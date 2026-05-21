/**
 * 多租户解析中间件
 *
 * 从请求中提取和验证租户标识，支持多种传递方式：
 * - X-Tenant-ID Header
 * - JWT Claim (tenant_id)
 * - 子域名 (tenant.orion.com)
 *
 * 实现功能：
 * 1. 租户标识提取
 * 2. 租户合法性校验
 * 3. 租户配额检查
 * 4. 数据库 session 变量设置
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getConfig } from '../config';
import { redisClient } from '../utils/redis';
import { ErrorCodes, AppError } from '../errors/error-codes';

/**
 * 租户上下文接口
 */
export interface TenantContext {
  tenantId: string;
  tenantName?: string;
  namespacePoolId: string;
  tier: TenantTier;
  quota: TenantQuota;
  status: TenantStatus;
  createdAt?: Date;
  expiresAt?: Date;
}

/**
 * 租户等级
 */
export type TenantTier = 'free' | 'standard' | 'premium';

/**
 * 租户状态
 */
export type TenantStatus = 'active' | 'suspended' | 'deleted';

/**
 * 租户配额
 */
export interface TenantQuota {
  cpuRequest: number;      // CPU Request (m)
  cpuLimit: number;        // CPU Limit (m)
  memoryRequest: number;   // Memory Request (Mi)
  memoryLimit: number;     // Memory Limit (Mi)
  storage: number;         // Storage (Gi)
  concurrentRunners: number;
  queueDepth: number;
  dailyTokenQuota: number;
  apiQps: number;
  dailyHoursQuota: number;
}

/**
 * 租户配额默认值
 */
export const DEFAULT_QUOTAS: Record<TenantTier, TenantQuota> = {
  free: {
    cpuRequest: 100,
    cpuLimit: 200,
    memoryRequest: 128,
    memoryLimit: 256,
    storage: 1,
    concurrentRunners: 2,
    queueDepth: 20,
    dailyTokenQuota: 10000,
    apiQps: 10,
    dailyHoursQuota: 10,
  },
  standard: {
    cpuRequest: 500,
    cpuLimit: 1000,
    memoryRequest: 512,
    memoryLimit: 1024,
    storage: 10,
    concurrentRunners: 5,
    queueDepth: 100,
    dailyTokenQuota: 100000,
    apiQps: 100,
    dailyHoursQuota: 100,
  },
  premium: {
    cpuRequest: 2000,
    cpuLimit: 4000,
    memoryRequest: 2048,
    memoryLimit: 8192,
    storage: 100,
    concurrentRunners: 50,
    queueDepth: 1000,
    dailyTokenQuota: 1000000,
    apiQps: 1000,
    dailyHoursQuota: 1000,
  },
};

/**
 * 公开路径（不需要租户上下文）
 */
const PUBLIC_PATHS = [
  '/healthz',
  '/readyz',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/swagger',
  '/favicon.ico',
  '/api/v1/tenants/register', // 租户注册接口不需要租户上下文
  '/api/v1/tenants',          // 租户管理 API（需要认证，不需要租户上下文）
  // Knowledge 子应用路径（子应用自身处理租户逻辑）
  '/api/v1/knowledge_base',
  '/api/v1/knowledge',
  '/api/v1/nav',
  '/api/v1/node',
  '/api/v1/user',
  '/api/v1/model',
  '/api/v1/stat',
  '/api/v1/app',
  '/api/v1/file',
  '/api/v1/conversation',
  '/api/v1/comment',
  '/api/v1/crawler',
  '/api/v1/setting',
  '/api/v1/license',
  '/api/v1/share',
  '/api/v1/health',
  '/share',
  '/static-file',
];

/**
 * 租户解析中间件类
 */
export class TenantMiddleware {
  private tenantCache: Map<string, TenantContext> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 分钟缓存

  constructor(private app: FastifyInstance) {}

