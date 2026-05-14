/**
 * ObjectStorageService - 对象存储后端集成 (Task 3.2)
 *
 * 职责：
 * - 支持 S3/OSS/COS 作为制品存储后端
 * - 替代本地文件存储
 * - 提供统一的上传/下载/删除接口
 * - 支持预签名 URL
 */

import pino from 'pino';
import * as crypto from 'crypto';

const logger = pino({ name: 'object-storage-service' });

export interface ObjectStorageConfig {
  provider: 's3' | 'oss' | 'cos' | 'minio';
  endpoint?: string;
  region?: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  prefix?: string;
  useSSL?: boolean;
}

export interface UploadResult {
  key: string;
  url: string;
  etag: string;
  size: number;
}

export interface DownloadResult {
  stream: Buffer;
  contentType?: string;
  size: number;
}

export class ObjectStorageService {
  private config: ObjectStorageConfig;
  private baseUrl: string;

  constructor(config: ObjectStorageConfig) {
    this.config = config;
    this.baseUrl = this.buildBaseUrl();
  }

  /**
   * 上传文件
   */
  async upload(
    key: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<UploadResult> {
    const fullKey = this.config.prefix
      ? `${this.config.prefix}/${key}`
      : key;

    try {
      const response = await this.putObject(fullKey, data, contentType);

      return {
        key: fullKey,
        url: `${this.baseUrl}/${fullKey}`,
        etag: response.etag,
        size: response.size,
      };
    } catch (error: any) {
      logger.error({ error, key }, 'Failed to upload object');
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * 下载文件
   */
  async download(key: string): Promise<DownloadResult> {
    const fullKey = this.config.prefix
      ? `${this.config.prefix}/${key}`
      : key;

    try {
      return await this.getObject(fullKey);
    } catch (error: any) {
      logger.error({ error, key }, 'Failed to download object');
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * 删除文件
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.config.prefix
      ? `${this.config.prefix}/${key}`
      : key;

    try {
      await this.deleteObject(fullKey);
      logger.info({ key: fullKey }, 'Object deleted');
    } catch (error: any) {
      logger.error({ error, key }, 'Failed to delete object');
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * 生成预签名 URL (用于临时下载)
   * 注意：不暴露 AccessKeyId，仅包含过期时间和签名
   */
  generatePresignedUrl(key: string, expiresIn = 3600): string {
    const fullKey = this.config.prefix
      ? `${this.config.prefix}/${key}`
      : key;

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = this.signStringToSign(fullKey, expiresAt);

    // 不暴露凭证标识符，仅包含过期时间和签名
    return `${this.baseUrl}/${encodeURIComponent(fullKey)}?` +
      `X-Expires=${expiresAt}` +
      `&X-Signature=${encodeURIComponent(signature)}`;
  }

  /**
   * 列出指定前缀下的所有对象
   */
  async listObjects(prefix?: string): Promise<Array<{
    key: string;
    size: number;
    lastModified: string;
    etag: string;
  }>> {
    const listPrefix = this.config.prefix
      ? `${this.config.prefix}/${prefix || ''}`
      : (prefix || '');

    // TODO: 实现具体的 listObjects API 调用
    // 这里使用 fetch 调用 S3/OSS ListObjects API
    logger.info({ prefix: listPrefix }, 'Listing objects');
    return [];
  }

  /**
   * 检查对象是否存在
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.config.prefix
      ? `${this.config.prefix}/${key}`
      : key;

    try {
      await this.headObject(fullKey);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== 底层实现 ====================

  /**
   * TODO: 生产环境应使用官方 SDK 替代手写签名逻辑
   * - S3: @aws-sdk/client-s3 (AWS Signature V4)
   * - OSS: ali-oss (阿里云签名)
   * - COS: cos-nodejs-sdk-v5 (腾讯云签名)
   * 当前实现仅为简化原型，不兼容任何真实云提供商的签名协议
   */

  /**
   * 构建基础 URL
   */
  private buildBaseUrl(): string {
    const protocol = this.config.useSSL !== false ? 'https' : 'http';
    const endpoint = this.config.endpoint || this.getDefaultEndpoint();
    return `${protocol}://${this.config.bucket}.${endpoint}`;
  }

  /**
   * 获取默认端点
   */
  private getDefaultEndpoint(): string {
    switch (this.config.provider) {
      case 's3':
        return `s3.${this.config.region || 'us-east-1'}.amazonaws.com`;
      case 'oss':
        return `oss-${this.config.region || 'oss-cn-hangzhou'}.aliyuncs.com`;
      case 'cos':
        return `cos.${this.config.region || 'ap-shanghai'}.myqcloud.com`;
      case 'minio':
        return this.config.endpoint || 'localhost:9000';
      default:
        return 'localhost:9000';
    }
  }

  /**
   * PUT 对象 (上传)
   */
  private async putObject(
    key: string,
    data: Buffer | string,
    contentType?: string
  ): Promise<{ etag: string; size: number }> {
    const headers: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
    };

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    headers['Content-Length'] = String(buffer.length);

    // 生成签名
    const signature = this.signRequest('PUT', key, headers);
    headers['Authorization'] = signature;

    const url = `${this.baseUrl}/${key}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: buffer,
    });

    if (!response.ok) {
      throw new Error(`PUT ${key} failed: ${response.status} ${response.statusText}`);
    }

    return {
      etag: response.headers.get('etag') || '',
      size: buffer.length,
    };
  }

  /**
   * GET 对象 (下载)
   */
  private async getObject(key: string): Promise<DownloadResult> {
    const headers: Record<string, string> = {};
    const signature = this.signRequest('GET', key, headers);
    headers['Authorization'] = signature;

    const response = await fetch(`${this.baseUrl}/${key}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`GET ${key} failed: ${response.status}`);
    }

    const stream = await response.arrayBuffer();
    return {
      stream: Buffer.from(stream),
      contentType: response.headers.get('content-type') || undefined,
      size: parseInt(response.headers.get('content-length') || '0', 10),
    };
  }

  /**
   * HEAD 对象 (检查存在)
   */
  private async headObject(key: string): Promise<void> {
    const signature = this.signRequest('HEAD', key, {});

    const response = await fetch(`${this.baseUrl}/${key}`, {
      method: 'HEAD',
      headers: { 'Authorization': signature },
    });

    if (!response.ok) {
      throw new Error(`HEAD ${key} failed: ${response.status}`);
    }
  }

  /**
   * DELETE 对象
   */
  private async deleteObject(key: string): Promise<void> {
    const signature = this.signRequest('DELETE', key, {});

    const response = await fetch(`${this.baseUrl}/${key}`, {
      method: 'DELETE',
      headers: { 'Authorization': signature },
    });

    if (!response.ok) {
      throw new Error(`DELETE ${key} failed: ${response.status}`);
    }
  }

  /**
   * 签名请求 (简化实现 - 生产环境应使用 aws-sdk/ali-oss)
   */
  private signRequest(method: string, key: string, headers: Record<string, string>): string {
    const stringToSign = `${method}\n\n${headers['Content-Type'] || ''}\n\n/${this.config.bucket}/${key}`;
    return this.signStringToSign(stringToSign);
  }

  /**
   * HMAC-SHA256 签名
   */
  private signStringToSign(stringToSign: string, expires?: number): string {
    const message = expires ? `${stringToSign}\n${expires}` : stringToSign;
    return crypto
      .createHmac('sha256', this.config.accessKeySecret)
      .update(message)
      .digest('hex');
  }
}
