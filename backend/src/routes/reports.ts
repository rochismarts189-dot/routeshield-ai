import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import { validateBody, validateIdParam } from '../middleware/validate.js';
import { createReportSchema, excludeReportSchema } from '../schemas/report.js';
import { processAndNormalizePhoto } from '../services/evidence.js';
import { uploadEvidencePhoto, getEvidencePhotoBuffer, removeEvidencePhoto } from '../config/storage.js';
import { analyzeEvidencePhoto, AnalysisResult } from '../services/gemini.js';
import { findActiveIncidentByEdgeId, createIncident, findIncidentById, lockEdgeRow, touchIncidentEvidenceTime } from '../repositories/incidents.js';
import { createReport, findReportById, findReportBySha256, updateReportAnalysis, setReportExclusion, reserveProviderAttempt } from '../repositories/reports.js';
import { createIncidentEvent } from '../repositories/events.js';
import { evaluateIncidentState, lockIncident } from '../services/incidents.js';
import { getAllNodes, getEdgeById } from '../repositories/network.js';
import { withTransaction, query } from '../config/db.js';
import { AppError } from '../lib/errors.js';

const router = Router();
const reportLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REPORTS', message: 'Please wait before submitting more evidence.' } } });
const accountLimiter = rateLimit({ windowMs: 10 * 60_000, max: 5, keyGenerator: req => req.user!.id,
  standardHeaders: true, legacyHeaders: false, message: { error: { code: 'TOO_MANY_REPORTS', message: 'Your evidence limit is reached. Please wait ten minutes.' } } });

async function finalize(reportId: string, incidentId: string, result: AnalysisResult) {
  return withTransaction(async client => {
    await lockIncident(client, incidentId);
    await updateReportAnalysis(client, { id: reportId, status: result.success ? 'COMPLETE' : 'FAILED', model: result.model,
      analysisJson: result.analysis, errorCode: result.errorCode });
    return evaluateIncidentState(client, incidentId);
  });
}

router.post('/', requireAuth, reportLimiter, accountLimiter, handleUpload, async (req, res, next) => {
  let uploadedKey: string | null = null;
  let saved = false;
  try {
    if (!req.file) throw new AppError(400, 'PHOTO_REQUIRED', 'A JPEG or PNG photograph is required.');
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid report data', parsed.error.flatten());
    const { edgeId, incidentId, claim, description, observedAt } = parsed.data;
    const processed = await processAndNormalizePhoto(req.file.buffer, req.file.mimetype);
    const duplicate = await findReportBySha256(processed.sha256Hex);
    if (duplicate) throw new AppError(409, 'DUPLICATE_PHOTO', 'This photograph was already submitted.', { existingIncidentId: duplicate.incident_id });
    const edge = await getEdgeById(edgeId);
    if (!edge) throw new AppError(400, 'INVALID_EDGE', 'Select a known pedestrian segment.');
    const nodes = await getAllNodes();
    const from = nodes.find(n => n.id === edge.from_node)!;
    const to = nodes.find(n => n.id === edge.to_node)!;
    if (!from || !to) throw new AppError(503, 'NETWORK_INCOMPLETE', 'The demonstration network needs its migrations.');
    uploadedKey = `${crypto.randomUUID()}.jpg`;
    await uploadEvidencePhoto(uploadedKey, processed.normalizedBuffer, processed.contentType);
    const photoKey = uploadedKey;
    const report = await withTransaction(async client => {
      await lockEdgeRow(client, edgeId);
      let active = await findActiveIncidentByEdgeId(client, edgeId);
      if (incidentId && active?.id !== incidentId) throw new AppError(409, 'INCIDENT_CHANGED', 'The selected incident is no longer active. Refresh before submitting.');
      if (claim === 'CLEAR' && !active) throw new AppError(400, 'NO_ACTIVE_INCIDENT', 'Clearance evidence requires an active incident.');
      if (!active) {
        const last = await client.query('SELECT cleared_at FROM routeshield.incidents WHERE edge_id = $1 AND status = $2 ORDER BY cleared_at DESC LIMIT 1', [edgeId, 'CLEARED']);
        if (last.rows[0] && new Date(observedAt).getTime() <= new Date(last.rows[0].cleared_at).getTime()) {
          throw new AppError(400, 'STALE_EVIDENCE', 'Submit an observation made after this segment was last cleared.');
        }
        active = await createIncident(client, { edgeId, createdBy: req.user!.id });
      }
      const created = await createReport(client, { incidentId: active.id, reporterId: req.user!.id, claim, description, photoKey,
        photoSha256: processed.sha256Hex, contentType: processed.contentType, byteCount: processed.byteCount,
        latitude: (Number(from.latitude) + Number(to.latitude)) / 2, longitude: (Number(from.longitude) + Number(to.longitude)) / 2, observedAt });
      await touchIncidentEvidenceTime(client, active.id);
      await createIncidentEvent(client, { incidentId: active.id, actorId: req.user!.id, fromStatus: active.status,
        toStatus: active.status, reasonCode: 'EVIDENCE_RECEIVED', metadata: { reportId: created.id, claim } });
      return created;
    });
    saved = true;
    const result = await analyzeEvidencePhoto({ imageBuffer: processed.normalizedBuffer, mimeType: processed.contentType,
      edgeLabel: edge.name, claim, description, beforeAttempt: () => reserveProviderAttempt(report.id) });
    const incident = await finalize(report.id, report.incident_id, result);
    res.status(201).json({ reportId: report.id, incidentId: incident.id, analysisStatus: result.success ? 'COMPLETE' : 'FAILED',
      incidentStatus: incident.status, analysis: result.analysis, errorCode: result.errorCode });
  } catch (err: any) {
    if (uploadedKey && !saved) await removeEvidencePhoto(uploadedKey).catch(() => console.warn('Evidence cleanup failed'));
    if (err.code === '23505') next(new AppError(409, 'DUPLICATE_PHOTO', 'This evidence was submitted concurrently. Refresh the incident list.'));
    else next(err);
  }
});

