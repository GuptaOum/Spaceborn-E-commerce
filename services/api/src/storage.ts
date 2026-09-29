import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from './config.js';

export interface Storage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

function s3Storage(bucket: string): Storage {
  const client = new S3Client({ region: config.AWS_REGION });
  return {
    async put(key, body) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/octet-stream', ServerSideEncryption: 'aws:kms' }),
      );
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return res.Body as Readable;
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

function diskStorage(root: string): Storage {
  const resolve = (key: string) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  };
  return {
    async put(key, body) {
      const full = resolve(key);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, body);
    },
    async get(key) {
      return fs.createReadStream(resolve(key));
    },
    async remove(key) {
      await fsp.rm(resolve(key), { force: true });
    },
  };
}

export const storage: Storage = config.UPLOADS_BUCKET ? s3Storage(config.UPLOADS_BUCKET) : diskStorage(config.UPLOAD_DIR);
