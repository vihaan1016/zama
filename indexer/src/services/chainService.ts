import { createPublicClient, http, type PublicClient, type Log } from 'viem';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { dexEventsAbi } from '../abi.js';
import { handleEvent } from './indexerService.js';
import type { Store } from '../store.js';

export const publicClient: PublicClient = createPublicClient({
  transport: http(config.RPC_URL),
});

const ZERO = '0x0000000000000000000000000000000000000000';

type DecodedLog = Log & { eventName?: string; args?: Record<string, unknown> };

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
    const logs = (await publicClient.getContractEvents({
      address,
      abi: dexEventsAbi,
      fromBlock: config.START_BLOCK,
      toBlock: 'latest',
    })) as DecodedLog[];
    logger.info('backfill fetched', { count: logs.length });
    await process(store, logs);
  } catch (err) {
    logger.error('backfill failed', { err: String(err) });
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