router.post('/:id/retry-analysis', requireAuth, validateIdParam(), accountLimiter, async (req, res, next) => {
  let claimedId: string | null = null;
  try {
    const report = await findReportById(req.params.id);
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
    if (report.reporter_id !== req.user!.id && req.user!.role !== 'MODERATOR') throw new AppError(403, 'FORBIDDEN', 'Only the reporter or moderator can retry.');
    const claimed = await query(`UPDATE routeshield.reports SET analysis_status = 'PENDING', analysis_error_code = NULL
      WHERE id = $1 AND analysis_status = 'FAILED' AND analysis_attempts < 3 RETURNING id`, [report.id]);
    if (!claimed.rows.length) throw new AppError(409, 'RETRY_UNAVAILABLE', 'Analysis is complete, already running, or reached its three-attempt limit.');
    claimedId = report.id;
    const incident = await findIncidentById(report.incident_id);
    const edge = await getEdgeById(incident!.edge_id);
    const buffer = await getEvidencePhotoBuffer(report.photo_key);
    const result = await analyzeEvidencePhoto({ imageBuffer: buffer, mimeType: report.content_type, edgeLabel: edge!.name,
      claim: report.claim, description: report.description, maxAttempts: 3 - report.analysis_attempts,
      beforeAttempt: () => reserveProviderAttempt(report.id) });
    const updated = await finalize(report.id, report.incident_id, result);
    claimedId = null;
    res.json({ reportId: report.id, analysisStatus: result.success ? 'COMPLETE' : 'FAILED', incidentStatus: updated.status,
      analysis: result.analysis, errorCode: result.errorCode });
  } catch (err) {
    if (claimedId) await query("UPDATE routeshield.reports SET analysis_status = 'FAILED', analysis_error_code = 'RETRY_FAILED' WHERE id = $1 AND analysis_status = 'PENDING'", [claimedId]).catch(() => {});
    next(err);
  }
});

router.post('/:id/exclude', requireAuth, requireModerator, validateIdParam(), validateBody(excludeReportSchema), async (req, res, next) => {
  try {
    const report = await findReportById(req.params.id);
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
    const incident = await withTransaction(async client => {
      const current = await lockIncident(client, report.incident_id);
      await setReportExclusion(client, report.id, true, req.body.reason);
      await createIncidentEvent(client, { incidentId: current.id, actorId: req.user!.id, fromStatus: current.status,
        toStatus: current.status, reasonCode: 'EVIDENCE_EXCLUDED', metadata: { reportId: report.id, reason: req.body.reason } });
      return evaluateIncidentState(client, current.id);
    });
    res.json({ message: 'Evidence excluded from corroboration', reportId: report.id, incidentStatus: incident.status });
  } catch (err) { next(err); }
});
export default router;
