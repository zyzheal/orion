/**
 * Build Cache Controller - 构建缓存 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BuildCacheService } from '../services/BuildCacheService';
import {
  CacheLevel,
  CacheStatus,
  CacheCleanupPolicy,
  CacheStorageType,
  BuildCacheConfigCreateInput,
  BuildCacheConfigUpdateInput,
} from '../models/BuildCache';

export class BuildCacheController {
  private service: BuildCacheService;

  constructor(service: BuildCacheService) {
    this.service = service;
  }

  /**
   * POST /api/v1/build-cache/configs - 创建缓存配置
   */
  async createConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = request.body as BuildCacheConfigCreateInput;

    // 验证必填字段
    if (!input.level || !input.cachePaths || input.cachePaths.length === 0) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'level and cachePaths are required',
      });
      return;
    }

    try {
      const config = await this.service.createConfig(input);
      reply.status(201).send(config);
    } catch (error) {
      if (error instanceof Error) {
        reply.status(409).send({
          error: 'CONFLICT',
          message: error.message,
        });
      } else {
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to create cache config',
        });
      }
    }
  }

  /**
   * GET /api/v1/build-cache/configs - 获取缓存配置列表
   */
  async listConfigs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;

    try {
      const options: {
        level?: CacheLevel;
        status?: CacheStatus;
        limit?: number;
        offset?: number;
      } = {};

      if (query.level) options.level = query.level as CacheLevel;
      if (query.status) options.status = query.status as CacheStatus;
      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);

      const configs = await this.service.listConfigs(options);
      reply.send(configs);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to list cache configs',
      });
    }
  }

  /**
   * GET /api/v1/build-cache/configs/:id - 获取缓存配置详情
   */
  async getConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const config = await this.service.getConfig(id);
      if (!config) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Cache config '${id}' not found`,
        });
        return;
      }
      reply.send(config);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get cache config',
      });
    }
  }

  /**
   * PUT /api/v1/build-cache/configs/:id - 更新缓存配置
   */
  async updateConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const input = request.body as BuildCacheConfigUpdateInput;

    try {
      const config = await this.service.updateConfig(id, input);
      if (!config) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Cache config '${id}' not found`,
        });
        return;
      }
      reply.send(config);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update cache config',
      });
    }
  }

  /**
   * DELETE /api/v1/build-cache/configs/:id - 删除缓存配置
   */
  async deleteConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const deleted = await this.service.deleteConfig(id);
      if (!deleted) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Cache config '${id}' not found`,
        });
        return;
      }
      reply.status(204).send();
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete cache config',
      });
    }
  }

  /**
   * GET /api/v1/build-cache/effective - 获取生效的缓存配置（三级级联）
   */
  async getEffectiveConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;
    const { pipelineId, taskId } = query;

    if (!pipelineId) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'pipelineId is required',
      });
      return;
    }

    try {
      const config = await this.service.getEffectiveConfig(pipelineId, taskId);
      reply.send(config);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get effective cache config',
      });
    }
  }

  /**
   * GET /api/v1/build-cache/enabled - 检查缓存是否启用（三级级联）
   */
  async isCacheEnabled(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;
    const { pipelineId, taskId } = query;

    if (!pipelineId) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'pipelineId is required',
      });
      return;
    }

    try {
      const enabled = await this.service.isCacheEnabled(pipelineId, taskId);
      reply.send({ enabled, pipelineId, taskId });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to check cache status',
      });
    }
  }

  // ==================== 缓存条目管理 ====================

  /**
   * POST /api/v1/build-cache/entries - 创建缓存条目
   */
  async createEntry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as {
      configId: string;
      hash: string;
      storagePath: string;
    };

    if (!body.configId || !body.hash || !body.storagePath) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'configId, hash, and storagePath are required',
      });
      return;
    }

    try {
      const entry = await this.service.createCacheEntry(
        body.configId,
        body.hash,
        body.storagePath
      );
      reply.status(201).send(entry);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create cache entry',
      });
    }
  }

  /**
   * GET /api/v1/build-cache/entries - 查询缓存条目
   */
  async listEntries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;

    try {
      const options: {
        configId?: string;
        limit?: number;
        offset?: number;
      } = {};

      if (query.configId) options.configId = query.configId;
      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);

      const entries = await this.service.listCacheEntries(options);
      reply.send(entries);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to list cache entries',
      });
    }
  }

  /**
   * DELETE /api/v1/build-cache/entries/:id - 删除缓存条目
   */
  async deleteEntry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const deleted = await this.service.deleteCacheEntry(id);
      if (!deleted) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Cache entry '${id}' not found`,
        });
        return;
      }
      reply.status(204).send();
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete cache entry',
      });
    }
  }

  // ==================== 缓存清理 ====================

  /**
   * POST /api/v1/build-cache/cleanup/expired - 清理过期缓存
   */
  async cleanupExpired(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const count = await this.service.cleanupExpired();
      reply.send({ cleaned: count, policy: 'expired' });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to cleanup expired cache',
      });
    }
  }

  /**
   * POST /api/v1/build-cache/cleanup/lru - 按 LRU 清理缓存
   */
  async cleanupLRU(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as { configId: string; maxEntries: number };

    if (!body.configId || !body.maxEntries) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'configId and maxEntries are required',
      });
      return;
    }

    try {
      const count = await this.service.cleanupLRU(body.configId, body.maxEntries);
      reply.send({ cleaned: count, policy: 'lru' });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to cleanup LRU cache',
      });
    }
  }

  /**
   * POST /api/v1/build-cache/clear/:configId - 清空指定配置的缓存
   */
  async clearConfigCache(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { configId } = request.params as { configId: string };

    try {
      const count = await this.service.clearConfigCache(configId);
      reply.send({ cleaned: count, configId });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to clear config cache',
      });
    }
  }
}
