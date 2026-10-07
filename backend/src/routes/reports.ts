import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import { validateBody } from '../middleware/validate.js';
import { createReportSchema, excludeReportSchema } from '../schemas/report.js';
import { processAndNormalizePhoto } from '../services/evidence.js';
import { uploadEvidencePhoto } from '../config/storage.js';
import { analyzeEvidencePhoto } from '../services/gemini.js';
import {
  findActiveIncidentByEdgeId,
  createIncident,
  findIncidentById,
  lockEdgeRow,
  touchIncidentEvidenceTime,
} from '../repositories/incidents.js';
import {
  createReport,
  findReportById,
  findReportBySha256,
  updateReportAnalysis,
  setReportExclusion,
} from '../repositories/reports.js';
import { evaluateIncidentState } from '../services/incidents.js';
import { getAllNodes, getEdgeById } from '../repositories/network.js';
import { withTransaction, query } from '../config/db.js';

const router = Router();

// Rate limiting: 10 reports per 10 min
const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REPORTS',
      message: 'Report submission rate limit reached. Please wait a few minutes before submitting another report.',
    },
  },
});

router.post(
  '/',
  requireAuth,
  reportLimiter,
  handleUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: {
            code: 'PHOTO_REQUIRED',
            message: 'A photograph is required as visual evidence',
          },
        });
        return;
      }

      // Validate textual body fields
      const parsedBody = createReportSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid report data',
            details: parsedBody.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }

      const { edgeId, claim, description, observedAt } = parsedBody.data;
      const reporterId = req.user!.id;

      // 1. Process and normalize image
      const processed = await processAndNormalizePhoto(req.file.buffer, req.file.mimetype);

      // 2. Check duplicate photo hash
      const duplicate = await findReportBySha256(processed.sha256Hex);
      if (duplicate) {
        res.status(409).json({
          error: {
            code: 'DUPLICATE_PHOTO',
            message: 'This exact photograph has already been submitted as evidence',
            details: {
              existingIncidentId: duplicate.incident_id,
              existingReportId: duplicate.id,
            },
          },
        });
        return;
      }

      // 3. Verify edge and calculate segment midpoint
      const edge = await getEdgeById(edgeId);
      if (!edge) {
        res.status(400).json({
          error: {
            code: 'INVALID_EDGE',
            message: 'Selected pedestrian segment does not exist',
          },
        });
        return;
      }

      const allNodes = await getAllNodes();
      const fromNode = allNodes.find((n) => n.id === edge.from_node);
      const toNode = allNodes.find((n) => n.id === edge.to_node);
      const midLat = fromNode && toNode ? (fromNode.latitude + toNode.latitude) / 2 : 12.0;
      const midLng = fromNode && toNode ? (fromNode.longitude + toNode.longitude) / 2 : 77.0;

      // 4. Stale clearance check
      const lastClearedRes = await query(
        `SELECT cleared_at FROM routeshield.incidents
         WHERE edge_id = $1 AND status = 'CLEARED'
         ORDER BY cleared_at DESC LIMIT 1;`,
        [edgeId]
      );
      if (lastClearedRes.rows.length > 0) {
        const clearedAt = new Date(lastClearedRes.rows[0].cleared_at).getTime();
        const obsTime = new Date(observedAt).getTime();
        if (obsTime <= clearedAt) {
          const activeCheck = await findActiveIncidentByEdgeId(query as any, edgeId);
          if (!activeCheck) {
            res.status(400).json({
              error: {
                code: 'STALE_EVIDENCE',
                message: 'This segment was previously cleared after the claimed observation time. Please submit a fresh observation.',
              },
            });
            return;
          }
        }
      }

      // Check active incident for CLEAR claim requirement
      const existingActive = await findActiveIncidentByEdgeId(query as any, edgeId);
      if (claim === 'CLEAR' && !existingActive) {
        res.status(400).json({
          error: {
            code: 'NO_ACTIVE_INCIDENT',
            message: 'A CLEAR claim requires an existing active incident on this segment to review clearance',
          },
        });
        return;
      }

      // 5. Store image in private Supabase Storage
      const photoKey = `${Date.now()}-${crypto.randomUUID()}.jpg`;
      await uploadEvidencePhoto(photoKey, processed.normalizedBuffer, processed.contentType);

      // 6. DB Transaction 1: Create incident (if not active) and attach PENDING report
      const { createdReport, targetIncidentId } = await withTransaction(async (client) => {
        await lockEdgeRow(client, edgeId);

        let activeInc = await findActiveIncidentByEdgeId(client, edgeId);
        if (!activeInc) {
          activeInc = await createIncident(client, {
            edgeId,
            createdBy: reporterId,
          });
        }

        const report = await createReport(client, {
          incidentId: activeInc.id,
          reporterId,
          claim,
          description,
          photoKey,
          photoSha256: processed.sha256Hex,
          contentType: processed.contentType,
          byteCount: processed.byteCount,
          latitude: midLat,
          longitude: midLng,
          observedAt,
        });

        await touchIncidentEvidenceTime(client, activeInc.id);

        return { createdReport: report, targetIncidentId: activeInc.id };
      });

      // 7. Gemini Multimodal AI call OUTSIDE transaction
      const analysisResult = await analyzeEvidencePhoto({
        imageBuffer: processed.normalizedBuffer,
        mimeType: processed.contentType,
        edgeLabel: edge.name,
        claim,
        description,
      });

      // 8. DB Transaction 2: Persist analysis outcome and evaluate incident status
      const updatedIncident = await withTransaction(async (client) => {
        await updateReportAnalysis(client, {
          id: createdReport.id,
          status: analysisResult.success ? 'COMPLETE' : 'FAILED',
          model: analysisResult.model,
          analysisJson: analysisResult.analysis,
          errorCode: analysisResult.errorCode,
        });

        return evaluateIncidentState(client, targetIncidentId);
      });

      res.status(201).json({
        reportId: createdReport.id,
        incidentId: targetIncidentId,
        analysisStatus: analysisResult.success ? 'COMPLETE' : 'FAILED',
        incidentStatus: updatedIncident.status,
        analysis: analysisResult.analysis,
        errorCode: analysisResult.errorCode,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Retry analysis for failed report
router.post('/:id/retry-analysis', requireAuth, async (req, res, next) => {
  try {
    const reportId = req.params.id as string;
    const report = await findReportById(reportId);

    if (!report) {
      res.status(404).json({
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found',
        },
      });
      return;
    }

    // Only report owner or moderator can retry
    if (report.reporter_id !== req.user!.id && req.user!.role !== 'MODERATOR') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the reporter or a moderator may retry analysis for this report',
        },
      });
      return;
    }

    if (report.analysis_attempts >= 3) {
      res.status(400).json({
        error: {
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum lifetime analysis attempts (3) reached for this report',
        },
      });
      return;
    }

    const incident = await findIncidentById(report.incident_id);
    const edge = incident ? await getEdgeById(incident.edge_id) : null;

    // Retry Gemini inference
    // Note: in local mock/fallback or storage fetch
    const analysisResult = await analyzeEvidencePhoto({
      imageBuffer: Buffer.alloc(0), // If storage client is configured or fallback
      mimeType: report.content_type,
      edgeLabel: edge?.name || 'Pedestrian Link',
      claim: report.claim,
      description: report.description,
    });

    const updatedIncident = await withTransaction(async (client) => {
      await updateReportAnalysis(client, {
        id: report.id,
        status: analysisResult.success ? 'COMPLETE' : 'FAILED',
        model: analysisResult.model,
        analysisJson: analysisResult.analysis,
        errorCode: analysisResult.errorCode,
      });

      return evaluateIncidentState(client, report.incident_id);
    });

    res.status(200).json({
      reportId: report.id,
      analysisStatus: analysisResult.success ? 'COMPLETE' : 'FAILED',
      incidentStatus: updatedIncident.status,
      analysis: analysisResult.analysis,
      errorCode: analysisResult.errorCode,
    });
  } catch (err) {
    next(err);
  }
});

// Moderator: exclude report from quorum
router.post(
  '/:id/exclude',
  requireAuth,
  requireModerator,
  validateBody(excludeReportSchema),
  async (req, res, next) => {
    try {
      const reportId = req.params.id as string;
      const { reason } = req.body;

      const report = await findReportById(reportId);
      if (!report) {
        res.status(404).json({
          error: {
            code: 'REPORT_NOT_FOUND',
            message: 'Report not found',
          },
        });
        return;
      }

      const updatedIncident = await withTransaction(async (client) => {
        await setReportExclusion(client, reportId, true, reason);
        return evaluateIncidentState(client, report.incident_id);
      });

      res.status(200).json({
        message: 'Report excluded from quorum successfully',
        reportId,
        incidentStatus: updatedIncident.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
