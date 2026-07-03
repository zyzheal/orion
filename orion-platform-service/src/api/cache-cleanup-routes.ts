/**
 * Cache Cleanup API Routes
 * 缓存清理管理 REST API 路由
 *
 * Prefix: /v1/cache-cleanup (handled by register)
 *
 * Endpoints:
 * - GET /v1/cache-cleanup/status - 获取清理服务状态
 * - POST /v1/cache-cleanup/run - 手动触发全量清理
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CacheCleanupService } from '../services/lowcode/CacheCleanupService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

/**
 * 路由选项接口
 */
interface CacheCleanupRoutesOptions {
  cacheCleanupService?: CacheCleanupService;
}

/**
 * 默认导出函数
 */
export default async function cacheCleanupRoutes(
  app: FastifyInstance,
  options: CacheCleanupRoutesOptions
): Promise<void> {
  // 默认不自动创建清理服务实例，由外部传入
  const cleanupService = options.cacheCleanupService || null;

  // ==================== GET /v1/cache-cleanup/status - 清理状态 ====================
  app.get(
    '/status',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        if (!cleanupService) {
          return reply.send({
            success: true,
            data: {
              enabled: false,
              message: 'Cache cleanup service not configured',
            },
          });
        }

        const status = cleanupService.getStatus();

        return reply.send({
          success: true,
          data: status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== POST /v1/cache-cleanup/run - 手动触发清理 ====================
  app.post(
    '/run',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'write' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        if (!cleanupService) {
          return handleError(reply, new ServiceUnavailableError('Cache cleanup service not available'))
        }

        const results = await cleanupService.triggerFullCleanup();

        return reply.send({
          success: true,
          data: {
            cleanedTypes: results.map((r) => ({
              type: r.type,
              deletedCount: r.deletedCount,
              durationMs: r.durationMs,
            })),
            totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
            totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  );
}
