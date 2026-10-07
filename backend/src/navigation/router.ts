import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import { validateBody, validateIdParam } from '../middleware/validate.js';
import { createReportSchema } from '../schemas/report.js';
import { verifyIncidentSchema } from '../schemas/verification.js';
import { processAndNormalizePhoto } from '../services/evidence.js';
import { analyzeEvidencePhoto, type AnalysisResult } from '../services/gemini.js';
import { getSignedPhotoUrl, uploadEvidencePhoto, removeEvidencePhoto, getEvidencePhotoBuffer } from '../config/storage.js';
import { AppError } from '../lib/errors.js';
import type { ReportRecord } from '../repositories/reports.js';
import { realRouteInput, computeWalkingRoutes, checkRealRoutes } from './google.js';
import { activeRealIncidents, lockRealIncident, realReports, realEvent, reconcileRealIncident, sameReportedLocation, verifyRealIncident, type RealIncidentRecord } from './incidents.js';

const router = Router();
const paidLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10, keyGenerator: (req: Request) => req.user!.id,
  standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Please wait before requesting more Google routes or image analyses.' } } });
const realReportInput = createReportSchema.omit({ edgeId: true }).extend({
  label: z.string().trim().min(1).max(120), latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180),
}).strict();
const location = (i: RealIncidentRecord) => ({ id: i.id, label: i.label, lat: i.latitude, lng: i.longitude, status: i.status,
  blockedGeneral: i.blocked_general, blockedStepFree: i.blocked_step_free, disputed: i.disputed, version: i.version, lastEvidenceAt: i.last_evidence_at });
