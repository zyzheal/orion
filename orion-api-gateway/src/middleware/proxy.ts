/**
 * 代理中间件
 *
 * 将请求代理到后端服务，支持：
 * - 服务发现与路由
 * - 超时控制（默认 30 秒）
 * - 重试策略（指数退避）
 * - 熔断机制（连续失败 5 次触发）
 * - 请求追踪 ID 传播
 * - 租户 ID 传播
 * - 统一错误码映射
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import httpProxy, { ServerOptions } from 'http-proxy';
import { Readable } from 'stream';
import {
  ServiceClient,
  ServiceClientError,
  SERVICE_ROUTES,
  CircuitState,
} from '../services/service-client';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';

export interface ProxyOptions {
  timeout?: number;
  preserveHost?: boolean;
  changeOrigin?: boolean;
  skipRetry?: boolean;
}

/**
 * 扩展 FastifyRequest 以包含租户和请求追踪信息
 */
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    requestId: string;
  }
}

export class ProxyMiddleware {
  private proxyServer: httpProxy;
  private serviceClient: ServiceClient;

  constructor(serviceClient?: ServiceClient) {
    this.proxyServer = httpProxy.createProxyServer({
      xfwd: true, // 添加 X-Forwarded-* 头部
    });
    this.serviceClient = serviceClient || new ServiceClient();

    // 监听服务客户端事件
    this.setupEventListeners();

    // 为所有代理响应注入 CORS 头
    // 确保目标服务返回的响应包含 CORS 头，支持跨域访问
    this.setupCorsInjection();
  }

  /**
   * 设置 CORS 注入
   * 为所有通过代理的响应添加 CORS 头，支持前端跨域访问后端服务
   */
  private setupCorsInjection(): void {
    this.proxyServer.on('proxyRes', (proxyRes, req, res) => {
      // 如果响应已结束，跳过 CORS 注入
      if (res.headersSent || res.writableEnded) return;

      const requestOrigin = (req as any).headers?.origin;

      // 不覆盖后端已设置的 CORS 头
      if (res.getHeader('Access-Control-Allow-Origin')) return;

      // 规范要求：credentials: true 时不能使用 origin: *
      // 有 origin 则回显，否则不设置 allow-credentials（降级为 *）
      const allowOrigin = requestOrigin || '*';
      const allowCredentials = requestOrigin ? 'true' : undefined;

      const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Request-ID, X-Tenant-ID',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Expose-Headers': 'X-Request-ID',
      };

      if (allowCredentials) {
        headers['Access-Control-Allow-Credentials'] = allowCredentials;
      }

      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    });
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.serviceClient.on('circuit:open', (serviceName: string, state: CircuitState) => {
      console.warn(`[Proxy] Circuit breaker OPEN for service: ${serviceName}`);
    });

