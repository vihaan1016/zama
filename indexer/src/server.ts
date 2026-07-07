import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config, allowedOrigins } from './config.js';
import { logger } from './logger.js';
import { initSocket } from './sockets/socketManager.js';
import { startChainWatcher } from './services/chainService.js';
import { Store } from './store.js';
import healthRoutes from './routes/health.js';
import { batchRoutes } from './routes/batches.js';
import { userRoutes } from './routes/users.js';

async function main(): Promise<void> {
  const store = new Store();
  await store.init();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'] }));
  app.use(express.json());

  app.use('/api', healthRoutes);
  app.use('/api/batches', batchRoutes(store));
  app.use('/api/users', userRoutes(store));

  const httpServer = createServer(app);
  initSocket(httpServer);

  const unwatch = await startChainWatcher(store);

  httpServer.listen(config.PORT, () => logger.info(`indexer listening on :${config.PORT}`));

  const shutdown = (signal: string) => {
    logger.info(`received ${signal}, shutting down`);
    unwatch();
    httpServer.close(async () => {
      await store.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('fatal indexer error', {
    err: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    errors: err instanceof AggregateError ? err.errors.map((e) => String(e)) : undefined,
  });
  process.exit(1);
});
