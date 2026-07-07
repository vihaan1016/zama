import { config } from './config.js';
import { logger } from './logger.js';
import { startMetricsServer } from './metrics.js';
import { KeeperDb } from './db.js';
import { Keeper } from './keeper.js';

async function main(): Promise<void> {
  startMetricsServer(config.metricsPort);

  const db = new KeeperDb(config.databaseUrl);
  await db.init();

  const keeper = new Keeper(config, db);

  const shutdown = async (signal: string) => {
    logger.info(`received ${signal}, shutting down`);
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await keeper.start();
}

main().catch((err) => {
  console.error('fatal keeper error', err);
  process.exit(1);
});
