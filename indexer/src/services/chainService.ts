import { createPublicClient, http, type PublicClient, type Log } from 'viem';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { BatchStatusName, dexEventsAbi, dexReadAbi } from '../abi.js';
import { handleEvent } from './indexerService.js';
import type { Store } from '../store.js';

export const publicClient: PublicClient = createPublicClient({
  transport: http(config.RPC_URL),
});

const ZERO = '0x0000000000000000000000000000000000000000';

type DecodedLog = Log & { eventName?: string; args?: Record<string, unknown> };
type ContractBatch = Record<string, unknown> | readonly unknown[];

function batchField(batch: ContractBatch, key: string, index: number): unknown {
  if (Array.isArray(batch)) return batch[index];
  return (batch as Record<string, unknown>)[key];
}

async function process(store: Store, logs: DecodedLog[]): Promise<void> {
  for (const log of logs) {
    if (!log.eventName) continue;
    try {
      await handleEvent(store, log.eventName, log.args ?? {}, log.transactionHash ?? null);
    } catch (err) {
      logger.error('event handling failed', { event: log.eventName, err: String(err) });
    }
  }
}

async function backfill(store: Store, address: `0x${string}`): Promise<void> {
  const latest = await publicClient.getBlockNumber();
  let fromBlock = config.START_BLOCK;
  if (fromBlock === 0n) {
    fromBlock = latest > 100n ? latest - 100n : 0n;
  }
  let count = 0;
  const step = BigInt(config.BACKFILL_BLOCK_RANGE);

  while (fromBlock <= latest) {
    const toBlock = fromBlock + step - 1n > latest ? latest : fromBlock + step - 1n;
    const logs = (await publicClient.getContractEvents({
      address,
      abi: dexEventsAbi,
      fromBlock,
      toBlock,
    })) as DecodedLog[];
    count += logs.length;
    await process(store, logs);
    fromBlock = toBlock + 1n;
  }

  logger.info('backfill fetched', {
    count,
    fromBlock: config.START_BLOCK.toString(),
    toBlock: latest.toString(),
    range: config.BACKFILL_BLOCK_RANGE,
  });
}

async function snapshotCurrentBatch(store: Store, address: `0x${string}`): Promise<void> {
  const batch = (await publicClient.readContract({
    address,
    abi: dexReadAbi,
    functionName: 'getCurrentBatch',
  })) as unknown as ContractBatch;

  const batchId = String(batchField(batch, 'batchId', 0));
  if (batchId === '0') return;

  const statusIndex = Number(batchField(batch, 'status', 3));
  const status = BatchStatusName[statusIndex] ?? 'Open';
  const hasClearingResult = statusIndex >= 3;

  const row = await store.upsertBatch({
    batchId,
    status,
    startTime: Number(batchField(batch, 'startTime', 1)),
    endTime: Number(batchField(batch, 'endTime', 2)),
    clearingTick: hasClearingResult ? Number(batchField(batch, 'clearingPrice', 4)) : null,
    matchedVolume: hasClearingResult ? String(batchField(batch, 'matchedVolume', 5)) : null,
    orderCount: Number(batchField(batch, 'orderCount', 6)),
  });

  logger.info('current batch snapshot stored', { batchId: row.batchId, status: row.status, orderCount: row.orderCount });
}

/**
 * Backfill historical events from START_BLOCK, then watch live.
 * @returns an unwatch function for graceful shutdown.
 */
export async function startChainWatcher(store: Store): Promise<() => void> {
  if (config.DEX_ADDRESS === ZERO) {
    logger.warn('DEX_ADDRESS not set — chain watcher idle (set it to start indexing)');
    return () => {};
  }
  const address = config.DEX_ADDRESS as `0x${string}`;
  logger.info('chain watcher starting', { dex: address, chainId: config.CHAIN_ID });

  // Backfill.
  try {
    await backfill(store, address);
  } catch (err) {
    logger.error('backfill failed', { err: String(err) });
  }

  try {
    await snapshotCurrentBatch(store, address);
  } catch (err) {
    logger.error('current batch snapshot failed', { err: String(err) });
  }

  // Live watch (all events in the ABI).
  const unwatch = publicClient.watchContractEvent({
    address,
    abi: dexEventsAbi,
    onLogs: (logs) => void process(store, logs as DecodedLog[]),
    onError: (err) => logger.error('watch error', { err: String(err) }),
  });

  return unwatch;
}