router.get('/status', (_req: Request, res: Response) => res.json({ configured: Boolean(env.GOOGLE_MAPS_SERVER_API_KEY), provider: 'Google Routes API', travelMode: 'WALK', stepFreeVerified: false }));
router.post('/plan', requireAuth, paidLimiter, validateBody(realRouteInput), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const routes = await computeWalkingRoutes(req.body.origin, req.body.destination);
    const incidents = await activeRealIncidents(); // Refresh after Google's response.
    res.json({ ...checkRealRoutes(routes, incidents.map(location)), checkedAt: new Date().toISOString(), activeIncidentCount: incidents.length, provider: 'Google Routes API', travelMode: 'WALK' });
  } catch (error) { next(error); }
});
router.get('/incidents', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ incidents: (await activeRealIncidents()).map(location) }); } catch (error) { next(error); }
});
router.get('/incidents/:id', requireAuth, validateIdParam(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const i = (await query<RealIncidentRecord>('SELECT * FROM routeshield.real_incidents WHERE id=$1', [req.params.id])).rows[0];
    if (!i) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Real incident not found.');
    const reports = await realReports(i.id);
    const sanitized = await Promise.all(reports.map(async r => ({ id: r.id, reporterName: r.reporter_name, claim: r.claim, description: r.description,
      observedAt: r.observed_at, analysisStatus: r.analysis_status, analysisModel: r.analysis_model, analysisJson: r.analysis_json,
      analysisErrorCode: r.analysis_error_code, analysisAttempts: r.analysis_attempts, excludedFromQuorum: r.excluded_from_quorum,
      signedPhotoUrl: await getSignedPhotoUrl(r.photo_key).catch(() => null) })));
    res.json({ incident: { ...location(i), dismissedAt: i.dismissed_at, reports: sanitized } });
  } catch (error) { next(error); }
});
async function reserveRealAttempt(reportId: string) {
  const result = await query("UPDATE routeshield.real_reports SET analysis_attempts=analysis_attempts+1 WHERE id=$1 AND analysis_status='PENDING' AND analysis_attempts<3 RETURNING id", [reportId]);
  if (!result.rows.length) throw new Error('MAX_ATTEMPTS_EXCEEDED');
}
async function finishAnalysis(report: ReportRecord, result: AnalysisResult) {
  return withTransaction(async client => {
    await lockRealIncident(client, report.incident_id);
    await client.query('UPDATE routeshield.real_reports SET analysis_status=$2, analysis_model=$3, analysis_json=$4, analysis_error_code=$5 WHERE id=$1',
      [report.id, result.success ? 'COMPLETE' : 'FAILED', result.model, result.analysis ? JSON.stringify(result.analysis) : null, result.errorCode]);
    return reconcileRealIncident(client, report.incident_id);
  });
}
router.post('/reports', requireAuth, paidLimiter, handleUpload, async (req: Request, res: Response, next: NextFunction) => {
  let photoKey: string | null = null, saved = false;
  try {
    if (!req.file) throw new AppError(400, 'PHOTO_REQUIRED', 'Upload a JPEG or PNG photograph.');
    const parsed = realReportInput.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Select a real location, photograph, claim and observation time.', parsed.error.flatten());
    const input = parsed.data;
    const processed = await processAndNormalizePhoto(req.file.buffer, req.file.mimetype);
    const duplicate = await query('SELECT id FROM routeshield.real_reports WHERE photo_sha256=$1 UNION ALL SELECT id FROM routeshield.reports WHERE photo_sha256=$1 LIMIT 1', [processed.sha256Hex]);
    if (duplicate.rows.length) throw new AppError(409, 'DUPLICATE_PHOTO', 'This photograph was already submitted. It cannot corroborate another report.');
    photoKey = `real/${crypto.randomUUID()}.jpg`;
    await uploadEvidencePhoto(photoKey, processed.normalizedBuffer, processed.contentType);
    const uploadedKey = photoKey;
    const report = await withTransaction(async client => {
      // Serialize only real-incident creation; never locks a Maple Ward edge.
      await client.query('SELECT pg_advisory_xact_lock(74658112)');
      const candidates = await activeRealIncidents(client);
      let active = candidates.find(i => i.label.normalize('NFKC').trim().toLowerCase() === input.label.normalize('NFKC').trim().toLowerCase() && sameReportedLocation(i, input.latitude, input.longitude));
      if (input.incidentId) {
        active = candidates.find(i => i.id === input.incidentId);
        if (!active || !sameReportedLocation(active, input.latitude, input.longitude)) throw new AppError(409, 'INCIDENT_CHANGED', 'Select the same reported location for corroboration or clearance.');
      }
      if (input.claim === 'CLEAR' && !active) throw new AppError(400, 'NO_ACTIVE_INCIDENT', 'Clearance evidence requires an active incident at this location.');
      if (!active) {
        const closed = await client.query<RealIncidentRecord & { cleared_at: string }>("SELECT * FROM routeshield.real_incidents WHERE status='CLEARED' AND cleared_at >= $1 AND lower(label)=lower($2) ORDER BY cleared_at DESC LIMIT 1000", [input.observedAt, input.label]);
        if (closed.rows.some(i => sameReportedLocation(i, input.latitude, input.longitude))) throw new AppError(400, 'STALE_EVIDENCE', 'Submit an observation made after this path was last cleared.');
        active = (await client.query<RealIncidentRecord>('INSERT INTO routeshield.real_incidents(label,latitude,longitude,created_by) VALUES($1,$2,$3,$4) RETURNING *', [input.label, input.latitude, input.longitude, req.user!.id])).rows[0];
      }
      await lockRealIncident(client, active.id);
      const result = await client.query<ReportRecord>(`INSERT INTO routeshield.real_reports(incident_id,reporter_id,claim,description,photo_key,photo_sha256,content_type,byte_count,latitude,longitude,observed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [active.id, req.user!.id, input.claim, input.description, uploadedKey, processed.sha256Hex, processed.contentType, processed.byteCount, input.latitude, input.longitude, input.observedAt]);
      await client.query('UPDATE routeshield.real_incidents SET last_evidence_at=now(), updated_at=now(), version=version+1 WHERE id=$1', [active.id]);
      await realEvent(client, active, req.user!.id, 'EVIDENCE_RECEIVED', { reportId: result.rows[0].id, claim: input.claim });
      return result.rows[0];
    });
    saved = true;
    const result = await analyzeEvidencePhoto({ imageBuffer: processed.normalizedBuffer, mimeType: processed.contentType, edgeLabel: input.label,
      claim: input.claim, description: input.description, beforeAttempt: () => reserveRealAttempt(report.id) });
    const incident = await finishAnalysis(report, result);
    res.status(201).json({ reportId: report.id, incidentId: incident.id, incidentStatus: incident.status, analysisStatus: result.success ? 'COMPLETE' : 'FAILED', model: result.model, analysis: result.analysis, errorCode: result.errorCode });
  } catch (error) {
    if (photoKey && !saved) await removeEvidencePhoto(photoKey).catch(() => {});
    if ((error as { code?: string }).code === '23505') next(new AppError(409, 'DUPLICATE_PHOTO', 'This photograph was submitted concurrently.')); else next(error);
  }
});
router.post('/reports/:id/retry-analysis', requireAuth, paidLimiter, validateIdParam(), async (req: Request, res: Response, next: NextFunction) => {
  let reportId: string | null = null;
  try {
    const report = (await query<ReportRecord>('SELECT * FROM routeshield.real_reports WHERE id=$1', [req.params.id])).rows[0];
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Real report not found.');
    if (report.reporter_id !== req.user!.id && req.user!.role !== 'MODERATOR') throw new AppError(403, 'FORBIDDEN', 'Only the reporter or moderator can retry.');
    const claimed = await query("UPDATE routeshield.real_reports SET analysis_status='PENDING', analysis_error_code=NULL WHERE id=$1 AND analysis_status='FAILED' AND analysis_attempts<3 RETURNING id", [report.id]);
    if (!claimed.rows.length) throw new AppError(409, 'RETRY_UNAVAILABLE', 'Analysis is complete, running, or reached its three-attempt limit.');
    reportId = report.id;
    const incident = (await query<RealIncidentRecord>('SELECT * FROM routeshield.real_incidents WHERE id=$1', [report.incident_id])).rows[0];
    const result = await analyzeEvidencePhoto({ imageBuffer: await getEvidencePhotoBuffer(report.photo_key), mimeType: report.content_type, edgeLabel: incident.label,
      claim: report.claim, description: report.description, maxAttempts: 3 - report.analysis_attempts, beforeAttempt: () => reserveRealAttempt(report.id) });
    const updated = await finishAnalysis(report, result); reportId = null;
    res.json({ reportId: report.id, incidentId: updated.id, incidentStatus: updated.status, analysisStatus: result.success ? 'COMPLETE' : 'FAILED', model: result.model, analysis: result.analysis, errorCode: result.errorCode });
  } catch (error) {
    if (reportId) await query("UPDATE routeshield.real_reports SET analysis_status='FAILED', analysis_error_code='RETRY_FAILED' WHERE id=$1 AND analysis_status='PENDING'", [reportId]).catch(() => {});
    next(error);
  }
});
router.post('/incidents/:id/verify', requireAuth, requireModerator, validateIdParam(), validateBody(verifyIncidentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ incident: await withTransaction(client => verifyRealIncident(client, req.params.id, req.user!.id, req.body)) }); }
  catch (error) { next(error); }
});
export default router;
