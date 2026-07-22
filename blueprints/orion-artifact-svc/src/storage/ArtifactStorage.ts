/**
 * Artifact Storage — local file system implementation.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ArtifactStorage {
  upload(artifactId: string, stream: NodeJS.ReadableStream): Promise<void>;
  download(artifactId: string): Promise<NodeJS.ReadableStream>;
  delete(artifactId: string): Promise<void>;
  exists(artifactId: string): Promise<boolean>;
  getSize(artifactId: string): Promise<number>;
}

export class LocalArtifactStorage implements ArtifactStorage {
  private baseDir: string;

  constructor(baseDir: string = '/tmp/artifacts') {
    this.baseDir = baseDir;
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  }

  private getFilePath(artifactId: string): string {
    return path.join(this.baseDir, artifactId);
  }

  async upload(artifactId: string, stream: NodeJS.ReadableStream): Promise<void> {
    const filePath = this.getFilePath(artifactId);
    const writeStream = fs.createWriteStream(filePath);
    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  async download(artifactId: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.getFilePath(artifactId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    return fs.createReadStream(filePath);
  }

  async delete(artifactId: string): Promise<void> {
    const filePath = this.getFilePath(artifactId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({ artifactId }, 'Artifact deleted from local storage');
    }
  }

  async exists(artifactId: string): Promise<boolean> {
    return fs.existsSync(this.getFilePath(artifactId));
  }

  async getSize(artifactId: string): Promise<number> {
    const filePath = this.getFilePath(artifactId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    return fs.statSync(filePath).size;
  }
}