  /**
   * 提取租户 ID 从请求中
   */
  private extractTenantId(request: FastifyRequest): string | null {
    // 1. 从 X-Tenant-ID Header 提取
    const tenantHeader = request.headers['x-tenant-id'];
    if (tenantHeader && typeof tenantHeader === 'string') {
      return tenantHeader;
    }

    // 2. 从 JWT Claim 提取
    const authContext = (request as any).authContext;
    if (authContext?.user?.tenant_id) {
      return authContext.user.tenant_id;
    }
    if (authContext?.user?.tenantId) {
      return authContext.user.tenantId;
    }

    // 3. 从子域名提取 (tenant.orion.com -> tenant)
    const host = request.headers.host;
    if (host && host.includes('.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
        return subdomain;
      }
    }

    return null;
  }

  /**
   * 从 Redis 获取租户信息
   */
  private async fetchTenantInfo(tenantId: string): Promise<TenantContext | undefined> {
    const redis = redisClient.getClient();
    if (!redis) {
      // Redis 不可用时返回默认配置
      return this.createDefaultTenantContext(tenantId);
    }

    try {
      const key = `tenant:info:${tenantId}`;
      const data = await redis.get(key);

      if (!data) {
        return this.createDefaultTenantContext(tenantId);
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        createdAt: parsed.createdAt ? new Date(parsed.createdAt) : undefined,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
      };
    } catch (error) {
      this.app.log.info({ err: error, tenantId }, 'Failed to fetch tenant info from Redis');
      return this.createDefaultTenantContext(tenantId);
    }
  }

  /**
   * 创建默认租户上下文
   */
  private createDefaultTenantContext(tenantId: string): TenantContext {
    return {
      tenantId,
      tenantName: tenantId,
      namespacePoolId: this.getNamespacePoolId(tenantId),
      tier: 'standard',
      quota: DEFAULT_QUOTAS.standard,
      status: 'active',
    };
  }

  /**
   * 根据租户 ID 计算 Namespace Pool ID
   * 规则：每 10 个租户共享一个 Namespace Pool
   */
  private getNamespacePoolId(tenantId: string): string {
    // 解析租户序号
    const match = tenantId.match(/t(\d+)/);
    if (match) {
      const seq = parseInt(match[1], 10);
      const poolIndex = Math.ceil(seq / 10);
      return `orion-tenant-pool-${String(poolIndex).padStart(3, '0')}`;
    }

    // 默认分配到 pool-001
    return 'orion-tenant-pool-001';
  }

  /**
   * 检查租户状态
   */
  private checkTenantStatus(context: TenantContext): void {
    if (context.status === 'deleted') {
      throw new AppError(
        'TENANT_DELETED',
        '租户已被删除',
        403,
        { tenantId: context.tenantId }
      );
    }

    if (context.status === 'suspended') {
      throw new AppError(
        'TENANT_SUSPENDED',
        '租户已被暂停',
        403,
        { tenantId: context.tenantId }
      );
    }

    // 检查过期时间
    if (context.expiresAt && context.expiresAt < new Date()) {
      throw new AppError(
        'TENANT_EXPIRED',
        '租户已过期',
        403,
        { tenantId: context.tenantId, expiresAt: context.expiresAt }
      );
    }
  }

