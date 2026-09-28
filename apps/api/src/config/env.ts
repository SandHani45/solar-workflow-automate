import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load `.env` from the working directory first, then the monorepo root. Existing
// process variables always win (dotenv never overrides).
if (process.env.NODE_ENV !== 'test') {
  // pnpm runs package scripts from apps/api, so ../../.env is the monorepo root.
  for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')]) {
    dotenv.config({ path: p, quiet: true });
  }
}

const isProd = process.env.NODE_ENV === 'production';
const devSecret = (name: string) => (isProd ? z.string().min(32, `${name} must be at least 32 characters`) : z.string().min(8).default(`dev-${name}-change-me-please`));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/solarflow'),
  /** Database name when the URI has none (e.g. Railway's MONGO_URL); overrides the URI path if set. */
  MONGODB_DB_NAME: z.string().min(1).optional(),
  /** Seed the demo organisation on boot when it doesn't exist yet (never overwrites). */
  SEED_DEMO_ON_BOOT: z.enum(['true', 'false']).default('false'),
  JWT_ACCESS_SECRET: devSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: devSecret('JWT_REFRESH_SECRET'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(15),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  SUPER_ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  SUPER_ADMIN_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  bcryptRounds: parsed.data.BCRYPT_ROUNDS ?? (parsed.data.NODE_ENV === 'test' ? 4 : 12),
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
};
export type Env = typeof env;
