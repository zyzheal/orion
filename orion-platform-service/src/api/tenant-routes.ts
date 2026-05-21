/**
 * Tenant Management API Routes
 *
 * 多租户隔离、配额管理、Namespace 池
 *
 * Prefix: /api/v1/tenant
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
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
  tenantId: string;
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

  // GET /tenant/my-tenants - 获取当前用户所属的租户列表
  app.get('/my-tenants', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as { userId?: string; userID?: string } | undefined;
    const userId = user?.userId || user?.userID;

    if (!userId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    // Query tenant_users table to get user's tenants
    try {
      const result = await options.database?.query(
        `SELECT t.id, t.name, t.display_name, t.status, tu.role, t.created_at
         FROM tenants t
         INNER JOIN tenant_users tu ON t.id = tu.tenant_id
         WHERE tu.user_id = $1 AND t.status = 'active'
         ORDER BY tu.role DESC, t.display_name ASC`,
        [userId]
      );

      const tenants = result?.rows || [];

      // Get current tenant from header or default to first
      const currentTenantId = request.headers['x-tenant-id'] as string;
      const tenantsWithCurrent = tenants.map((t: any) => ({
        ...t,
        isCurrent: t.id === currentTenantId,
      }));

      return reply.send({
        tenants: tenantsWithCurrent,
        total: tenantsWithCurrent.length,
        currentTenant: tenantsWithCurrent.find((t: any) => t.isCurrent) || tenantsWithCurrent[0] || null,
      });
    } catch (error: any) {
      console.error('[tenant/my-tenants] Error:', error);
      return reply.status(500).send({
        error: 'MY_TENANTS_ERROR',
        message: error.message,
      });
    }
  });

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

    const tenantIdStr = tenantIdHeader;
    // Try numeric fallback for backward compatibility
    const tenantIdNum = parseInt(tenantIdHeader, 10);
    const quota = await quotaService.getQuota(isNaN(tenantIdNum) ? 0 : tenantIdNum, tenantIdStr);

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

    const tenantIdStr = tenantIdHeader;
    const tenantIdNum = parseInt(tenantIdHeader, 10);
    const tenantId = isNaN(tenantIdNum) ? 0 : tenantIdNum;

    try {
      const currentQuota = await quotaService.getQuota(tenantId, tenantIdStr);
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
  app.post('/quota/check', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    const tenantIdStr = tenantIdHeader;
    const tenantIdNum = parseInt(tenantIdHeader, 10);
    const tenantId = isNaN(tenantIdNum) ? 0 : tenantIdNum;

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
  app.get('/namespace/pool', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const status = namespacePool.getPoolStatus();
    return reply.send({ status });
  });

  // POST /tenant/namespace/allocate - 从 Namespace 池分配
  app.post('/namespace/allocate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.post('/namespace/release', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/namespace/:tenantId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };

    const namespaces = namespacePool.getTenantNamespaces(parseInt(tenantId, 10));

    return reply.send({
      namespaces,
      count: namespaces.length,
    });
  });

  // ==================== Tenant Middleware Config ====================

  // GET /tenant/middleware/config - 获取中间件配置
  app.get('/middleware/config', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      config: {
        enabled: true,
        headerName: 'x-tenant-id',
        jwtTenantClaim: 'tenant_id',
      },
    });
  });

  // PUT /tenant/middleware/config - 更新中间件配置
  app.put('/middleware/config', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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

  // POST /tenant - Create new tenant (with auto quota + namespace allocation)
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      display_name?: string;
      settings?: Record<string, any>;
      autoAllocateNamespace?: boolean;
      initialNamespaceCount?: number;
      customQuota?: Partial<{
        maxPipelines: number;
        maxPipelineRunsPerDay: number;
        maxConcurrentRuns: number;
        maxRunners: number;
        maxCpuCores: number;
        maxMemoryGb: number;
        maxStorageGb: number;
        maxNamespaces: number;
      }>;
    };

    if (tenantService) {
      try {
        // 1. Create tenant
        const tenant = await tenantService.createTenant({
          name: body.name,
          display_name: body.display_name,
          settings: body.settings,
        });

        // 2. Initialize quota (with defaults or custom)
        if (quotaService) {
          const defaultQuota = {
            maxPipelines: 100,
            maxPipelineRunsPerDay: 1000,
            maxConcurrentRuns: 10,
            maxTasksPerPipeline: 50,
            maxRunners: 5,
            maxCpuCores: 16,
            maxMemoryGb: 32,
            maxStorageGb: 100,
            maxNamespaces: 10,
            apiRateLimit: 1000,
            apiRateLimitWindowSeconds: 60,
          };

          await quotaService.setQuota({
            tenantId: 0, // Will be overridden by tenant UUID in repo
            ...defaultQuota,
            ...body.customQuota,
          });
        }

        // 3. Auto allocate namespaces if requested
        const allocatedNamespaces: any[] = [];
        const nsCount = body.autoAllocateNamespace ? (body.initialNamespaceCount || 1) : 0;
        for (let i = 0; i < nsCount; i++) {
          const result = await namespacePool.allocateNamespace(tenant.id, {
            purpose: body.settings?.namespacePurpose || 'tenant-workspace',
          });
          if (result.success && result.namespace) {
            allocatedNamespaces.push(result.namespace);
          }
        }

        return reply.status(201).send({
          ...tenant,
          allocatedNamespaces: allocatedNamespaces.length > 0 ? allocatedNamespaces : undefined,
          message: body.autoAllocateNamespace
            ? `Tenant created with ${allocatedNamespaces.length} namespace(s) allocated`
            : 'Tenant created successfully',
        });
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
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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

  // POST /tenant/:id/split - 拆分租户
  app.post('/:id/split', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      newTenantName: string;
      newTenantDisplayName?: string;
      migrateUsers?: string[];           // 要迁移的用户 ID 列表
      migrateNamespaces?: string[];      // 要迁移的 Namespace 名称列表
      splitResources?: {
        pipelines?: string[];            // 要迁移的 Pipeline ID 列表
      };
      keepOriginalUsers?: boolean;       // 是否保留原租户访问权限
    };

    if (!options.database || !tenantService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    try {
      // 1. 验证原租户存在
      const originalTenant = await tenantService.getTenant(id);

      // 2. 创建新租户
      const newTenant = await tenantService.createTenant({
        name: body.newTenantName,
        display_name: body.newTenantDisplayName || `${originalTenant.display_name || originalTenant.name}-拆分`,
      });

      // 3. 迁移用户
      const migratedUsers: string[] = [];
      if (body.migrateUsers && body.migrateUsers.length > 0) {
        for (const userId of body.migrateUsers) {
          // 添加用户到新租户
          await options.database.query(
            `INSERT INTO tenant_users (tenant_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'member'`,
            [newTenant.id, userId]
          );

          // 如果保留原租户权限，不删除原关联；否则删除
          if (!body.keepOriginalUsers) {
            await options.database.query(
              'DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
              [id, userId]
            );
          }
          migratedUsers.push(userId);
        }
      }

      // 4. 迁移 Namespace
      const migratedNamespaces: string[] = [];
      if (body.migrateNamespaces && body.migrateNamespaces.length > 0) {
        for (const nsName of body.migrateNamespaces) {
          await options.database.query(
            `UPDATE namespace_allocations
             SET tenant_id = $1, updated_at = NOW()
             WHERE namespace_name = $2 AND tenant_id = $3`,
            [newTenant.id, nsName, id]
          );
          migratedNamespaces.push(nsName);
        }
      }

      // 5. 迁移 Pipeline
      const migratedPipelines: string[] = [];
      if (body.splitResources?.pipelines && body.splitResources.pipelines.length > 0) {
        for (const pipelineId of body.splitResources.pipelines) {
          // 更新 pipeline 的租户关联（需要在 pipelines 表有 tenant_id 字段）
          try {
            await options.database.query(
              `UPDATE pipelines SET tenant_id = $1 WHERE id = $2 AND tenant_id = $3`,
              [newTenant.id, pipelineId, id]
            );
            migratedPipelines.push(pipelineId);
          } catch (e) {
            console.warn('[tenant/split] Pipeline migration skipped:', pipelineId, e);
          }
        }
      }

      // 6. 复制配额设置到新租户
      if (quotaService) {
        const originalQuota = await quotaService.getQuota(0, id);
        await quotaService.setQuota({
          ...originalQuota,
          tenantId: 0, // 会根据新租户 UUID 重新存储
        });
      }

      return reply.status(201).send({
        success: true,
        originalTenant: {
          id: originalTenant.id,
          name: originalTenant.name,
          display_name: originalTenant.display_name,
        },
        newTenant: {
          id: newTenant.id,
          name: newTenant.name,
          display_name: newTenant.display_name,
        },
        migrated: {
          users: migratedUsers,
          namespaces: migratedNamespaces,
          pipelines: migratedPipelines,
        },
        message: `租户拆分完成：迁移 ${migratedUsers.length} 用户、${migratedNamespaces.length} Namespace、${migratedPipelines.length} Pipeline`,
      });
    } catch (error: any) {
      console.error('[tenant/split] Error:', error);
      return reply.status(400).send({
        error: 'SPLIT_ERROR',
        message: error.message || '租户拆分失败',
      });
    }
  });

  // GET /tenant/count - Get tenant count
  app.get('/count', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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

  // ==================== Tenant Usage Statistics ====================

  // GET /tenant/usage - 获取租户配额使用率统计
  app.get('/usage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'X-Tenant-ID header is required',
      });
    }

    const tenantIdStr = tenantIdHeader;
    const tenantIdNum = parseInt(tenantIdHeader, 10);
    const tenantId = isNaN(tenantIdNum) ? 0 : tenantIdNum;

    try {
      const [quota, namespaceStats] = await Promise.all([
        quotaService.getQuota(tenantId, tenantIdStr),
        namespacePool.getTenantNamespaces(tenantId),
      ]);

      // Build usage report with real data
      const usage = {
        pipelines: { used: 0, limit: quota.maxPipelines },
        runners: { used: 0, limit: quota.maxRunners },
        namespaces: { used: namespaceStats.length, limit: quota.maxNamespaces },
        concurrentRuns: { used: 0, limit: quota.maxConcurrentRuns },
        cpuCores: { used: 0, limit: quota.maxCpuCores },
        memoryGb: { used: 0, limit: quota.maxMemoryGb },
        storageGb: { used: 0, limit: quota.maxStorageGb },
        pipelineRunsPerDay: { used: 0, limit: quota.maxPipelineRunsPerDay },
      };

      return reply.send({ usage, quota });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'USAGE_STATS_ERROR',
        message: error.message,
      });
    }
  });

  // GET /tenant/namespace/:tenantId/usage - 获取租户 Namespace 使用详情
  app.get('/namespace/:tenantId/usage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };

    const namespaces = namespacePool.getTenantNamespaces(parseInt(tenantId, 10) || 0);

    const namespaceDetails = namespaces.map(ns => ({
      id: ns.id,
      namespaceName: ns.namespaceName,
      status: ns.status,
      allocatedAt: ns.allocatedAt,
      runnerCount: 0,
      pipelineCount: 0,
      activeRuns: 0,
      cpuUsed: 0,
      memoryUsed: 0,
    }));

    return reply.send({
      namespaces: namespaceDetails,
      total: namespaceDetails.length,
    });
  });

  // ==================== Tenant User Management ====================

  // GET /tenant/:id/users - 获取租户用户列表
  app.get('/:id/users', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    if (!options.database) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    try {
      const result = await options.database.query(
        `SELECT tu.user_id, tu.role, tu.created_at, tu.updated_at,
                u.username, u.email, u.display_name, u.status as user_status
         FROM tenant_users tu
         LEFT JOIN users u ON tu.user_id = u.id
         WHERE tu.tenant_id = $1
         ORDER BY tu.role DESC, tu.created_at ASC`,
        [id]
      );

      return reply.send({
        users: result.rows,
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('[tenant/users] Error:', error);
      return reply.status(500).send({
        error: 'GET_USERS_ERROR',
        message: error.message,
      });
    }
  });

  // DELETE /tenant/:id/users/:userId - 从租户移除用户
  app.delete('/:id/users/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, userId } = request.params as { id: string; userId: string };

    if (!options.database) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    // 获取当前用户信息
    const currentUser = (request as any).user as { userId?: string; userID?: string } | undefined;
    const currentUserId = currentUser?.userId || currentUser?.userID;

    // 防止自己移除自己（至少保留一个管理员）
    if (userId === currentUserId) {
      return reply.status(400).send({
        error: 'CANNOT_REMOVE_SELF',
        message: 'Cannot remove yourself from the tenant',
      });
    }

    try {
      // 检查是否为最后一个管理员
      const adminCheck = await options.database.query(
        `SELECT role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (adminCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'USER_NOT_FOUND',
          message: 'User is not a member of this tenant',
        });
      }

      const userRole = adminCheck.rows[0].role;

      // 如果是最后一个管理员，需要检查是否还有其他管理员
      if (userRole === 'owner' || userRole === 'admin') {
        const adminCount = await options.database.query(
          `SELECT COUNT(*) as count FROM tenant_users
           WHERE tenant_id = $1 AND (role = 'owner' OR role = 'admin')`,
          [id]
        );

        if (parseInt(adminCount.rows[0].count, 10) <= 1) {
          return reply.status(400).send({
            error: 'CANNOT_REMOVE_LAST_ADMIN',
            message: 'Cannot remove the last administrator from the tenant',
          });
        }
      }

      // 执行删除
      await options.database.query(
        'DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
        [id, userId]
      );

      return reply.status(200).send({
        success: true,
        message: 'User removed from tenant successfully',
      });
    } catch (error: any) {
      console.error('[tenant/users/delete] Error:', error);
      return reply.status(500).send({
        error: 'REMOVE_USER_ERROR',
        message: error.message,
      });
    }
  });

  // ==================== Tenant Invitation System ====================

  // POST /tenant/:id/invite - 邀请用户加入租户
  app.post('/:id/invite', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      email: string;
      role?: string;
      message?: string;
      expiresInDays?: number;
    };

    if (!body.email) {
      return reply.status(400).send({
        error: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    if (!options.database) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    // 获取当前用户信息
    const currentUser = (request as any).user as { userId?: string; userID?: string; email?: string } | undefined;
    const currentUserId = currentUser?.userId || currentUser?.userID;

    if (!currentUserId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    try {
      // 检查租户是否存在
      const tenantCheck = await options.database.query(
        'SELECT id, name, display_name FROM tenants WHERE id = $1',
        [id]
      );

      if (tenantCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      const tenant = tenantCheck.rows[0];

      // 检查是否已存在待处理的邀请
      const existingInvite = await options.database.query(
        `SELECT id, status, expires_at FROM tenant_invites
         WHERE tenant_id = $1 AND email = $2 AND status = 'pending'
         AND expires_at > NOW()`,
        [id, body.email]
      );

      if (existingInvite.rows.length > 0) {
        return reply.status(400).send({
          error: 'INVITE_EXISTS',
          message: 'A pending invitation already exists for this email',
          invite: existingInvite.rows[0],
        });
      }

      // 检查用户是否已经是租户成员
      const existingMember = await options.database.query(
        `SELECT tu.user_id FROM tenant_users tu
         INNER JOIN users u ON tu.user_id = u.id
         WHERE tu.tenant_id = $1 AND u.email = $2`,
        [id, body.email]
      );

      if (existingMember.rows.length > 0) {
        return reply.status(400).send({
          error: 'USER_ALREADY_MEMBER',
          message: 'User is already a member of this tenant',
        });
      }

      // 生成邀请码 (32字符的随机字符串)
      const inviteCode = randomUUID().replace(/-/g, '').substring(0, 32);
      const expiresInDays = body.expiresInDays || 7;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      const role = body.role || 'member';

      // 插入邀请记录
      const inviteResult = await options.database.query(
        `INSERT INTO tenant_invites
         (tenant_id, email, role, invite_code, status, invited_by, expires_at, created_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())
         RETURNING id, invite_code, email, role, status, expires_at, created_at`,
        [id, body.email, role, inviteCode, currentUserId, expiresAt]
      );

      const invite = inviteResult.rows[0];

      // TODO: 发送邀请邮件（集成邮件服务）
      console.log(`[tenant/invite] Invitation created: ${invite.invite_code} for ${body.email} to tenant ${tenant.name}`);

      return reply.status(201).send({
        invite: {
          id: invite.id,
          inviteCode: invite.invite_code,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
          tenantName: tenant.display_name || tenant.name,
          message: body.message || `You have been invited to join ${tenant.display_name || tenant.name}`,
        },
        // 注意：实际环境中不应返回完整邀请码，此处仅用于开发测试
        // 实际应该通过邮件发送邀请链接
        hint: 'In production, the invite code will be sent via email',
      });
    } catch (error: any) {
      console.error('[tenant/invite] Error:', error);
      return reply.status(500).send({
        error: 'INVITE_ERROR',
        message: error.message,
      });
    }
  });

  // POST /tenant/invite/:code/accept - 接受邀请
  app.post('/invite/:code/accept', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as { code: string };

    if (!options.database) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    // 获取当前用户信息
    const currentUser = (request as any).user as {
      userId?: string;
      userID?: string;
      email?: string
    } | undefined;
    const currentUserId = currentUser?.userId || currentUser?.userID;
    const currentUserEmail = currentUser?.email;

    if (!currentUserId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    try {
      // 查找邀请记录
      const inviteResult = await options.database.query(
        `SELECT ti.id, ti.tenant_id, ti.email, ti.role, ti.status, ti.expires_at,
                t.name as tenant_name, t.display_name as tenant_display_name
         FROM tenant_invites ti
         INNER JOIN tenants t ON ti.tenant_id = t.id
         WHERE ti.invite_code = $1`,
        [code]
      );

      if (inviteResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'INVITE_NOT_FOUND',
          message: 'Invalid invitation code',
        });
      }

      const invite = inviteResult.rows[0];

      // 检查邀请状态
      if (invite.status !== 'pending') {
        return reply.status(400).send({
          error: 'INVITE_NOT_PENDING',
          message: `This invitation has already been ${invite.status}`,
        });
      }

      // 检查邀请是否过期
      if (new Date(invite.expires_at) < new Date()) {
        // 更新邀请状态为过期
        await options.database.query(
          'UPDATE tenant_invites SET status = $1 WHERE id = $2',
          ['expired', invite.id]
        );
        return reply.status(400).send({
          error: 'INVITE_EXPIRED',
          message: 'This invitation has expired',
        });
      }

      // 验证邮箱匹配（如果提供了邮箱）
      if (currentUserEmail && currentUserEmail.toLowerCase() !== invite.email.toLowerCase()) {
        return reply.status(403).send({
          error: 'EMAIL_MISMATCH',
          message: 'The current user email does not match the invitation email',
        });
      }

      // 检查用户是否已经是租户成员
      const existingMember = await options.database.query(
        'SELECT user_id FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
        [invite.tenant_id, currentUserId]
      );

      if (existingMember.rows.length > 0) {
        // 更新邀请状态为已接受
        await options.database.query(
          'UPDATE tenant_invites SET status = $1, accepted_by = $2, accepted_at = NOW() WHERE id = $3',
          ['accepted', currentUserId, invite.id]
        );
        return reply.status(200).send({
          success: true,
          message: 'You are already a member of this tenant',
          tenant: {
            id: invite.tenant_id,
            name: invite.tenant_name,
            displayName: invite.tenant_display_name,
          },
        });
      }

      // 添加用户到租户
      await options.database.query(
        'INSERT INTO tenant_users (tenant_id, user_id, role, created_at) VALUES ($1, $2, $3, NOW())',
        [invite.tenant_id, currentUserId, invite.role]
      );

      // 更新邀请状态为已接受
      await options.database.query(
        'UPDATE tenant_invites SET status = $1, accepted_by = $2, accepted_at = NOW() WHERE id = $3',
        ['accepted', currentUserId, invite.id]
      );

      console.log(`[tenant/invite/accept] User ${currentUserId} accepted invitation to tenant ${invite.tenant_name}`);

      return reply.status(200).send({
        success: true,
        message: 'Invitation accepted successfully',
        tenant: {
          id: invite.tenant_id,
          name: invite.tenant_name,
          displayName: invite.tenant_display_name,
          role: invite.role,
        },
      });
    } catch (error: any) {
      console.error('[tenant/invite/accept] Error:', error);
      return reply.status(500).send({
        error: 'ACCEPT_INVITE_ERROR',
        message: error.message,
      });
    }
  });

  // GET /tenant/invite/:code - 查询邀请信息（无需认证）
  app.get('/invite/:code', {
    // 不需要认证，任何人都可以查看邀请信息（但需要知道邀请码）
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as { code: string };

    if (!options.database) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    try {
      const inviteResult = await options.database.query(
        `SELECT ti.id, ti.tenant_id, ti.email, ti.role, ti.status, ti.expires_at, ti.created_at,
                t.name as tenant_name, t.display_name as tenant_display_name
         FROM tenant_invites ti
         INNER JOIN tenants t ON ti.tenant_id = t.id
         WHERE ti.invite_code = $1`,
        [code]
      );

      if (inviteResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'INVITE_NOT_FOUND',
          message: 'Invalid invitation code',
        });
      }

      const invite = inviteResult.rows[0];

      // 检查邀请是否过期
      const isExpired = new Date(invite.expires_at) < new Date();
      const isValid = invite.status === 'pending' && !isExpired;

      return reply.send({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          isValid: isValid,
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
          tenant: {
            id: invite.tenant_id,
            name: invite.tenant_name,
            displayName: invite.tenant_display_name,
          },
        },
      });
    } catch (error: any) {
      console.error('[tenant/invite/get] Error:', error);
      return reply.status(500).send({
        error: 'GET_INVITE_ERROR',
        message: error.message,
      });
    }
  });
}
