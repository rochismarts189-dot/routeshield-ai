import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { planRouteSchema } from '../schemas/route.js';
import { getAllNodes, getAllEdges } from '../repositories/network.js';
import { listIncidents } from '../repositories/incidents.js';
import { listReportsForIncident, ReportRecord } from '../repositories/reports.js';
import { planRoute } from '../services/routing.js';

const router = Router();

router.post('/plan', validateBody(planRouteSchema), async (req, res, next) => {
  try {
    const { originId, destinationId, profile } = req.body;

    const [nodes, edges, allIncidents] = await Promise.all([
      getAllNodes(),
      getAllEdges(),
      listIncidents({}),
    ]);

    // Active incidents
    const activeIncidents = allIncidents.filter(
      (i) => i.status !== 'CLEARED' && !i.dismissed_at
    );

    // Fetch reports for active incidents
    const reportsMap = new Map<string, ReportRecord[]>();
    await Promise.all(
      activeIncidents.map(async (inc) => {
        const reps = await listReportsForIncident(inc.id);
        reportsMap.set(inc.id, reps);
      })
    );

    const plan = planRoute(
      originId,
      destinationId,
      profile,
      nodes,
      edges,
      activeIncidents,
      reportsMap
    );

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
});

export default router;
