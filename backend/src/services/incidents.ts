import pg from 'pg';
import {
  findActiveIncidentByEdgeId,
  createIncident,
  updateIncidentState,
  IncidentRecord,
} from '../repositories/incidents.js';
import {
  listReportsForIncident,
  ReportRecord,
  setReportExclusion,
} from '../repositories/reports.js';
import { createIncidentEvent } from '../repositories/events.js';
import { VerifyIncidentInput } from '../schemas/verification.js';

export function isQualifyingBlockReport(report: ReportRecord): boolean {
  if (report.excluded_from_quorum) return false;
  if (report.analysis_status !== 'COMPLETE' || !report.analysis_json) return false;

  const analysis = report.analysis_json;
  const isWithin30Min = (dateStr: string) => {
    const diff = Math.abs(Date.now() - new Date(dateStr).getTime());
    return diff <= 30 * 60 * 1000;
  };

  if (!isWithin30Min(report.observed_at) || !isWithin30Min(report.received_at)) {
    return false;
  }

  if (analysis.evidence_quality !== 'CLEAR') return false;
  if (analysis.visible_extent !== 'FULL_WIDTH') return false;
  if (analysis.passability.general_walk !== 'BLOCKED') return false;
  if (analysis.passability.step_free !== 'BLOCKED') return false;
  if (analysis.description_consistency === 'CONFLICTS') return false;

  return true;
}

export function isQualifyingClearReport(report: ReportRecord): boolean {
  if (report.excluded_from_quorum) return false;
  if (report.claim !== 'CLEAR') return false;
  if (report.analysis_status !== 'COMPLETE' || !report.analysis_json) return false;

  const analysis = report.analysis_json;
  const isWithin30Min = (dateStr: string) => {
    const diff = Math.abs(Date.now() - new Date(dateStr).getTime());
    return diff <= 30 * 60 * 1000;
  };

  if (!isWithin30Min(report.observed_at) || !isWithin30Min(report.received_at)) {
    return false;
  }

  if (analysis.evidence_quality !== 'CLEAR') return false;
  if (analysis.obstruction_type !== 'NONE') return false;
  if (analysis.visible_extent !== 'NONE') return false;
  if (analysis.passability.general_walk !== 'APPEARS_CLEAR') return false;
  if (analysis.passability.step_free !== 'APPEARS_CLEAR') return false;
  if (analysis.description_consistency === 'CONFLICTS') return false;

  return true;
}

export async function evaluateIncidentState(
  client: pg.PoolClient,
  incidentId: string
): Promise<IncidentRecord> {
  const incidentRes = await client.query<IncidentRecord>(
    `SELECT * FROM routeshield.incidents WHERE id = $1 FOR UPDATE;`,
    [incidentId]
  );
  const incident = incidentRes.rows[0];
  if (!incident) throw new Error('Incident not found');

  if (incident.status === 'CLEARED' || incident.dismissed_at) {
    return incident;
  }

  const reports = await listReportsForIncident(incidentId);

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
  let requiresReview = incident.requires_review;
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
  const incidentRes = await client.query<IncidentRecord>(
    `SELECT * FROM routeshield.incidents WHERE id = $1 FOR UPDATE;`,
    [incidentId]
  );
  const incident = incidentRes.rows[0];
  if (!incident) throw new Error('Incident not found');

  if (incident.version !== input.expectedVersion) {
    const error = new Error('Incident state has been modified by another action. Please refresh.');
    (error as any).code = 'CONFLICT';
    throw error;
  }

  if (input.action === 'DISMISS') {
    if (incident.status !== 'UNVERIFIED') {
      throw new Error('Dismissal is only permitted for UNVERIFIED incidents');
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
    const reports = await listReportsForIncident(incident.id);
    const qualifyingClears = reports.filter(isQualifyingClearReport);

    if (qualifyingClears.length === 0) {
      throw new Error('Clearing requires fresh qualifying clear evidence adhering to strict clear standards');
    }

    const updated = await updateIncidentState(client, {
      id: incident.id,
      status: 'CLEARED',
      blockedGeneral: false,
      blockedStepFree: false,
      disputed: false,
      requiresReview: false,
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
        evidenceReportId: input.evidenceReportId || qualifyingClears[0].id,
      },
    });
    return updated;
  }

  if (input.action === 'CONFIRM_BLOCKED') {
    const blockedGeneral = input.blockedProfiles?.includes('GENERAL_WALK') || false;
    const blockedStepFree = input.blockedProfiles?.includes('STEP_FREE') || false;

    if (!blockedGeneral && !blockedStepFree) {
      throw new Error('At least one profile must be blocked for confirmation');
    }

    const updated = await updateIncidentState(client, {
      id: incident.id,
      status: 'CONFIRMED_BLOCKED',
      blockedGeneral,
      blockedStepFree,
      disputed: false,
      requiresReview: false,
      confirmedAt: new Date().toISOString(),
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
