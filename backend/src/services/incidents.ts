import pg from 'pg';
import {
  lockEdgeRow,
  updateIncidentState,
  IncidentRecord,
} from '../repositories/incidents.js';
import {
  listReportsForIncident,
  ReportRecord,
} from '../repositories/reports.js';
import { createIncidentEvent } from '../repositories/events.js';
import { AppError } from '../lib/errors.js';
import { VerifyIncidentInput } from '../schemas/verification.js';

export function isFreshReport(report: ReportRecord): boolean {
  return [report.observed_at, report.received_at].every(value => {
    const age = Date.now() - new Date(value).getTime();
    return Number.isFinite(age) && age >= -5 * 60_000 && age <= 30 * 60_000;
  });
}

export function hasUsableObstruction(report: ReportRecord): boolean {
  const a = report.analysis_json;
  return !report.excluded_from_quorum && report.analysis_status === 'COMPLETE' && !!a &&
    a.evidence_quality !== 'UNUSABLE' && a.description_consistency !== 'CONFLICTS' &&
    !['NONE', 'UNKNOWN'].includes(a.obstruction_type) && report.claim !== 'CLEAR';
}

export function isQualifyingBlockReport(report: ReportRecord): boolean {
  const a = report.analysis_json;
  return hasUsableObstruction(report) && isFreshReport(report) && !!a &&
    a.evidence_quality === 'CLEAR' && a.visible_extent === 'FULL_WIDTH' &&
    a.passability.general_walk === 'BLOCKED' && a.passability.step_free === 'BLOCKED';
}

export function isQualifyingClearReport(report: ReportRecord): boolean {
  const a = report.analysis_json;
  return !report.excluded_from_quorum && report.claim === 'CLEAR' &&
    report.analysis_status === 'COMPLETE' && !!a && isFreshReport(report) &&
    a.evidence_quality === 'CLEAR' && a.obstruction_type === 'NONE' &&
    a.visible_extent === 'NONE' && a.passability.general_walk === 'APPEARS_CLEAR' &&
    a.passability.step_free === 'APPEARS_CLEAR' && a.description_consistency !== 'CONFLICTS';
}

// All mutation paths acquire the edge before the incident, preventing lock inversion.
export async function lockIncident(client: pg.PoolClient, incidentId: string): Promise<IncidentRecord> {
  const lookup = await client.query<IncidentRecord>('SELECT * FROM routeshield.incidents WHERE id = $1', [incidentId]);
  if (!lookup.rows[0]) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  await lockEdgeRow(client, lookup.rows[0].edge_id);
  const result = await client.query<IncidentRecord>('SELECT * FROM routeshield.incidents WHERE id = $1 FOR UPDATE', [incidentId]);
  return result.rows[0];
}

export async function evaluateIncidentState(
  client: pg.PoolClient,
  incidentId: string
): Promise<IncidentRecord> {
  const incident = await lockIncident(client, incidentId);

  if (incident.status === 'CLEARED' || incident.dismissed_at) {
    return incident;
  }

  const reports = await listReportsForIncident(incidentId, client);

  // Group latest report per account
  const latestByAccount = new Map<string, ReportRecord>();
  for (const report of reports) {
    if (!latestByAccount.has(report.reporter_id)) {
      latestByAccount.set(report.reporter_id, report);
    }
  }

  const qualifyingBlockAccounts: { accountId: string; sha256: string }[] = [];
  let hasQualifyingClear = false;

  for (const [accountId, report] of latestByAccount.entries()) {
    if (isQualifyingClearReport(report)) {
      hasQualifyingClear = true;
    }
    if (isQualifyingBlockReport(report)) {
      qualifyingBlockAccounts.push({
        accountId,
        sha256: report.photo_sha256,
      });
    }
  }

  // Ensure 2 distinct accounts and 2 distinct photo hashes
  const distinctHashes = new Set(qualifyingBlockAccounts.map((a) => a.sha256));
  const hasCorroboratingBlocks =
    qualifyingBlockAccounts.length >= 2 && distinctHashes.size >= 2;

  let newStatus = incident.status;
  let blockedGeneral = incident.blocked_general;
  let blockedStepFree = incident.blocked_step_free;
  let disputed = incident.disputed;
  let requiresReview = incident.requires_review || reports.some(r => !r.excluded_from_quorum && (r.analysis_status === 'FAILED' || r.analysis_json?.description_consistency === 'CONFLICTS' || r.analysis_json?.evidence_quality === 'UNUSABLE'));
  let confirmedAt = incident.confirmed_at;

  // Clear evidence requires review, never auto-clears
  if (hasQualifyingClear) {
    requiresReview = true;
    if (incident.status === 'CONFIRMED_BLOCKED' || hasCorroboratingBlocks) {
      disputed = true;
    }
  }

  // Check automated community corroboration
  if (
    incident.status === 'UNVERIFIED' &&
    hasCorroboratingBlocks &&
    !hasQualifyingClear
  ) {
    newStatus = 'CONFIRMED_BLOCKED';
    blockedGeneral = true;
    blockedStepFree = true;
    confirmedAt = new Date().toISOString();

    await createIncidentEvent(client, {
      incidentId: incident.id,
      actorId: null, // automated backend action
      fromStatus: incident.status,
      toStatus: newStatus,
      reasonCode: 'COMMUNITY_CORROBORATION',
      metadata: {
        distinctAccountsCount: qualifyingBlockAccounts.length,
        qualifyingReportsCount: distinctHashes.size,
        basis: '2+ qualifying reports from distinct accounts with distinct photo hashes within 30m',
      },
    });
  }

  return updateIncidentState(client, {
    id: incident.id,
    status: newStatus,
    blockedGeneral,
    blockedStepFree,
    disputed,
    requiresReview,
    confirmedAt,
    clearedAt: incident.cleared_at,
    dismissedAt: incident.dismissed_at,
    moderationNote: incident.moderation_note,
  });
}

