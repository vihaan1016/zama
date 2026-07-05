import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

export interface BatchRow {
  batchId: string;
  status: string;
  startTime: number | null;
  endTime: number | null;
  clearingTick: number | null;
  matchedVolume: string | null;
  orderCount: number;
}

export interface OrderRow {
  orderId: string;
  batchId: string;
  trader: string;
  side: string;
  filled: boolean;
  txHash: string | null;
}

/**
 * Persistence for indexed state. Metadata only — never order price/size, which
 * stay encrypted on-chain. Uses Postgres when DATABASE_URL is set, otherwise an
 * in-memory store so the indexer runs standalone in dev.
 */
export class Store {
  private pool: pg.Pool | null;
  private batches = new Map<string, BatchRow>();
  private orders = new Map<string, OrderRow>();

  constructor() {
    this.pool = config.DATABASE_URL ? new pg.Pool({ connectionString: config.DATABASE_URL }) : null;
  }

  async init(): Promise<void> {
    if (!this.pool) {
      logger.warn('DATABASE_URL unset — using in-memory store');
      return;
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS batches (
        batch_id      BIGINT PRIMARY KEY,
        status        TEXT NOT NULL,
        start_time    BIGINT,
        end_time      BIGINT,
        clearing_tick INTEGER,
        matched_volume TEXT,
        order_count   INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS orders (
        order_id  BIGINT PRIMARY KEY,
        batch_id  BIGINT NOT NULL,
        trader    TEXT NOT NULL,
        side      TEXT NOT NULL,
        filled    BOOLEAN NOT NULL DEFAULT FALSE,
        tx_hash   TEXT
      );
      CREATE INDEX IF NOT EXISTS orders_batch_idx ON orders (batch_id);
      CREATE INDEX IF NOT EXISTS orders_trader_idx ON orders (lower(trader));
    `);
    logger.info('store initialised (postgres)');
  }

  async upsertBatch(b: Partial<BatchRow> & { batchId: string }): Promise<BatchRow> {
    const existing = (await this.getBatch(b.batchId)) ?? {
      batchId: b.batchId,
      status: 'Open',
      startTime: null,
      endTime: null,
      clearingTick: null,
      matchedVolume: null,
      orderCount: 0,
    };
    const merged: BatchRow = { ...existing, ...b };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO batches (batch_id, status, start_time, end_time, clearing_tick, matched_volume, order_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (batch_id) DO UPDATE SET
           status=$2, start_time=$3, end_time=$4, clearing_tick=$5, matched_volume=$6, order_count=$7`,
        [merged.batchId, merged.status, merged.startTime, merged.endTime, merged.clearingTick, merged.matchedVolume, merged.orderCount],
      );
    } else {
      this.batches.set(merged.batchId, merged);
    }
    return merged;
  }

  async getBatch(batchId: string): Promise<BatchRow | null> {
    if (this.pool) {
      const r = await this.pool.query('SELECT * FROM batches WHERE batch_id=$1', [batchId]);
      return r.rows[0] ? rowToBatch(r.rows[0]) : null;
    }
    return this.batches.get(batchId) ?? null;
  }

  async listBatches(limit = 50): Promise<BatchRow[]> {
    if (this.pool) {
      const r = await this.pool.query('SELECT * FROM batches ORDER BY batch_id DESC LIMIT $1', [limit]);
      return r.rows.map(rowToBatch);
    }
    return [...this.batches.values()].sort((a, b) => Number(BigInt(b.batchId) - BigInt(a.batchId))).slice(0, limit);
  }

  async currentBatch(): Promise<BatchRow | null> {
    const all = await this.listBatches(1);
    return all[0] ?? null;
  }

  async insertOrder(o: OrderRow): Promise<void> {
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO orders (order_id, batch_id, trader, side, filled, tx_hash)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (order_id) DO NOTHING`,
        [o.orderId, o.batchId, o.trader, o.side, o.filled, o.txHash],
      );
    } else {
      if (!this.orders.has(o.orderId)) this.orders.set(o.orderId, o);
    }
  }

  async markFilled(orderId: string): Promise<void> {
    if (this.pool) {
      await this.pool.query('UPDATE orders SET filled=TRUE WHERE order_id=$1', [orderId]);
    } else {
      const o = this.orders.get(orderId);
      if (o) o.filled = true;
    }
  }

  async ordersByBatch(batchId: string): Promise<OrderRow[]> {
    if (this.pool) {
      const r = await this.pool.query('SELECT * FROM orders WHERE batch_id=$1 ORDER BY order_id', [batchId]);
      return r.rows.map(rowToOrder);
    }
    return [...this.orders.values()].filter((o) => o.batchId === batchId);
  }

  async ordersByTrader(trader: string): Promise<OrderRow[]> {
    if (this.pool) {
      const r = await this.pool.query('SELECT * FROM orders WHERE lower(trader)=lower($1) ORDER BY order_id DESC', [trader]);
      return r.rows.map(rowToOrder);
    }
    return [...this.orders.values()].filter((o) => o.trader.toLowerCase() === trader.toLowerCase());
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}

function rowToBatch(r: Record<string, unknown>): BatchRow {
  return {
    batchId: String(r.batch_id),
    status: String(r.status),
    startTime: r.start_time !== null ? Number(r.start_time) : null,
    endTime: r.end_time !== null ? Number(r.end_time) : null,
    clearingTick: r.clearing_tick !== null ? Number(r.clearing_tick) : null,
    matchedVolume: r.matched_volume !== null ? String(r.matched_volume) : null,
    orderCount: Number(r.order_count),
  };
}

function rowToOrder(r: Record<string, unknown>): OrderRow {
  return {
    orderId: String(r.order_id),
    batchId: String(r.batch_id),
    trader: String(r.trader),
    side: String(r.side),
    filled: Boolean(r.filled),
    txHash: r.tx_hash !== null ? String(r.tx_hash) : null,
  };
}
