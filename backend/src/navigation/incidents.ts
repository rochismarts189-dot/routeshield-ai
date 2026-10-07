import type pg from 'pg';
import { query } from '../config/db.js';
import type { ReportRecord } from '../repositories/reports.js';
import { isQualifyingBlockReport, isQualifyingClearReport, hasUsableObstruction, isFreshReport } from '../services/incidents.js';
import type { VerifyIncidentInput } from '../schemas/verification.js';
import { AppError } from '../lib/errors.js';
import { distanceToPathMeters } from './geometry.js';

export interface RealIncidentRecord {
  id: string; label: string; latitude: number; longitude: number; status: 'UNVERIFIED' | 'CONFIRMED_BLOCKED' | 'CLEARED';
  blocked_general: boolean; blocked_step_free: boolean; disputed: boolean; requires_review: boolean;
  version: number; last_evidence_at: string; dismissed_at: string | null;
}
export async function realReports(id: string, client?: pg.PoolClient): Promise<ReportRecord[]> {
  return (await (client ? client.query.bind(client) : query)<ReportRecord>(`SELECT r.*, u.display_name AS reporter_name FROM routeshield.real_reports r JOIN routeshield.users u ON u.id=r.reporter_id WHERE r.incident_id=$1 ORDER BY r.received_at DESC, r.id DESC`, [id])).rows;
}
export async function activeRealIncidents(client?: pg.PoolClient): Promise<RealIncidentRecord[]> {
  const rows = (await (client ? client.query.bind(client) : query)<RealIncidentRecord>(`SELECT * FROM routeshield.real_incidents WHERE status <> 'CLEARED' AND dismissed_at IS NULL ORDER BY updated_at DESC LIMIT 1001`)).rows;
  if (rows.length > 1000) throw new AppError(503, 'INCIDENT_CHECK_CAPACITY', 'Real incident coverage cannot be checked completely right now. No clear-route claim is available.');
  return rows;
}
export async function lockRealIncident(client: pg.PoolClient, id: string) {
  const result = await client.query<RealIncidentRecord>('SELECT * FROM routeshield.real_incidents WHERE id=$1 FOR UPDATE', [id]);
  if (!result.rows[0]) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Real incident not found.');
  return result.rows[0];
}
export async function realEvent(client: pg.PoolClient, incident: RealIncidentRecord, actor: string | null, reason: string, metadata: object, toStatus = incident.status) {
  await client.query('INSERT INTO routeshield.real_incident_events(incident_id, actor_id, from_status, to_status, reason_code, metadata) VALUES($1,$2,$3,$4,$5,$6)', [incident.id, actor, incident.status, toStatus, reason, JSON.stringify(metadata)]);
}
export async function reconcileRealIncident(client: pg.PoolClient, id: string) {
  const incident = await lockRealIncident(client, id);
  if (incident.status === 'CLEARED' || incident.dismissed_at) return incident;
  const reports = await realReports(id, client);
  const latest = new Map<string, ReportRecord>();
  reports.forEach(report => { if (!latest.has(report.reporter_id)) latest.set(report.reporter_id, report); });
  const blocks = [...latest.values()].filter(isQualifyingBlockReport);
  const clear = [...latest.values()].some(isQualifyingClearReport);
  const corroborated = blocks.length >= 2 && new Set(blocks.map(r => r.photo_sha256)).size >= 2;
  const confirm = incident.status === 'UNVERIFIED' && corroborated && !clear;
  const requiresReview = incident.requires_review || clear || reports.some(r => r.analysis_status === 'FAILED' || r.analysis_json?.description_consistency === 'CONFLICTS' || r.analysis_json?.evidence_quality === 'UNUSABLE');
  if (confirm) await realEvent(client, incident, null, 'COMMUNITY_CORROBORATION', { distinctAccounts: blocks.length, distinctPhotos: new Set(blocks.map(r => r.photo_sha256)).size }, 'CONFIRMED_BLOCKED');
  const result = await client.query<RealIncidentRecord>(`UPDATE routeshield.real_incidents SET status=$2, blocked_general=$3, blocked_step_free=$4,
    confirmed_at=CASE WHEN $5 THEN now() ELSE confirmed_at END, disputed=$6, requires_review=$7, version=version+1, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, confirm ? 'CONFIRMED_BLOCKED' : incident.status, confirm || incident.blocked_general, confirm || incident.blocked_step_free, confirm, incident.disputed || (clear && (corroborated || incident.status === 'CONFIRMED_BLOCKED')), requiresReview]);
  return result.rows[0];
}
export async function verifyRealIncident(client: pg.PoolClient, id: string, actor: string, input: VerifyIncidentInput) {
  const incident = await lockRealIncident(client, id);
  if (incident.status === 'CLEARED' || incident.dismissed_at) throw new AppError(409, 'INCIDENT_CLOSED', 'This incident is closed.');
  if (input.expectedVersion !== incident.version) throw new AppError(409, 'CONFLICT', 'Refresh and review the latest evidence.');
  const report = (await realReports(id, client)).find(r => r.id === input.evidenceReportId);
  let status: RealIncidentRecord['status'] = incident.status;
  let general = false, stepFree = false;
  if (input.action === 'DISMISS') {
    if (incident.status !== 'UNVERIFIED') throw new AppError(400, 'INVALID_MODERATION_ACTION', 'Only unverified incidents can be dismissed.');
  } else if (input.action === 'CLEAR') {
    if (!input.attestation || !report || !isQualifyingClearReport(report)) throw new AppError(400, 'INVALID_CLEARANCE_EVIDENCE', 'Fresh qualifying clearance evidence and whole-path attestation are required.');
    status = 'CLEARED';
  } else {
    general = input.blockedProfiles?.includes('GENERAL_WALK') ?? false;
    stepFree = input.blockedProfiles?.includes('STEP_FREE') ?? false;
    if ((!general && !stepFree) || !report || !hasUsableObstruction(report) || !isFreshReport(report) ||
      (general && report.analysis_json?.passability.general_walk !== 'BLOCKED') ||
      (stepFree && !['BLOCKED', 'UNCERTAIN'].includes(report.analysis_json!.passability.step_free))) throw new AppError(400, 'INVALID_BLOCK_EVIDENCE', 'Select fresh analyzed evidence supporting the affected profiles.');
    status = 'CONFIRMED_BLOCKED';
  }
  await realEvent(client, incident, actor, `MODERATOR_${input.action}`, { reason: input.reason, evidenceReportId: input.evidenceReportId, attestation: input.attestation }, status);
  return (await client.query<RealIncidentRecord>(`UPDATE routeshield.real_incidents SET status=$2, blocked_general=$3, blocked_step_free=$4,
    confirmed_at=CASE WHEN $2='CONFIRMED_BLOCKED' THEN COALESCE(confirmed_at,now()) ELSE confirmed_at END,
    cleared_at=CASE WHEN $2='CLEARED' THEN now() ELSE NULL END, dismissed_at=CASE WHEN $5 THEN now() ELSE NULL END,
    requires_review=false, disputed=false, moderation_note=$6, version=version+1, updated_at=now() WHERE id=$1 RETURNING *`, [id, status, general, stepFree, input.action === 'DISMISS', input.reason])).rows[0];
}
export function sameReportedLocation(a: RealIncidentRecord, latitude: number, longitude: number) {
  return distanceToPathMeters({ lat: latitude, lng: longitude }, [{ lat: a.latitude, lng: a.longitude }, { lat: a.latitude, lng: a.longitude }]) <= 15;
}
