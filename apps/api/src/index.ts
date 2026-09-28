import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { env } from './config/env';
import { connectDb, disconnectDb } from './lib/db';
import { logger } from './lib/logger';
import { APP_VERSION } from './lib/version';
import { ensureSuperAdmin } from './modules/auth/service';
import { syncFeatureCatalogue } from './modules/platform/catalogue';

async function main(): Promise<void> {
  await connectDb();
  await syncFeatureCatalogue();
  await ensureSuperAdmin();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV, version: APP_VERSION }, 'SolarFlow API listening'));
  server.keepAliveTimeout = 65_000;
  if (env.SEED_DEMO_ON_BOOT === 'true') seedDemoIfMissing();

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(async () => {
      await disconnectDb().catch(() => undefined);
      logger.info('Shutdown complete');
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));
}

/** Runs the built seed script in a child process so the API keeps serving (and passing health checks) meanwhile. */
function seedDemoIfMissing(): void {
  const script = fileURLToPath(new URL('./seed.js', import.meta.url));
  if (!existsSync(script)) return logger.warn('SEED_DEMO_ON_BOOT is set but dist/seed.js was not found; run `pnpm seed` instead');
  execFile(process.execPath, [script, '--if-missing'], { env: process.env }, (err, stdout) => {
    if (err) logger.error({ err }, 'Demo seed failed');
    else logger.info({ output: stdout.trim().split('\n').slice(-16).join('\n') }, 'Demo seed finished');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
