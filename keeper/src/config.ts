import 'dotenv/config';

/** Fail fast if a required environment variable is missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalNumber(name: string, fallback: number): number {
  const v = process.env[name];
  return v === undefined ? fallback : Number(v);
}

export const config = {
  rpcUrl: required('RPC_URL'),
  keeperPrivateKey: required('KEEPER_PRIVATE_KEY') as `0x${string}`,
  dexAddress: required('DEX_ADDRESS') as `0x${string}`,
  chainId: optionalNumber('CHAIN_ID', 11155111),

  /** Relayer endpoint used for off-chain public decryption of the clearing winner. */
  relayerUrl: process.env.RELAYER_URL ?? 'https://relayer.testnet.zama.org',

  /** How many ticks to fold per clearBatchRange transaction (keep each tx under the HCU budget). */
  clearChunkTicks: optionalNumber('CLEAR_CHUNK_TICKS', 6),
  /** How many orders to settle per settleBatchRange transaction. */
  settleChunkOrders: optionalNumber('SETTLE_CHUNK_ORDERS', 4),

  /** Poll interval in milliseconds. */
  pollIntervalMs: optionalNumber('POLL_INTERVAL_MS', 15_000),

  /** Optional Postgres connection string; when unset the keeper runs without persistence. */
  databaseUrl: process.env.DATABASE_URL,

  /** Port for the Prometheus /metrics endpoint. */
  metricsPort: optionalNumber('METRICS_PORT', 9464),
};

export type Config = typeof config;
