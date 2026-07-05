import { BatchStatusName, OrderTypeName } from '../abi.js';
import { logger } from '../logger.js';
import { emit } from '../sockets/socketManager.js';
import type { Store } from '../store.js';

type Args = Record<string, unknown>;

/**
 * Fold a single decoded DEX event into the store and push socket updates.
 * Idempotent per (event, id) so backfill and live watching can overlap safely.
 */
export async function handleEvent(
  store: Store,
  eventName: string,
  args: Args,
  txHash: string | null,
): Promise<void> {
  const batchId = args.batchId !== undefined ? String(args.batchId) : undefined;

  switch (eventName) {
    case 'BatchOpened': {
      if (!batchId) return;
      const startTime = Number(args.startTime);
      const duration = Number(args.duration);
      const batch = await store.upsertBatch({
        batchId,
        status: 'Open',
        startTime,
        endTime: startTime + duration,
      });
      emit.batchUpdate(batch);
      break;
    }
    case 'OrderSubmitted': {
      if (!batchId) return;
      const orderId = String(args.orderId);
      const side = OrderTypeName[Number(args.orderType)] ?? 'Buy';
      await store.insertOrder({
        orderId,
        batchId,
        trader: String(args.trader),
        side,
        filled: false,
        txHash,
      });
      const current = await store.getBatch(batchId);
      const batch = await store.upsertBatch({
        batchId,
        orderCount: (current?.orderCount ?? 0) + 1,
      });
      emit.orderNew({ orderId, batchId, trader: String(args.trader), side, filled: false });
      emit.batchUpdate(batch);
      break;
    }
    case 'BatchClosed': {
      if (!batchId) return;
      emit.batchUpdate(await store.upsertBatch({ batchId, status: 'Closed' }));
      break;
    }
    case 'ClearingPending': {
      if (!batchId) return;
      emit.batchUpdate(await store.upsertBatch({ batchId, status: 'Clearing' }));
      break;
    }
    case 'BatchCleared': {
      if (!batchId) return;
      const batch = await store.upsertBatch({
        batchId,
        status: 'Cleared',
        clearingTick: Number(args.clearingTick),
        matchedVolume: String(args.matchedVolume),
      });
      emit.batchCleared(batch);
      emit.batchUpdate(batch);
      break;
    }
    case 'OrderFilled': {
      const orderId = String(args.orderId);
      await store.markFilled(orderId);
      emit.orderFilled({ orderId, batchId, trader: String(args.trader) });
      break;
    }
    case 'BatchSettled': {
      if (!batchId) return;
      const batch = await store.upsertBatch({ batchId, status: 'Settled' });
      emit.batchSettled(batch);
      emit.batchUpdate(batch);
      break;
    }
    default:
      logger.debug('unhandled event', { eventName });
  }
}

export { BatchStatusName };
