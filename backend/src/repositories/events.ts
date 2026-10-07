import pg from 'pg';
import { query } from '../config/db.js';

export interface IncidentEventRecord {
  id: string;
  incident_id: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string;
  reason_code: string;
  metadata: any;
  created_at: string;
  actor_name?: string | null;
}

export async function createIncidentEvent(
  client: pg.PoolClient,
  data: {
    incidentId: string;
    actorId?: string | null;
    fromStatus: string | null;
    toStatus: string;
    reasonCode: string;
    metadata?: any;
  }
): Promise<IncidentEventRecord> {
  const res = await client.query<IncidentEventRecord>(
    `INSERT INTO routeshield.incident_events (
       incident_id, actor_id, from_status, to_status, reason_code, metadata, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING *;`,
    [
      data.incidentId,
      data.actorId || null,
      data.fromStatus,
      data.toStatus,
      data.reasonCode,
      JSON.stringify(data.metadata || {}),
    ]
  );
  return res.rows[0];
}

export async function listEventsForIncident(incidentId: string): Promise<IncidentEventRecord[]> {
  const res = await query<IncidentEventRecord>(
    `SELECT e.*, u.display_name as actor_name
     FROM routeshield.incident_events e
     LEFT JOIN routeshield.users u ON e.actor_id = u.id
     WHERE e.incident_id = $1
     ORDER BY e.created_at ASC, e.id ASC;`,
    [incidentId]
  );
  return res.rows;
}
