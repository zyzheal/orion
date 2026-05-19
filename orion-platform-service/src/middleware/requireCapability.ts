/**
 * requireCapability - 基于 CapabilityService 的能力检查中间件
 *
 * 在路由处理前进行能力授权检查（基于 Capability 系统）。
 *
 * 支持两种模式：
 * 1. 静态检查：指定 capabilityId 进行检查 (requireCapability)
 * 2. 动态检查：使用自定义函数动态判断 (requireCapabilityDynamic)
 *
 * Usage (静态模式):
 *   app.get('/api/pipelines/:id/trigger', {
 *     preHandler: [requireCapability({ capabilityId: 'pipeline_operations.trigger' })]
 *   }, handler);
 *
 * Usage (动态模式):
 *   app.get('/api/resources/:id', {
 *     preHandler: [requireCapabilityDynamic({
 *       check: (user, context) => user.roles.includes('admin') || context.resource?.ownerId === user.id
 *     })]
 *   }, handler);
 *
 * Or register globally:
 *   app.addHook('onRequest', requireCapability({ capabilityId: 'global_access.read' }));
 *
 * 便捷函数:
 *   requireCapabilityForAction('pipeline', 'trigger') // 检查 'pipeline:trigger'
 *   requireAnyCapability(['capability_a', 'capability_b']) // 任一通过即可
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CapabilityService } from '../services/capability';

/**
 * 能力检查选项 - 静态模式
 */
export interface RequireCapabilityOptions {
  /** 静态 capability ID，如 'pipeline_operations.trigger' */
  capabilityId?: string;
  /** 可选：从请求中提取环境后缀 */
  extractEnvironmentSuffix?: (req: FastifyRequest) => string | undefined;
  /** 可选：自定义错误消息 */
  errorMessage?: string;
  /** 可选：是否允许需要审批的能力（默认不允许） */
  allowRequiresApproval?: boolean;
}

/**
 * 能力检查选项 - 动态模式
 */
export interface RequireCapabilityDynamicOptions {
  /** 动态检查函数 */
  check: (user: CapabilityCheckUser, context: CapabilityCheckContext) => boolean | Promise<boolean>;
  /** 可选：从请求中提取环境后缀 */
  extractEnvironmentSuffix?: (req: FastifyRequest) => string | undefined;
  /** 可选：自定义错误消息 */
  errorMessage?: string;
}

/**
 * 用户信息类型（用于能力检查）
 */
export interface CapabilityCheckUser {
  id: string;
  userId?: string;
  username: string;
  roles: string[];
  tenantId?: string;
}

/**
 * 能力检查上下文
 */
export interface CapabilityCheckContext {
  resource?: {
    type?: string;
    id?: string;
    ownerId?: string;
    tenantId?: string;
    projectId?: string;
  };
  action?: string;
  environmentSuffix?: string;
  request: FastifyRequest;
}

/**
 * 从请求中提取用户信息的帮助函数
 */
/**
 * 用户信息接口 - 与 authMiddleware 中设置的 user 对象兼容
 */
interface RequestUser {
  userId?: string;
  id?: string;
  username?: string;
  roles?: string[];
  tenantId?: string;
  [key: string]: unknown;
}

/**
 * 从请求中提取用户信息的帮助函数
 */
function extractUserFromRequest(request: FastifyRequest): CapabilityCheckUser {
  const user: RequestUser = (request as RequestUser).user || {};
  return {
    id: user.userId || user.id || '',
    userId: user.userId || user.id,
    username: user.username || '',
    roles: user.roles || [],
    tenantId: user.tenantId,
  };
}

// Global CapabilityService instance, set during app initialization
let capabilityService: CapabilityService | null = null;

/**
 * 设置全局 CapabilityService 实例
 * 在 app.ts 初始化时调用
 */
export function setCapabilityService(service: CapabilityService): void {
  capabilityService = service;
}

/**
 * 获取全局 CapabilityService 实例
 */
export function getCapabilityService(): CapabilityService | null {
  return capabilityService;
}

/**
 * 创建静态能力检查中间件
 *
 * @param options 能力检查选项
 * @returns Fastify 钩子函数
 */
