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
    prefix: '/api/v1/pipelines',
    target: getConfig().services.pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/pipeline',
    target: getConfig().services.pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/deploy',
    target: getConfig().services.deploy?.url || 'http://localhost:3003',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/tickets',
    target: getConfig().services.ticket?.url || 'http://localhost:3004',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/monitoring',
    target: getConfig().services.monitor?.url || 'http://localhost:3005',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/alert',
    target: getConfig().services.monitor?.url || 'http://localhost:3005',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-gateway',
    target: getConfig().services.intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-decision',
    target: getConfig().services.intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-review',
    target: getConfig().services.intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-security',
    target: getConfig().services.intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/change-intelligence',
    target: getConfig().services.intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/agents',
    target: getConfig().services.agent?.url || 'http://localhost:3007',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/cost',
    target: getConfig().services.finops?.url || 'http://localhost:3009',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/finops',
    target: getConfig().services.finops?.url || 'http://localhost:3009',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/cost-operations',
    target: getConfig().services.finops?.url || 'http://localhost:3009',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/code-repo',
    target: getConfig().services.code?.url || 'http://localhost:3010',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/build',
    target: getConfig().services.code?.url || 'http://localhost:3010',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/test-reports',
    target: getConfig().services.code?.url || 'http://localhost:3010',
    timeout: 30000,
    stripPrefix: false,
  },
  // Plugin service
  {
    prefix: '/api/v1/plugins-spi',
    target: getConfig().services.plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugins',
    target: getConfig().services.plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugins-enhanced',
    target: getConfig().services.plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugins/marketplace',
    target: getConfig().services.plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  // AI service
  {
    prefix: '/api/v1/ai-gateway',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-decision',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-review',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-security',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/vector-store',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/vector',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/llm',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/degradation',
    target: getConfig().services.ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  // Security service
  {
    prefix: '/api/v1/risk',
    target: getConfig().services.security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/sbom',
    target: getConfig().services.security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/supply-chain',
    target: getConfig().services.security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/policies',
    target: getConfig().services.security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/quality-gates',
    target: getConfig().services.security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  // Artifact service
  {
    prefix: '/api/v1/artifacts',
    target: getConfig().services.artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/artifact-ops',
    target: getConfig().services.artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/artifact-versions',
    target: getConfig().services.artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },
  // Efficiency service
  {
    prefix: '/api/v1/efficiency',
    target: getConfig().services.efficiency?.url || 'http://localhost:3015',
    timeout: 30000,
    stripPrefix: false,
  },
  // DR service
  {
    prefix: '/api/v1/backup',
    target: getConfig().services.dr?.url || 'http://localhost:3016',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/disaster-recovery',
    target: getConfig().services.dr?.url || 'http://localhost:3016',
    timeout: 30000,
    stripPrefix: false,
  },
  // Federation service
  {
    prefix: '/api/v1/federation',
    target: getConfig().services.federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/federation-advanced',
    target: getConfig().services.federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/multi-cloud',
    target: getConfig().services.federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/multi-cloud-advanced',
    target: getConfig().services.federation?.url || 'http://localhost:3017',
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