    this.serviceClient.on('request:retry', (serviceName: string, path: string, attempt: number, delay: number) => {
      console.log(`[Proxy] Retrying request to ${serviceName}${path} (attempt ${attempt}) after ${delay}ms`);
    });
  }

  /**
   * 代理请求到目标服务（使用 ServiceClient）
   */
  async forwardWithClient<T = any>(
    request: FastifyRequest,
    reply: FastifyReply,
    serviceName: string,
    path: string,
    options: ProxyOptions = {}
  ): Promise<T> {
    // 构建请求头，传播追踪 ID 和租户 ID
    const headers: Record<string, string> = {
      'X-Request-ID': request.requestId,
      'X-Forwarded-For': request.ip,
    };

    // 传播租户 ID
    if (request.tenantId) {
      headers['X-Tenant-ID'] = request.tenantId;
    }

    // 传播认证信息
    const authHeader = request.headers.authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    try {
      const response = await this.serviceClient.request<T>(serviceName, path, {
        method: request.method as any,
        headers,
        body: request.body,
        timeout: options.timeout,
        skipRetry: options.skipRetry,
      });

      return response.data;
    } catch (error) {
      this.handleError(error, reply, serviceName, path);
      throw error;
    }
  }

  /**
   * 代理请求到目标服务（直接代理模式，用于流式响应）
   */
  /**
   * 代理请求到目标服务（直接代理模式，用于流式响应）
   *
   * OPTIONS 预检请求直接响应，不代理到后端
   */
  forward(
    request: FastifyRequest,
    reply: FastifyReply,
    target: string,
    options?: ProxyOptions
  ): void {
    // 处理 CORS 预检请求（OPTIONS），直接响应不代理
    if (request.method === 'OPTIONS') {
      const requestOrigin = request.headers.origin;
      const allowOrigin = requestOrigin || '*';

      reply.header('Access-Control-Allow-Origin', allowOrigin);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Request-ID, X-Tenant-ID');
      reply.header('Access-Control-Max-Age', '86400');
      if (requestOrigin) {
        reply.header('Access-Control-Allow-Credentials', 'true');
      }
      reply.code(204).send();
      return;
    }

    const timeout = options?.timeout || 30000;

    // 设置超时
    request.raw.setTimeout(timeout);

    // 构建代理请求头，传播认证和追踪信息
    const proxyHeaders: Record<string, string> = {
      'X-Request-ID': request.requestId || `gw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    // 传播 Content-Type（POST 请求必需）
    const contentType = request.headers['content-type'];
    if (contentType) {
      proxyHeaders['Content-Type'] = contentType as string;
    }

    // 传播认证信息（Authorization 或 X-API-Key）
    const authHeader = request.headers.authorization;
    if (authHeader) {
      proxyHeaders['Authorization'] = authHeader;
    }
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      proxyHeaders['X-API-Key'] = apiKey as string;
    }

    // 传播租户 ID
    if (request.tenantId) {
      proxyHeaders['X-Tenant-ID'] = request.tenantId;
    }

    const proxyOptions: ServerOptions = {
      target,
      changeOrigin: options?.changeOrigin !== false,
      timeout,
      headers: proxyHeaders,
    };

    // 如果 Fastify 已解析 body（如 POST/PUT），http-proxy 无法读取原始流，
    // 需要手动将已解析的 body 序列化为 buffer 注入
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined;
    if (hasBody) {
      const bodyStr = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);
      const bodyBuffer = Buffer.from(bodyStr);
      const bufferStream = Readable.from(bodyBuffer);
      proxyOptions.buffer = bufferStream;

      // 更新 Content-Length 以匹配重新序列化的 body
      proxyHeaders['Content-Length'] = String(bodyBuffer.length);
    }

    // 使用 once 注册 error 处理，避免监听器累积
    this.proxyServer.once('error', (err, req, res) => {
      const errorResponse = ErrorFactory.create(
        ErrorCodes.HTTP_REQUEST_FAILED,
        { target, error: err.message }
      );
      reply.code(errorResponse.statusCode).send(errorResponse.toJSON(request.requestId));
    });

    this.proxyServer.web(request.raw, reply.raw, proxyOptions);
  }

  /**
   * 处理服务客户端错误
   */
  private handleError(
    error: unknown,
    reply: FastifyReply,
    serviceName: string,
    path: string
  ): void {
    if (error instanceof ServiceClientError) {
      const errorResponse = this.mapServiceErrorToResponse(error, serviceName, path);
      reply.code(errorResponse.statusCode).send(errorResponse);
      return;
    }

    // 未知错误
    const errorResponse = ErrorFactory.create(ErrorCodes.HTTP_REQUEST_FAILED, {
      serviceName,
      path,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    reply.code(502).send(errorResponse);
  }

  /**
   * 映射服务客户端错误到响应
   */
  private mapServiceErrorToResponse(
    error: ServiceClientError,
    serviceName: string,
    path: string
  ): { statusCode: number; error: string; message: string; code: string; details?: any } {
    const codeMap: Record<string, { statusCode: number; errorCode: ErrorCodes }> = {
      'TIMEOUT': { statusCode: 504, errorCode: ErrorCodes.HTTP_TIMEOUT },
      'REQUEST_FAILED': { statusCode: 502, errorCode: ErrorCodes.HTTP_REQUEST_FAILED },
      'CIRCUIT_OPEN': { statusCode: 503, errorCode: ErrorCodes.GATEWAY_UNAVAILABLE },
      'SERVICE_NOT_FOUND': { statusCode: 404, errorCode: ErrorCodes.ROUTE_NOT_FOUND },
      'SERVICE_UNAVAILABLE': { statusCode: 503, errorCode: ErrorCodes.GATEWAY_UNAVAILABLE },
    };

    const mapping = codeMap[error.code];
    if (mapping) {
      const errorResponse = ErrorFactory.create(mapping.errorCode, {
        serviceName,
        path,
        originalCode: error.code,
        ...error.details,
      });
      return {
        statusCode: mapping.statusCode,
        error: errorResponse.name,
        message: error.message,
        code: errorResponse.code,
        details: errorResponse.details,
      };
    }

    return {
      statusCode: error.statusCode,
      error: 'ServiceError',
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  /**
   * 健康检查代理
   */
  async checkServiceHealth(url: string, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const checkUrl = new URL('/healthz', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      fetch(checkUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
      })
        .then((res) => {
          clearTimeout(timeoutId);
          resolve(res.ok);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          resolve(false);
        });
    });
  }

  /**
   * 获取服务熔断器状态
   */
  getCircuitState(serviceName: string): CircuitState | undefined {
    return this.serviceClient.getCircuitState(serviceName);
  }

  /**
   * 重置服务熔断器
   */
  resetCircuit(serviceName: string): void {
    this.serviceClient.resetCircuit(serviceName);
  }

  /**
   * 获取底层 proxy 实例
   */
  getProxyServer(): httpProxy {
    return this.proxyServer;
  }

  /**
   * 获取服务客户端实例
   */
  getServiceClient(): ServiceClient {
    return this.serviceClient;
  }
}

// 导出单例
export const proxyMiddleware = new ProxyMiddleware();

// 导出服务路由配置供其他模块使用
export { SERVICE_ROUTES };
