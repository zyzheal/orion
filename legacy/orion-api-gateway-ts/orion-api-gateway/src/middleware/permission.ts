/**
 * Permission Middleware
 *
 * 实现完整的权限检查中间件：
 * - RBAC + ABAC 组合检查
 * - 资源级别权限控制
 * - API 路由权限覆盖
 */

import { FastifyRequest, FastifyReply, FastifyInstance, preHandlerHookHandler } from 'fastify';
import { rbacService, Permission } from '../services/rbac.service';
import {
  abacPolicyEngine,
  AbacContext,
  PolicyEvaluationResult,
} from '../services/auth/AbacPolicyEngine';

/**
 * 权限检查配置
 */
export interface PermissionConfig {
  // 必需的 RBAC 权限
  permissions?: string[];
  // 必需的角色
  roles?: string[];
  // 资源类型（用于 ABAC）
  resourceType?: string;
  // 操作类型（用于 ABAC）
  actionType?: string;
  // 是否启用 ABAC 检查
  enableAbac?: boolean;
  // 自定义检查函数
  customCheck?: (request: FastifyRequest) => boolean | Promise<boolean>;
  // 是否跳过资源所有权检查
  skipOwnerCheck?: boolean;
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  allowed: boolean;
  denied: boolean; // 是否被 ABAC deny 政策拒绝
  needsAuth?: boolean; // 是否需要认证（未认证用户）
  reason?: string;
  rbacResult: {
    hasPermission: boolean;
    missingPermissions: string[];
    hasRole: boolean;
    missingRoles: string[];
  };
  abacResult?: PolicyEvaluationResult;
}

/**
 * API 路权限映射
 */
