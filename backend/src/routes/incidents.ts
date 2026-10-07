import { Router } from 'express';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { verifyIncidentSchema } from '../schemas/verification.js';
import {
  listIncidents,
  findIncidentById,
} from '../repositories/incidents.js';
import { listReportsForIncident } from '../repositories/reports.js';
import { listEventsForIncident } from '../repositories/events.js';
import { getSignedPhotoUrl } from '../config/storage.js';
import { verifyIncidentAsModerator } from '../services/incidents.js';
import { withTransaction } from '../config/db.js';
import { z } from 'zod';

const router = Router();

const listQuerySchema = z.object({
  status: z.enum(['UNVERIFIED', 'CONFIRMED_BLOCKED', 'CLEARED']).optional(),
  edgeId: z.string().optional(),
});

// GET /incidents - Public sanitized list
router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { status, edgeId } = req.query as any;
    const incidents = await listIncidents({ status, edgeId });

    // Sanitize and attach evidence count
    const sanitized = await Promise.all(
      incidents.map(async (inc) => {
        const reports = await listReportsForIncident(inc.id);
        const distinctReporters = new Set(reports.map((r) => r.reporter_id)).size;

        return {
          id: inc.id,
          edgeId: inc.edge_id,
          edgeName: inc.edge_name,
          status: inc.status,
          blockedGeneral: inc.blocked_general,
          blockedStepFree: inc.blocked_step_free,
          disputed: inc.disputed,
          requiresReview: inc.requires_review,
          version: inc.version,
          createdAt: inc.created_at,
          updatedAt: inc.updated_at,
          lastEvidenceAt: inc.last_evidence_at,
          confirmedAt: inc.confirmed_at,
          clearedAt: inc.cleared_at,
          dismissedAt: inc.dismissed_at,
          moderationNote: inc.moderation_note,
          reportsCount: reports.length,
          distinctAccountsCount: distinctReporters,
        };
      })
    );

    res.status(200).json({ incidents: sanitized });
  } catch (err) {
    next(err);
  }
});

// GET /incidents/:id - Public sanitized detailed incident
router.get('/:id', async (req, res, next) => {
  try {
    const incidentId = req.params.id;
    const incident = await findIncidentById(incidentId);

    if (!incident) {
      res.status(404).json({
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: 'Incident not found',
        },
      });
      return;
    }

    const [reports, events] = await Promise.all([
      listReportsForIncident(incidentId),
      listEventsForIncident(incidentId),
    ]);

    // Sign photo URLs with short expiration (1 hour)
    const sanitizedReports = await Promise.all(
      reports.map(async (rep) => {
        let signedUrl = '';
        try {
          signedUrl = await getSignedPhotoUrl(rep.photo_key, 3600);
        } catch {
          signedUrl = `/placeholder/${rep.photo_key}`;
        }

        return {
          id: rep.id,
          reporterName: rep.reporter_name || 'Community Member',
          claim: rep.claim,
          description: rep.description,
          signedPhotoUrl: signedUrl,
          contentType: rep.content_type,
          byteCount: rep.byte_count,
          latitude: rep.latitude,
          longitude: rep.longitude,
          observedAt: rep.observed_at,
          receivedAt: rep.received_at,
          analysisStatus: rep.analysis_status,
          analysisModel: rep.analysis_model,
          analysisJson: rep.analysis_json,
          analysisErrorCode: rep.analysis_error_code,
          analysisAttempts: rep.analysis_attempts,
          excludedFromQuorum: rep.excluded_from_quorum,
          exclusionNote: rep.exclusion_note,
        };
      })
    );

    const distinctReporters = new Set(reports.map((r) => r.reporter_id)).size;

    // Determine confirmation basis if confirmed
    const confirmationEvent = events.find((e) => e.to_status === 'CONFIRMED_BLOCKED');
    const confirmationBasis = confirmationEvent
      ? confirmationEvent.reason_code === 'COMMUNITY_CORROBORATION'
        ? 'Automated community corroboration (2+ distinct accounts & photographs)'
        : `Moderator confirmed (${confirmationEvent.metadata?.reason || 'Verified field obstruction'})`
      : null;

    res.status(200).json({
      incident: {
        id: incident.id,
        edgeId: incident.edge_id,
        edgeName: incident.edge_name,
        status: incident.status,
        blockedGeneral: incident.blocked_general,
        blockedStepFree: incident.blocked_step_free,
        disputed: incident.disputed,
        requiresReview: incident.requires_review,
        version: incident.version,
        createdAt: incident.created_at,
        updatedAt: incident.updated_at,
        lastEvidenceAt: incident.last_evidence_at,
        confirmedAt: incident.confirmed_at,
        clearedAt: incident.cleared_at,
        dismissedAt: incident.dismissed_at,
        moderationNote: incident.moderation_note,
        distinctAccountsCount: distinctReporters,
        confirmationBasis,
        reports: sanitizedReports,
        events: events.map((e) => ({
          id: e.id,
          actorName: e.actor_name || 'RouteShield System',
          fromStatus: e.from_status,
          toStatus: e.to_status,
          reasonCode: e.reason_code,
          metadata: e.metadata,
          createdAt: e.created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /incidents/:id/verify - Moderator only verification
router.post(
  '/:id/verify',
  requireAuth,
  requireModerator,
  validateBody(verifyIncidentSchema),
  async (req, res, next) => {
    try {
      const incidentId = req.params.id as string;
      const moderatorId = req.user!.id;
      const input = req.body;

      const updatedIncident = await withTransaction(async (client) => {
        return verifyIncidentAsModerator(client, incidentId, moderatorId, input);
      });

      res.status(200).json({
        message: `Incident successfully updated to ${updatedIncident.status}`,
        incident: {
          id: updatedIncident.id,
          status: updatedIncident.status,
          blockedGeneral: updatedIncident.blocked_general,
          blockedStepFree: updatedIncident.blocked_step_free,
          version: updatedIncident.version,
          confirmedAt: updatedIncident.confirmed_at,
          clearedAt: updatedIncident.cleared_at,
          dismissedAt: updatedIncident.dismissed_at,
        },
      });
    } catch (err: any) {
      if (err.message === 'STALE_VERSION_OR_NOT_FOUND' || (err as any).code === 'CONFLICT') {
        res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: 'Incident was modified concurrently by another action. Please refresh and review latest state.',
          },
        });
        return;
      }

      if (
        err.message?.includes('Clearing requires') ||
        err.message?.includes('Dismissal is only') ||
        err.message?.includes('At least one profile') ||
        err.message?.includes('Unsupported moderation action')
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_MODERATION_ACTION',
            message: err.message,
          },
        });
        return;
      }

      next(err);
    }
  }
);

export default router;
