import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { dexAbi, BatchStatus } from './abi.js';
import type { Config } from './config.js';
import { logger } from './logger.js';
import { metrics } from './metrics.js';
import { KeeperDb } from './db.js';
import { publicDecrypt } from './decrypt.js';

interface Batch {
  batchId: bigint;
  startTime: bigint;
  endTime: bigint;
  status: number;
  clearingPrice: bigint;
  matchedVolume: bigint;
  orderCount: bigint;
  nextTick: bigint;
  settleCursor: bigint;
}

/**
 * Drives one batch through the full lifecycle. Each `tick()` performs at most one on-chain step,
 * so the loop is idempotent and safe to call on a fixed interval: it always reads current state
 * first and acts only if there is a step to take.
 */
export class Keeper {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly account: Account;
  private maxTick = 0n;

  constructor(
    private readonly config: Config,
    private readonly db: KeeperDb,
  ) {
    this.account = privateKeyToAccount(config.keeperPrivateKey);
    const transport = http(config.rpcUrl);
    this.publicClient = createPublicClient({ transport });
    this.walletClient = createWalletClient({ account: this.account, transport });
  }

  async start(): Promise<void> {
    this.maxTick = (await this.read('MAX_TICK')) as bigint;
    logger.info('keeper started', { keeper: this.account.address, dex: this.config.dexAddress, maxTick: Number(this.maxTick) });

    // Sequential loop: never overlap ticks (each may send several transactions).
    for (;;) {
      try {
        await this.tick();
      } catch (err) {
        metrics.errors.inc({ stage: 'tick' });
        logger.error('tick failed', { err: String(err) });
      }
      await sleep(this.config.pollIntervalMs);
    }
  }

  private async tick(): Promise<void> {
    const batch = await this.getCurrentBatch();
    metrics.currentBatchId.set(Number(batch.batchId));
    metrics.currentBatchStatus.set(batch.status);

    switch (batch.status) {
      case BatchStatus.Open:
        await this.maybeClose(batch);
        break;
      case BatchStatus.Closed:
        await this.driveClearing(batch);
        break;
      case BatchStatus.Clearing:
        await this.submitClearing(batch);
        break;
      case BatchStatus.Cleared:
        await this.driveSettlement(batch);
        break;
      case BatchStatus.Settled:
        // Contract auto-opens the next batch; nothing to do.
        break;
    }
  }

  private async maybeClose(batch: Batch): Promise<void> {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < batch.endTime) return;
    const hash = await this.send('closeBatch', []);
    metrics.batchesClosed.inc();
    await this.db.record(batch.batchId, 'closed', hash);
    logger.info('batch closed', { batchId: Number(batch.batchId), hash });
  }

  private async driveClearing(batch: Batch): Promise<void> {
    // Fold one HCU-sized tick chunk per transaction until the whole grid is scanned.
    let nextTick = batch.nextTick;
    while (nextTick <= this.maxTick) {
      const end = bigintMin(nextTick + BigInt(this.config.clearChunkTicks) - 1n, this.maxTick);
      const hash = await this.send('clearBatchRange', [nextTick, end]);
      metrics.clearingTxs.inc();
      logger.info('cleared tick range', { batchId: Number(batch.batchId), start: Number(nextTick), end: Number(end), hash });
      nextTick = end + 1n;
    }
    const hash = await this.send('finalizeClearing', []);
    await this.db.record(batch.batchId, 'clearing_finalized', hash);
    logger.info('clearing finalized, winner published for decryption', { batchId: Number(batch.batchId), hash });
  }

  private async submitClearing(batch: Batch): Promise<void> {
    const [volumeHandle, tickHandle] = (await this.read('getClearingHandles')) as [Hex, Hex];
    const { cleartexts, decryptionProof, values } = await publicDecrypt(
      this.config.relayerUrl,
      this.config.chainId,
      [volumeHandle, tickHandle],
    );
    const hash = await this.send('submitClearingResult', [[volumeHandle, tickHandle], cleartexts, decryptionProof]);
    metrics.batchesCleared.inc();
    await this.db.record(batch.batchId, 'cleared', hash, { volume: values[0]?.toString(), tick: values[1]?.toString() });
    logger.info('clearing result submitted', { batchId: Number(batch.batchId), volume: values[0]?.toString(), tick: values[1]?.toString(), hash });
  }

  private async driveSettlement(batch: Batch): Promise<void> {
    let cursor = batch.settleCursor;
    const total = batch.orderCount;

    if (total === 0n) {
      // Must call at least once to transition the contract state to Settled and open the next batch
      const hash = await this.send('settleBatchRange', [0n, 0n]);
      logger.info('settled empty batch', { batchId: Number(batch.batchId), hash });
    } else {
      while (cursor < total) {
        const end = bigintMin(cursor + BigInt(this.config.settleChunkOrders), total);
        const hash = await this.send('settleBatchRange', [cursor, end]);
        metrics.settleTxs.inc();
        logger.info('settled order range', { batchId: Number(batch.batchId), start: Number(cursor), end: Number(end), hash });
        cursor = end;
      }
    }

    metrics.batchesSettled.inc();
    await this.db.record(batch.batchId, 'settled');
    logger.info('batch fully settled', { batchId: Number(batch.batchId) });
  }

  // --------------------------------------------------------------- chain io

  private async getCurrentBatch(): Promise<Batch> {
    return (await this.read('getCurrentBatch')) as Batch;
  }

  private read(functionName: string, args: readonly unknown[] = []) {
    return this.publicClient.readContract({
      address: this.config.dexAddress,
      abi: dexAbi,
      functionName: functionName as never,
      args: args as never,
    });
  }

  private async send(functionName: string, args: readonly unknown[]): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      address: this.config.dexAddress,
      abi: dexAbi,
      functionName: functionName as never,
      args: args as never,
      account: this.account,
    });
    const hash = await this.walletClient.writeContract(request as never);
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
