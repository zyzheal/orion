/**
 * Tenant Management API Routes
 *
 * 多租户隔离、配额管理、Namespace 池
 *
 * Prefix: /api/v1/tenant
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TenantContext, TenantInfo, tenantContext } from '../services/tenant/TenantContext';
import { TenantQuotaService, TenantQuota, tenantQuotaService, QuotaCheckResult } from '../services/tenant/TenantQuotaService';
import { NamespacePoolService, namespacePoolService } from '../services/tenant/NamespacePoolService';

interface TenantQuotaUpdate {
  maxPipelines?: number;
  maxPipelineRunsPerDay?: number;
  maxConcurrentRuns?: number;
  maxStorageGb?: number;
  maxNamespaces?: number;
}

interface NamespaceAllocateRequest {
  tenantId: number;
  namespaceType?: 'build' | 'deploy' | 'test';
}

interface NamespaceReleaseRequest {
  namespaceName: string;
}

export default async function tenantRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services
  const context = new TenantContext();
  const quotaService = tenantQuotaService;
  const namespacePool = namespacePoolService;

  // ==================== Tenant Context ====================

  // GET /tenant/context - 获取当前租户上下文
  app.get('/context', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'X-Tenant-ID header is required',
      });
    }

    const tenantId = parseInt(tenantIdHeader, 10);
    const tenantInfo = context.extractTenantFromRequest({
      headers: { 'x-tenant-id': tenantIdHeader },
      user: { tenant_id: tenantId },
    });

    return reply.send({
      context: tenantInfo,
    });
  });

  // ==================== Tenant Quota ====================

  // GET /tenant/quota - 获取租户配额状态
  app.get('/quota', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'X-Tenant-ID header is required',
      });
    }

    const tenantId = parseInt(tenantIdHeader, 10);
    const quota = quotaService.getQuota(tenantId);

    return reply.send({
      quota,
    });
  });

  // PUT /tenant/quota - 更新租户配额
  app.put('/quota', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;
    const body = request.body as TenantQuotaUpdate;

    if (!tenantIdHeader) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'X-Tenant-ID header is required',
      });
    }

    const tenantId = parseInt(tenantIdHeader, 10);

    try {
      const currentQuota = quotaService.getQuota(tenantId);
      const updatedQuota: TenantQuota = {
        ...currentQuota,
        ...body,
        tenantId,
      };

      quotaService.setQuota(updatedQuota);

      return reply.send({
        quota: updatedQuota,
      });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'QUOTA_UPDATE_ERROR',
        message: error.message,
      });
    }
  });

  // POST /tenant/quota/check - 检查租户配额
  app.post('/quota/check', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;
    const body = request.body as {
      resourceType: string;
      amount: number;
    };

    if (!tenantIdHeader) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'X-Tenant-ID header is required',
      });
    }

    const tenantId = parseInt(tenantIdHeader, 10);

    const result = quotaService.checkQuota(
      tenantId,
      body.resourceType,
      body.amount
    );

    return reply.send({
      result,
    });
  });

  // ==================== Namespace Pool ====================

  // GET /tenant/namespace/pool - 获取 Namespace 池状态
  app.get('/namespace/pool', async (request: FastifyRequest, reply: FastifyReply) => {
    const status = namespacePool.getPoolStatus();
    return reply.send({ status });
  });

  // POST /tenant/namespace/allocate - 从 Namespace 池分配
  app.post('/namespace/allocate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as NamespaceAllocateRequest;

    try {
      const result = await namespacePool.allocateNamespace(body.tenantId);

      if (result.success) {
        return reply.status(201).send({
          allocation: result.namespace,
        });
      } else {
        return reply.status(400).send({
          error: 'ALLOCATION_ERROR',
          message: result.error || 'Failed to allocate namespace',
        });
      }
    } catch (error: any) {
      return reply.status(400).send({
        error: 'ALLOCATION_ERROR',
        message: error.message,
      });
    }
  });

  // POST /tenant/namespace/release - 释放 Namespace 到池中
  app.post('/namespace/release', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as NamespaceReleaseRequest;

    try {
      const released = await namespacePool.releaseNamespace(body.namespaceName);

      return reply.send({
        released,
      });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'RELEASE_ERROR',
        message: error.message,
      });
    }
  });

  // GET /tenant/namespace/:tenantId - 获取租户的 Namespaces
  app.get('/namespace/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };

    const namespaces = namespacePool.getTenantNamespaces(parseInt(tenantId, 10));

    return reply.send({
      namespaces,
      count: namespaces.length,
    });
  });

  // ==================== Tenant Middleware Config ====================

  // GET /tenant/middleware/config - 获取中间件配置
  app.get('/middleware/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      config: {
        enabled: true,
        headerName: 'x-tenant-id',
        jwtTenantClaim: 'tenant_id',
      },
    });
  });

  // PUT /tenant/middleware/config - 更新中间件配置
  app.put('/middleware/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      enabled?: boolean;
      headerName?: string;
      jwtTenantClaim?: string;
    };

    return reply.send({
      config: {
        enabled: body.enabled ?? true,
        headerName: body.headerName || 'x-tenant-id',
        jwtTenantClaim: body.jwtTenantClaim || 'tenant_id',
      },
    });
  });
}
