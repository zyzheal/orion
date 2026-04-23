/**
 * Build Environment API Routes - 构建环境管理路由
 *
 * 注册以下路由：
 * - /build-images       - Builder 镜像管理
 * - /build-cache        - 构建缓存管理
 * - /build-pods         - K8s 构建执行
 * - /build-logs         - 构建日志管理
 * - /artifacts          - 构建产物管理
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BuilderImageService } from '../services/build/BuilderImageService';
import { BuildCacheService } from '../services/build/BuildCacheService';
import { K8sBuildExecutor } from '../services/build/K8sBuildExecutor';
import { BuildLogService } from '../services/build/BuildLogService';
import { ArtifactService } from '../services/build/ArtifactService';
import { BuildxBuilderService } from '../services/build/BuildxBuilderService';
import { BuilderImageController } from './controllers/build/BuilderImageController';
import { BuildCacheController } from './controllers/build/BuildCacheController';
import { K8sBuildController } from './controllers/build/K8sBuildController';
import { BuildLogController } from './controllers/build/BuildLogController';
import { ArtifactController } from './controllers/build/ArtifactController';
import { StageCacheController } from './controllers/build/StageCacheController';
import { BuildxBuilderController } from './controllers/build/BuildxBuilderController';

export default async function buildRoutes(app: FastifyInstance): Promise<void> {
  // 初始化服务
  const builderImageService = new BuilderImageService();
  const buildCacheService = new BuildCacheService();
  const k8sBuildExecutor = new K8sBuildExecutor(
    undefined,  // 使用 Mock K8s 客户端
    buildCacheService,
    builderImageService
  );
  const buildLogService = new BuildLogService();
  const artifactService = new ArtifactService();
  const buildxBuilderService = new BuildxBuilderService();

  // 初始化控制器
  const builderImageController = new BuilderImageController(builderImageService);
  const buildCacheController = new BuildCacheController(buildCacheService);
  const k8sBuildController = new K8sBuildController(k8sBuildExecutor);
  const buildLogController = new BuildLogController(buildLogService);
  const artifactController = new ArtifactController(artifactService);
  const stageCacheController = new StageCacheController(buildCacheService, artifactService);
  const buildxBuilderController = new BuildxBuilderController(buildxBuilderService);

  // ==================== Builder 镜像路由 ====================

  // POST /build-images - 注册新镜像
  app.post('/build-images', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.create(request, reply);
  });

  // GET /build-images - 镜像列表
  app.get('/build-images', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.list(request, reply);
  });

  // GET /build-images/presets - 预置镜像
  app.get('/build-images/presets', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.getPresets(request, reply);
  });

  // GET /build-images/available - 可用镜像
  app.get('/build-images/available', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.getAvailable(request, reply);
  });

  // GET /build-images/type/:type - 按类型获取镜像
  app.get('/build-images/type/:type', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.getByType(request, reply);
  });

  // GET /build-images/:id - 镜像详情
  app.get('/build-images/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.getById(request, reply);
  });

  // PUT /build-images/:id - 更新镜像
  app.put('/build-images/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.update(request, reply);
  });

  // POST /build-images/:id/deprecate - 弃用镜像
  app.post('/build-images/:id/deprecate', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.deprecate(request, reply);
  });

  // POST /build-images/:id/restore - 恢复镜像
  app.post('/build-images/:id/restore', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.restore(request, reply);
  });

  // DELETE /build-images/:id - 删除镜像
  app.delete('/build-images/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return builderImageController.delete(request, reply);
  });

  // ==================== 构建缓存路由 ====================

  // POST /build-cache/configs - 创建缓存配置
  app.post('/build-cache/configs', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.createConfig(request, reply);
  });

  // GET /build-cache/configs - 缓存配置列表
  app.get('/build-cache/configs', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.listConfigs(request, reply);
  });

  // GET /build-cache/configs/:id - 缓存配置详情
  app.get('/build-cache/configs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.getConfig(request, reply);
  });

  // PUT /build-cache/configs/:id - 更新缓存配置
  app.put('/build-cache/configs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.updateConfig(request, reply);
  });

  // DELETE /build-cache/configs/:id - 删除缓存配置
  app.delete('/build-cache/configs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.deleteConfig(request, reply);
  });

  // GET /build-cache/effective - 生效的缓存配置（三级级联）
  app.get('/build-cache/effective', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.getEffectiveConfig(request, reply);
  });

  // GET /build-cache/enabled - 检查缓存是否启用
  app.get('/build-cache/enabled', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.isCacheEnabled(request, reply);
  });

  // POST /build-cache/entries - 创建缓存条目
  app.post('/build-cache/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.createEntry(request, reply);
  });

  // GET /build-cache/entries - 缓存条目列表
  app.get('/build-cache/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.listEntries(request, reply);
  });

  // DELETE /build-cache/entries/:id - 删除缓存条目
  app.delete('/build-cache/entries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.deleteEntry(request, reply);
  });

  // POST /build-cache/cleanup/expired - 清理过期缓存
  app.post('/build-cache/cleanup/expired', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.cleanupExpired(request, reply);
  });

  // POST /build-cache/cleanup/lru - LRU 清理
  app.post('/build-cache/cleanup/lru', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.cleanupLRU(request, reply);
  });

  // POST /build-cache/clear/:configId - 清空配置缓存
  app.post('/build-cache/clear/:configId', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildCacheController.clearConfigCache(request, reply);
  });

  // ==================== K8s 构建执行路由 ====================

  // POST /build-pods - 创建构建 Pod
  app.post('/build-pods', async (request: FastifyRequest, reply: FastifyReply) => {
    return k8sBuildController.createPod(request, reply);
  });

  // GET /build-pods - Pod 列表
  app.get('/build-pods', async (request: FastifyRequest, reply: FastifyReply) => {
    return k8sBuildController.listPods(request, reply);
  });

  // GET /build-pods/:id - Pod 状态
  app.get('/build-pods/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return k8sBuildController.getPodStatus(request, reply);
  });

  // GET /build-pods/:id/logs - Pod 日志
  app.get('/build-pods/:id/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return k8sBuildController.getPodLogs(request, reply);
  });

  // POST /build-pods/:id/cancel - 取消构建
  app.post('/build-pods/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return k8sBuildController.cancelBuild(request, reply);
  });

  // POST /build-pods/cleanup - 清理完成的 Pod
  app.post('/build-pods/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
    return k8sBuildController.cleanupPods(request, reply);
  });

  // ==================== 构建日志路由 ====================

  // POST /build-logs - 创建日志
  app.post('/build-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.createLog(request, reply);
  });

  // GET /build-logs - 查询日志
  app.get('/build-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.queryLogs(request, reply);
  });

  // GET /build-logs/:id - 日志详情
  app.get('/build-logs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.getLog(request, reply);
  });

  // GET /build-logs/:id/text - 格式化日志文本
  app.get('/build-logs/:id/text', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.getLogText(request, reply);
  });

  // POST /build-logs/:id/entries - 追加日志
  app.post('/build-logs/:id/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.appendEntry(request, reply);
  });

  // POST /build-logs/:id/entries/batch - 批量追加日志
  app.post('/build-logs/:id/entries/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.appendEntries(request, reply);
  });

  // POST /build-logs/:id/import - 导入原始日志文本
  app.post('/build-logs/:id/import', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.importLogs(request, reply);
  });

  // POST /build-logs/:id/complete - 标记日志完成
  app.post('/build-logs/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.completeLog(request, reply);
  });

  // GET /build-logs/:id/stream - SSE 日志流
  app.get('/build-logs/:id/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildLogController.streamLogs(request, reply);
  });

  // ==================== Artifact 管理路由 ====================

  // POST /api/v1/artifacts - 创建 Artifact（上传）
  app.post('/api/v1/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.create(request, reply);
  });

  // GET /api/v1/artifacts - 查询 Artifact 列表
  app.get('/api/v1/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.list(request, reply);
  });

  // GET /api/v1/artifacts/:id - 获取 Artifact 详情
  app.get('/api/v1/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.get(request, reply);
  });

  // GET /api/v1/artifacts/:id/download - 下载 Artifact
  app.get('/api/v1/artifacts/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.download(request, reply);
  });

  // DELETE /api/v1/artifacts/:id - 删除 Artifact
  app.delete('/api/v1/artifacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.delete(request, reply);
  });

  // POST /api/v1/artifacts/cleanup/expired - 清理过期 Artifact
  app.post('/api/v1/artifacts/cleanup/expired', async (request: FastifyRequest, reply: FastifyReply) => {
    return artifactController.cleanupExpired(request, reply);
  });

  // ==================== Stage 级别缓存和 Artifact 路由 ====================

  // POST /api/v1/pipeline-runs/:runId/stages/:stageId/cache - 保存缓存
  app.post('/pipeline-runs/:runId/stages/:stageId/cache', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageCacheController.saveCache(request, reply);
  });

  // GET /api/v1/pipeline-runs/:runId/stages/:stageId/cache - 恢复缓存
  app.get('/pipeline-runs/:runId/stages/:stageId/cache', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageCacheController.restoreCache(request, reply);
  });

  // POST /api/v1/pipeline-runs/:runId/stages/:stageId/artifacts - 上传 Artifact
  app.post('/pipeline-runs/:runId/stages/:stageId/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageCacheController.uploadArtifact(request, reply);
  });

  // GET /api/v1/pipeline-runs/:runId/stages/:stageId/artifacts - 获取 Artifact 列表
  app.get('/pipeline-runs/:runId/stages/:stageId/artifacts', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageCacheController.listArtifacts(request, reply);
  });

  // ==================== Buildx Builder 路由 ====================

  // POST /build/buildx - 多架构构建
  app.post('/build/buildx', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.buildMultiArch(request, reply);
  });

  // GET /build/buildx/builders - 获取构建器列表
  app.get('/build/buildx/builders', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.getBuilders(request, reply);
  });

  // GET /build/buildx/current - 获取当前构建器
  app.get('/build/buildx/current', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.getCurrentBuilder(request, reply);
  });

  // POST /build/buildx/validate - 验证构建配置
  app.post('/build/buildx/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.validateBuildConfig(request, reply);
  });

  // GET /build/buildx/history - 获取构建历史
  app.get('/build/buildx/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.getBuildHistory(request, reply);
  });

  // POST /build/buildx/:buildId/cancel - 取消构建
  app.post('/build/buildx/:buildId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.cancelBuild(request, reply);
  });

  // GET /build/buildx/:buildId/status - 获取构建状态
  app.get('/build/buildx/:buildId/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return buildxBuilderController.getBuildStatus(request, reply);
  });
}
