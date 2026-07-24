/**
 * replyHelper - Fastify 响应辅助工具函数
 *
 * 提供统一的 API 响应构建方法，符合 Orion API 响应标准
 * @see docs/superpowers/specs/2026-05-21-api-response-standard-design.md
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { OrionResponse, ApiMeta } from '../types/api-response';
import { ErrorCode, ErrorCodes } from '../types/error-codes';

/**
 * 构建 meta 对象（自动注入 requestId 和 timestamp）
 *
 * 安全约束：extra 参数中的 requestId/timestamp 会被忽略，防止路由代码意外覆盖
 * @param request - Fastify 请求对象
 * @param extra - 额外的 meta 字段（如分页信息）
 * @returns ApiMeta 对象
 */
function buildMeta(request: FastifyRequest, extra?: Record<string, unknown>): ApiMeta {
  // 过滤掉 requestId 和 timestamp，防止意外覆盖
  const { requestId: _r, timestamp: _t, ...safeExtra } = extra || {};

  // 获取 requestId（优先使用 Fastify 插件注入的 request.id）
  const requestId = (request as any).id
    ? String((request as any).id)
    : `req_${Math.random().toString(36).slice(2, 10)}`;

  return {
    requestId,
    timestamp: Date.now(),
    ...safeExtra,
  };
}

/**
 * 成功响应（200 OK）
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param data - 响应数据
 * @param meta - 额外的 meta 信息（如分页）
 * @returns Fastify Reply
 */
export function success<T>(
  reply: FastifyReply,
  request: FastifyRequest,
  data: T,
  meta?: Record<string, unknown>
): FastifyReply {
  const response: OrionResponse<T> = {
    success: true,
    data,
    meta: buildMeta(request, meta),
  };
  return reply.send(response);
}

/**
 * 创建成功响应（201 Created）
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param data - 响应数据
 * @param meta - 额外的 meta 信息
 * @returns Fastify Reply
 */
export function created<T>(
  reply: FastifyReply,
  request: FastifyRequest,
  data: T,
  meta?: Record<string, unknown>
): FastifyReply {
  const response: OrionResponse<T> = {
    success: true,
    data,
    meta: buildMeta(request, meta),
  };
  return reply.status(201).send(response);
}

/**
 * 无内容响应（204 No Content）
 *
 * 注意：RFC 7231 规定 204 响应不能包含消息体
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @returns Fastify Reply
 */
export function noContent(reply: FastifyReply, request: FastifyRequest): FastifyReply {
  return reply.status(204).send();
}

/**
 * 通用错误响应
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param statusCode - HTTP 状态码
 * @param code - 错误码（ErrorCode 枚举）
 * @param message - 错误消息
 * @param details - 额外的错误详情（可选）
 * @returns Fastify Reply
 */
export function apiError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown
): FastifyReply {
  const meta = buildMeta(request);
  const response: OrionResponse<null> = {
    success: false,
    data: null,
    error: { code, message, details },
    meta,
  };
  return reply.status(statusCode).send(response);
}

// ========== 快捷错误方法 ==========

/**
 * 400 Bad Request - 客户端参数错误
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param code - 错误码（默认 CLIENT_PARAM_INVALID）
 * @param message - 错误消息
 * @param details - 额外的错误详情（可选）
 * @returns Fastify Reply
 */
export function badRequest(
  reply: FastifyReply,
  request: FastifyRequest,
  code: ErrorCode = ErrorCodes.CLIENT_PARAM_INVALID,
  message: string,
  details?: unknown
): FastifyReply {
  return apiError(reply, request, 400, code, message, details);
}

/**
 * 401 Unauthorized - 未认证
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param message - 错误消息（默认 '未认证'）
 * @returns Fastify Reply
 */
export function unauthorized(
  reply: FastifyReply,
  request: FastifyRequest,
  message = '未认证'
): FastifyReply {
  return apiError(reply, request, 401, ErrorCodes.CLIENT_AUTH_EXPIRED, message);
}

/**
 * 403 Forbidden - 无权限
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param message - 错误消息（默认 '无权限'）
 * @returns Fastify Reply
 */
export function forbidden(
  reply: FastifyReply,
  request: FastifyRequest,
  message = '无权限'
): FastifyReply {
  return apiError(reply, request, 403, ErrorCodes.CLIENT_PERMISSION_DENIED, message);
}

/**
 * 404 Not Found - 资源不存在
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param code - 错误码（默认 CLIENT_RESOURCE_NOT_FOUND）
 * @param message - 错误消息（默认 '资源不存在'）
 * @returns Fastify Reply
 */
export function notFound(
  reply: FastifyReply,
  request: FastifyRequest,
  code: ErrorCode = ErrorCodes.CLIENT_RESOURCE_NOT_FOUND,
  message = '资源不存在'
): FastifyReply {
  return apiError(reply, request, 404, code, message);
}

/**
 * 500 Internal Server Error - 服务器内部错误
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param message - 错误消息（默认 '服务器内部错误'）
 * @param details - 额外的错误详情（可选）
 * @returns Fastify Reply
 */
export function internalError(
  reply: FastifyReply,
  request: FastifyRequest,
  message = '服务器内部错误',
  details?: unknown
): FastifyReply {
  return apiError(reply, request, 500, ErrorCodes.SYS_INTERNAL_ERROR, message, details);
}

/**
 * 503 Service Unavailable - 服务不可用
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param message - 错误消息（默认 '服务暂时不可用'）
 * @returns Fastify Reply
 */
export function serviceUnavailable(
  reply: FastifyReply,
  request: FastifyRequest,
  message = '服务暂时不可用'
): FastifyReply {
  return apiError(reply, request, 503, ErrorCodes.SYS_SERVICE_UNAVAILABLE, message);
}

/**
 * 409 Conflict - 资源冲突
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param code - 错误码（默认 CLIENT_CONFLICT）
 * @param message - 错误消息（默认 '资源冲突'）
 * @returns Fastify Reply
 */
export function conflict(
  reply: FastifyReply,
  request: FastifyRequest,
  code: ErrorCode = ErrorCodes.CLIENT_CONFLICT,
  message = '资源冲突'
): FastifyReply {
  return apiError(reply, request, 409, code, message);
}

/**
 * 429 Too Many Requests - 请求频率超限
 *
 * @param reply - Fastify Reply 对象
 * @param request - Fastify Request 对象
 * @param message - 错误消息（默认 '请求过于频繁，请稍后再试'）
 * @returns Fastify Reply
 */
export function rateLimited(
  reply: FastifyReply,
  request: FastifyRequest,
  message = '请求过于频繁，请稍后再试'
): FastifyReply {
  return apiError(reply, request, 429, ErrorCodes.CLIENT_RATE_LIMITED, message);
}