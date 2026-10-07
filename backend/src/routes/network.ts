import { Router } from 'express';
import { getAllNodes, getAllEdges } from '../repositories/network.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [nodes, edges] = await Promise.all([
      getAllNodes(),
      getAllEdges(),
    ]);

    res.status(200).json({
      nodes,
      edges,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
