/**
 * 租户管理 API 路由
 *
 * 提供租户 CRUD 操作：
 * - POST /api/v1/tenants - 创建租户
 * - GET /api/v1/tenants/:id - 查询租户
 * - PUT /api/v1/tenants/:id - 更新租户
 * - DELETE /api/v1/tenants/:id - 删除租户
 * - GET /api/v1/tenants - 查询租户列表
 * - POST /api/v1/tenants/:id/quota - 调整配额
 * - POST /api/v1/tenants/:id/suspend - 暂停租户
 * - POST /api/v1/tenants/:id/activate - 激活租户
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisClient } from '../utils/redis';
import { namespacePoolManager } from '../services/namespace-pool.service';
import { tenantQuotaService } from '../services/tenant-quota.service';
import { TenantTier, TenantStatus, DEFAULT_QUOTAS } from '../middleware/tenant';
import { AppError, ErrorCodes, ErrorFactory } from '../errors/error-codes';

/**
 * 租户创建请求
 */
export interface CreateTenantRequest {
  name: string;
  displayName?: string;
  tier?: TenantTier;
  ownerEmail?: string;
  businessUnit?: string;
  costCenter?: string;
  expiresAt?: string;
}

/**
 * 租户更新请求
 */
export interface UpdateTenantRequest {
  name?: string;
  displayName?: string;
  tier?: TenantTier;
  status?: TenantStatus;
  ownerEmail?: string;
  businessUnit?: string;
  costCenter?: string;
  expiresAt?: string;
}

/**
 * 配额调整请求
 */
export interface QuotaAdjustmentRequest {
  adjustmentType: 'permanent' | 'temporary';
  changes: {
    cpu_limit?: number;
    memory_limit?: number;
    concurrent_runners?: number;
    queue_depth?: number;
    daily_token_quota?: number;
    api_qps?: number;
  };
  reason: string;
  effectiveDate?: string;
}

/**
 * 租户响应
 */
export interface TenantResponse {
  id: string;
  name: string;
  displayName?: string;
  tier: TenantTier;
  status: TenantStatus;
  namespacePoolId: string;
  ownerEmail?: string;
  businessUnit?: string;
  costCenter?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
}

/**
 * 租户管理服务类
 */
export class TenantManagementService {
  private redis: any | null = null;

  constructor() {
    const client = redisClient.getClient();
    if (client) {
      this.redis = client;
    }
  }

  setRedisClient(client: any): void {
    this.redis = client;
  }

  /**
   * 生成租户 ID
   */
  private generateTenantId(seq: number): string {
    return `t${String(seq).padStart(3, '0')}`;
  }

  /**
   * 获取下一个租户序号
   */
  private async getNextTenantSeq(): Promise<number> {
    if (!this.redis) return 1;

    const seqKey = 'tenant:sequence';
    const nextSeq = await this.redis.incr(seqKey);
    return nextSeq;
  }

  /**
   * 创建租户
   */
  async createTenant(data: CreateTenantRequest): Promise<TenantResponse> {
    if (!this.redis) {
      throw new AppError('DATABASE_UNAVAILABLE', '数据库服务不可用', 503);
    }

    // 检查名称是否已存在
    const nameKey = `tenant:name:${data.name}`;
    const exists = await this.redis.exists(nameKey);
    if (exists) {
      throw ErrorFactory.business(ErrorCodes.RESOURCE_EXISTS, {
        resourceType: 'tenant',
        identifier: data.name,
      });
    }

    // 获取下一个租户序号
    const tenantSeq = await this.getNextTenantSeq();
    const tenantId = this.generateTenantId(tenantSeq);

    // 分配 Namespace 池
    const allocation = await namespacePoolManager.allocatePool(tenantId);
    const namespacePoolId = allocation?.poolId || 'orion-tenant-pool-001';

    const now = new Date().toISOString();
    const tier = data.tier || 'standard';

    const tenant = {
      id: tenantId,
      name: data.name,
      displayName: data.displayName || data.name,
      tier,
      status: 'active' as TenantStatus,
      namespacePoolId,
      ownerEmail: data.ownerEmail,
      businessUnit: data.businessUnit,
      costCenter: data.costCenter,
      createdAt: now,
      updatedAt: now,
      expiresAt: data.expiresAt || undefined,
    };

    // 保存租户信息
    const tenantKey = `tenant:info:${tenantId}`;
    await this.redis.set(tenantKey, JSON.stringify(tenant));

    // 保存名称索引
    await this.redis.set(nameKey, tenantId);

    // 初始化配额
    await tenantQuotaService.initQuota(tenantId, tier);

    return tenant as TenantResponse;
  }

