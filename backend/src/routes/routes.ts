import { withTransaction } from '../config/db.js';
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

    const plan = await withTransaction(async client => {
    const [nodes, edges, allIncidents] = await Promise.all([
      getAllNodes(client),
      getAllEdges(client),
      listIncidents({}, client),
    ]);

    // Active incidents
    const activeIncidents = allIncidents.filter(
      (i) => i.status !== 'CLEARED' && !i.dismissed_at
    );

    // Fetch reports for active incidents
    const reportsMap = new Map<string, ReportRecord[]>();
    await Promise.all(
      activeIncidents.map(async (inc) => {
        const reps = await listReportsForIncident(inc.id, client);
        reportsMap.set(inc.id, reps);
      })
    );

    return planRoute(
      originId,
      destinationId,
      profile,
      nodes,
      edges,
      activeIncidents,
      reportsMap
    );

    }, true);
    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
});

export default router;
