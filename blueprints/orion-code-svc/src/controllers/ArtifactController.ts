/**
 * Artifact Controller - 构建产物 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactService } from '../services/ArtifactService';
import { ArtifactType, ArtifactCreateInput } from '../services/ArtifactService';

export class ArtifactController {
  private service: ArtifactService;

  constructor(service: ArtifactService) {
    this.service = service;
  }

  /**
   * POST /api/v1/artifacts - 创建 Artifact（上传）
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { name, type, runId, stageId, size, checksum, expiresAt, metadata } = body;

      if (!name || !runId) {
        reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'name and runId are required',
        });
        return;
      }

      // 计算过期时间
      const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;

      const artifact = await this.service.createArtifact({
        name,
        type: type as ArtifactType,
        runId,
        stageId,
        size: size || 0,
        checksum,
        storagePath: `/artifacts/${runId}/${name}`,
        expiresAt: expiresAtDate,
        metadata,
      });

      reply.status(201).send(artifact);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create artifact',
      });
    }
  }

  /**
   * GET /api/v1/artifacts - 查询 Artifact 列表
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const options: {
        runId?: string;
        stageId?: string;
        type?: ArtifactType;
        limit?: number;
        offset?: number;
      } = {};

      if (query.runId) options.runId = query.runId;
      if (query.stageId) options.stageId = query.stageId;
      if (query.type) options.type = query.type as ArtifactType;
      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);

      const artifacts = await this.service.listArtifacts(options);
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

  /**
   * GET /api/v1/artifacts/:id - 获取 Artifact 详情
   */
  async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const artifact = await this.service.getArtifact(id);

      if (!artifact) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Artifact '${id}' not found`,
        });
        return;
      }

      reply.send(artifact);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get artifact',
      });
    }
  }

  /**
   * GET /api/v1/artifacts/:id/download - 下载 Artifact
   */
  async download(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const artifact = await this.service.getArtifact(id);

      if (!artifact) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Artifact '${id}' not found`,
        });
        return;
      }

      // 记录下载
      await this.service.recordDownload(id);

      // 返回下载信息
      reply.send({
        downloadUrl: artifact.storagePath,
        name: artifact.name,
        size: artifact.size,
        checksum: artifact.checksum,
      });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to download artifact',
      });
    }
  }

  /**
   * DELETE /api/v1/artifacts/:id - 删除 Artifact
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const deleted = await this.service.deleteArtifact(id);

      if (!deleted) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Artifact '${id}' not found`,
        });
        return;
      }

      reply.status(204).send();
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete artifact',
      });
    }
  }

  /**
   * POST /api/v1/artifacts/cleanup/expired - 清理过期 Artifact
   */
  async cleanupExpired(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const count = await this.service.cleanupExpired();
      reply.send({ cleaned: count });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to cleanup expired artifacts',
      });
    }
  }
}
