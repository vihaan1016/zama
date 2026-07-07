import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number).pipe(z.number().int().positive()),
  RPC_URL: z.string().url().default('https://sepolia.rpc.zama.ai'),
  CHAIN_ID: z.string().default('11155111').transform(Number),
  DEX_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'DEX_ADDRESS must be a valid address')
    .default('0x0000000000000000000000000000000000000000'),
  DATABASE_URL: z.string().optional(),
  CORS_ORIGINS: z.string().optional().default(''),
  // Block to start indexing from (deploy block); 0 = from genesis of the filter.
  START_BLOCK: z.string().optional().default('0').transform((s) => BigInt(s)),
  BACKFILL_BLOCK_RANGE: z.string().optional().default('10').transform(Number).pipe(z.number().int().positive()),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const allowedOrigins = config.CORS_ORIGINS
  ? config.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
