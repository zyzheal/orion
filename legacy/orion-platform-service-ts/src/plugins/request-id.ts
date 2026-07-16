/**
 * Request ID 插件
 *
 * 为每个请求自动注入唯一的 requestId，用于全链路追踪。
 * 优先级：X-Request-Id Header > Fastify request.id > 自动生成
 *
 * 用法:
 *   fastify.register(requestIdPlugin);
 *
 * 结果:
 *   - request.id 始终可用
 *   - 响应自动添加 X-Request-Id Header
 *   - 日志自动附加 requestId 字段
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

export interface RequestIdPluginOptions {
  /** Header 名称，默认 'X-Request-Id' */
  headerName?: string;
  /** 是否将 requestId 添加到响应 Header，默认 true */
  setResponseHeader?: boolean;
  /** 是否在 Pino 日志中添加 requestId 字段，默认 true */
  attachToLog?: boolean;
}

const requestIdPlugin: FastifyPluginAsync<RequestIdPluginOptions> = async (
  fastify: FastifyInstance,
  options: RequestIdPluginOptions = {}
): Promise<void> => {
  const headerName = options.headerName || 'X-Request-Id';
  const setResponseHeader = options.setResponseHeader !== false;
  const attachToLog = options.attachToLog !== false;

  // onRequest: 确保每个请求都有 requestId
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 优先级 1: 客户端传入的 X-Request-Id
    const clientRequestId = request.headers[headerName.toLowerCase()];
    if (typeof clientRequestId === 'string' && clientRequestId.length > 0) {
      (request as any).id = clientRequestId;
      return;
    }

    // 优先级 2: Fastify 内置的 requestId（如果配置了 genReqId）
    if (request.id) {
      return;
    }

    // 优先级 3: 自动生成
    (request as any).id = `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  });

  // onResponse: 将 requestId 添加到响应 Header
  if (setResponseHeader) {
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!reply.getHeader(headerName)) {
        const requestId = (request as any).id;
        if (requestId) {
          reply.header(headerName, requestId);
        }
      }
    });
  }

  // 日志集成：将 requestId 附加到所有日志条目
  if (attachToLog) {
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      const requestId = (request as any).id;
      if (requestId && request.log) {
        (request.log as any).bindings = () => ({ requestId });
      }
    });
  }

  fastify.log.info(`[RequestIdPlugin] enabled (header: ${headerName})`);
};

export default requestIdPlugin;
