import pg from 'pg';
import { query } from '../config/db.js';

export interface IncidentRecord {
  id: string;
  edge_id: string;
  created_by: string;
  status: 'UNVERIFIED' | 'CONFIRMED_BLOCKED' | 'CLEARED';
  blocked_general: boolean;
  blocked_step_free: boolean;
  disputed: boolean;
  requires_review: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  last_evidence_at: string;
  confirmed_at: string | null;
  cleared_at: string | null;
  dismissed_at: string | null;
  moderation_note: string | null;
  edge_name?: string;
}

export async function lockEdgeRow(client: pg.PoolClient, edgeId: string): Promise<void> {
  await client.query(
    `SELECT id FROM routeshield.edges WHERE id = $1 FOR UPDATE;`,
    [edgeId]
  );
}

export async function findActiveIncidentByEdgeId(
  clientOrPool: any,
  edgeId: string
): Promise<IncidentRecord | null> {
  const doQuery =
    typeof clientOrPool === 'function'
      ? clientOrPool
      : clientOrPool && typeof clientOrPool.query === 'function'
      ? (text: string, params?: any[]) => clientOrPool.query(text, params)
      : query;

  const res = await doQuery(
    `SELECT i.*, e.name as edge_name
     FROM routeshield.incidents i
     JOIN routeshield.edges e ON i.edge_id = e.id
     WHERE i.edge_id = $1 AND i.status <> 'CLEARED' AND i.dismissed_at IS NULL
     LIMIT 1;`,
    [edgeId]
  );
  return res.rows[0] || null;
}

export async function findIncidentById(id: string): Promise<IncidentRecord | null> {
  const res = await query<IncidentRecord>(
    `SELECT i.*, e.name as edge_name
     FROM routeshield.incidents i
     JOIN routeshield.edges e ON i.edge_id = e.id
     WHERE i.id = $1
     LIMIT 1;`,
    [id]
  );
  return res.rows[0] || null;
}

export async function listIncidents(filters: {
  status?: string;
  edgeId?: string;
}, client?: pg.PoolClient): Promise<IncidentRecord[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`i.status = $${params.length}`);
  }

  if (filters.edgeId) {
    params.push(filters.edgeId);
    conditions.push(`i.edge_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await (client ? client.query.bind(client) : query)<IncidentRecord>(
    `SELECT i.*, e.name as edge_name
     FROM routeshield.incidents i
     JOIN routeshield.edges e ON i.edge_id = e.id
     ${whereClause}
     ORDER BY i.updated_at DESC;`,
    params
  );
  return res.rows;
}

export async function createIncident(
  client: pg.PoolClient,
  data: {
    edgeId: string;
    createdBy: string;
  }
): Promise<IncidentRecord> {
  const res = await client.query<IncidentRecord>(
    `INSERT INTO routeshield.incidents (
       edge_id, created_by, status, blocked_general, blocked_step_free,
       disputed, requires_review, version, created_at, updated_at, last_evidence_at
     )
     VALUES ($1, $2, 'UNVERIFIED', false, false, false, false, 1, now(), now(), now())
     RETURNING *;`,
    [data.edgeId, data.createdBy]
  );
  return res.rows[0];
}

export async function updateIncidentState(
  client: pg.PoolClient,
  data: {
    id: string;
    status: 'UNVERIFIED' | 'CONFIRMED_BLOCKED' | 'CLEARED';
    blockedGeneral: boolean;
    blockedStepFree: boolean;
    disputed: boolean;
    requiresReview: boolean;
    confirmedAt?: string | null;
    clearedAt?: string | null;
    dismissedAt?: string | null;
    moderationNote?: string | null;
    expectedVersion?: number;
  }
): Promise<IncidentRecord> {
  let versionClause = '';
  const params: any[] = [
    data.id,
    data.status,
    data.blockedGeneral,
    data.blockedStepFree,
    data.disputed,
    data.requiresReview,
    data.confirmedAt || null,
    data.clearedAt || null,
    data.dismissedAt || null,
    data.moderationNote || null,
  ];

  if (data.expectedVersion !== undefined) {
    params.push(data.expectedVersion);
    versionClause = `AND version = $${params.length}`;
  }

  const res = await client.query<IncidentRecord>(
    `UPDATE routeshield.incidents
     SET status = $2,
         blocked_general = $3,
         blocked_step_free = $4,
         disputed = $5,
         requires_review = $6,
         confirmed_at = $7,
         cleared_at = $8,
         dismissed_at = $9,
         moderation_note = $10,
         version = version + 1,
         updated_at = now()
     WHERE id = $1 ${versionClause}
     RETURNING *;`,
    params
  );

  if (res.rows.length === 0) {
    throw new Error('STALE_VERSION_OR_NOT_FOUND');
  }

  return res.rows[0];
}

export async function touchIncidentEvidenceTime(
  client: pg.PoolClient,
  incidentId: string
): Promise<void> {
  await client.query(
    `UPDATE routeshield.incidents
     SET last_evidence_at = now(),
         updated_at = now(), version = version + 1
     WHERE id = $1;`,
    [incidentId]
  );
}
