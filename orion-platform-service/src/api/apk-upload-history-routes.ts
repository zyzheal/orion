/**
 * APK Upload History API Routes
 *
 * 路径: /api/v1/apk-upload-history
 * - GET /                          - 列出上传历史
 * - GET /:id                       - 获取单条记录
 * - GET /recent-failures           - 获取最近的失败记录
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import ApkUploadHistoryService from '../services/pipeline/ApkUploadHistoryService';

// Global history service instance
let globalHistoryService: ApkUploadHistoryService | null = null;

export function getApkUploadHistoryService(): ApkUploadHistoryService {
  if (!globalHistoryService) {
    globalHistoryService = new ApkUploadHistoryService();
  }
  return globalHistoryService;
}

// Valid status values
const VALID_STATUSES = ['pending', 'uploading', 'submitted', 'published', 'failed'] as const;

// Valid market values
const VALID_MARKETS = ['huawei', 'xiaomi', 'oppo', 'vivo', 'honor', 'tencent', 'googleplay', 'samsung', 'pgyer', 'fir'] as const;

interface ListQuery {
  limit?: number;
  offset?: number;
  market?: string;
  status?: string;
}

interface IdParams {
  id: string;
}

// Validate and sanitize status parameter
function validateStatus(status?: string): string | undefined {
  if (!status) return undefined;
  return VALID_STATUSES.includes(status as any) ? status : undefined;
}

// Validate and sanitize market parameter
function validateMarket(market?: string): string | undefined {
  if (!market) return undefined;
  return VALID_MARKETS.includes(market as any) ? market : undefined;
}

// Validate and sanitize pagination parameters
function validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const safeLimit = Math.min(Math.max(Math.floor(limit || 50), 1), 100);
  const safeOffset = Math.max(Math.floor(offset || 0), 0);
  return { limit: safeLimit, offset: safeOffset };
}

export async function registerApkUploadHistoryRoutes(app: FastifyInstance): Promise<void> {
  const historyService = getApkUploadHistoryService();

  // Get tenant ID from request - only from authenticated user session
  // Security: Do not trust x-tenant-id header as it can be forged by clients
  const getTenantId = (request: FastifyRequest): string => {
    const user = (request as any).user;
    if (user?.tenantId) return user.tenantId;
    // Fallback only for internal service calls (from same origin)
    const internalCall = request.headers['x-internal-call'] === 'true';
    if (internalCall) {
      const headerTenant = request.headers['x-tenant-id'] as string;
      if (headerTenant) return headerTenant;
    }
    return 'default';
  };

  await app.register(async (instance: FastifyInstance) => {
    // GET /api/v1/apk-upload-history - 列出上传历史
    instance.get('/api/v1/apk-upload-history', {
      onRequest: [authenticateUser, requirePermission({ resource: 'apk-upload', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const query = request.query as ListQuery;

        // Validate and sanitize parameters
        const pagination = validatePagination(query.limit, query.offset);
        const market = validateMarket(query.market);
        const status = validateStatus(query.status);

        const records = await historyService.findByTenant(tenantId, {
          limit: pagination.limit,
          offset: pagination.offset,
          market,
          status: status as any,
        });

        const total = await historyService.countByTenant(tenantId, {
          market,
          status: status as any,
        });

        reply.send({
          data: records,
          total,
          limit: pagination.limit,
          offset: pagination.offset,
        });
      } catch (error) {
        const tenantId = getTenantId(request);
        const query = request.query as ListQuery;
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: `Failed to list history for tenant ${tenantId}, market: ${query.market}`,
        });
      }
    });

    // GET /api/v1/apk-upload-history/recent-failures - 获取最近的失败记录
    instance.get('/api/v1/apk-upload-history/recent-failures', {
      onRequest: [authenticateUser, requirePermission({ resource: 'apk-upload', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const query = request.query as { limit?: number };
        const limit = query.limit || 10;

        const records = await historyService.getRecentFailures(tenantId, limit);

        reply.send({
          data: records,
        });
      } catch (error) {
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get recent failures',
        });
      }
    });

    // GET /api/v1/apk-upload-history/stats - 获取上传统计信息
    instance.get('/api/v1/apk-upload-history/stats', {
      onRequest: [authenticateUser, requirePermission({ resource: 'apk-upload', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const stats = await historyService.getStats(tenantId);

        reply.send({
          data: stats,
        });
      } catch (error) {
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get stats',
        });
      }
    });

    // GET /api/v1/apk-upload-history/:id - 获取单条记录（租户隔离）
    instance.get('/api/v1/apk-upload-history/:id', {
      onRequest: [authenticateUser, requirePermission({ resource: 'apk-upload', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getTenantId(request);
        const params = request.params as IdParams;
        // Use tenant-aware query to prevent cross-tenant access
        const record = await historyService.findByIdAndTenant(params.id, tenantId);

        if (!record) {
          reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Upload record '${params.id}' not found`,
          });
          return;
        }

        reply.send({
          data: record,
        });
      } catch (error) {
        const tenantId = getTenantId(request);
        const params = request.params as IdParams;
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: `Failed to get upload record ${params.id} for tenant ${tenantId}`,
        });
      }
    });
  });
}

/**
 * Record an APK upload result (called from TaskRunner after upload completes)
 */
export async function recordApkUpload(
  tenantId: string,
  data: {
    pipelineRunId?: string;
    pipelineId?: string;
    pipelineName?: string;
    market: string;
    packageName: string;
    versionName?: string;
    versionCode?: number;
    apkPath: string;
    status: 'pending' | 'uploading' | 'submitted' | 'published' | 'failed';
    uploadUrl?: string;
    uploadId?: string;
    error?: string;
    stdout?: string;
    stderr?: string;
    durationMs?: number;
    progress?: number;
  }
): Promise<void> {
  const service = getApkUploadHistoryService();
  await service.create({ tenantId, ...data });
}

/**
 * Update an APK upload record status (called during upload progress)
 */
export async function updateApkUploadProgress(
  id: string,
  updates: {
    status?: 'pending' | 'uploading' | 'submitted' | 'published' | 'failed';
    progress?: number;
    uploadId?: string;
    error?: string;
    stdout?: string;
    stderr?: string;
  }
): Promise<void> {
  const service = getApkUploadHistoryService();
  await service.update(id, updates);
}

export { ApkUploadHistoryService };