  /**
   * 查询租户
   */
  async getTenant(tenantId: string): Promise<TenantResponse | null> {
    if (!this.redis) return null;

    const tenantKey = `tenant:info:${tenantId}`;
    const data = await this.redis.get(tenantKey);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * 查询租户列表
   */
  async listTenants(
    options: {
      status?: TenantStatus;
      tier?: TenantTier;
      namespacePoolId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ tenants: TenantResponse[]; total: number }> {
    if (!this.redis) {
      return { tenants: [], total: 0 };
    }

    // 获取所有租户 ID
    const pattern = 'tenant:info:t*';
    const keys = await this.redis.keys(pattern);

    let tenants: TenantResponse[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const tenant = JSON.parse(data) as TenantResponse;

        // 应用过滤条件
        if (options.status && tenant.status !== options.status) continue;
        if (options.tier && tenant.tier !== options.tier) continue;
        if (options.namespacePoolId && tenant.namespacePoolId !== options.namespacePoolId) continue;

        tenants.push(tenant);
      }
    }

    const total = tenants.length;

    // 分页
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    tenants = tenants.slice(offset, offset + limit);

    return { tenants, total };
  }

  /**
   * 更新租户
   */
  async updateTenant(tenantId: string, data: UpdateTenantRequest): Promise<TenantResponse> {
    if (!this.redis) {
      throw new AppError('DATABASE_UNAVAILABLE', '数据库服务不可用', 503);
    }

    const existing = await this.getTenant(tenantId);
    if (!existing) {
      throw ErrorFactory.business(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'tenant',
        id: tenantId,
      });
    }

    const updated = {
      ...existing,
      ...data,
      id: tenantId, // 不允许修改 ID
      updatedAt: new Date().toISOString(),
    };

    // 保存更新
    const tenantKey = `tenant:info:${tenantId}`;
    await this.redis.set(tenantKey, JSON.stringify(updated));

    // 如果名称变更，更新索引
    if (data.name && data.name !== existing.name) {
      const oldNameKey = `tenant:name:${existing.name}`;
      const newNameKey = `tenant:name:${data.name}`;
      await this.redis.del(oldNameKey);
      await this.redis.set(newNameKey, tenantId);
    }

    return updated;
  }

  /**
   * 删除租户
   */
  async deleteTenant(tenantId: string): Promise<void> {
    if (!this.redis) {
      throw new AppError('DATABASE_UNAVAILABLE', '数据库服务不可用', 503);
    }

    const existing = await this.getTenant(tenantId);
    if (!existing) {
      throw ErrorFactory.business(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'tenant',
        id: tenantId,
      });
    }

    // 软删除：标记为 deleted
    const updated = {
      ...existing,
      status: 'deleted' as TenantStatus,
      updatedAt: new Date().toISOString(),
    };

    const tenantKey = `tenant:info:${tenantId}`;
    await this.redis.set(tenantKey, JSON.stringify(updated));

    // 回收 Namespace 池分配
    await namespacePoolManager.deallocatePool(tenantId);
  }

  /**
   * 暂停租户
   */
  async suspendTenant(tenantId: string): Promise<TenantResponse> {
    return this.updateTenant(tenantId, { status: 'suspended' });
  }

  /**
   * 激活租户
   */
  async activateTenant(tenantId: string): Promise<TenantResponse> {
    return this.updateTenant(tenantId, { status: 'active' });
  }

  /**
   * 获取租户配额状态
   */
  async getTenantQuotaStatus(tenantId: string): Promise<any> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw ErrorFactory.business(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'tenant',
        id: tenantId,
      });
    }

    const usage = await tenantQuotaService.getUsage(tenantId);
    const quota = DEFAULT_QUOTAS[tenant.tier];

    return {
      tenantId,
      tier: tenant.tier,
      quota,
      usage: usage || {},
      alerts: await tenantQuotaService.checkQuotaAlerts(tenantId, quota),
    };
  }

  /**
   * 调整租户配额
   */
  async adjustQuota(
    tenantId: string,
    data: QuotaAdjustmentRequest
  ): Promise<TenantResponse> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw ErrorFactory.business(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'tenant',
        id: tenantId,
      });
    }

    // 临时提升：记录到 Redis，24 小时后过期
    if (data.adjustmentType === 'temporary') {
      const tempQuotaKey = `tenant:quota:temp:${tenantId}`;
      await this.redis.setex(
        tempQuotaKey,
        86400, // 24 小时
        JSON.stringify({
          ...data.changes,
          reason: data.reason,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        })
      );
    } else {
      // 永久调整：需要升级租户等级
      // 这里简化处理，实际应该检查是否有审批
      console.log(`Permanent quota adjustment for ${tenantId}:`, data);
    }

    return tenant;
  }
}

// 导出单例
export const tenantManagementService = new TenantManagementService();

/**
 * 租户管理路由类
 */
export class TenantRoutes {
  private service: TenantManagementService;

  constructor(private app: FastifyInstance) {
    this.service = tenantManagementService;
  }

