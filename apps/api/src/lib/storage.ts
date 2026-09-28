import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../config/env';

/** Pluggable blob storage for uploaded documents. */
export interface StorageDriver {
  readonly name: string;
  save(key: string, data: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** Stores files on the local filesystem under UPLOAD_DIR (a Docker volume in production). */
export class LocalStorage implements StorageDriver {
  readonly name = 'local';
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async read(key: string): Promise<Readable> {
    const full = this.resolve(key);
    await fs.access(full);
    return createReadStream(full);
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * S3 driver placeholder. Wire up `@aws-sdk/client-s3` here (PutObject / GetObject /
 * DeleteObject / HeadObject) when STORAGE_DRIVER=s3 is needed; the rest of the API only
 * depends on the StorageDriver interface.
 */
export class S3Storage implements StorageDriver {
  readonly name = 's3';
  private fail(): never {
    throw new Error('STORAGE_DRIVER=s3 is not configured in this build; install @aws-sdk/client-s3 and implement S3Storage');
  }
  async save(): Promise<void> {
    this.fail();
  }
  async read(): Promise<Readable> {
    this.fail();
  }
  async remove(): Promise<void> {
    this.fail();
  }
  async exists(): Promise<boolean> {
    this.fail();
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage(env.uploadDir);
  return driver;
}
export function setStorage(d: StorageDriver): void {
  driver = d;
}
