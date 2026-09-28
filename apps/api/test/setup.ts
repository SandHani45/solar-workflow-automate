import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, inject } from 'vitest';

// Must run before any src module is imported (env is parsed at import time).
const dbName = `sf_test_${crypto.randomBytes(4).toString('hex')}`;
const base = inject('mongoUri');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = `${base.replace(/\/?(\?.*)?$/, '')}/${dbName}`;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
process.env.APP_URL = 'http://localhost:3000';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `sf-uploads-${dbName}`);
process.env.SUPER_ADMIN_EMAIL = 'root@solarflow.test';
process.env.SUPER_ADMIN_PASSWORD = 'RootPass123';
process.env.BCRYPT_ROUNDS = '4';

beforeAll(async () => {
  const { connectDb } = await import('../src/lib/db');
  const { syncFeatureCatalogue } = await import('../src/modules/platform/catalogue');
  const { ensureSuperAdmin } = await import('../src/modules/auth/service');
  const { mongoose } = await import('../src/lib/mongoose');
  await connectDb();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await syncFeatureCatalogue();
  await ensureSuperAdmin();
});

afterAll(async () => {
  const { mongoose } = await import('../src/lib/mongoose');
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
  const fs = await import('node:fs/promises');
  await fs.rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});
