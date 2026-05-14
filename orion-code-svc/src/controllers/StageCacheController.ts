/**
 * Stage Cache Controller - Stage 级别缓存 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BuildCacheService } from '../services/BuildCacheService';
import { ArtifactService } from '../services/ArtifactService';

export class StageCacheController {
  private buildCacheService: BuildCacheService;
  private artifactService: ArtifactService;

  constructor(buildCacheService: BuildCacheService, artifactService: ArtifactService) {
    this.buildCacheService = buildCacheService;
    this.artifactService = artifactService;
  }

  /**
   * POST /api/v1/pipeline-runs/:runId/stages/:stageId/cache - 保存缓存
   */
  async saveCache(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };
      const body = request.body as { key: string; paths: string[]; hash?: string };
      const { key, paths, hash } = body;

      if (!key || !paths || paths.length === 0) {
        reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'key and paths are required',
        });
        return;
      }

      // 检查缓存是否启用
      const enabled = await this.buildCacheService.isCacheEnabled(runId, stageId);
      if (!enabled) {
        reply.status(400).send({
          error: 'CACHE_DISABLED',
          message: 'Cache is not enabled for this stage',
        });
        return;
      }

      // 获取生效的缓存配置
      const config = await this.buildCacheService.getEffectiveConfig(runId, stageId);
      if (!config) {
        reply.status(404).send({
          error: 'NO_CACHE_CONFIG',
          message: 'No cache configuration found',
        });
        return;
      }

      // 计算 hash（如果未提供）
      const dependencyHash = hash || this.buildCacheService.computeDependencyHash(paths, {});

      // 创建缓存条目
      const entry = await this.buildCacheService.createCacheEntry(
        config.id,
        dependencyHash,
        `/cache/${runId}/${stageId}/${key}`
      );

      reply.status(201).send({
        success: true,
        cacheKey: entry.cacheKey,
        entry: {
          id: entry.id,
          key: entry.cacheKey,
          hash: entry.hash,
          size: 0,
          createdAt: entry.createdAt,
        },
      });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to save cache',
      });
    }
  }

  /**
   * GET /api/v1/pipeline-runs/:runId/stages/:stageId/cache - 恢复缓存
   */
  async restoreCache(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };
      const query = request.query as { key: string };
      const { key } = query;

      if (!key) {
        reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'key is required',
        });
        return;
      }

      // 检查缓存是否启用
      const enabled = await this.buildCacheService.isCacheEnabled(runId, stageId);
      if (!enabled) {
        reply.send({
          restored: false,
          reason: 'Cache is not enabled',
        });
        return;
      }

      // 获取生效的缓存配置
      const config = await this.buildCacheService.getEffectiveConfig(runId, stageId);
      if (!config) {
        reply.send({
          restored: false,
          reason: 'No cache configuration found',
        });
        return;
      }

      // 查找缓存条目
      const entry = await this.buildCacheService.getCacheEntryByKey(config.id, key);
      if (!entry) {
        reply.send({
          restored: false,
          reason: 'Cache miss',
          cacheKey: key,
        });
        return;
      }

      // 检查是否过期
      if (entry.expiresAt && entry.expiresAt <= new Date()) {
        reply.send({
          restored: false,
          reason: 'Cache expired',
          cacheKey: key,
        });
        return;
      }

      reply.send({
        restored: true,
        cacheKey: entry.cacheKey,
        storagePath: entry.storagePath,
        size: entry.size,
        hitCount: entry.hitCount,
      });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to restore cache',
      });
    }
  }

  /**
   * POST /api/v1/pipeline-runs/:runId/stages/:stageId/artifacts - 上传 Artifact
   */
  async uploadArtifact(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };
      const body = request.body as any;
      const { name, paths, type, expiresAt } = body;

      if (!name || !paths || !Array.isArray(paths)) {
        reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'name and paths array are required',
        });
        return;
      }

      // 为每个路径创建 Artifact 记录
      const artifacts = [];
      for (const path of paths) {
        const artifact = await this.artifactService.createArtifact({
          name: `${name}/${path}`,
          type,
          runId,
          stageId,
          size: 0, // 实际大小需要在文件上传后计算
          storagePath: `/artifacts/${runId}/${stageId}/${path}`,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });
        artifacts.push({
          id: artifact.id,
          name: artifact.name,
          storagePath: artifact.storagePath,
        });
      }

      reply.status(201).send({
        success: true,
        artifacts,
      });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to upload artifact',
      });
    }
  }

  /**
   * GET /api/v1/pipeline-runs/:runId/stages/:stageId/artifacts - 获取 Stage 的 Artifact 列表
   */
  async listArtifacts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { runId, stageId } = request.params as { runId: string; stageId: string };

      const artifacts = await this.artifactService.listArtifacts({ runId, stageId });
      reply.send({
        data: artifacts,
        total: artifacts.length,
      });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to list artifacts',
      });
    }
  }
}