export const API_PERMISSION_MAP: Record<string, PermissionConfig> = {
  // Pipeline API
  'GET /api/v1/pipelines': {
    permissions: ['pipeline:read'],
    resourceType: 'pipeline',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/pipelines': {
    permissions: ['pipeline:create'],
    resourceType: 'pipeline',
    actionType: 'create',
    enableAbac: true,
  },
  'PUT /api/v1/pipelines/:id': {
    permissions: ['pipeline:update'],
    resourceType: 'pipeline',
    actionType: 'update',
    enableAbac: true,
  },
  'DELETE /api/v1/pipelines/:id': {
    permissions: ['pipeline:delete'],
    resourceType: 'pipeline',
    actionType: 'delete',
    enableAbac: true,
  },
  'POST /api/v1/pipelines/:id/trigger': {
    permissions: ['pipeline:trigger'],
    resourceType: 'pipeline',
    actionType: 'trigger',
    enableAbac: true,
  },

  // Deployment API
  'GET /api/v1/deployments': {
    permissions: ['deployment:read'],
    resourceType: 'deployment',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/deployments': {
    permissions: ['deployment:create'],
    resourceType: 'deployment',
    actionType: 'create',
    enableAbac: true,
  },
  'PUT /api/v1/deployments/:id': {
    permissions: ['deployment:update'],
    resourceType: 'deployment',
    actionType: 'update',
    enableAbac: true,
  },
  'DELETE /api/v1/deployments/:id': {
    permissions: ['deployment:delete'],
    resourceType: 'deployment',
    actionType: 'delete',
    enableAbac: true,
  },
  'POST /api/v1/deployments/:id/rollback': {
    permissions: ['deployment:rollback'],
    resourceType: 'deployment',
    actionType: 'rollback',
    enableAbac: true,
  },

  // CMDB API
  'GET /api/v1/cmdb': {
    permissions: ['cmdb:read'],
    resourceType: 'cmdb',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/cmdb': {
    permissions: ['cmdb:create'],
    resourceType: 'cmdb',
    actionType: 'create',
    enableAbac: true,
  },
  'PUT /api/v1/cmdb/:id': {
    permissions: ['cmdb:update'],
    resourceType: 'cmdb',
    actionType: 'update',
    enableAbac: true,
  },
  'DELETE /api/v1/cmdb/:id': {
    permissions: ['cmdb:delete'],
    resourceType: 'cmdb',
    actionType: 'delete',
    enableAbac: true,
  },

  // Tenant API (管理员权限)
  'GET /api/v1/tenants': {
    roles: ['admin'],
    resourceType: 'tenant',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/tenants': {
    roles: ['admin'],
    permissions: ['tenant:create'],
    resourceType: 'tenant',
    actionType: 'create',
    enableAbac: true,
  },
  'PUT /api/v1/tenants/:id': {
    roles: ['admin'],
    permissions: ['tenant:update'],
    resourceType: 'tenant',
    actionType: 'update',
    enableAbac: true,
  },
  'DELETE /api/v1/tenants/:id': {
    roles: ['admin'],
    permissions: ['tenant:delete'],
    resourceType: 'tenant',
    actionType: 'delete',
    enableAbac: true,
  },
  'POST /api/v1/tenants/:id/suspend': {
    roles: ['admin'],
    permissions: ['tenant:suspend'],
    resourceType: 'tenant',
    actionType: 'suspend',
    enableAbac: true,
  },
  'POST /api/v1/tenants/:id/activate': {
    roles: ['admin'],
    permissions: ['tenant:activate'],
    resourceType: 'tenant',
    actionType: 'activate',
    enableAbac: true,
  },
  'POST /api/v1/tenants/:id/quota': {
    roles: ['admin'],
    permissions: ['tenant:quota'],
    resourceType: 'tenant',
    actionType: 'quota',
    enableAbac: true,
  },

  // User API
  'GET /api/v1/users': {
    permissions: ['user:read'],
    resourceType: 'user',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/users': {
    roles: ['admin'],
    permissions: ['user:create'],
    resourceType: 'user',
    actionType: 'create',
    enableAbac: true,
  },
  'PUT /api/v1/users/:id': {
    permissions: ['user:update'],
    resourceType: 'user',
    actionType: 'update',
    enableAbac: true,
  },
  'DELETE /api/v1/users/:id': {
    roles: ['admin'],
    permissions: ['user:delete'],
    resourceType: 'user',
    actionType: 'delete',
    enableAbac: true,
  },

  // Role API
  'GET /api/v1/roles': {
    permissions: ['role:read'],
    resourceType: 'role',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/roles/assign': {
    roles: ['admin'],
    permissions: ['role:assign'],
    resourceType: 'role',
    actionType: 'assign',
    enableAbac: true,
  },
  'POST /api/v1/roles/revoke': {
    roles: ['admin'],
    permissions: ['role:revoke'],
    resourceType: 'role',
    actionType: 'revoke',
    enableAbac: true,
  },

  // Artifact API
  'GET /api/v1/artifacts': {
    permissions: ['artifact:read'],
    resourceType: 'artifact',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/artifacts': {
    permissions: ['artifact:upload'],
    resourceType: 'artifact',
    actionType: 'upload',
    enableAbac: true,
  },
  'DELETE /api/v1/artifacts/:id': {
    permissions: ['artifact:delete'],
    resourceType: 'artifact',
    actionType: 'delete',
    enableAbac: true,
  },

  // Monitoring API
  'GET /api/v1/monitoring': {
    permissions: ['monitoring:read'],
    resourceType: 'monitoring',
    actionType: 'read',
    enableAbac: true,
  },

  // Alert API
  'GET /api/v1/alerts': {
    permissions: ['alert:read'],
    resourceType: 'alert',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/alerts/:id/acknowledge': {
    permissions: ['alert:acknowledge'],
    resourceType: 'alert',
    actionType: 'acknowledge',
    enableAbac: true,
  },
  'POST /api/v1/alerts/:id/resolve': {
    permissions: ['alert:resolve'],
    resourceType: 'alert',
    actionType: 'resolve',
    enableAbac: true,
  },

  // Log API
  'GET /api/v1/logs': {
    permissions: ['log:read'],
    resourceType: 'log',
    actionType: 'read',
    enableAbac: true,
  },

  // Test API
  'GET /api/v1/tests': {
    permissions: ['test:read'],
    resourceType: 'test',
    actionType: 'read',
    enableAbac: true,
  },
  'POST /api/v1/tests': {
    permissions: ['test:create'],
    resourceType: 'test',
    actionType: 'create',
    enableAbac: true,
  },
  'POST /api/v1/tests/:id/execute': {
    permissions: ['test:execute'],
    resourceType: 'test',
    actionType: 'execute',
    enableAbac: true,
  },
};