export function requireCapability(options: RequireCapabilityOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!capabilityService) {
      console.error('[requireCapability] CapabilityService not initialized');
      return reply.code(500).send({
        code: 500,
        error: 'INTERNAL_ERROR',
        message: 'Capability service not initialized',
      });
    }

    if (!options.capabilityId) {
      console.error('[requireCapability] capabilityId is required');
      return reply.code(500).send({
        code: 500,
        error: 'INVALID_CONFIG',
        message: 'capabilityId is required for static capability check',
      });
    }

    const user = extractUserFromRequest(request);

    if (!user.id) {
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'User information not found in request',
      });
    }

    try {
      const result = await capabilityService.checkPermission({
        userId: user.id,
        userRoles: user.roles,
        capabilityId: options.capabilityId,
      });

      if (!result.allowed) {
        const message = options.errorMessage || result.reason || 'Insufficient capability';
        return reply.code(403).send({
          code: 403,
          error: 'FORBIDDEN',
          message,
          capabilityId: options.capabilityId,
          requiresApproval: result.requiresApproval,
        });
      }

      // 如果能力需要审批但不允许，直接拒绝
      if (!options.allowRequiresApproval && result.requiresApproval) {
        const message = options.errorMessage || `Capability '${options.capabilityId}' requires approval`;
        return reply.code(403).send({
          code: 403,
          error: 'REQUIRES_APPROVAL',
          message,
          capabilityId: options.capabilityId,
          requiresApproval: true,
        });
      }

      // 将检查结果附加到请求对象，供后续处理函数使用
      const reqWithCapability = request as FastifyRequest & { capabilityCheck?: Record<string, unknown> };
      reqWithCapability.capabilityCheck = {
        allowed: true,
        capabilityId: options.capabilityId,
        requiresApproval: result.requiresApproval,
      };

    } catch (error) {
      console.error('[requireCapability] Error checking capability:', error);
      return reply.code(500).send({
        code: 500,
        error: 'INTERNAL_ERROR',
        message: 'Error checking capability permission',
      });
    }
  };
}

/**
 * 创建动态能力检查中间件
 *
 * @param options 动态检查选项
 * @returns Fastify 钩子函数
 */
export function requireCapabilityDynamic(options: RequireCapabilityDynamicOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = extractUserFromRequest(request);

    if (!user.id) {
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'User information not found in request',
      });
    }

    // 构建上下文
    const context: CapabilityCheckContext = {
      request,
      environmentSuffix: options.extractEnvironmentSuffix?.(request),
      // 可以从请求中提取更多资源信息
      resource: {
        type: request.params['resourceType'] as string | undefined,
        id: request.params['id'] as string | undefined,
      },
      action: request.method,
    };

    try {
      const allowed = await options.check(user, context);

      if (!allowed) {
        const message = options.errorMessage || 'Insufficient capability (dynamic check)';
        return reply.code(403).send({
          code: 403,
          error: 'FORBIDDEN',
          message,
        });
      }

      // 将检查结果附加到请求对象，使用类型断言
      const reqWithCapability = request as FastifyRequest & { capabilityCheck?: Record<string, unknown> };
      reqWithCapability.capabilityCheck = {
        allowed: true,
        dynamic: true,
      };

    } catch (error) {
      console.error('[requireCapability] Error in dynamic capability check:', error);
      return reply.code(500).send({
        code: 500,
        error: 'INTERNAL_ERROR',
        message: 'Error checking capability permission',
      });
    }
  };
}

/**
 * 便捷函数：创建基于 capability 前缀的检查
 * 例如：传入 'pipeline' 会检查 'pipeline.read', 'pipeline.write' 等
 */
export function requireCapabilityForAction(
  resourceType: string,
  action: string,
  options?: Omit<RequireCapabilityOptions, 'capabilityId'>
) {
  const capabilityId = `${resourceType}:${action}`;
  return requireCapability({ ...options, capabilityId });
}

/**
 * 便捷函数：创建组合多个 capability 检查的中间件
 * 只有当用户满足至少一个 capability 时才允许访问
 */
export function requireAnyCapability(capabilityIds: string[], options?: {
  extractEnvironmentSuffix?: (req: FastifyRequest) => string | undefined;
  errorMessage?: string;
}) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!capabilityService) {
      console.error('[requireAnyCapability] CapabilityService not initialized');
      return reply.code(500).send({
        code: 500,
        error: 'INTERNAL_ERROR',
        message: 'Capability service not initialized',
      });
    }

    const user = extractUserFromRequest(request);

    if (!user.id) {
      return reply.code(401).send({
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'User information not found in request',
      });
    }

    try {
      // 检查用户是否有任一所需的 capability
      for (const capabilityId of capabilityIds) {
        const result = await capabilityService.checkPermission({
          userId: user.id,
          userRoles: user.roles,
          capabilityId,
        });

        if (result.allowed) {
          const reqWithCapability = request as FastifyRequest & { capabilityCheck?: Record<string, unknown> };
          reqWithCapability.capabilityCheck = {
            allowed: true,
            capabilityId,
            matchedCapability: capabilityId,
          };
          return; // 有一个通过就允许
        }
      }

      // 全部检查完毕，无一通过
      const message = options?.errorMessage || `User does not have any of the required capabilities: ${capabilityIds.join(', ')}`;
      return reply.code(403).send({
        code: 403,
        error: 'FORBIDDEN',
        message,
        requiredCapabilities: capabilityIds,
      });

    } catch (error) {
      console.error('[requireAnyCapability] Error checking capability:', error);
      return reply.code(500).send({
        code: 500,
        error: 'INTERNAL_ERROR',
        message: 'Error checking capability permission',
      });
    }
  };
}