import { Router } from 'express';
import type { Store } from '../store.js';

export function userRoutes(store: Store): Router {
  const router = Router();

  router.get('/:address/orders', async (req, res) => {
    const addr = req.params.address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return res.status(400).json({ error: 'invalid address' });
    }
    res.json(await store.ordersByTrader(addr));
  });

  return router;
}
