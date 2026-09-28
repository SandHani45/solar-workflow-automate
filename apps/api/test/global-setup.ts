import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

let mongod: MongoMemoryServer | undefined;

/**
 * One mongod for the whole run; each test file uses its own database.
 * Set MONGOMS_SYSTEM_BINARY to use a locally installed mongod instead of a download.
 */
export default async function setup(project: TestProject) {
  mongod = await MongoMemoryServer.create();
  project.provide('mongoUri', mongod.getUri());
  return async () => {
    await mongod?.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
