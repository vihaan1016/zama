import pg from 'pg';
import { logger } from './logger.js';

/**
 * Optional operational persistence for the keeper. Stores only lifecycle bookkeeping
 * (batch ids, timings, tx hashes) — never order contents, which stay encrypted on-chain.
 * When DATABASE_URL is unset the keeper runs fully in-memory.
 */
export class KeeperDb {
  private pool: pg.Pool | null;

  constructor(databaseUrl?: string) {
    this.pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }) : null;
  }

  get enabled(): boolean {
    return this.pool !== null;
  }

  async init(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS batch_events (
        id           BIGSERIAL PRIMARY KEY,
        batch_id     BIGINT      NOT NULL,
        event        TEXT        NOT NULL,
        tx_hash      TEXT,
        detail       JSONB,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS batch_events_batch_id_idx ON batch_events (batch_id);
    `);
    logger.info('keeper database initialised');
  }

  async record(batchId: bigint, event: string, txHash?: string, detail?: unknown): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'INSERT INTO batch_events (batch_id, event, tx_hash, detail) VALUES ($1, $2, $3, $4)',
        [batchId.toString(), event, txHash ?? null, detail ? JSON.stringify(detail) : null],
      );
    } catch (err) {
      logger.warn('failed to record batch event', { err: String(err) });
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
