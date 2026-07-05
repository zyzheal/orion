/**
 * OCIRegistryService - OCI/Docker Registry 业务服务
 *
 * 封装 DockerRegistryClient，提供高层次的 Registry 操作方法。
 * 支持多 Registry 配置（生产/测试/开发环境）。
 * 集成 FallbackStorageService 做缓存。
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../utils/logger';
import {
  DockerRegistryClient,
  DockerRegistryClientFactory,
  DockerRegistryError,
  RegistryConfig,
  RegistryType,
  AuthType,
  ImageListResult,
  TagListResult,
  PullResult,
  PushResult,
  DeleteResult,
} from './DockerRegistryClient';
import { FallbackStorageService } from '../../fallback/FallbackStorageService';
import { OrionError, ErrorCode, ValidationError, NotFoundError, ExternalServiceError, handleError } from '../../../errors';

const logger = createLogger('oci-registry-service');

// ==================== Types ====================

export interface RegistryConfigInput {
  name: string;
  url: string;
  type: RegistryType;
  authType: AuthType;
  username?: string;
  password?: string;
  bearerToken?: string;
  insecure?: boolean;
  environment?: string;
  description?: string;
  // Cloud provider credentials
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  gcpProjectId?: string;
  gcpServiceAccountKey?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
}

export interface RegistryConfigOutput {
  id: string;
  name: string;
  url: string;
  type: RegistryType;
  authType: AuthType;
  insecure?: boolean;
  environment?: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryInfo {
  name: string;
  tagCount: number;
  lastUpdated?: string;
}

export interface ImageDetail {
  name: string;
  tag: string;
  digest: string;
  sizeBytes: number;
  mediaType: string;
  createdAt?: string;
  labels?: Record<string, string>;
}

// ==================== Service ====================

export class OCIRegistryService {
  private readonly registries = new Map<string, RegistryConfig>();
  private readonly clients = new Map<string, DockerRegistryClient>();
  private readonly cache: FallbackStorageService;

  constructor(cacheOptions?: { prefix?: string; ttlMs?: number; maxSize?: number }) {
    const prefix = cacheOptions?.prefix || 'oci-registry';
    this.cache = new FallbackStorageService({
      prefix,
      ttlMs: cacheOptions?.ttlMs ?? 300_000, // 5 minutes default
      maxSize: cacheOptions?.maxSize ?? 500,
    });
  }

  /**
   * 启动缓存服务
   */
  start(): void {
    this.cache.start();
    logger.info('OCIRegistryService started with cache');
  }

  /**
   * 停止缓存服务
   */
  stop(): void {
    this.cache.stop();
    logger.info('OCIRegistryService stopped');
  }

  // ==================== Registry Configuration Management ====================

  /**
   * 注册新的 Registry 配置
   */
  async registerRegistry(input: RegistryConfigInput): Promise<RegistryConfigOutput> {
    try {
      const id = input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + uuidv4().slice(0, 8);

      const auth = {
        type: input.authType,
        username: input.username,
        password: input.password,
        bearerToken: input.bearerToken,
        awsRegion: input.awsRegion,
        awsAccessKeyId: input.awsAccessKeyId,
        awsSecretAccessKey: input.awsSecretAccessKey,
        gcpProjectId: input.gcpProjectId,
        gcpServiceAccountKey: input.gcpServiceAccountKey,
        azureTenantId: input.azureTenantId,
        azureClientId: input.azureClientId,
        azureClientSecret: input.azureClientSecret,
      };

      const now = new Date().toISOString();
      const config: RegistryConfig = {
        id,
        name: input.name,
        url: input.url,
        type: input.type,
        auth,
        insecure: input.insecure,
        environment: input.environment,
        description: input.description,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };

      // 创建客户端并验证连接
      const client = DockerRegistryClientFactory.create(config);
      const healthy = await client.ping().catch(() => false);

      this.registries.set(id, config);
      this.clients.set(id, client);

      logger.info({ registryId: id, name: input.name, healthy }, 'Registry registered');

      return {
        id,
        name: input.name,
        url: input.url,
        type: input.type,
        authType: input.authType,
        insecure: input.insecure,
        environment: input.environment,
        description: input.description,
        enabled: healthy,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      logger.error({ error, input }, 'Failed to register registry');
      throw error;
    }
  }

  /**
   * 列出所有已配置的 Registry
   */
  async listRegistries(environment?: string): Promise<RegistryConfigOutput[]> {
    try {
      const results: RegistryConfigOutput[] = [];
      for (const [id, config] of this.registries) {
        if (environment && config.environment !== environment) {
          continue;
        }
        results.push({
          id: config.id,
          name: config.name,
          url: config.url,
          type: config.type,
          authType: config.auth.type,
          insecure: config.insecure,
          environment: config.environment,
          description: config.description,
          enabled: config.enabled ?? true,
          createdAt: config.createdAt ?? new Date().toISOString(),
          updatedAt: config.updatedAt ?? new Date().toISOString(),
        });
      }
      return results;
    } catch (error) {
      logger.error({ error, environment }, 'Failed to list registries');
      throw error;
    }
  }

  /**
   * 获取单个 Registry 配置
   */
  async getRegistry(registryId: string): Promise<RegistryConfigOutput> {
    const config = this.registries.get(registryId);
    if (!config) {
      throw new NotFoundError('Registry', registryId);
    }
    return {
      id: config.id,
      name: config.name,
      url: config.url,
      type: config.type,
      authType: config.auth.type,
      insecure: config.insecure,
      environment: config.environment,
      description: config.description,
      enabled: config.enabled ?? true,
      createdAt: config.createdAt ?? new Date().toISOString(),
      updatedAt: config.updatedAt ?? new Date().toISOString(),
    };
  }

  /**
   * 删除 Registry 配置
   */
  async deleteRegistry(registryId: string): Promise<void> {
    const existed = this.registries.delete(registryId);
    this.clients.delete(registryId);
    if (!existed) {
      throw new NotFoundError('Registry', registryId);
    }
    // 清除相关缓存
    await this.cache.clear();
    logger.info({ registryId }, 'Registry deleted');
  }

  /**
   * 启用/禁用 Registry
   */
  async setRegistryEnabled(registryId: string, enabled: boolean): Promise<void> {
    const config = this.registries.get(registryId);
    if (!config) {
      throw new NotFoundError('Registry', registryId);
    }
    config.enabled = enabled;
    config.updatedAt = new Date().toISOString();
    logger.info({ registryId, enabled }, 'Registry enabled status updated');
  }

  // ==================== Repository Operations ====================

  /**
   * 列出指定 Registry 中的所有镜像仓库
   */
  async listRepositories(registryId: string): Promise<RepositoryInfo[]> {
    const client = this.getClient(registryId);
    const cacheKey = `repos:${registryId}`;

    // 尝试从缓存读取
    const cached = await this.cache.get<RepositoryInfo[]>(cacheKey);
    if (cached) {
      logger.debug({ registryId }, 'Returning repositories from cache');
      return cached;
    }

    try {
      const result = await client.listImages();
      const repos: RepositoryInfo[] = result.repositories.map(name => ({
        name,
        tagCount: 0, // 需要额外调用 listTags 获取，这里先返回基本信息
      }));

      // 写入缓存
      await this.cache.set(cacheKey, repos);
      return repos;
    } catch (error) {
      if (error instanceof DockerRegistryError) {
        throw new ExternalServiceError('Docker Registry', error);
      }
      throw error;
    }
  }

  /**
   * 列出指定镜像的所有标签
   */
  async listTags(registryId: string, repositoryName: string): Promise<TagListResult> {
    const client = this.getClient(registryId);
    const cacheKey = `tags:${registryId}:${repositoryName}`;

    // 尝试从缓存读取
    const cached = await this.cache.get<TagListResult>(cacheKey);
    if (cached) {
      logger.debug({ registryId, repositoryName }, 'Returning tags from cache');
      return cached;
    }

    try {
      const result = await client.listTags(repositoryName);

      // 写入缓存
      await this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof DockerRegistryError) {
        throw new ExternalServiceError('Docker Registry', error);
      }
      throw error;
    }
  }

  /**
   * 获取镜像 manifest
   */
  async getManifest(registryId: string, repositoryName: string, reference: string): Promise<any> {
    const client = this.getClient(registryId);
    try {
      return await client.getManifest(repositoryName, reference);
    } catch (error) {
      if (error instanceof DockerRegistryError) {
        throw new ExternalServiceError('Docker Registry', error);
      }
      throw error;
    }
  }

  /**
   * 拉取镜像元数据
   */
  async pullImage(registryId: string, repositoryName: string, tag: string): Promise<PullResult> {
    const client = this.getClient(registryId);
    try {
      return await client.pullImage(repositoryName, tag);
    } catch (error) {
      if (error instanceof DockerRegistryError) {
        throw new ExternalServiceError('Docker Registry', error);
      }
      throw error;
    }
  }

  /**
   * 推送镜像
   */
  async pushImage(registryId: string, repositoryName: string, tag: string, manifest: any): Promise<PushResult> {
    const client = this.getClient(registryId);
    try {
      const result = await client.pushImage(repositoryName, tag, manifest);

      // 推送成功后清除相关缓存
      const repoCacheKey = `repos:${registryId}`;
      const tagsCacheKey = `tags:${registryId}:${repositoryName}`;
      await this.cache.delete(repoCacheKey);
      await this.cache.delete(tagsCacheKey);

      return result;
    } catch (error) {
      if (error instanceof DockerRegistryError) {
        throw new ExternalServiceError('Docker Registry', error);
      }
      throw error;
    }
  }

  /**
   * 删除镜像
   */
  async deleteImage(registryId: string, repositoryName: string, tag: string): Promise<DeleteResult> {
    const client = this.getClient(registryId);
    try {
      const result = await client.deleteImage(repositoryName, tag);

      // 删除成功后清除相关缓存
      const repoCacheKey = `repos:${registryId}`;
      const tagsCacheKey = `tags:${registryId}:${repositoryName}`;
      await this.cache.delete(repoCacheKey);
      await this.cache.delete(tagsCacheKey);

      return result;
    } catch (error) {
      if (error instanceof DockerRegistryError) {
        throw new ExternalServiceError('Docker Registry', error);
      }
      throw error;
    }
  }

  // ==================== Health Check ====================

  /**
   * 检查所有 Registry 的健康状态
   */
  async healthCheckAll(): Promise<Map<string, { healthy: boolean; latencyMs: number; version?: string }>> {
    const results = new Map<string, { healthy: boolean; latencyMs: number; version?: string }>();
    for (const [id, config] of this.registries) {
      if (!config.enabled && config.enabled !== undefined) {
        results.set(id, { healthy: false, latencyMs: 0 });
        continue;
      }
      try {
        const client = this.clients.get(id) || DockerRegistryClientFactory.create(config);
        const health = await client.healthCheck();
        results.set(id, health);
      } catch (error) {
        results.set(id, { healthy: false, latencyMs: 0 });
      }
    }
    return results;
  }

  /**
   * 检查单个 Registry 的健康状态
   */
  async healthCheck(registryId: string): Promise<{ healthy: boolean; latencyMs: number; version?: string }> {
    const config = this.registries.get(registryId);
    if (!config) {
      throw new NotFoundError('Registry', registryId);
    }
    const client = this.clients.get(registryId) || DockerRegistryClientFactory.create(config);
    return client.healthCheck();
  }

  // ==================== Private Helpers ====================

  private getClient(registryId: string): DockerRegistryClient {
    const config = this.registries.get(registryId);
    if (!config) {
      throw new NotFoundError('Registry', registryId);
    }
    if (config.enabled === false) {
      throw new OrionError(`Registry ${registryId} is disabled`, ErrorCode.SERVICE_UNAVAILABLE);
    }
    return this.clients.get(registryId) || DockerRegistryClientFactory.create(config);
  }
}