  /**
   * 检查租户配额
   */
  private async checkQuota(context: TenantContext): Promise<void> {
    const redis = redisClient.getClient();
    if (!redis) {
      return;
    }

    try {
      // 检查当前并发 Runner 数
      const runnerKey = `tenant:runners:${context.tenantId}`;
      const currentRunners = await redis.get(runnerKey);
      const runnerCount = currentRunners ? parseInt(currentRunners, 10) : 0;

      if (runnerCount >= context.quota.concurrentRunners) {
        throw new AppError(
          'QUOTA_EXCEEDED',
          `并发 Runner 数已达上限 (${context.quota.concurrentRunners})`,
          429,
          {
            tenantId: context.tenantId,
            quotaType: 'concurrentRunners',
            current: runnerCount,
            limit: context.quota.concurrentRunners,
          }
        );
      }

      // 检查 API QPS (使用 Redis 计数器)
      const qpsKey = `tenant:qps:${context.tenantId}:${Date.now()}`;
      const currentQps = await redis.incr(qpsKey);
      if (currentQps === 1) {
        await redis.expire(qpsKey, 1); // 1 秒过期
      }

      if (currentQps > context.quota.apiQps) {
        throw new AppError(
          'RATE_LIMIT_EXCEEDED',
          `API 调用频率超限 (${context.quota.apiQps} QPS)`,
          429,
          {
            tenantId: context.tenantId,
            quotaType: 'apiQps',
            current: currentQps,
            limit: context.quota.apiQps,
          }
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.app.log.info({ err: error, tenantId: context.tenantId }, 'Quota check failed');
    }
  }

  /**
   * 设置数据库 session 变量
   * 在数据库连接建立后由业务服务调用
   */
  async setDatabaseSession(request: FastifyRequest, context: TenantContext): Promise<void> {
    // 将租户上下文附加到请求对象
    (request as any).tenantContext = context;

    // 记录日志
    this.app.log.info(
      { tenantId: context.tenantId, namespacePoolId: context.namespacePoolId },
      'Tenant context set for request'
    );
  }

  /**
   * 获取请求的租户上下文
   */
  getTenantContext(request: FastifyRequest): TenantContext | undefined {
    return (request as any).tenantContext;
  }

  /**
   * 中间件处理器
   */
  async handler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const url = request.raw.url || '';

    // 公开路径跳过租户解析
    if (PUBLIC_PATHS.some((path) => url.startsWith(path))) {
      return;
    }

    // 提取租户 ID
    const tenantId = this.extractTenantId(request);
    if (!tenantId) {
      reply.code(400).send({
        error: 'TENANT_ID_MISSING',
        message: '缺少租户标识，请提供 X-Tenant-ID 头部或有效的 JWT token',
      });
      return;
    }

    // 验证租户 ID 格式
    if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
      reply.code(400).send({
        error: 'INVALID_TENANT_ID',
        message: '无效的租户 ID 格式',
      });
      return;
    }

    try {
      // 获取租户信息（带缓存）
      let tenantInfo = this.tenantCache.get(tenantId);

      if (!tenantInfo) {
        tenantInfo = await this.fetchTenantInfo(tenantId);
        if (!tenantInfo) {
          reply.code(404).send({
            error: 'TENANT_NOT_FOUND',
            message: `租户 ${tenantId} 不存在`,
          });
          return;
        }
        // 缓存租户信息
        this.tenantCache.set(tenantId, tenantInfo);
      }

      // 检查租户状态
      this.checkTenantStatus(tenantInfo);

      // 检查配额（异步，不阻塞）
      await this.checkQuota(tenantInfo);

      // 设置租户上下文到请求
      await this.setDatabaseSession(request, tenantInfo);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.app.log.error({ err: error, tenantId }, 'Tenant resolution failed');
      reply.code(500).send({
        error: 'TENANT_RESOLUTION_FAILED',
        message: '租户解析失败',
      });
    }
  }

  /**
   * 清除租户缓存（用于租户信息更新后）
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantCache.delete(tenantId);
    } else {
      this.tenantCache.clear();
    }
  }

  /**
   * 更新租户缓存
   */
  updateCache(tenantId: string, context: TenantContext): void {
    this.tenantCache.set(tenantId, context);
  }
}

/**
 * 租户辅助函数
 */

/**
 * 获取请求的租户 ID
 */
export function getTenantId(request: FastifyRequest): string | undefined {
  const context = (request as any).tenantContext;
  return context?.tenantId;
}

/**
 * 获取请求的租户上下文
 */
export function getTenantContext(request: FastifyRequest): TenantContext | undefined {
  return (request as any).tenantContext;
}

/**
 * 检查租户等级
 */
export function isTenantTier(request: FastifyRequest, tier: TenantTier): boolean {
  const context = (request as any).tenantContext;
  if (!context) return false;

  const tiers = ['free', 'standard', 'premium'];
  const contextIndex = tiers.indexOf(context.tier);
  const targetIndex = tiers.indexOf(tier);

  return contextIndex >= targetIndex;
}

/**
 * 检查租户是否拥有指定配额
 */
export function hasQuota(request: FastifyRequest, quotaType: keyof TenantQuota, value: number): boolean {
  const context = (request as any).tenantContext;
  if (!context) return false;
  return context.quota[quotaType] >= value;
}
