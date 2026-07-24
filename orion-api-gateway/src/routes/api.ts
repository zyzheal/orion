/**
 * API 路由
 *
 * 定义网关的路由规则，将请求分发到对应的后端服务
 * 支持从服务注册表动态发现路由
 *
 * 工作流程：
 * 1. 启动时从服务注册表发现所有服务
 * 2. 结合静态 DEFAULT_SERVICE_ROUTE_MAPPING 注册路由
 * 3. 监听服务注册表事件，自动响应服务上下线
 * 4. 集成健康检查，不健康服务的路由自动返回 503
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config';
import { proxyMiddleware } from '../middleware/proxy';
import { tokenExchangeMiddleware } from '../middleware/token-exchange';
import { getSubAppRoutePrefixes } from '../services/gateway-route-sync';
import { gatewayDynamicRoutes } from '../services/gateway-dynamic-routes';
import { serviceRegistry } from '../services/service-registry';

export interface RouteConfig {
  prefix: string;
  target: string;
  timeout?: number;
  stripPrefix?: boolean;
}

const services = () => getConfig().services;

// ==================== 默认静态路由配置 ====================
// 保留作为 fallback 和默认值

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

  // ========== Notify Service (3019) ==========
  {
    prefix: '/api/v1/notify',
    target: services().notify?.url || 'http://localhost:3019',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/notification',
    target: services().notify?.url || 'http://localhost:3019',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/notifications',
    target: services().notify?.url || 'http://localhost:3019',
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
  // NOTE: /api/v1/compliance is now routed to the dedicated compliance service (port 8087)

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

  // ========== ChatOps Service (3027) ==========
  {
    prefix: '/api/v1/chatops',
    target: services().chatops?.url || 'http://localhost:3027',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/chat',
    target: services().chatops?.url || 'http://localhost:3027',
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

  // ========== Canary Service (8086) ==========
  {
    prefix: '/api/v1/canary',
    target: services().canary?.url || 'http://localhost:8086',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/canary-analysis',
    target: services().canary?.url || 'http://localhost:8086',
    timeout: 60000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/canary-ml',
    target: services().canary?.url || 'http://localhost:8086',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/canary-config',
    target: services().canary?.url || 'http://localhost:8086',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Compliance Service (8087) ==========
  {
    prefix: '/api/v1/compliance',
    target: services().compliance?.url || 'http://localhost:8087',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/compliance-reports',
    target: services().compliance?.url || 'http://localhost:8087',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/compliance-schedules',
    target: services().compliance?.url || 'http://localhost:8087',
    timeout: 30000,
    stripPrefix: false,
  },

  // ========== Report Designer Service (8088) ==========
  {
    prefix: '/api/v1/reports',
    target: services()['report-designer']?.url || 'http://localhost:8088',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/report-definitions',
    target: services()['report-designer']?.url || 'http://localhost:8088',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/report-datasources',
    target: services()['report-designer']?.url || 'http://localhost:8088',
    timeout: 30000,
    stripPrefix: false,
  },
  {
    prefix: '/api/v1/report-schedules',
    target: services()['report-designer']?.url || 'http://localhost:8088',
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
 *
 * 优先从服务注册表动态发现路由，Fallback 到静态配置
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
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

    // 获取所有已注册的后端服务 URL（从服务注册表或静态配置）
    const backendTargets = new Set<string>();
    const allRoutes = gatewayDynamicRoutes.listRoutes({ status: 'active' });
    for (const route of allRoutes) {
      backendTargets.add(route.target);
    }

    // 如果没有动态路由，使用静态路由配置
    if (backendTargets.size === 0) {
      for (const route of routeConfigs) {
        backendTargets.add(route.target);
      }
    }

    for (const target of backendTargets) {
      try {
        const start = Date.now();
        const res = await fetch(`${target}/healthz`, { signal: AbortSignal.timeout(2000) });
        const latency = Date.now() - start;
        const serviceName = target.split('/').pop() || target;
        checks[serviceName] = {
          status: res.ok ? 'up' : 'down',
          latency,
        };
        if (!res.ok) allHealthy = false;
      } catch {
        const serviceName = target.split('/').pop() || target;
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

  // ==================== 动态路由发现与注册 ====================

  // 初始化动态路由管理器
  gatewayDynamicRoutes.setApp(app);

  // 优先从服务注册表动态发现路由
  const registrySyncedCount = gatewayDynamicRoutes.syncWithServiceRegistry();

  if (registrySyncedCount > 0) {
    console.log(`[Routes] Registered ${registrySyncedCount} routes from service registry`);
  } else {
    // Fallback：从静态配置注册路由
    console.log('[Routes] No routes from service registry, falling back to static config');
    const staticConfigs: Array<Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'>> = routeConfigs.map((r, index) => ({
      id: `static-${index}`,
      serviceName: extractServiceNameFromPrefix(r.prefix),
      prefix: r.prefix,
      target: r.target,
      timeout: r.timeout,
      stripPrefix: r.stripPrefix,
      status: 'active' as const,
      description: `Static route: ${r.prefix}`,
      metadata: { source: 'static-config' },
    }));

    gatewayDynamicRoutes.loadFromStaticConfig(staticConfigs);
  }

  // 注册子应用路由（knowledge 等）
  // 注意：这里会注册 knowledge 等子应用的路由
  // 如果服务注册表中已有这些路由，会被跳过
  const subAppCount = await gatewayRouteSync(app);
  console.log(`[Routes] Sub-app route sync: ${subAppCount} routes registered`);

  // 设置服务注册表事件监听器
  gatewayDynamicRoutes.setupRegistryListeners();

  // 启动健康检查集成
  gatewayDynamicRoutes.startHealthCheckIntegration(30000);

  console.log(`[Routes] Total active routes: ${gatewayDynamicRoutes.getActiveRouteCount()}`);
}

/**
 * 从路由前缀提取服务名称（用于静态配置 fallback）
 */
