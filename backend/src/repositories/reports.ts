import pg from 'pg';
import { query } from '../config/db.js';
import { GeminiAnalysis } from '../schemas/analysis.js';

export interface ReportRecord {
  id: string;
  incident_id: string;
  reporter_id: string;
  claim: 'BLOCKED' | 'CLEAR' | 'UNCERTAIN';
  description: string;
  photo_key: string;
  photo_sha256: string;
  content_type: 'image/jpeg' | 'image/png';
  byte_count: number;
  latitude: number;
  longitude: number;
  location_mode: string;
  observed_at: string;
  received_at: string;
  analysis_status: 'PENDING' | 'COMPLETE' | 'FAILED';
  analysis_model: string | null;
  analysis_json: GeminiAnalysis | null;
  analysis_error_code: string | null;
  analysis_attempts: number;
  excluded_from_quorum: boolean;
  exclusion_note: string | null;
  reporter_name?: string;
  signed_photo_url?: string;
}

export async function findReportBySha256(sha256: string): Promise<ReportRecord | null> {
  const res = await query<ReportRecord>(
    `SELECT * FROM routeshield.reports WHERE photo_sha256 = $1 LIMIT 1;`,
    [sha256.toLowerCase()]
  );
  return res.rows[0] || null;
}

export async function findReportById(id: string): Promise<ReportRecord | null> {
  const res = await query<ReportRecord>(
    `SELECT r.*, u.display_name as reporter_name
     FROM routeshield.reports r
     JOIN routeshield.users u ON r.reporter_id = u.id
     WHERE r.id = $1
     LIMIT 1;`,
    [id]
  );
  return res.rows[0] || null;
}

export async function listReportsForIncident(incidentId: string): Promise<ReportRecord[]> {
  const res = await query<ReportRecord>(
    `SELECT r.*, u.display_name as reporter_name
     FROM routeshield.reports r
     JOIN routeshield.users u ON r.reporter_id = u.id
     WHERE r.incident_id = $1
     ORDER BY r.received_at DESC;`,
    [incidentId]
  );
  return res.rows;
}

export async function createReport(
  client: pg.PoolClient,
  data: {
    incidentId: string;
    reporterId: string;
    claim: 'BLOCKED' | 'CLEAR' | 'UNCERTAIN';
    description: string;
    photoKey: string;
    photoSha256: string;
    contentType: 'image/jpeg' | 'image/png';
    byteCount: number;
    latitude: number;
    longitude: number;
    observedAt: string;
  }
): Promise<ReportRecord> {
  const res = await client.query<ReportRecord>(
    `INSERT INTO routeshield.reports (
       incident_id, reporter_id, claim, description, photo_key, photo_sha256,
       content_type, byte_count, latitude, longitude, location_mode,
       observed_at, received_at, analysis_status, analysis_attempts
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SEGMENT_SELECTION', $11, now(), 'PENDING', 0)
     RETURNING *;`,
    [
      data.incidentId,
      data.reporterId,
      data.claim,
      data.description,
      data.photoKey,
      data.photoSha256,
      data.contentType,
      data.byteCount,
      data.latitude,
      data.longitude,
      data.observedAt,
    ]
  );
  return res.rows[0];
}

export async function updateReportAnalysis(
  client: pg.PoolClient,
  data: {
    id: string;
    status: 'COMPLETE' | 'FAILED';
    model: string | null;
    analysisJson: GeminiAnalysis | null;
    errorCode: string | null;
  }
): Promise<ReportRecord> {
  const res = await client.query<ReportRecord>(
    `UPDATE routeshield.reports
     SET analysis_status = $2,
         analysis_model = $3,
         analysis_json = $4,
         analysis_error_code = $5,
         analysis_attempts = analysis_attempts + 1
     WHERE id = $1
     RETURNING *;`,
    [
      data.id,
      data.status,
      data.model,
      data.analysisJson ? JSON.stringify(data.analysisJson) : null,
      data.errorCode,
    ]
  );
  return res.rows[0];
}

export async function setReportExclusion(
  client: pg.PoolClient,
  reportId: string,
  excluded: boolean,
  note: string
): Promise<ReportRecord> {
  const res = await client.query<ReportRecord>(
    `UPDATE routeshield.reports
     SET excluded_from_quorum = $2,
         exclusion_note = $3
     WHERE id = $1
     RETURNING *;`,
    [reportId, excluded, note]
  );
  return res.rows[0];
}
