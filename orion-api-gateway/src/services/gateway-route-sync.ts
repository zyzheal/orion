/**
 * Gateway Route Sync - 动态路由同步
 *
 * 从平台服务获取子应用配置，自动注册网关代理路由。
 * 无需在 api.ts 中硬编码子应用的 API 路径映射。
 *
 * 工作流程：
 * 1. 网关启动时调用 platform /api/v1/subapps/enabled 获取启用的子应用
 * 2. 对每个有 api_domain 的子应用，查找对应的服务 URL
 * 3. 根据 api_domain 映射的 API 路径前缀，动态注册代理路由
 * 4. 支持定时同步（默认 60s）以响应配置变更
 */

import { FastifyInstance } from 'fastify';
import { RouteConfig, addRouteConfig } from '../routes/api';
import { getConfig } from '../config';
import { proxyMiddleware } from '../middleware/proxy';

// ==================== 类型定义 ====================

interface SubAppConfig {
  id: string;
  name: string;
  key: string;
  version: string;
  entry_dev: string;
  entry_prod: string;
  routes: string[];
  permissions: string[];
  keep_alive: boolean;
  preload: boolean;
  description: string | null;
  icon: string | null;
  api_domain: string | null;
  api_paths?: string[];
  status: 'enabled' | 'disabled';
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PlatformSubAppsResponse {
  success: boolean;
  data: SubAppConfig[];
  total?: number;
}

// ==================== API 路径映射 ====================

/**
 * api_domain 到 API 路径前缀的映射表
 * 定义每个子应用负责的 API 路径前缀
 * 当子应用配置中包含 api_paths 时使用配置值，否则使用此默认映射
 */
const DEFAULT_API_PATH_MAP: Record<string, string[]> = {
  // PandaWiki / Knowledge 子应用
  knowledge: [
    '/api/v1/knowledge_base',
    '/api/v1/knowledge',
    '/api/v1/nav',
    '/api/v1/node',
    '/api/v1/user',
    '/api/v1/model',
    '/api/v1/stat',
    '/api/v1/app',
    '/api/v1/file',
    '/api/v1/chat',
    '/api/v1/conversation',
    '/api/v1/comment',
    '/api/v1/crawler',
    '/api/v1/setting',
    '/api/v1/license',
    '/api/v1/share',
    '/api/v1/health',
    '/share',
    '/static-file',
  ],

  // DBA 子应用
  dba: ['/api/v1/dba', '/api/v1/database', '/api/v1/databases'],

  // Visor 子应用
  visor: ['/api/v1/visor', '/api/v1/visualization'],
};

/**
 * api_domain 到网关服务配置 key 的映射
 * 用于从配置中查找对应的服务 URL
 */
const DOMAIN_TO_SERVICE_KEY: Record<string, string> = {
  knowledge: 'knowledge',
  dba: 'dba',
  visor: 'visor',
};

// ==================== 核心功能 ====================

/**
 * 从平台服务获取启用的子应用配置
 */
async function fetchEnabledSubApps(platformUrl: string): Promise<SubAppConfig[]> {
  try {
    const response = await fetch(`${platformUrl}/api/v1/subapps/enabled`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[GatewayRouteSync] Failed to fetch subapps: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as PlatformSubAppsResponse;
    if (!data.success) {
      console.warn('[GatewayRouteSync] Platform returned unsuccessful response');
      return [];
    }

    return data.data || [];
  } catch (error) {
    console.warn('[GatewayRouteSync] Error fetching subapps from platform:', error);
    return [];
  }
}

/**
 * 获取子应用对应的后端服务 URL
 */
function getServiceUrlForDomain(apiDomain: string): string | null {
  const serviceKey = DOMAIN_TO_SERVICE_KEY[apiDomain];
  if (!serviceKey) {
    console.warn(`[GatewayRouteSync] No service mapping for api_domain: ${apiDomain}`);
    return null;
  }

  const services = getConfig().services;
  const service = services[serviceKey];
  return service?.url || null;
}

/**
 * 获取子应用的 API 路径前缀列表
 * 优先使用配置中的 api_paths，否则使用默认映射
 */
function getApiPathsForDomain(apiDomain: string): string[] {
  // 如果子应用配置中定义了 api_paths，优先使用
  // （通过 fetchEnabledSubApps 返回的数据可能包含此字段）
  // 当前阶段使用默认映射表
  return DEFAULT_API_PATH_MAP[apiDomain] || [];
}

/**
 * 注册单个子应用的网关路由
 */
function registerSubAppRoutes(
  app: FastifyInstance | undefined,
  subApp: SubAppConfig,
): number {
  const { key, name, api_domain } = subApp;

  if (!api_domain) {
    console.log(`[GatewayRouteSync] SubApp "${key}" has no api_domain, skipping route registration`);
    return 0;
  }

  const serviceUrl = getServiceUrlForDomain(api_domain);
  if (!serviceUrl) {
    console.warn(`[GatewayRouteSync] No service URL for subapp "${key}" (api_domain: ${api_domain})`);
    return 0;
  }

  const apiPaths = getApiPathsForDomain(api_domain);
  if (apiPaths.length === 0) {
    console.log(`[GatewayRouteSync] No API paths mapped for api_domain: ${api_domain}`);
    return 0;
  }

  let registeredCount = 0;
  for (const pathPrefix of apiPaths) {
    const routeConfig: RouteConfig = {
      prefix: pathPrefix,
      target: serviceUrl,
      timeout: 30000,
      stripPrefix: false,
    };

    // 注册到全局路由配置（供 registerRoutes 使用）
    addRouteConfig(routeConfig);

    // 如果 app 实例已提供，直接注册路由
    if (app) {
      registerProxyRoute(app, routeConfig);
    }

    registeredCount++;
    console.log(`[GatewayRouteSync] Registered route: ${pathPrefix} -> ${serviceUrl} (subapp: ${key})`);
  }

  return registeredCount;
}

/**
 * 注册单个代理路由（与 api.ts 中的实现一致）
 */
function registerProxyRoute(app: FastifyInstance, config: RouteConfig): void {
  app.all(`${config.prefix}/*`, async (request, reply) => {
    const target = config.target;
    let url = request.raw.url || '';

    if (config.stripPrefix && config.prefix !== '/') {
      const strippedPath = url.replace(config.prefix, '') || '/';
      url = strippedPath;
      request.raw.url = strippedPath;
    }

    proxyMiddleware.forward(request, reply, target, {
      timeout: config.timeout,
      changeOrigin: true,
    });
  });
}

/**
 * 主同步函数：从平台服务获取子应用配置并注册网关路由
 *
 * @param app Fastify 实例（可选，如果提供则直接注册路由）
 * @returns 注册的路由数量
 */
export async function gatewayRouteSync(app?: FastifyInstance): Promise<number> {
  console.log('[GatewayRouteSync] Starting route synchronization...');

  const platformUrl = getConfig().services.platform?.url || 'http://localhost:3001';
  const subApps = await fetchEnabledSubApps(platformUrl);

  if (subApps.length === 0) {
    console.log('[GatewayRouteSync] No enabled sub-apps found from platform');
    return 0;
  }

  console.log(`[GatewayRouteSync] Found ${subApps.length} enabled sub-app(s)`);

  let totalRoutes = 0;
  for (const subApp of subApps) {
    const routes = registerSubAppRoutes(app, subApp);
    totalRoutes += routes;
  }

  console.log(`[GatewayRouteSync] Route sync complete. Total routes registered: ${totalRoutes}`);
  return totalRoutes;
}

/**
 * 启动定时路由同步
 *
 * @param app Fastify 实例
 * @param intervalMs 同步间隔（毫秒），默认 60000
 * @returns 清理函数
 */
export function startPeriodicRouteSync(
  app: FastifyInstance,
  intervalMs: number = 60000,
): () => void {
  console.log(`[GatewayRouteSync] Starting periodic route sync (interval: ${intervalMs}ms)`);

  // 立即执行一次
  gatewayRouteSync(app).catch((err) => {
    console.error('[GatewayRouteSync] Initial sync failed:', err);
  });

  const timer = setInterval(() => {
    gatewayRouteSync(app).catch((err) => {
      console.error('[GatewayRouteSync] Periodic sync failed:', err);
    });
  }, intervalMs);

  // 返回清理函数
  return () => {
    clearInterval(timer);
    console.log('[GatewayRouteSync] Periodic route sync stopped');
  };
}