/**
 * 权限中间件类
 */
export class PermissionMiddleware {
  private permissionMap: Map<string, PermissionConfig> = new Map();
  private bypassPaths: string[] = [
    '/healthz',
    '/readyz',
    '/version',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/swagger',
    '/favicon.ico',
  ];

  constructor(private app: FastifyInstance) {
    this.initPermissionMap();
  }

  /**
   * 初始化权限映射
   */
  private initPermissionMap(): void {
    Object.entries(API_PERMISSION_MAP).forEach(([key, config]) => {
      this.permissionMap.set(key, config);
    });
  }

  /**
   * 添加公开路径（不需要权限检查）
   */
  addBypassPath(path: string): void {
    this.bypassPaths.push(path);
  }

  /**
   * 添加自定义权限配置
   */
  addPermissionConfig(routeKey: string, config: PermissionConfig): void {
    this.permissionMap.set(routeKey, config);
  }

  /**
   * 检查路径是否需要跳过权限检查
   */
  private shouldBypass(url: string): boolean {
    return this.bypassPaths.some((path) => url.startsWith(path));
  }

  /**
   * 匹配路由配置
   */
  matchRouteConfig(method: string, url: string): PermissionConfig | null {
    // 构建路由键
    const routeKey = `${method.toUpperCase()} ${url}`;

    // 直接匹配
    if (this.permissionMap.has(routeKey)) {
      return this.permissionMap.get(routeKey) || null;
    }

    // 模式匹配（处理带参数的路由）
    for (const [key, config] of this.permissionMap.entries()) {
      const [keyMethod, keyPattern] = key.split(' ');
      if (keyMethod !== method.toUpperCase()) continue;

      // 将 :id 等参数转换为正则
      const regexPattern = keyPattern
        .replace(/:[^/]+/g, '[^/]+')
        .replace(/\//g, '\\/');

      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(url)) {
        return config;
      }
    }

    return null;
  }

  /**
   * 从请求构建 ABAC 上下文
   */
  private buildAbacContext(
    request: FastifyRequest,
    resourceType?: string,
    actionType?: string,
    resourceId?: string
  ): AbacContext {
    const authContext = request.authContext;
    const user = authContext?.user;

    return {
      user: {
        id: user?.sub || '',
        role: user?.roles?.[0] || '',
        department: (user as any)?.department,
        level: (user as any)?.level,
        teams: (user as any)?.teams,
        tenantId: (user as any)?.tenantId,
        attributes: user as any,
      },
      resource: {
        type: resourceType || 'unknown',
        id: resourceId,
        owner: (request.params as any)?.owner,
        ownerId: (request.params as any)?.ownerId,
        department: (request.params as any)?.department,
        sensitivity: (request.params as any)?.sensitivity,
        tenantId: (request as any)?.tenantId,
        attributes: request.params as any,
      },
      environment: {
        time: new Date(),
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        network: this.determineNetworkType(request),
        sessionId: (user as any)?.sessionId,
      },
      action: {
        type: actionType || request.method.toLowerCase(),
        impact: this.determineActionImpact(request.method, actionType),
      },
    };
  }

  /**
   * 确定网络类型
   */
  private determineNetworkType(request: FastifyRequest): 'internal' | 'external' | 'vpn' {
    const ip = request.ip;

    // 内部 IP
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.')) {
      return 'internal';
    }