function extractServiceNameFromPrefix(prefix: string): string {
  // 从 /api/v1/<service-name> 提取服务名
  const match = prefix.match(/\/api\/v1\/([^/]+)/);
  if (match) {
    return match[1];
  }
  return 'unknown';
}

/**
 * 注册单个代理路由
 */
function registerProxyRoute(app: FastifyInstance, config: RouteConfig): void {
  app.all(`${config.prefix}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.raw.url || '';

    // /api/v1 fallback 路由：检查是否为 knowledge 路径，若是则转发到 PandaWiki
    if (config.prefix === '/api/v1') {
      const subAppPrefixes = getSubAppRoutePrefixes();
      for (const prefix of subAppPrefixes) {
        if (url.startsWith(prefix)) {
          // knowledge 路径：转发到 PandaWiki 并执行 token exchange
          const knowledgeConfig = getConfig().services.knowledge;
          const target = knowledgeConfig?.url || 'http://localhost:8090';
          await tokenExchangeMiddleware(request, reply);
          proxyMiddleware.forward(request, reply, target, {
            timeout: config.timeout,
            changeOrigin: true,
          });
          reply.hijack();
          return;
        }
      }
    }

    // 注意：当前所有路由 stripPrefix=false，此分支未激活
    if (config.stripPrefix && config.prefix !== '/') {
      const strippedPath = url.replace(config.prefix, '') || '/';
      request.raw.url = strippedPath;
    }

    // 代理请求
    proxyMiddleware.forward(request, reply, config.target, {
      timeout: config.timeout,
      changeOrigin: true,
    });

    // 标记连接已接管，Fastify 不再发送响应
    reply.hijack();
  });
}

/**
 * 添加自定义路由配置
 */
export function addRouteConfig(config: RouteConfig): void {
  routeConfigs.push(config);
}

// 重新导出 gatewayDynamicRoutes 供外部使用
export { gatewayDynamicRoutes };
