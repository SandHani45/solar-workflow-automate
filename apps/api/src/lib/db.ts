import { env } from '../config/env';
import { logger } from './logger';
import { mongoose } from './mongoose';

export async function connectDb(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export const dbState = (): 'up' | 'down' => (mongoose.connection.readyState === 1 ? 'up' : 'down');
