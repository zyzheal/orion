/**
 * BaseController - Controller 层基类
 *
 * ARCH-012: 统一 Controller 认证和错误处理逻辑
 * ARCH-013: 集成全局错误类型系统
 *
 * 功能:
 * 1. 统一 JWT 用户提取
 * 2. 统一错误响应格式 (使用全局 ErrorCode)
 * 3. 统一成功响应格式
 * 4. 统一 401/403/404/400 处理
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  ErrorCode,
  OrionError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BusinessError,
  handleError,
  createSuccessResponse,
} from '../../errors';

/**
 * 用户信息类型
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
}

/**
 * BaseController - 所有 Controller 的基类
 *
 * ARCH-012/ARCH-013: 提供统一的认证和响应处理方法
 */
export abstract class BaseController {
  /**
   * ARCH-012: 统一 JWT 用户提取
   * 所有 Controller 应使用此方法而非直接读取 request.user
   */
  protected getUser(request: FastifyRequest): AuthenticatedUser | null {
    const user = (request as any).user as AuthenticatedUser | undefined;
    if (!user) return null;
    return user;
  }

  /**
   * ARCH-012: 要求认证（如果未认证返回 401）
   */
  protected requireAuth(request: FastifyRequest, reply: FastifyReply): AuthenticatedUser | null {
    const user = this.getUser(request);
    if (!user) {
      this.sendUnauthorized(reply);
      return null;
    }
    return user;
  }

  /**
   * ARCH-012: 要求特定角色
   */
  protected requireRole(
    request: FastifyRequest,
    reply: FastifyReply,
    allowedRoles: string[],
  ): AuthenticatedUser | null {
    const user = this.requireAuth(request, reply);
    if (!user) return null;

    if (!allowedRoles.includes(user.role)) {
      this.sendForbidden(reply, `需要角色: ${allowedRoles.join(', ')}`);
      return null;
    }

    return user;
  }

  /**
   * ARCH-013: 发送成功响应（使用全局响应格式）
   */
  protected sendSuccess<T>(
    reply: FastifyReply,
    data: T,
    total?: number,
    metadata?: Record<string, unknown>,
  ): void {
    reply.send(createSuccessResponse(data, total, metadata));
  }

  /**
   * ARCH-013: 发送创建成功响应 (201)
   */
  protected sendCreated<T>(reply: FastifyReply, data: T): void {
    reply.status(201).send(createSuccessResponse(data));
  }

  /**
   * ARCH-013: 发送删除成功响应
   */
  protected sendDeleted(reply: FastifyReply, id: string): void {
    reply.send(createSuccessResponse({ id, deleted: true }));
  }

  /**
   * ARCH-013: 发送更新成功响应
   */
  protected sendUpdated<T>(reply: FastifyReply, data: T): void {
    reply.send(createSuccessResponse(data));
  }

  /**
   * ARCH-013: 发送 401 Unauthorized（使用全局错误类型）
   */
  protected sendUnauthorized(reply: FastifyReply, message: string = '未授权访问'): void {
    const error = new UnauthorizedError(message);
    reply.status(error.getHttpStatus()).send(error.toJSON());
  }

  /**
   * ARCH-013: 发送 403 Forbidden（使用全局错误类型）
   */
  protected sendForbidden(reply: FastifyReply, message: string = '禁止访问'): void {
    const error = new ForbiddenError(message);
    reply.status(error.getHttpStatus()).send(error.toJSON());
  }

  /**
   * ARCH-013: 发送 404 Not Found（使用全局错误类型）
   */
  protected sendNotFound(reply: FastifyReply, resource: string, id?: string): void {
    const error = new NotFoundError(resource, id);
    reply.status(error.getHttpStatus()).send(error.toJSON());
  }

  /**
   * ARCH-013: 发送 400 Bad Request（使用全局错误类型）
   */
  protected sendBadRequest(reply: FastifyReply, message: string, details?: Record<string, unknown>): void {
    const error = new ValidationError(message, details);
    reply.status(error.getHttpStatus()).send(error.toJSON());
  }

  /**
   * ARCH-013: 发送业务逻辑错误 (422)
   */
  protected sendBusinessError(reply: FastifyReply, message: string, details?: Record<string, unknown>): void {
    const error = new BusinessError(message, details);
    reply.status(error.getHttpStatus()).send(error.toJSON());
  }

  /**
   * ARCH-013: 发送 500 Internal Server Error
   */
  protected sendInternalError(reply: FastifyReply, error: unknown): void {
    handleError(reply, error);
  }

  /**
   * ARCH-013: 统一错误处理（使用全局错误处理器）
   */
  protected handleError(reply: FastifyReply, error: unknown): void {
    handleError(reply, error);
  }

  /**
   * ARCH-012: 获取查询参数
   */
  protected getQuery<T extends Record<string, string | undefined>>(request: FastifyRequest): T {
    return request.query as T;
  }

  /**
   * 获取租户ID（从请求头或user信息）
   */
  protected getTenantId(request: FastifyRequest): string {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (tenantId) return tenantId;
    const user = this.getUser(request);
    return user?.tenantId || 'default';
  }

  /**
   * ARCH-012: 获取路径参数
   */
  protected getParams<T extends Record<string, string>>(request: FastifyRequest): T {
    return request.params as T;
  }

  /**
   * ARCH-012: 获取请求体
   */
  protected getBody<T>(request: FastifyRequest): T {
    return request.body as T;
  }

  /**
   * ARCH-012: 解析分页参数
   */
  protected parsePagination(query: Record<string, string | undefined>): {
    page: number;
    perPage: number;
    offset: number;
  } {
    const page = query.page ? parseInt(query.page) : 1;
    const perPage = query.perPage ? parseInt(query.perPage) : 20;
    return {
      page,
      perPage,
      offset: (page - 1) * perPage,
    };
  }

  /**
   * ARCH-013: 尝试执行操作（自动处理错误）
   */
  protected async tryExecute<T>(
    reply: FastifyReply,
    operation: () => Promise<T>,
    onSuccess: (result: T) => void,
  ): Promise<void> {
    try {
      const result = await operation();
      onSuccess(result);
    } catch (error) {
      this.handleError(reply, error);
    }
  }

  /**
   * ARCH-013: 验证必填参数
   */
  protected validateRequired(reply: FastifyReply, params: Record<string, unknown>, requiredFields: string[]): boolean {
    for (const field of requiredFields) {
      if (params[field] === undefined || params[field] === null) {
        this.sendBadRequest(reply, `参数 ${field} 必填`, { field });
        return false;
      }
    }
    return true;
  }

  /**
   * ARCH-013: 执行并返回（简化版）
   */
  protected async executeAndSend<T>(
    reply: FastifyReply,
    operation: () => Promise<T>,
  ): Promise<void> {
    await this.tryExecute(reply, operation, (result) => this.sendSuccess(reply, result));
  }

  /**
   * ARCH-013: 执行创建并返回 201
   */
  protected async executeCreateAndSend<T>(
    reply: FastifyReply,
    operation: () => Promise<T>,
  ): Promise<void> {
    await this.tryExecute(reply, operation, (result) => this.sendCreated(reply, result));
  }
}