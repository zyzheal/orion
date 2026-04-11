/**
 * 代理中间件
 *
 * 将请求代理到后端服务，支持负载均衡
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import httpProxy, { ServerOptions } from 'http-proxy';
import { getConfig } from '../config';

export interface ProxyOptions {
  timeout?: number;
  preserveHost?: boolean;
  changeOrigin?: boolean;
}

export class ProxyMiddleware {
  private proxyServer: httpProxy;

  constructor() {
    this.proxyServer = httpProxy.createProxyServer({
      xfwd: true, // 添加 X-Forwarded-* 头部
    });
  }

  /**
   * 代理请求到目标服务
   */
  forward(
    request: FastifyRequest,
    reply: FastifyReply,
    target: string,
    options?: ProxyOptions
  ): void {
    const config = getConfig();
    const timeout = options?.timeout || 30000;

    // 设置超时
    request.raw.setTimeout(timeout);

    const proxyOptions: ServerOptions = {
      target,
      changeOrigin: options?.changeOrigin !== false,
      timeout,
    };

    this.proxyServer.web(request.raw, reply.raw, proxyOptions);

    // 处理代理错误
    this.proxyServer.on('error', (err, req, res) => {
      reply.code(502).send({
        error: 'SERVICE_UNAVAILABLE',
        message: `Failed to proxy request to ${target}: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    });
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
   * 获取底层 proxy 实例
   */
  getProxyServer(): httpProxy {
    return this.proxyServer;
  }
}

export const proxyMiddleware = new ProxyMiddleware();
