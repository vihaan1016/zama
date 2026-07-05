import { Router } from 'express';
import type { Store } from '../store.js';

export function batchRoutes(store: Store): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await store.listBatches(50));
  });

  router.get('/current', async (_req, res) => {
    const batch = await store.currentBatch();
    if (!batch) return res.status(404).json({ error: 'no batches yet' });
    res.json(batch);
  });

  router.get('/:id', async (req, res) => {
    const batch = await store.getBatch(req.params.id);
    if (!batch) return res.status(404).json({ error: 'batch not found' });
    const orders = await store.ordersByBatch(req.params.id);
    res.json({ ...batch, orders });
  });

  return router;
}