    // VPN IP（假设 VPN 使用特定 IP 段）
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor && typeof forwardedFor === 'string') {
      if (forwardedFor.includes('vpn')) {
        return 'vpn';
      }
    }

    return 'external';
  }

  /**
   * 确定操作影响级别
   */
  private determineActionImpact(method: string, actionType?: string): 'low' | 'medium' | 'high' | 'critical' {
    // 删除操作为 critical
    if (method === 'DELETE' || actionType === 'delete') {
      return 'critical';
    }

    // 创建/更新为 high
    if (method === 'POST' || method === 'PUT' || actionType === 'create' || actionType === 'update') {
      return 'high';
    }

    // 执行操作为 medium
    if (actionType === 'execute' || actionType === 'trigger') {
      return 'medium';
    }

    // 读取为 low
    return 'low';
  }

  /**
   * 执行 RBAC 检查
   */
  private checkRbac(userId: string, config: PermissionConfig): PermissionCheckResult['rbacResult'] {
    const result = {
      hasPermission: true,
      missingPermissions: [] as string[],
      hasRole: true,
      missingRoles: [] as string[],
    };

    // 检查权限（如果配置了权限要求）
    if (config.permissions && config.permissions.length > 0) {
      // 初始化为 false，只有满足所有权限才为 true
      result.hasPermission = config.permissions.every((perm) => rbacService.hasPermission(userId, perm));
      if (!result.hasPermission) {
        result.missingPermissions = config.permissions.filter((perm) => !rbacService.hasPermission(userId, perm));
      }
    }

    // 检查角色（如果配置了角色要求）
    if (config.roles && config.roles.length > 0) {
      const userRoles = rbacService.getUserRoles(userId);
      const userRoleIds = userRoles.map((r) => r.id);

      // 用户需要拥有任一配置的角色
      result.hasRole = config.roles.some((role) => userRoleIds.includes(role));
      if (!result.hasRole) {
        result.missingRoles = config.roles.filter((role) => !userRoleIds.includes(role));
      }
    }

    return result;
  }

  /**
   * 执行 ABAC 检查
   */
  private checkAbac(context: AbacContext): PolicyEvaluationResult {
    return abacPolicyEngine.evaluate(context);
  }

  /**
   * 综合权限检查
   */
  async checkPermission(
    request: FastifyRequest,
    config: PermissionConfig
  ): Promise<PermissionCheckResult> {
    const authContext = request.authContext;

    // 未认证用户直接拒绝
    if (!authContext?.authenticated || !authContext?.user?.sub) {
      return {
        allowed: false,
        denied: false,
        reason: 'Authentication required',
        needsAuth: true, // 标记需要认证
        rbacResult: {
          hasPermission: false,
          missingPermissions: [],
          hasRole: false,
          missingRoles: [],
        },
      };
    }

    const userId = authContext.user.sub;
    const resourceId = (request.params as any)?.id;

    // 1. RBAC 检查
    const rbacResult = this.checkRbac(userId, config);

    // RBAC 不通过则拒绝
    // 如果配置了 permissions 但用户没有权限，拒绝
    // 如果配置了 roles 但用户没有角色，拒绝
    const hasRbacConfig = (config.permissions && config.permissions.length > 0) ||
                          (config.roles && config.roles.length > 0);

    if (hasRbacConfig && (!rbacResult.hasPermission || !rbacResult.hasRole)) {
      return {
        allowed: false,
        denied: false,
        reason: `Missing permissions: ${rbacResult.missingPermissions.join(', ')}. Missing roles: ${rbacResult.missingRoles.join(', ')}`,
        rbacResult: rbacResult,
      };
    }

    // 2. ABAC 检查（如果启用）
    let abacResult: PolicyEvaluationResult | undefined;
    if (config.enableAbac) {
      const abacContext = this.buildAbacContext(
        request,
        config.resourceType,
        config.actionType,
        resourceId
      );
      abacResult = this.checkAbac(abacContext);

      // ABAC deny 优先
      if (abacResult.denied) {
        return {
          allowed: false,
          denied: true,
          reason: abacResult.denialReason || 'ABAC policy denied',
          rbacResult,
          abacResult,
        };
      }
    }

    // 3. 自定义检查（如果配置）
    if (config.customCheck) {
      try {
        const customResult = await config.customCheck(request);
        if (!customResult) {
          return {
            allowed: false,
            denied: false,
            reason: 'Custom permission check failed',
            rbacResult,
            abacResult,
          };
        }
      } catch (error) {
        return {
          allowed: false,
          denied: false,
          reason: `Custom check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rbacResult,
          abacResult,
        };
      }
    }

    // 通过所有检查
    return {
      allowed: true,
      denied: false,
      rbacResult,
      abacResult,
    };
  }

  /**
   * 权限检查中间件处理器
   */
  async handler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const url = request.raw.url || '';
    const method = request.method;

    // 跳过公开路径
    if (this.shouldBypass(url)) {
      return;
    }

    // 匹配路由配置
    const config = this.matchRouteConfig(method, url);

    // 无配置的路由默认需要认证但无权限限制
    if (!config) {
      // 检查是否有认证
      if (!request.authContext?.authenticated) {
        reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      return;
    }

    // 执行权限检查
    const result = await this.checkPermission(request, config);

    if (!result.allowed) {
      // 需要认证的情况返回 401
      if (result.needsAuth) {
        reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // 记录权限拒绝日志
      this.app.log.warn({
        userId: request.authContext?.user?.sub,
        method,
        url,
        reason: result.reason,
        rbac: result.rbacResult,
        abac: result.abacResult,
      }, 'Permission denied');

      reply.code(403).send({
        error: 'FORBIDDEN',
        message: result.reason || 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        details: {
          missingPermissions: result.rbacResult?.missingPermissions,
          missingRoles: result.rbacResult?.missingRoles,
          abacDenied: result.abacResult?.denied,
        },
      });
      return;
    }

    // 权限通过，继续处理
    return;
  }

  /**
   * 创建特定路由的权限检查 preHandler
   */
  requirePermission(config: PermissionConfig): preHandlerHookHandler {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await this.checkPermission(request, config);

      if (!result.allowed) {
        reply.code(403).send({
          error: 'FORBIDDEN',
          message: result.reason || 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
        });
        return;
      }
    };
  }

  /**
   * 创建角色检查 preHandler
   */
  requireRoles(...roles: string[]): preHandlerHookHandler {
    return this.requirePermission({ roles });
  }

  /**
   * 创建权限检查 preHandler
   */
  requirePermissions(...permissions: string[]): preHandlerHookHandler {
    return this.requirePermission({ permissions });
  }

  /**
   * 创建 ABAC 检查 preHandler
   */
  requireAbac(resourceType: string, actionType: string): preHandlerHookHandler {
    return this.requirePermission({
      resourceType,
      actionType,
      enableAbac: true,
    });
  }

  /**
   * 获取用户的可用权限列表
   */
  getUserPermissions(userId: string): Permission[] {
    return rbacService.getUserPermissions(userId);
  }

  /**
   * 获取用户可执行的操作
   */
  getAvailableActions(
    request: FastifyRequest,
    resourceType: string,
    actionTypes: string[]
  ): string[] {
    const authContext = request.authContext;
    if (!authContext?.user?.sub) return [];

    const context = this.buildAbacContext(request, resourceType);
    return abacPolicyEngine.getAvailableActions(context, actionTypes);
  }

  /**
   * 检查特定资源权限
   */
  async checkResourcePermission(
    request: FastifyRequest,
    resourceType: string,
    actionType: string,
    resourceId?: string
  ): Promise<PermissionCheckResult> {
    const config: PermissionConfig = {
      resourceType,
      actionType,
      enableAbac: true,
    };

    const result = await this.checkPermission(request, config);

    // 如果需要检查特定资源，重新构建 ABAC 上下文
    if (resourceId && result.abacResult) {
      const abacContext = this.buildAbacContext(request, resourceType, actionType, resourceId);
      result.abacResult = abacPolicyEngine.evaluate(abacContext);
      result.allowed = result.allowed && !result.abacResult.denied;
    }

    return result;
  }
}

// 导出便捷函数
export function createPermissionMiddleware(app: FastifyInstance): PermissionMiddleware {
  return new PermissionMiddleware(app);
}