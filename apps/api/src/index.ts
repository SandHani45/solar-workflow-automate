import type { Server } from 'node:http';
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

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
