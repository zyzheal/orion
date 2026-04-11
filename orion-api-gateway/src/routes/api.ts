/**
 * API 路由
 *
 * 定义网关的路由规则，将请求分发到对应的后端服务
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config';
import { proxyMiddleware } from '../middleware/proxy';

export interface RouteConfig {
  prefix: string;
  target: string;
  timeout?: number;
  stripPrefix?: boolean;
}

// 预定义路由配置
const routeConfigs: RouteConfig[] = [
  {
    prefix: '/api/v1/platform',
    target: getConfig().services.platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1',
    target: getConfig().services.platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
];

/**
 * 注册 API 路由
 */
export function registerRoutes(app: FastifyInstance): void {
  const config = getConfig();

  // 注册健康检查路由
  app.get('/healthz', async (request, reply) => {
    reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || '1.0.0',
      service: 'api-gateway',
    });
  });

  // 注册就绪检查路由
  app.get('/readyz', async (request, reply) => {
    // 检查依赖服务是否就绪
    const platformReady = await proxyMiddleware.checkServiceHealth(
      config.services.platform?.url || 'http://localhost:3001',
      2000
    );

    const ready = platformReady;

    reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        platform: platformReady ? 'up' : 'down',
      },
    });
  });

  // 注册版本信息路由
  app.get('/version', async (request, reply) => {
    reply.send({
      name: '@orion/api-gateway',
      version: process.env.VERSION || '1.0.0',
      buildTime: process.env.BUILD_TIME,
      gitCommit: process.env.GIT_COMMIT,
    });
  });

  // 注册动态代理路由
  for (const routeConfig of routeConfigs) {
    registerProxyRoute(app, routeConfig);
  }
}

/**
 * 注册单个代理路由
 */
function registerProxyRoute(app: FastifyInstance, config: RouteConfig): void {
  app.all(`${config.prefix}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    const target = config.target;
    const url = request.raw.url || '';

    // 如果需要去除前缀
    let targetPath = url;
    if (config.stripPrefix && config.prefix !== '/') {
      targetPath = url.replace(config.prefix, '') || '/';
    }

    // 构建目标 URL
    const targetUrl = new URL(targetPath, target).toString();

    // 代理请求
    proxyMiddleware.forward(request, reply, target, {
      timeout: config.timeout,
      changeOrigin: true,
    });
  });
}

/**
 * 添加自定义路由配置
 */
export function addRouteConfig(config: RouteConfig): void {
  routeConfigs.push(config);
}
