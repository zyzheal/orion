/**
 * Artifact Registry API Routes
 * 制品仓库 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactController } from './controllers/artifact/ArtifactController';
import { ArtifactRegistryServiceImpl } from '../services/artifact/ArtifactRegistryService';
import { PostgresArtifactRepository } from '../repositories/ArtifactRepository';
import { LocalArtifactStorage } from '../storage/ArtifactStorage';
import { PromotionService, PromotionStage } from '../services/artifact/PromotionService';

export default async function artifactRoutes(app: FastifyInstance): Promise<void> {
  // 初始化依赖
  const artifactRepository = new PostgresArtifactRepository((app as any).db);
  const artifactStorage = new LocalArtifactStorage('/tmp/artifacts');
  const artifactService = new ArtifactRegistryServiceImpl(artifactRepository, artifactStorage);
  const artifactController = new ArtifactController(artifactService);
  const promotionService = new PromotionService();

  // ==================== 制品管理 ====================

  // POST /artifacts - 创建制品
  app.post('/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.create(request, reply);
  });

  // GET /artifacts - 获取制品列表
  app.get('/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.list(request, reply);
  });

  // GET /artifacts/:id - 获取制品详情
  app.get('/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.getById(request, reply);
  });

  // PUT /artifacts/:id - 更新制品
  app.put('/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.update(request, reply);
  });

  // DELETE /artifacts/:id - 删除制品
  app.delete('/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.delete(request, reply);
  });

  // ==================== 标签管理 ====================

  // POST /artifacts/:id/tags - 添加标签
  app.post('/artifacts/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.addTags(request, reply);
  });

  // DELETE /artifacts/:id/tags - 移除标签
  app.delete('/artifacts/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.removeTags(request, reply);
  });

  // GET /artifacts/:id/tags - 获取标签
  app.get('/artifacts/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.getTags(request, reply);
  });

  // ==================== 下载管理 ====================

  // GET /artifacts/:id/download - 下载制品
  app.get('/artifacts/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.download(request, reply);
  });

  // GET /artifacts/:id/downloads - 获取下载历史
  app.get('/artifacts/:id/downloads', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.getDownloadHistory(request, reply);
  });

  // ==================== 搜索和操作 ====================

  // GET /artifacts/search - 搜索制品
  app.get('/artifacts/search', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.search(request, reply);
  });

  // POST /artifacts/:id/promote - 制品升级
  app.post('/artifacts/:id/promote', async (request: FastifyRequest, reply: FastifyReply) => {
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
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /artifacts/:id/stage - 获取当前阶段
  app.get('/artifacts/:id/stage', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const stage = promotionService.getCurrentStage(id);
    if (!stage) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send({ stage });
  });

  // GET /artifacts/:id/history - 获取晋升历史
  app.get('/artifacts/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send({ history: promotionService.getHistory(id) });
  });

  // POST /artifacts/:id/deprecate - 废弃制品
  app.post('/artifacts/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.deprecate(request, reply);
  });

  // POST /artifacts/:id/quarantine - 隔离制品
  app.post('/artifacts/:id/quarantine', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.quarantine(request, reply);
  });

  // ==================== 统计信息 ====================

  // GET /artifacts/stats - 获取统计信息
  app.get('/artifacts/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await artifactRepository.getStats();
      reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get stats' });
    }
  });

  // GET /artifacts/types - 获取制品类型统计
  app.get('/artifacts/types', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const typeStats = await artifactRepository.getTypeStats();
      reply.send({
        success: true,
        data: typeStats
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get type stats' });
    }
  });

  // GET /artifacts/namespaces - 获取命名空间列表
  app.get('/artifacts/namespaces', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const namespaces = await artifactRepository.getNamespaces();
      reply.send({
        success: true,
        data: namespaces
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get namespaces' });
    }
  });
}