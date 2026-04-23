/**
 * Artifact Storage Interface
 * 制品存储接口
 */

import { ArtifactStorage as IArtifactStorage, CreateArtifactInput } from '../models/Artifact';

export interface ArtifactStorage extends IArtifactStorage {}

export class LocalArtifactStorage implements ArtifactStorage {
  private storageDir: string;

  constructor(storageDir: string = '/tmp/artifacts') {
    this.storageDir = storageDir;
  }

  async upload(file: Buffer, metadata: CreateArtifactInput): Promise<any> {
    const fs = require('fs').promises;
    const path = require('path');
    
    // 确保存储目录存在
    await fs.mkdir(this.storageDir, { recursive: true });
    
    // 构建文件路径
    const filePath = path.join(this.storageDir, `${metadata.namespace}-${metadata.name}-${metadata.version}`);
    
    // 写入文件
    await fs.writeFile(filePath, file);
    
    return {
      storagePath: filePath,
      size: file.length
    };
  }

  async download(id: string): Promise<Buffer> {
    const fs = require('fs').promises;
    const path = require('path');
    
    // 从数据库获取存储路径
    const artifact = await this.getArtifactMetadata(id);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }
    
    const filePath = path.join(this.storageDir, artifact.storagePath);
    
    // 读取文件
    const file = await fs.readFile(filePath);
    return file;
  }

  async delete(id: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');
    
    // 从数据库获取存储路径
    const artifact = await this.getArtifactMetadata(id);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }
    
    const filePath = path.join(this.storageDir, artifact.storagePath);
    
    // 删除文件
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // 文件不存在，忽略错误
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(id: string): Promise<boolean> {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const artifact = await this.getArtifactMetadata(id);
      if (!artifact) {
        return false;
      }
      
      const filePath = path.join(this.storageDir, artifact.storagePath);
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getMetadata(id: string): Promise<Record<string, any>> {
    const artifact = await this.getArtifactMetadata(id);
    return artifact?.metadata || {};
  }

  // 模拟方法，实际应该从数据库获取
  private async getArtifactMetadata(id: string): Promise<any> {
    // 这里应该从数据库查询制品信息
    // 暂时返回模拟数据
    return {
      id,
      storagePath: `${id}-file`,
      metadata: {}
    };
  }
}

export class S3ArtifactStorage implements ArtifactStorage {
  private s3: any;
  private bucket: string;

  constructor(bucket: string, region: string = 'us-east-1') {
    const AWS = require('aws-sdk');
    this.s3 = new AWS.S3({ region });
    this.bucket = bucket;
  }

  async upload(file: Buffer, metadata: CreateArtifactInput): Promise<any> {
    const key = `${metadata.namespace}/${metadata.name}/${metadata.version}`;
    
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: this.getContentType(metadata.type),
      Metadata: {
        'x-amz-meta-namespace': metadata.namespace,
        'x-amz-meta-name': metadata.name,
        'x-amz-meta-version': metadata.version,
        'x-amz-meta-type': metadata.type,
        'x-amz-meta-created-by': metadata.createdBy
      }
    }).promise();

    return {
      storagePath: key,
      size: file.length
    };
  }

  async download(id: string): Promise<Buffer> {
    const key = await this.getArtifactKey(id);
    
    const result = await this.s3.getObject({
      Bucket: this.bucket,
      Key: key
    }).promise();

    return result.Body;
  }

  async delete(id: string): Promise<void> {
    const key = await this.getArtifactKey(id);
    
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: key
    }).promise();
  }

  async exists(id: string): Promise<boolean> {
    try {
      const key = await this.getArtifactKey(id);
      await this.s3.headObject({
        Bucket: this.bucket,
        Key: key
      }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getMetadata(id: string): Promise<Record<string, any>> {
    const key = await this.getArtifactKey(id);
    
    const result = await this.s3.headObject({
      Bucket: this.bucket,
      Key: key
    }).promise();

    return {
      namespace: result.Metadata['x-amz-meta-namespace'],
      name: result.Metadata['x-amz-meta-name'],
      version: result.Metadata['x-amz-meta-version'],
      type: result.Metadata['x-amz-meta-type'],
      createdBy: result.Metadata['x-amz-meta-created-by']
    };
  }

  private async getArtifactKey(id: string): Promise<string> {
    // 这里应该从数据库查询制品信息
    // 暂时返回模拟数据
    return `artifacts/${id}`;
  }

  private getContentType(type: string): string {
    const contentTypes: Record<string, string> = {
      'DOCKER_IMAGE': 'application/vnd.docker.image.rootfs.diff.tar.gzip',
      'HELM_CHART': 'application/vnd.cncf.helm.chart.v2+json',
      'FUNCTION_PACKAGE': 'application/zip',
      'MODEL_FILE': 'application/octet-stream',
      'PLUGIN_PACKAGE': 'application/octet-stream',
      'CONFIG_FILE': 'text/plain',
      'BUILD_OUTPUT': 'application/octet-stream',
      'TEST_REPORT': 'application/xml'
    };
    
    return contentTypes[type] || 'application/octet-stream';
  }
}