export async function verifyIncidentAsModerator(
  client: pg.PoolClient,
  incidentId: string,
  moderatorId: string,
  input: VerifyIncidentInput
): Promise<IncidentRecord> {
  const incident = await lockIncident(client, incidentId);
  if (incident.status === 'CLEARED' || incident.dismissed_at) {
    throw new AppError(409, 'INCIDENT_CLOSED', 'This incident is closed. Submit a fresh report for a new obstruction.');
  }
  if (incident.version !== input.expectedVersion) {
    throw new AppError(409, 'CONFLICT', 'Incident changed. Refresh and review the latest evidence.');
  }

  if (input.action === 'DISMISS') {
    if (incident.status !== 'UNVERIFIED') {
      throw new AppError(400, 'INVALID_MODERATION_ACTION', 'Dismissal is only permitted for UNVERIFIED incidents');
    }
    const updated = await updateIncidentState(client, {
      id: incident.id,
      status: 'UNVERIFIED',
      blockedGeneral: false,
      blockedStepFree: false,
      disputed: false,
      requiresReview: false,
      dismissedAt: new Date().toISOString(),
      moderationNote: input.reason,
      confirmedAt: incident.confirmed_at,
      clearedAt: incident.cleared_at,
      expectedVersion: input.expectedVersion,
    });

    await createIncidentEvent(client, {
      incidentId: incident.id,
      actorId: moderatorId,
      fromStatus: incident.status,
      toStatus: 'UNVERIFIED',
      reasonCode: 'MODERATOR_DISMISSED',
      metadata: { reason: input.reason },
    });
    return updated;
  }

  if (input.action === 'CLEAR') {
    // Requires fresh qualifying clear evidence and attestation
    const reports = await listReportsForIncident(incident.id, client);
    const evidence = reports.find(r => r.id === input.evidenceReportId);
    if (input.attestation !== true || !evidence || !isQualifyingClearReport(evidence)) {
      throw new AppError(400, 'INVALID_CLEARANCE_EVIDENCE', 'Select fresh qualifying clear evidence and attest that the entire segment was checked.');
    }

    const updated = await updateIncidentState(client, {
      id: incident.id,
      status: 'CLEARED',
      blockedGeneral: false,
      blockedStepFree: false,
      disputed: false,
      requiresReview: false,
      confirmedAt: incident.confirmed_at,
      clearedAt: new Date().toISOString(),
      moderationNote: input.reason,
      expectedVersion: input.expectedVersion,
    });

    await createIncidentEvent(client, {
      incidentId: incident.id,
      actorId: moderatorId,
      fromStatus: incident.status,
      toStatus: 'CLEARED',
      reasonCode: 'MODERATOR_CLEARED',
      metadata: {
        reason: input.reason,
        attestation: true,
        evidenceReportId: input.evidenceReportId,
      },
    });
    return updated;
  }

  if (input.action === 'CONFIRM_BLOCKED') {
    const blockedGeneral = input.blockedProfiles?.includes('GENERAL_WALK') || false;
    const blockedStepFree = input.blockedProfiles?.includes('STEP_FREE') || false;

    const reports = await listReportsForIncident(incident.id, client);
    const evidence = reports.find(r => r.id === input.evidenceReportId);
    if ((!blockedGeneral && !blockedStepFree) || !evidence || !hasUsableObstruction(evidence) || !isFreshReport(evidence) ||
      (blockedGeneral && evidence.analysis_json!.passability.general_walk !== 'BLOCKED') ||
      (blockedStepFree && !['BLOCKED', 'UNCERTAIN'].includes(evidence.analysis_json!.passability.step_free))) {
      throw new AppError(400, 'INVALID_BLOCK_EVIDENCE', 'Select fresh usable obstruction evidence supporting every affected profile.');
    }

    const updated = await updateIncidentState(client, {
      id: incident.id,
      status: 'CONFIRMED_BLOCKED',
      blockedGeneral,
      blockedStepFree,
      disputed: false,
      requiresReview: false,
      confirmedAt: incident.confirmed_at || new Date().toISOString(),
      clearedAt: incident.cleared_at,
      moderationNote: input.reason,
      expectedVersion: input.expectedVersion,
    });

    await createIncidentEvent(client, {
      incidentId: incident.id,
      actorId: moderatorId,
      fromStatus: incident.status,
      toStatus: 'CONFIRMED_BLOCKED',
      reasonCode: 'MODERATOR_CONFIRMED',
      metadata: {
        reason: input.reason,
        blockedProfiles: input.blockedProfiles,
        evidenceReportId: input.evidenceReportId,
      },
    });
    return updated;
  }

  throw new Error(`Unsupported moderation action: ${input.action}`);
}
