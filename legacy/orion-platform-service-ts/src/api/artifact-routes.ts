/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/artifact/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Artifact Registry API Routes
 * 制品仓库 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ArtifactController } from './controllers/artifact/ArtifactController';
import { ArtifactRegistryServiceImpl } from '../services/artifact/ArtifactRegistryService';
import { PostgresArtifactRepository } from '../repositories/ArtifactRepository';
import { LocalArtifactStorage } from '../storage/ArtifactStorage';
import { PromotionService, PromotionStage } from '../services/artifact/PromotionService';
import { OrionError, ValidationError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

interface ArtifactRoutesOptions {
  database?: DatabasePool;
}

export default async function artifactRoutes(
  app: FastifyInstance,
  options: ArtifactRoutesOptions
): Promise<void> {
  // 初始化依赖
  const artifactRepository = options.database
    ? new PostgresArtifactRepository(options.database)
    : null;
  const artifactStorage = new LocalArtifactStorage('/tmp/artifacts');
  const artifactService = artifactRepository
    ? new ArtifactRegistryServiceImpl(artifactRepository, artifactStorage)
    : null;
  const artifactController = artifactService ? new ArtifactController(artifactService) : null;
  const promotionService = new PromotionService();

  // DB 不可用时的统一错误响应
  const dbUnavailable = async (_request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
  };

  // ==================== 制品管理 ====================

  // POST /artifacts - 创建制品
  app.post('/artifacts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.create(request, reply);
  });

  // GET /artifacts - 获取制品列表
  app.get('/artifacts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.list(request, reply);
  });

  // GET /artifacts/:id - 获取制品详情
  app.get('/artifacts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.getById(request, reply);
  });

  // PUT /artifacts/:id - 更新制品
  app.put('/artifacts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.update(request, reply);
  });

  // DELETE /artifacts/:id - 删除制品
  app.delete('/artifacts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.delete(request, reply);
  });

  // ==================== 标签管理 ====================

  // POST /artifacts/:id/tags - 添加标签
  app.post('/artifacts/:id/tags', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.addTags(request, reply);
  });

  // DELETE /artifacts/:id/tags - 移除标签
  app.delete('/artifacts/:id/tags', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.removeTags(request, reply);
  });

  // GET /artifacts/:id/tags - 获取标签
  app.get('/artifacts/:id/tags', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.getTags(request, reply);
  });

  // ==================== 下载管理 ====================

  // GET /artifacts/:id/download - 下载制品
  app.get('/artifacts/:id/download', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.download(request, reply);
  });

  // GET /artifacts/:id/downloads - 获取下载历史
  app.get('/artifacts/:id/downloads', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.getDownloadHistory(request, reply);
  });

  // ==================== 搜索和操作 ====================

  // GET /artifacts/search - 搜索制品
  app.get('/artifacts/search', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.search(request, reply);
  });

  // POST /artifacts/:id/promote - 制品升级
  app.post('/artifacts/:id/promote', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { promotedBy, approvedBy, reason } = request.body as any;

    try {
      if (approvedBy) {
        const record = await promotionService.promoteWithApproval(id, promotedBy, approvedBy, reason);
        return reply.send(record);
      }
      const record = await promotionService.promote(id, promotedBy, reason);
      return reply.send(record);
    } catch (err: any) {
      return handleError(reply, new ValidationError(err.message));
    }
  });

  // GET /artifacts/:id/stage - 获取当前阶段
  app.get('/artifacts/:id/stage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const stage = await promotionService.getCurrentStage(id);
    if (!stage) return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ stage });
  });

  // GET /artifacts/:id/history - 获取晋升历史
  app.get('/artifacts/:id/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send({ history: promotionService.getHistory(id) });
  });

  // POST /artifacts/:id/deprecate - 废弃制品
  app.post('/artifacts/:id/deprecate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.deprecate(request, reply);
  });

  // POST /artifacts/:id/quarantine - 隔离制品
  app.post('/artifacts/:id/quarantine', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactController) return dbUnavailable(request, reply);
    return artifactController.quarantine(request, reply);
  });

  // ==================== 统计信息 ====================

  // GET /artifacts/stats - 获取统计信息
  app.get('/artifacts/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactRepository) return dbUnavailable(request, reply);
    try {
      const stats = await artifactRepository.getStats();
      reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      return handleError(reply, new OrionError('Failed to get stats', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /artifacts/types - 获取制品类型统计
  app.get('/artifacts/types', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactRepository) return dbUnavailable(request, reply);
    try {
      const typeStats = await artifactRepository.getTypeStats();
      reply.send({
        success: true,
        data: typeStats
      });
    } catch (error) {
      return handleError(reply, new OrionError('Failed to get type stats', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /artifacts/namespaces - 获取命名空间列表
  app.get('/artifacts/namespaces', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!artifactRepository) return dbUnavailable(request, reply);
    try {
      const namespaces = await artifactRepository.getNamespaces();
      reply.send({
        success: true,
        data: namespaces
      });
    } catch (error) {
      return handleError(reply, new OrionError('Failed to get namespaces', ErrorCode.INTERNAL_ERROR));
    }
  });
}