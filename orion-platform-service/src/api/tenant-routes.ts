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
import { TenantService, TenantServiceError } from '../services/tenant/TenantService';
import { TenantRepository } from '../services/tenant/TenantRepository';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

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

/**
 * Options passed to tenant routes via app.register()
 * Follows the same pattern as cost-routes.ts, config-routes.ts, etc.
 */
interface TenantRoutesOptions {
  database?: DatabasePool;
}

export default async function tenantRoutes(
  app: FastifyInstance,
  options: TenantRoutesOptions
): Promise<void> {
  // Initialize services
  const context = new TenantContext();
  const quotaService = options.database
    ? new TenantQuotaService(options.database)
    : tenantQuotaService;
  const namespacePool = namespacePoolService;

  // Initialize database-backed TenantService via Repository pattern
  let tenantService: TenantService | null = null;
  if (options.database) {
    const tenantRepository = new TenantRepository(options.database);
    tenantService = new TenantService(tenantRepository);
    console.log('[TenantRoutes] Database-backed TenantService and TenantQuotaService initialized');
  } else {
    console.warn('[TenantRoutes] Database not available, tenant CRUD routes will not be functional');
  }

  // ==================== Tenant Context ====================

  // GET /tenant/context - 获取当前租户上下文
  app.get('/context', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/quota', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'X-Tenant-ID header is required',
      });
    }

    const tenantId = parseInt(tenantIdHeader, 10);
    const quota = await quotaService.getQuota(tenantId);

    return reply.send({
      quota,
    });
  });

  // PUT /tenant/quota - 更新租户配额
  app.put('/quota', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
      const currentQuota = await quotaService.getQuota(tenantId);
      const updatedQuota: TenantQuota = {
        ...currentQuota,
        ...body,
        tenantId,
      };

      await quotaService.setQuota(updatedQuota);

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
      resource: string;
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

  // ==================== Tenant CRUD (Database-backed) ====================

  // GET /tenant - List all tenants
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20', status } = request.query as Record<string, string>;
    
    if (tenantService) {
      try {
        const result = await tenantService.listTenants({
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          status,
        });
        return reply.send(result);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'LIST_ERROR',
          message: error.message,
        });
      }
    }

    // Fallback: return empty list if no database
    return reply.send({
      data: [],
      total: 0,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: 0,
    });
  });

  // GET /tenant/:id - Get tenant by ID
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (tenantService) {
      try {
        const tenant = await tenantService.getTenant(id);
        return reply.send(tenant);
      } catch (error: any) {
        if (error instanceof TenantServiceError && error.code === 'TENANT_NOT_FOUND') {
          return reply.status(404).send({
            error: 'TENANT_NOT_FOUND',
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'GET_ERROR',
          message: error.message,
        });
      }
    }

    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database not available',
    });
  });

  // POST /tenant - Create new tenant
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      display_name?: string;
      settings?: Record<string, any>;
    };

    if (tenantService) {
      try {
        const tenant = await tenantService.createTenant(body);
        return reply.status(201).send(tenant);
      } catch (error: any) {
        if (error instanceof TenantServiceError) {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'CREATE_ERROR',
          message: error.message,
        });
      }
    }

    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database not available',
    });
  });

  // PUT /tenant/:id - Update tenant
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      display_name?: string;
      status?: string;
      settings?: Record<string, any>;
    };

    if (tenantService) {
      try {
        const tenant = await tenantService.updateTenant(id, body);
        return reply.send(tenant);
      } catch (error: any) {
        if (error instanceof TenantServiceError) {
          const statusCode = error.code === 'TENANT_NOT_FOUND' ? 404 : 400;
          return reply.status(statusCode).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'UPDATE_ERROR',
          message: error.message,
        });
      }
    }

    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database not available',
    });
  });

  // DELETE /tenant/:id - Delete tenant (soft delete)
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (tenantService) {
      try {
        await tenantService.deleteTenant(id);
        return reply.status(204).send();
      } catch (error: any) {
        if (error instanceof TenantServiceError) {
          const statusCode = error.code === 'TENANT_NOT_FOUND' ? 404 : 400;
          return reply.status(statusCode).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'DELETE_ERROR',
          message: error.message,
        });
      }
    }

    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database not available',
    });
  });

  // GET /tenant/count - Get tenant count
  app.get('/count', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status } = request.query as Record<string, string>;

    if (tenantService) {
      try {
        const result = await tenantService.listTenants({ limit: 1, status });
        return reply.send({ total: result.total });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'COUNT_ERROR',
          message: error.message,
        });
      }
    }

    return reply.send({ total: 0 });
  });
}