  /**
   * 注册所有租户管理路由
   */
  register(): void {
    // POST /api/v1/tenants - 创建租户
    this.app.post(
      '/api/v1/tenants',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              displayName: { type: 'string' },
              tier: { type: 'string', enum: ['free', 'standard', 'premium'] },
              ownerEmail: { type: 'string', format: 'email' },
              businessUnit: { type: 'string' },
              costCenter: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      this.createTenant.bind(this)
    );

    // GET /api/v1/tenants - 查询租户列表
    this.app.get('/api/v1/tenants', this.listTenants.bind(this));

    // GET /api/v1/tenants/:id - 查询租户
    this.app.get('/api/v1/tenants/:id', this.getTenant.bind(this));

    // PUT /api/v1/tenants/:id - 更新租户
    this.app.put(
      '/api/v1/tenants/:id',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              displayName: { type: 'string' },
              tier: { type: 'string', enum: ['free', 'standard', 'premium'] },
              status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
              ownerEmail: { type: 'string', format: 'email' },
              businessUnit: { type: 'string' },
              costCenter: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      this.updateTenant.bind(this)
    );

    // DELETE /api/v1/tenants/:id - 删除租户
    this.app.delete('/api/v1/tenants/:id', this.deleteTenant.bind(this));

    // POST /api/v1/tenants/:id/suspend - 暂停租户
    this.app.post('/api/v1/tenants/:id/suspend', this.suspendTenant.bind(this));

    // POST /api/v1/tenants/:id/activate - 激活租户
    this.app.post('/api/v1/tenants/:id/activate', this.activateTenant.bind(this));

    // GET /api/v1/tenants/:id/quota - 查询配额状态
    this.app.get('/api/v1/tenants/:id/quota', this.getQuotaStatus.bind(this));

    // POST /api/v1/tenants/:id/quota - 调整配额
    this.app.post(
      '/api/v1/tenants/:id/quota',
      {
        schema: {
          body: {
            type: 'object',
            required: ['adjustmentType', 'reason'],
            properties: {
              adjustmentType: { type: 'string', enum: ['permanent', 'temporary'] },
              changes: {
                type: 'object',
                properties: {
                  cpu_limit: { type: 'number' },
                  memory_limit: { type: 'number' },
                  concurrent_runners: { type: 'number' },
                  queue_depth: { type: 'number' },
                  daily_token_quota: { type: 'number' },
                  api_qps: { type: 'number' },
                },
              },
              reason: { type: 'string' },
              effectiveDate: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      this.adjustQuota.bind(this)
    );
  }

  private async createTenant(
    request: FastifyRequest<{ Body: CreateTenantRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const tenant = await this.service.createTenant(request.body);
      reply.code(201).send(tenant);
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to create tenant');
      throw error;
    }
  }

  private async getTenant(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const tenant = await this.service.getTenant(request.params.id);

    if (!tenant) {
      reply.code(404).send({
        error: 'TENANT_NOT_FOUND',
        message: `租户 ${request.params.id} 不存在`,
      });
      return;
    }

    reply.send(tenant);
  }

  private async listTenants(
    request: FastifyRequest<{
      Querystring: {
        status?: TenantStatus;
        tier?: TenantTier;
        namespacePoolId?: string;
        limit?: number;
        offset?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.listTenants({
      status: request.query.status,
      tier: request.query.tier,
      namespacePoolId: request.query.namespacePoolId,
      limit: request.query.limit,
      offset: request.query.offset,
    });

    reply.send(result);
  }

  private async updateTenant(
    request: FastifyRequest<{
      Params: { id: string };
      Body: UpdateTenantRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const tenant = await this.service.updateTenant(request.params.id, request.body);
      reply.send(tenant);
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to update tenant');
      throw error;
    }
  }

  private async deleteTenant(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await this.service.deleteTenant(request.params.id);
      reply.code(204).send();
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to delete tenant');
      throw error;
    }
  }

  private async suspendTenant(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const tenant = await this.service.suspendTenant(request.params.id);
      reply.send(tenant);
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to suspend tenant');
      throw error;
    }
  }

  private async activateTenant(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const tenant = await this.service.activateTenant(request.params.id);
      reply.send(tenant);
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to activate tenant');
      throw error;
    }
  }

  private async getQuotaStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const status = await this.service.getTenantQuotaStatus(request.params.id);
      reply.send(status);
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to get quota status');
      throw error;
    }
  }

  private async adjustQuota(
    request: FastifyRequest<{
      Params: { id: string };
      Body: QuotaAdjustmentRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const tenant = await this.service.adjustQuota(request.params.id, request.body);
      reply.send(tenant);
    } catch (error) {
      this.app.log.error({ err: error }, 'Failed to adjust quota');
      throw error;
    }
  }
}
