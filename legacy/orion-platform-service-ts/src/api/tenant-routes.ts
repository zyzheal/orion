/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/tenant/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

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
import { TenantQuotaService, TenantQuota, QuotaCheckResult } from '../services/tenant/TenantQuotaService';
import { NamespacePoolService } from '../services/tenant/NamespacePoolService';
import { TenantService, TenantServiceError } from '../services/tenant/TenantService';
import { TenantRepository } from '../services/tenant/TenantRepository';
import { TenantQuotaRepository } from '../repositories/TenantQuotaRepository';
import { NamespaceAllocationRepository } from '../repositories/NamespaceAllocationRepository';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, noContent, badRequest, notFound, internalError, conflict, serviceUnavailable, unauthorized, forbidden } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { createLogger } from '../utils/logger';

const logger = createLogger('tenant-routes');

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
  if (!options.database) {
    logger.warn('[TenantRoutes] Database not available, tenant routes will not be functional');
    return;
  }

  // Initialize repositories
  const quotaRepo = new TenantQuotaRepository(options.database);
  const namespaceRepo = new NamespaceAllocationRepository(options.database);

  // Initialize services
  const context = new TenantContext();
  const quotaService = new TenantQuotaService(quotaRepo);
  const namespacePool = new NamespacePoolService(namespaceRepo);

  // Initialize Namespace pool from DB
  await namespacePool.initialize();

  // Initialize database-backed TenantService via Repository pattern
  const tenantRepository = new TenantRepository(options.database);
  const tenantService = new TenantService(tenantRepository);
  logger.info('[TenantRoutes] Database-backed services initialized');

  // ==================== Tenant Context ====================

  // GET /tenant/my-tenants - 获取当前用户所属的租户列表
  app.get('/my-tenants', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as { userId?: string; userID?: string } | undefined;
    const userId = user?.userId || user?.userID;

    if (!userId) {
      return unauthorized(reply, request, 'User not authenticated');
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

      const currentTenant = tenantsWithCurrent.find((t: any) => t.isCurrent) || tenantsWithCurrent[0] || null;

      return success(reply, request, tenantsWithCurrent, {
        total: tenantsWithCurrent.length,
        currentTenant,
      });
    } catch (error: any) {
      logger.error('[tenant/my-tenants] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // GET /tenant/context - 获取当前租户上下文
  app.get('/context', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
    }

    const tenantId = parseInt(tenantIdHeader, 10);
    const tenantInfo = context.extractTenantFromRequest({
      headers: { 'x-tenant-id': tenantIdHeader },
      user: { tenant_id: tenantId },
    });

    return success(reply, request, { context: tenantInfo });
  });

  // ==================== Tenant Quota ====================

  // GET /tenant/quota - 获取租户配额状态
  app.get('/quota', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
    }

    const tenantIdStr = tenantIdHeader;
    // Try numeric fallback for backward compatibility
    const tenantIdNum = parseInt(tenantIdHeader, 10);
    const quota = await quotaService.getQuota(isNaN(tenantIdNum) ? 0 : tenantIdNum, tenantIdStr);

    return success(reply, request, { quota });
  });

  // PUT /tenant/quota - 更新租户配额
  app.put('/quota', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;
    const body = request.body as TenantQuotaUpdate;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
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

      return success(reply, request, { quota: updatedQuota });
    } catch (error: any) {
      return badRequest(reply, request, ErrorCodes.BIZ_TENANT_QUOTA_EXCEEDED, error.message);
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
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
    }

    const tenantIdStr = tenantIdHeader;
    const tenantIdNum = parseInt(tenantIdHeader, 10);
    const tenantId = isNaN(tenantIdNum) ? 0 : tenantIdNum;

    const result = quotaService.checkQuota(
      tenantId,
      body.resourceType,
      body.amount
    );

    return success(reply, request, { result });
  });

  // ==================== Namespace Pool ====================

  // GET /tenant/namespace/pool - 获取 Namespace 池状态
  app.get('/namespace/pool', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const status = await namespacePool.getPoolStatus();
    return success(reply, request, { status });
  });

  // POST /tenant/namespace/allocate - 从 Namespace 池分配
  app.post('/namespace/allocate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as NamespaceAllocateRequest;

    try {
      const result = await namespacePool.allocateNamespace(body.tenantId);

      if (result.success) {
        return created(reply, request, { allocation: result.namespace });
      } else {
        return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, result.error || 'Failed to allocate namespace');
      }
    } catch (error: any) {
      return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, error.message);
    }
  });

  // POST /tenant/namespace/release - 释放 Namespace 到池中
  app.post('/namespace/release', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as NamespaceReleaseRequest;

    try {
      const released = await namespacePool.releaseNamespace(body.namespaceName);

      return success(reply, request, { released });
    } catch (error: any) {
      return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, error.message);
    }
  });

  // GET /tenant/namespace/:tenantId - 获取租户的 Namespaces
  app.get('/namespace/:tenantId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  tenantId  } = request.params as any as { tenantId: string };

    const namespaces = await namespacePool.getTenantNamespaces(parseInt(tenantId, 10));

    return success(reply, request, namespaces, { count: namespaces.length });
  });

  // ==================== Tenant Middleware Config ====================

  // GET /tenant/middleware/config - 获取中间件配置
  app.get('/middleware/config', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return success(reply, request, {
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

    return success(reply, request, {
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
    const {  page = '1', limit = '20', status, search  } = request.query as any as Record<string, string>;

    try {
      const result = await tenantService.listTenants({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        status,

      });
      return success(reply, request, result.data, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error: any) {
      return internalError(reply, request, error.message);
    }
  });

  // GET /tenant/:id - Get tenant by ID
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id  } = request.params as any as { id: string };

    try {
      const tenant = await tenantService.getTenant(id);
      return success(reply, request, tenant);
    } catch (error: any) {
      if (error instanceof TenantServiceError && error.code === 'TENANT_NOT_FOUND') {
        return notFound(reply, request, ErrorCodes.BIZ_TENANT_NOT_FOUND, error.message);
      }
      return internalError(reply, request, error.message);
    }
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

    try {
      // 1. Create tenant
      const tenant = await tenantService.createTenant({
        name: body.name,
        display_name: body.display_name,
        settings: body.settings,
      });

      // 2. Initialize quota (with defaults or custom)
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
        tenantId: 0,
        ...defaultQuota,
        ...body.customQuota,
      });

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

      const message = body.autoAllocateNamespace
        ? `Tenant created with ${allocatedNamespaces.length} namespace(s) allocated`
        : 'Tenant created successfully';

      return created(reply, request, {
        ...tenant,
        allocatedNamespaces: allocatedNamespaces.length > 0 ? allocatedNamespaces : undefined,
        message,
      });
    } catch (error: any) {
      if (error instanceof TenantServiceError) {
        return badRequest(reply, request, ErrorCodes.BIZ_TENANT_NAME_EXISTS, error.message);
      }
      return internalError(reply, request, error.message);
    }
  });

  // PUT /tenant/:id - Update tenant
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id  } = request.params as any as { id: string };
    const body = request.body as {
      name?: string;
      display_name?: string;
      status?: string;
      settings?: Record<string, any>;
    };

    try {
      const tenant = await tenantService.updateTenant(id, body);
      return success(reply, request, tenant);
    } catch (error: any) {
      if (error instanceof TenantServiceError) {
        const code = error.code === 'TENANT_NOT_FOUND'
          ? ErrorCodes.BIZ_TENANT_NOT_FOUND
          : ErrorCodes.BIZ_TENANT_STATUS_INVALID;
        return notFound(reply, request, code, error.message);
      }
      return internalError(reply, request, error.message);
    }
  });

  // DELETE /tenant/:id - Delete tenant (soft delete)
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id  } = request.params as any as { id: string };

    try {
      await tenantService.deleteTenant(id);
      return noContent(reply, request);
    } catch (error: any) {
      if (error instanceof TenantServiceError) {
        const code = error.code === 'TENANT_NOT_FOUND'
          ? ErrorCodes.BIZ_TENANT_NOT_FOUND
          : ErrorCodes.BIZ_TENANT_STATUS_INVALID;
        return notFound(reply, request, code, error.message);
      }
      return internalError(reply, request, error.message);
    }
  });

  // POST /tenant/:id/split - 拆分租户
  app.post('/:id/split', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id  } = request.params as any as { id: string };
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

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
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
            logger.warn('[tenant/split] Pipeline migration skipped:', pipelineId, e);
          }
        }
      }

      // 6. 复制配额设置到新租户
      const originalQuota = await quotaService.getQuota(0, id);
      await quotaService.setQuota({
        ...originalQuota,
        tenantId: 0,
      });

      const message = `租户拆分完成：迁移 ${migratedUsers.length} 用户、${migratedNamespaces.length} Namespace、${migratedPipelines.length} Pipeline`;

      return created(reply, request, {
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
        message,
      });
    } catch (error: any) {
      logger.error('[tenant/split] Error:', error);
      return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, error.message || '租户拆分失败');
    }
  });

  // GET /tenant/count - Get tenant count
  app.get('/count', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  status  } = request.query as any as Record<string, string>;

    try {
      const result = await tenantService.listTenants({ limit: 1, status });
      return success(reply, request, { total: result.total });
    } catch (error: any) {
      return internalError(reply, request, error.message);
    }
  });

  // ==================== Tenant Usage Statistics ====================

  // GET /tenant/usage - 获取租户配额使用率统计
  app.get('/usage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
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

      return success(reply, request, { usage, quota });
    } catch (error: any) {
      return internalError(reply, request, error.message);
    }
  });

  // GET /tenant/namespace/:tenantId/usage - 获取租户 Namespace 使用详情
  app.get('/namespace/:tenantId/usage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  tenantId  } = request.params as any as { tenantId: string };

    if (!options.database) {
      // Fallback to namespace pool service if no database
      const namespaces = await namespacePool.getTenantNamespaces(parseInt(tenantId, 10) || 0);
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
      return success(reply, request, {
        namespaces: namespaceDetails,
        total: namespaceDetails.length,
      });
    }

    try {
      // Get namespace allocations from database
      const nsResult = await options.database.query(
        `SELECT id, namespace_name, status, tenant_id, allocated_at, purpose, runner_count
         FROM namespace_allocations
         WHERE tenant_id = $1
         ORDER BY allocated_at DESC`,
        [tenantId]
      );

      // Get usage stats for each namespace
      const namespaceDetails = await Promise.all(
        nsResult.rows.map(async (row: any) => {
          // Get pipeline count for this namespace
          const pipelineResult = await options.database?.query(
            `SELECT COUNT(*) as count FROM pipelines WHERE namespace = $1`,
            [row.namespace_name]
          );
          const pipelineCount = parseInt(pipelineResult?.rows[0]?.count || '0', 10);

          // Get active runs count
          const runsResult = await options.database?.query(
            `SELECT COUNT(*) as count FROM pipeline_runs
             WHERE namespace = $1 AND status IN ('pending', 'running')`,
            [row.namespace_name]
          );
          const activeRuns = parseInt(runsResult?.rows[0]?.count || '0', 10);

          return {
            id: row.id,
            namespaceName: row.namespace_name,
            status: row.status,
            allocatedAt: row.allocated_at,
            purpose: row.purpose,
            runnerCount: row.runner_count || 0,
            pipelineCount,
            activeRuns,
            cpuUsed: 0,  // Would require integration with K8s metrics API
            memoryUsed: 0,  // Would require integration with K8s metrics API
          };
        })
      );

      // Calculate totals
      const totals = {
        totalNamespaces: namespaceDetails.length,
        totalPipelines: namespaceDetails.reduce((sum, ns) => sum + ns.pipelineCount, 0),
        totalActiveRuns: namespaceDetails.reduce((sum, ns) => sum + ns.activeRuns, 0),
        totalRunners: namespaceDetails.reduce((sum, ns) => sum + ns.runnerCount, 0),
      };

      return success(reply, request, {
        namespaces: namespaceDetails,
        total: namespaceDetails.length,
        totals,
      });
    } catch (error: any) {
      logger.error('[tenant/namespace/usage] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // ==================== Tenant User Management ====================

  // GET /tenant/:id/users - 获取租户用户列表
  app.get('/:id/users', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id  } = request.params as any as { id: string };

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
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

      return success(reply, request, result.rows, { total: result.rows.length });
    } catch (error: any) {
      logger.error('[tenant/users] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // DELETE /tenant/:id/users/:userId - 从租户移除用户
  app.delete('/:id/users/:userId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id, userId  } = request.params as any as { id: string; userId: string };

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
    }

    // 获取当前用户信息
    const currentUser = (request as any).user as { userId?: string; userID?: string } | undefined;
    const currentUserId = currentUser?.userId || currentUser?.userID;

    // 防止自己移除自己（至少保留一个管理员）
    if (userId === currentUserId) {
      return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, 'Cannot remove yourself from the tenant');
    }

    try {
      // 检查是否为最后一个管理员
      const adminCheck = await options.database.query(
        `SELECT role FROM tenant_users WHERE tenant_id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (adminCheck.rows.length === 0) {
        return notFound(reply, request, ErrorCodes.BIZ_USER_NOT_FOUND, 'User is not a member of this tenant');
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
          return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, 'Cannot remove the last administrator from the tenant');
        }
      }

      // 执行删除
      await options.database.query(
        'DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2',
        [id, userId]
      );

      return success(reply, request, {
        message: 'User removed from tenant successfully',
      });
    } catch (error: any) {
      logger.error('[tenant/users/delete] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // ==================== Tenant Invitation System ====================

  // POST /tenant/:id/invite - 邀请用户加入租户
  app.post('/:id/invite', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  id  } = request.params as any as { id: string };
    const body = request.body as {
      email: string;
      role?: string;
      message?: string;
      expiresInDays?: number;
    };

    if (!body.email) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'Email is required');
    }

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
    }

    // 获取当前用户信息
    const currentUser = (request as any).user as { userId?: string; userID?: string; email?: string } | undefined;
    const currentUserId = currentUser?.userId || currentUser?.userID;

    if (!currentUserId) {
      return unauthorized(reply, request, 'User not authenticated');
    }

    try {
      // 检查租户是否存在
      const tenantCheck = await options.database.query(
        'SELECT id, name, display_name FROM tenants WHERE id = $1',
        [id]
      );

      if (tenantCheck.rows.length === 0) {
        return notFound(reply, request, ErrorCodes.BIZ_TENANT_NOT_FOUND, 'Tenant not found');
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
        return conflict(reply, request, ErrorCodes.BIZ_RESOURCE_CONFLICT, 'A pending invitation already exists for this email');
      }

      // 检查用户是否已经是租户成员
      const existingMember = await options.database.query(
        `SELECT tu.user_id FROM tenant_users tu
         INNER JOIN users u ON tu.user_id = u.id
         WHERE tu.tenant_id = $1 AND u.email = $2`,
        [id, body.email]
      );

      if (existingMember.rows.length > 0) {
        return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, 'User is already a member of this tenant');
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
      logger.info(`[tenant/invite] Invitation created: ${invite.invite_code} for ${body.email} to tenant ${tenant.name}`);

      return created(reply, request, {
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
      logger.error('[tenant/invite] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // POST /tenant/invite/:code/accept - 接受邀请
  app.post('/invite/:code/accept', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  code  } = request.params as any as { code: string };

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
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
      return unauthorized(reply, request, 'User not authenticated');
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
        return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, 'Invalid invitation code');
      }

      const invite = inviteResult.rows[0];

      // 检查邀请状态
      if (invite.status !== 'pending') {
        return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, `This invitation has already been ${invite.status}`);
      }

      // 检查邀请是否过期
      if (new Date(invite.expires_at) < new Date()) {
        // 更新邀请状态为过期
        await options.database.query(
          'UPDATE tenant_invites SET status = $1 WHERE id = $2',
          ['expired', invite.id]
        );
        return badRequest(reply, request, ErrorCodes.BIZ_OPERATION_FAILED, 'This invitation has expired');
      }

      // 验证邮箱匹配（如果提供了邮箱）
      if (currentUserEmail && currentUserEmail.toLowerCase() !== invite.email.toLowerCase()) {
        return forbidden(reply, request, 'The current user email does not match the invitation email');
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
        return success(reply, request, {
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

      logger.info(`[tenant/invite/accept] User ${currentUserId} accepted invitation to tenant ${invite.tenant_name}`);

      return success(reply, request, {
        message: 'Invitation accepted successfully',
        tenant: {
          id: invite.tenant_id,
          name: invite.tenant_name,
          displayName: invite.tenant_display_name,
          role: invite.role,
        },
      });
    } catch (error: any) {
      logger.error('[tenant/invite/accept] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // GET /tenant/invite/:code - 查询邀请信息（无需认证）
  app.get('/invite/:code', {
    // 不需要认证，任何人都可以查看邀请信息（但需要知道邀请码）
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const {  code  } = request.params as any as { code: string };

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
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
        return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, 'Invalid invitation code');
      }

      const invite = inviteResult.rows[0];

      // 检查邀请是否过期
      const isExpired = new Date(invite.expires_at) < new Date();
      const isValid = invite.status === 'pending' && !isExpired;

      return success(reply, request, {
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
      logger.error('[tenant/invite/get] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // ==================== Tenant Alerts (Quota Alerts) ====================

  // GET /tenant/alerts - 获取租户告警历史
  app.get('/alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;
    const {  page = '1', limit = '20', resourceType, status  } = request.query as any as Record<string, string>;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
    }

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
    }

    try {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      // Build query with filters
      let whereClause = 'WHERE tenant_id = $1';
      const queryParams: any[] = [tenantIdHeader];
      let paramIndex = 2;

      if (resourceType) {
        whereClause += ` AND resource_type = $${paramIndex}`;
        queryParams.push(resourceType);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND notify_status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      // Get total count
      const countResult = await options.database.query(
        `SELECT COUNT(*) as total FROM tenant_quota_alerts ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Get paginated alerts
      const result = await options.database.query(
        `SELECT id, tenant_id, resource_type, threshold_percent, current_usage,
                quota_limit, notify_status, cooldown_until, created_at
         FROM tenant_quota_alerts ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limitNum, offset]
      );

      const alerts = result.rows.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        resourceType: row.resource_type,
        thresholdPercent: row.threshold_percent,
        currentUsage: row.current_usage,
        quotaLimit: row.quota_limit,
        usagePercent: row.quota_limit > 0 ? Math.round((row.current_usage / row.quota_limit) * 100) : 0,
        notifyStatus: row.notify_status,
        cooldownUntil: row.cooldown_until,
        createdAt: row.created_at,
      }));

      return success(reply, request, alerts, {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error: any) {
      logger.error('[tenant/alerts] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // GET /tenant/current - 获取当前租户信息
  app.get('/current', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
    }

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
    }

    try {
      // Get tenant info
      const tenantResult = await options.database.query(
        `SELECT id, name, display_name, status, settings, created_at, updated_at
         FROM tenants WHERE id = $1`,
        [tenantIdHeader]
      );

      if (tenantResult.rows.length === 0) {
        return notFound(reply, request, ErrorCodes.BIZ_TENANT_NOT_FOUND, 'Tenant not found');
      }

      const tenant = tenantResult.rows[0];

      // Get quota info
      const quota = await quotaService.getQuota(0, tenantIdHeader);

      // Get namespace count
      const nsResult = await options.database.query(
        `SELECT COUNT(*) as count FROM namespace_allocations WHERE tenant_id = $1`,
        [tenantIdHeader]
      );
      const namespaceCount = parseInt(nsResult.rows[0]?.count || '0', 10);

      // Get active alert count
      const alertResult = await options.database.query(
        `SELECT COUNT(*) as count FROM tenant_quota_alerts
         WHERE tenant_id = $1 AND notify_status = 'sent'
         AND (cooldown_until IS NULL OR cooldown_until < NOW())`,
        [tenantIdHeader]
      );
      const activeAlertCount = parseInt(alertResult.rows[0]?.count || '0', 10);

      return success(reply, request, {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          displayName: tenant.display_name,
          status: tenant.status,
          settings: tenant.settings,
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at,
        },
        quota,
        namespaces: {
          count: namespaceCount,
          limit: quota.maxNamespaces,
        },
        alerts: {
          activeCount: activeAlertCount,
        },
      });
    } catch (error: any) {
      logger.error('[tenant/current] Error:', error);
      return internalError(reply, request, error.message);
    }
  });

  // GET /tenant/alerts/stats - 获取租户告警统计
  app.get('/alerts/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tenant', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantIdHeader = request.headers['x-tenant-id'] as string;

    if (!tenantIdHeader) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_MISSING, 'X-Tenant-ID header is required');
    }

    if (!options.database) {
      return serviceUnavailable(reply, request, 'Database not available');
    }

    try {
      // Get alert counts by status
      const statusResult = await options.database.query(
        `SELECT notify_status, COUNT(*) as count
         FROM tenant_quota_alerts
         WHERE tenant_id = $1
         GROUP BY notify_status`,
        [tenantIdHeader]
      );

      // Get alert counts by resource type (last 7 days)
      const resourceResult = await options.database.query(
        `SELECT resource_type, COUNT(*) as count
         FROM tenant_quota_alerts
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY resource_type`,
        [tenantIdHeader]
      );

      // Get active alerts (not in cooldown)
      const activeResult = await options.database.query(
        `SELECT id, resource_type, threshold_percent, current_usage, quota_limit, created_at
         FROM tenant_quota_alerts
         WHERE tenant_id = $1 AND notify_status = 'sent'
         AND (cooldown_until IS NULL OR cooldown_until < NOW())
         ORDER BY created_at DESC
         LIMIT 10`,
        [tenantIdHeader]
      );

      const statusCounts: Record<string, number> = {};
      statusResult.rows.forEach((row: any) => {
        statusCounts[row.notify_status] = parseInt(row.count, 10);
      });

      const resourceCounts: Record<string, number> = {};
      resourceResult.rows.forEach((row: any) => {
        resourceCounts[row.resource_type] = parseInt(row.count, 10);
      });

      const activeAlerts = activeResult.rows.map((row: any) => ({
        id: row.id,
        resourceType: row.resource_type,
        thresholdPercent: row.threshold_percent,
        currentUsage: row.current_usage,
        quotaLimit: row.quota_limit,
        usagePercent: row.quota_limit > 0 ? Math.round((row.current_usage / row.quota_limit) * 100) : 0,
        createdAt: row.created_at,
      }));

      return success(reply, request, {
        byStatus: statusCounts,
        byResourceType: resourceCounts,
        activeAlerts,
        totalActive: activeAlerts.length,
      });
    } catch (error: any) {
      logger.error('[tenant/alerts/stats] Error:', error);
      return internalError(reply, request, error.message);
    }
  });
}