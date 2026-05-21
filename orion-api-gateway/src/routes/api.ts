/**
 * API 路由
 *
 * 定义网关的路由规则，将请求分发到对应的后端服务
 * 支持全部 34 个服务的代理
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

const services = () => getConfig().services;

// 预定义路由配置 - 全部 34 个服务
const routeConfigs: RouteConfig[] = [
  // ========== Platform Service (3001) ==========
  {
    prefix: '/api/v1/platform',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Pipeline Service (3002) ==========
  {
    prefix: '/api/v1/pipelines',
    target: services().pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/pipeline',
    target: services().pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/pipeline-templates',
    target: services().pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/pipeline-versions',
    target: services().pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/pipeline-budget',
    target: services().pipeline?.url || 'http://localhost:3002',
    timeout: 60000,
    stripPrefix: false,
  },

  // ========== Deploy Service (3003) ==========
  {
    prefix: '/api/v1/deploy',
    target: services().deploy?.url || 'http://localhost:3003',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/deployments',
    target: services().deploy?.url || 'http://localhost:3003',
    timeout: 60000,
    stripPrefix: false,
  },

  // ========== Ticket Service (3004) ==========
  {
    prefix: '/api/v1/tickets',
    target: services().ticket?.url || 'http://localhost:3004',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ticket',
    target: services().ticket?.url || 'http://localhost:3004',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Monitor Service (3005) ==========
  {
    prefix: '/api/v1/monitoring',
    target: services().monitor?.url || 'http://localhost:3005',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/alert',
    target: services().monitor?.url || 'http://localhost:3005',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/alerts',
    target: services().monitor?.url || 'http://localhost:3005',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/metrics',
    target: services().monitor?.url || 'http://localhost:3005',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Intelligence Service (3006) ==========
  {
    prefix: '/api/v1/ai-gateway',
    target: services().intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-decision',
    target: services().intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-review',
    target: services().intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-security',
    target: services().intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/change-intelligence',
    target: services().intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/intelligence',
    target: services().intelligence?.url || 'http://localhost:3006',
    timeout: 60000,
    stripPrefix: false,
  },

  // ========== Agent Service (3007) ==========
  {
    prefix: '/api/v1/agents',
    target: services().agent?.url || 'http://localhost:3007',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/agent',
    target: services().agent?.url || 'http://localhost:3007',
    timeout: 60000,
    stripPrefix: false,
  },

  // ========== Digital Twin Service (3008) ==========
  {
    prefix: '/api/v1/digital-twin',
    target: services()['digital-twin']?.url || 'http://localhost:3008',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== FinOps Service (3009) ==========
  {
    prefix: '/api/v1/cost',
    target: services().finops?.url || 'http://localhost:3009',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/finops',
    target: services().finops?.url || 'http://localhost:3009',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/cost-operations',
    target: services().finops?.url || 'http://localhost:3009',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Code Service (3010) ==========
  {
    prefix: '/api/v1/code-repo',
    target: services().code?.url || 'http://localhost:3010',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/code',
    target: services().code?.url || 'http://localhost:3010',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/build',
    target: services().code?.url || 'http://localhost:3010',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/test-reports',
    target: services().code?.url || 'http://localhost:3010',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Plugin Service (3011) ==========
  {
    prefix: '/api/v1/plugins-spi',
    target: services().plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugins',
    target: services().plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugin',
    target: services().plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugins-enhanced',
    target: services().plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/plugins/marketplace',
    target: services().plugin?.url || 'http://localhost:3011',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== AI Service (3012) ==========
  {
    prefix: '/api/v1/ai',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-models',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/ai-model',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/vector-store',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/vector',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/llm',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/degradation',
    target: services().ai?.url || 'http://localhost:3012',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Security Service (3013) ==========
  {
    prefix: '/api/v1/security',
    target: services().security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/risk',
    target: services().security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/sbom',
    target: services().security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/supply-chain',
    target: services().security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/policies',
    target: services().security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/quality-gates',
    target: services().security?.url || 'http://localhost:3013',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Artifact Service (3014) ==========
  {
    prefix: '/api/v1/artifacts',
    target: services().artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/artifact',
    target: services().artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/artifact-ops',
    target: services().artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/artifact-versions',
    target: services().artifact?.url || 'http://localhost:3014',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Efficiency Service (3015) ==========
  {
    prefix: '/api/v1/efficiency',
    target: services().efficiency?.url || 'http://localhost:3015',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== DR Service (3016) ==========
  {
    prefix: '/api/v1/backup',
    target: services().dr?.url || 'http://localhost:3016',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/disaster-recovery',
    target: services().dr?.url || 'http://localhost:3016',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/dr',
    target: services().dr?.url || 'http://localhost:3016',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Federation Service (3017) ==========
  {
    prefix: '/api/v1/federation',
    target: services().federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/federation-advanced',
    target: services().federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/multi-cloud',
    target: services().federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/multi-cloud-advanced',
    target: services().federation?.url || 'http://localhost:3017',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Approval Service (3018) ==========
  {
    prefix: '/api/v1/approval',
    target: services().approval?.url || 'http://localhost:3018',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/approvals',
    target: services().approval?.url || 'http://localhost:3018',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Notify Service (3019) — routed to platform-service (3001) ==========
  {
    prefix: '/api/v1/notify',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/notification',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/notifications',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/webhook',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/webhooks',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Knowledge Service (PandaWiki Go 后端 8090) ==========
  // 网关层按路径前缀分发，子应用零改动，保持原 API 路径
  // 路由由 gatewayRouteSync() 从平台服务动态获取并注册
  // 保留 /api/v1/wiki 作为 fallback 路由
  {
    prefix: '/api/v1/wiki',
    target: services().knowledge?.url || 'http://localhost:8090',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Graph Service (3021) ==========
  {
    prefix: '/api/v1/graph',
    target: services().graph?.url || 'http://localhost:3021',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Governance Service (3022) ==========
  {
    prefix: '/api/v1/governance',
    target: services().governance?.url || 'http://localhost:3022',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/compliance',
    target: services().governance?.url || 'http://localhost:3022',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Skill Service (3023) ==========
  {
    prefix: '/api/v1/skills',
    target: services().skill?.url || 'http://localhost:3023',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/skill',
    target: services().skill?.url || 'http://localhost:3023',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Self-Healing Service (3024) ==========
  {
    prefix: '/api/v1/selfhealing',
    target: services().selfhealing?.url || 'http://localhost:3024',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/self-healing',
    target: services().selfhealing?.url || 'http://localhost:3024',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/healing',
    target: services().selfhealing?.url || 'http://localhost:3024',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Risk Service (3025) ==========
  {
    prefix: '/api/v1/risks',
    target: services().risk?.url || 'http://localhost:3025',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Audit Service (3026) ==========
  {
    prefix: '/api/v1/audit',
    target: services().audit?.url || 'http://localhost:3026',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/audits',
    target: services().audit?.url || 'http://localhost:3026',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== ChatOps Service (3027) — routed to platform-service (3001) ==========
  {
    prefix: '/api/v1/chatops',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/chat',
    target: services().platform?.url || 'http://localhost:3001',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Runner Service (3028) ==========
  {
    prefix: '/api/v1/runner',
    target: services().runner?.url || 'http://localhost:3028',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/runners',
    target: services().runner?.url || 'http://localhost:3028',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/jobs',
    target: services().runner?.url || 'http://localhost:3028',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Config Management Service (3029) ==========
  {
    prefix: '/api/v1/config',
    target: services()['config-mgmt']?.url || 'http://localhost:3029',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/configuration',
    target: services()['config-mgmt']?.url || 'http://localhost:3029',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/config-mgmt',
    target: services()['config-mgmt']?.url || 'http://localhost:3029',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/environment',
    target: services()['config-mgmt']?.url || 'http://localhost:3029',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/environments',
    target: services()['config-mgmt']?.url || 'http://localhost:3029',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== CMDB Service (3030) ==========
  {
    prefix: '/api/v1/cmdb',
    target: services().cmdb?.url || 'http://localhost:3030',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/assets',
    target: services().cmdb?.url || 'http://localhost:3030',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Inception Service (3031) ==========
  {
    prefix: '/api/v1/inception',
    target: services().inception?.url || 'http://localhost:3031',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== DBA Service (3032) ==========
  {
    prefix: '/api/v1/dba',
    target: services().dba?.url || 'http://localhost:3032',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/database',
    target: services().dba?.url || 'http://localhost:3032',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/databases',
    target: services().dba?.url || 'http://localhost:3032',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Community Service (3033) ==========
  {
    prefix: '/api/v1/community',
    target: services().community?.url || 'http://localhost:3033',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Visor Service (3034) ==========
  {
    prefix: '/api/v1/visor',
    target: services().visor?.url || 'http://localhost:3034',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/visualization',
    target: services().visor?.url || 'http://localhost:3034',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Default fallback to platform ==========
  {
    prefix: '/api/v1',
    target: services().platform?.url || 'http://localhost:3001',
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

  // 注册就绪检查路由 - 检查所有配置的服务
  app.get('/readyz', async (request, reply) => {
    const services = config.services;
    const checks: Record<string, { status: string; latency?: number }> = {};
    let allHealthy = true;

    // Deduplicate service targets from routeConfigs
    const checkedTargets = new Set<string>();
    for (const route of routeConfigs) {
      if (checkedTargets.has(route.target)) continue;
      checkedTargets.add(route.target);

      const serviceName = route.prefix.split('/').filter(Boolean)[2] || route.target;

      try {
        const start = Date.now();
        const res = await fetch(`${route.target}/healthz`, { signal: AbortSignal.timeout(2000) });
        const latency = Date.now() - start;
        checks[serviceName] = {
          status: res.ok ? 'up' : 'down',
          latency,
        };
        if (!res.ok) allHealthy = false;
      } catch {
        checks[serviceName] = { status: 'unreachable' };
        allHealthy = false;
      }
    }

    reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      services: Object.keys(checks).length,
      checks,
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
    let url = request.raw.url || '';

    // 如果需要去除前缀
    if (config.stripPrefix && config.prefix !== '/') {
      const strippedPath = url.replace(config.prefix, '') || '/';
      url = strippedPath;
      // 修改原始请求 URL，确保 http-proxy 使用重写后的路径
      request.raw.url = strippedPath;
    }

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
