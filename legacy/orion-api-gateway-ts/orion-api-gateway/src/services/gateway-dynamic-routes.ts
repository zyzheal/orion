/**
 * Gateway Dynamic Routes - 动态路由管理服务
 *
 * 支持：
 * - 运行时动态注册/注销路由
 * - 从 service_registry 表（或内存）发现服务
 * - 热重载：数据库变更或文件变更时更新路由
 * - 提供完整的路由元数据管理
 * - 监听服务注册表事件，自动响应服务上下线
 * - 健康检查集成：不健康服务的路由自动返回 503
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { proxyMiddleware } from '../middleware/proxy';
import { tokenExchangeMiddleware, registerTokenExchange } from '../middleware/token-exchange';
import { serviceRegistry, ServiceInfo } from './service-registry';
import { getConfig } from '../config';
import { moduleRoutingService } from './module-routing';

// ==================== 类型定义 ====================

export interface DynamicRouteConfig {
  /** 路由唯一标识（通常为服务名:前缀） */
  id: string;
  /** 服务名称 */
  serviceName: string;
  /** 路由路径前缀 */
  prefix: string;
  /** 后端目标 URL */
  target: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否剥离前缀 */
  stripPrefix?: boolean;
  /** 是否需要 token exchange（如 PandaWiki） */
  tokenExchange?: {
    serviceType: string;
    targetUrl: string;
    pandawikiAccount?: string;
    pandawikiPassword?: string;
  };
  /** 路由描述 */
  description?: string;
  /** 服务状态 */
  status: 'active' | 'inactive' | 'maintenance';
  /** 注册时间 */
  registeredAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 元数据 */
  metadata?: Record<string, any>;
}

export interface RouteDiscoverySource {
  /** 数据源类型 */
  type: 'memory' | 'database' | 'file' | 'service-registry';
  /** 数据源路径/连接串 */
  source: string;
  /** 轮询间隔（毫秒），0 表示不轮询 */
  pollInterval?: number;
}

export interface ServiceRouteMapping {
  /** 服务名称（与 serviceRegistry 中的名称对应） */
  serviceName: string;
  /** API 路径前缀列表 */
  apiPaths: string[];
  /** 是否需要进行 token exchange（如 PandaWiki） */
  tokenExchange?: {
    serviceType: string;
    targetUrl: string;
    pandawikiAccount?: string;
    pandawikiPassword?: string;
  };
}

export interface ListRoutesOptions {
  /** 按服务名过滤 */
  serviceName?: string;
  /** 按状态过滤 */
  status?: string;
  /** 按前缀过滤 */
  prefix?: string;
}

// ==================== 默认服务路由映射 ====================

/**
 * 默认服务路由映射表
 * 当服务注册表中没有 api_paths 元数据时，使用此映射
 */
const DEFAULT_SERVICE_ROUTE_MAPPING: ServiceRouteMapping[] = [
  { serviceName: 'platform', apiPaths: ['/api/v1/platform'] },
  { serviceName: 'pipeline', apiPaths: ['/api/v1/pipelines', '/api/v1/pipeline', '/api/v1/pipeline-templates', '/api/v1/pipeline-versions', '/api/v1/pipeline-budget'] },
  { serviceName: 'deploy', apiPaths: ['/api/v1/deploy', '/api/v1/deployments'] },
  { serviceName: 'ticket', apiPaths: ['/api/v1/tickets', '/api/v1/ticket'] },
  { serviceName: 'monitor', apiPaths: ['/api/v1/monitoring', '/api/v1/alert', '/api/v1/alerts', '/api/v1/metrics'] },
  { serviceName: 'intelligence', apiPaths: ['/api/v1/ai-gateway', '/api/v1/ai-decision', '/api/v1/ai-review', '/api/v1/ai-security', '/api/v1/change-intelligence', '/api/v1/intelligence'] },
  { serviceName: 'agent', apiPaths: ['/api/v1/agents', '/api/v1/agent'] },
  { serviceName: 'digital-twin', apiPaths: ['/api/v1/digital-twin'] },
  { serviceName: 'finops', apiPaths: ['/api/v1/cost', '/api/v1/finops', '/api/v1/cost-operations'] },
  { serviceName: 'code', apiPaths: ['/api/v1/code-repo', '/api/v1/code', '/api/v1/build', '/api/v1/test-reports'] },
  { serviceName: 'plugin', apiPaths: ['/api/v1/plugins-spi', '/api/v1/plugins', '/api/v1/plugin', '/api/v1/plugins-enhanced', '/api/v1/plugins/marketplace'] },
  { serviceName: 'ai', apiPaths: ['/api/v1/ai', '/api/v1/ai-models', '/api/v1/ai-model', '/api/v1/vector-store', '/api/v1/vector', '/api/v1/llm', '/api/v1/degradation'] },
  { serviceName: 'security', apiPaths: ['/api/v1/security', '/api/v1/risk', '/api/v1/sbom', '/api/v1/supply-chain', '/api/v1/policies', '/api/v1/quality-gates'] },
  { serviceName: 'artifact', apiPaths: ['/api/v1/artifacts', '/api/v1/artifact', '/api/v1/artifact-ops', '/api/v1/artifact-versions'] },
  { serviceName: 'efficiency', apiPaths: ['/api/v1/efficiency'] },
  { serviceName: 'dr', apiPaths: ['/api/v1/backup', '/api/v1/disaster-recovery', '/api/v1/dr'] },
  { serviceName: 'federation', apiPaths: ['/api/v1/federation', '/api/v1/federation-advanced', '/api/v1/multi-cloud', '/api/v1/multi-cloud-advanced'] },
  { serviceName: 'approval', apiPaths: ['/api/v1/approval', '/api/v1/approvals'] },
  { serviceName: 'notify', apiPaths: ['/api/v1/notify', '/api/v1/notification', '/api/v1/notifications', '/api/v1/webhook', '/api/v1/webhooks'] },
  { serviceName: 'knowledge', apiPaths: ['/api/v1/knowledge_base', '/api/v1/knowledge', '/api/v1/nav', '/api/v1/node', '/api/v1/user', '/api/v1/model', '/api/v1/stat', '/api/v1/app', '/api/v1/file', '/api/v1/conversation', '/api/v1/comment', '/api/v1/crawler', '/api/v1/setting', '/api/v1/license', '/api/v1/share', '/api/v1/health', '/share', '/static-file'], tokenExchange: { serviceType: 'pandawiki', targetUrl: process.env.KNOWLEDGE_SERVICE_URL || 'http://localhost:8090', pandawikiAccount: 'admin', pandawikiPassword: process.env.PANDAWIKI_PASSWORD || '' } },
  { serviceName: 'graph', apiPaths: ['/api/v1/graph'] },
  { serviceName: 'governance', apiPaths: ['/api/v1/governance', '/api/v1/compliance'] },
  { serviceName: 'skill', apiPaths: ['/api/v1/skills', '/api/v1/skill'] },
  { serviceName: 'selfhealing', apiPaths: ['/api/v1/selfhealing', '/api/v1/self-healing', '/api/v1/healing'] },
  { serviceName: 'risk', apiPaths: ['/api/v1/risks'] },
  { serviceName: 'audit', apiPaths: ['/api/v1/audit', '/api/v1/audits'] },
  { serviceName: 'chatops', apiPaths: ['/api/v1/chatops', '/api/v1/chat'] },
  { serviceName: 'runner', apiPaths: ['/api/v1/runner', '/api/v1/runners', '/api/v1/jobs'] },
  { serviceName: 'config-mgmt', apiPaths: ['/api/v1/config', '/api/v1/configuration', '/api/v1/config-mgmt', '/api/v1/environment', '/api/v1/environments'] },
  { serviceName: 'cmdb', apiPaths: ['/api/v1/cmdb', '/api/v1/assets'] },
  { serviceName: 'inception', apiPaths: ['/api/v1/inception'] },
  { serviceName: 'dba', apiPaths: ['/api/v1/dba', '/api/v1/database', '/api/v1/databases'] },
  { serviceName: 'community', apiPaths: ['/api/v1/community'] },
  { serviceName: 'visor', apiPaths: ['/api/v1/visor', '/api/v1/visualization'] },
];

// ==================== 动态路由管理服务 ====================

export class GatewayDynamicRoutes {
  private routes: Map<string, DynamicRouteConfig> = new Map();
  private registeredPrefixes: Set<string> = new Set();
  private discoverySources: RouteDiscoverySource[] = [];
  private pollTimers: Map<string, NodeJS.Timeout> = new Map();
  private app: FastifyInstance | null = null;
  private registryListeners: Map<string, () => void> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    // 默认发现源：内存（静态配置 + service registry）
    this.discoverySources = [
      { type: 'memory', source: 'static-config' },
      { type: 'service-registry', source: 'service-registry' },
    ];
  }

  /**
   * 设置 Fastify 实例（用于注册路由）
   */
  setApp(app: FastifyInstance): void {
    this.app = app;
  }

  /**
   * 注册单个路由
   *
   * @returns true 表示新注册，false 表示已存在
   */
  registerRoute(config: Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'>): boolean {
    const existing = this.routes.get(config.id);

    if (existing && existing.status !== 'inactive') {
      // 已存在且活跃，跳过
      return false;
    }

    const now = new Date();
    const routeConfig: DynamicRouteConfig = {
      ...config,
      registeredAt: existing ? existing.registeredAt : now,
      updatedAt: now,
    };

    this.routes.set(config.id, routeConfig);

    // 如果前缀未注册，注册到 Fastify
    if (this.app && !this.registeredPrefixes.has(config.prefix)) {
      this.registerProxyRoute(this.app, routeConfig);
      this.registeredPrefixes.add(config.prefix);
    }

    // 注册 token exchange 规则（如有）
    if (config.tokenExchange && this.app) {
      registerTokenExchange(config.prefix, {
        targetUrl: config.tokenExchange.targetUrl,
        serviceType: config.tokenExchange.serviceType as any,
        pandawikiAccount: config.tokenExchange.pandawikiAccount,
        pandawikiPassword: config.tokenExchange.pandawikiPassword,
      });
    }

    return true;
  }

  /**
   * 注销路由
   */
  unregisterRoute(routeId: string): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;

    // 注意：Fastify 不支持运行时注销路由，这里仅标记为 inactive
    // 并更新内存状态，新请求不会再匹配到已注销的路由（取决于 Fastify 路由表行为）
    route.status = 'inactive';
    route.updatedAt = new Date();
    this.routes.set(routeId, route);

    return true;
  }

  /**
   * 更新路由配置
   */
  updateRoute(
    routeId: string,
    updates: Partial<Omit<DynamicRouteConfig, 'id' | 'registeredAt'>>,
  ): DynamicRouteConfig | null {
    const existing = this.routes.get(routeId);
    if (!existing) return null;

    const updated: DynamicRouteConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      registeredAt: existing.registeredAt,
      updatedAt: new Date(),
    };

    this.routes.set(routeId, updated);

    // 如果 target 变更且前缀已注册，Fastify 路由需要重新注册
    // Fastify 不支持修改已有路由，这里记录变更供外部处理
    if (updates.target && updates.target !== existing.target && this.app) {
      console.warn(
        `[GatewayDynamicRoutes] Route ${routeId} target changed from ${existing.target} to ${updates.target}. ` +
        'Fastify does not support route modification at runtime. Restart required for target change to take effect.'
      );
    }

    return updated;
  }

  /**
   * 获取单个路由
   */
  getRoute(routeId: string): DynamicRouteConfig | undefined {
    return this.routes.get(routeId);
  }

  /**
   * 列出所有路由
   */
  listRoutes(options: ListRoutesOptions = {}): DynamicRouteConfig[] {
    let routes = Array.from(this.routes.values());

    if (options.serviceName) {
      routes = routes.filter((r) => r.serviceName === options.serviceName);
    }
    if (options.status) {
      routes = routes.filter((r) => r.status === options.status);
    }
    if (options.prefix) {
      routes = routes.filter((r) => r.prefix === options.prefix);
    }

    return routes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * 获取活跃路由数量
   */
  getActiveRouteCount(): number {
    return Array.from(this.routes.values()).filter((r) => r.status === 'active').length;
  }

  /**
   * 从 service registry 发现路由
   *
   * 遍历所有已注册服务，为有 api_paths 元数据的服务自动注册路由
   */
  discoverFromServiceRegistry(
    services: Array<{ name: string; url: string; metadata?: Record<string, any> }>,
    serviceUrlMap: Record<string, string>,
  ): number {
    let discoveredCount = 0;

    for (const service of services) {
      const apiPaths = service.metadata?.api_paths;
      if (!apiPaths || !Array.isArray(apiPaths) || apiPaths.length === 0) continue;

      const target = serviceUrlMap[service.name] || service.url;
      if (!target) continue;

      for (const prefix of apiPaths) {
        const routeId = `${service.name}:${prefix}`;
        const registered = this.registerRoute({
          id: routeId,
          serviceName: service.name,
          prefix,
          target,
          timeout: service.metadata?.timeout || 30000,
          stripPrefix: false,
          status: 'active',
          description: `Auto-discovered from service registry: ${service.name}`,
          metadata: {
            source: 'service-registry',
            discoveredAt: new Date().toISOString(),
          },
        });

        if (registered) discoveredCount++;
      }
    }

    if (discoveredCount > 0) {
      console.log(`[GatewayDynamicRoutes] Discovered ${discoveredCount} routes from service registry`);
    }

    return discoveredCount;
  }

  /**
   * 从静态配置批量注册路由
   */
  loadFromStaticConfig(configs: Array<Omit<DynamicRouteConfig, 'registeredAt' | 'updatedAt'>>): number {
    let loadedCount = 0;

    for (const config of configs) {
      const registered = this.registerRoute({
        ...config,
        status: config.status || 'active',
      });

      if (registered) loadedCount++;
    }

    if (loadedCount > 0) {
      console.log(`[GatewayDynamicRoutes] Loaded ${loadedCount} routes from static config`);
    }

    return loadedCount;
  }

  /**
   * 启动轮询发现
   *
   * @param source 发现源标识
   * @param fetcher 获取最新服务列表的函数
   * @param intervalMs 轮询间隔
   * @returns 清理函数
   */
  startPolling(
    source: string,
    fetcher: () => Promise<
      Array<{ name: string; url: string; metadata?: Record<string, any> }>
    >,
    intervalMs: number = 60000,
  ): () => void {
    console.log(`[GatewayDynamicRoutes] Starting polling for source: ${source} (interval: ${intervalMs}ms)`);

    // 立即执行一次
    this.pollOnce(source, fetcher).catch((err) => {
      console.error(`[GatewayDynamicRoutes] Initial poll failed for ${source}:`, err);
    });

    const timer = setInterval(() => {
      this.pollOnce(source, fetcher).catch((err) => {
        console.error(`[GatewayDynamicRoutes] Poll failed for ${source}:`, err);
      });
    }, intervalMs);

    this.pollTimers.set(source, timer);

    return () => {
      clearInterval(timer);
      this.pollTimers.delete(source);
      console.log(`[GatewayDynamicRoutes] Stopped polling for ${source}`);
    };
  }

  /**
   * 单次轮询
   */
  private async pollOnce(
    source: string,
    fetcher: () => Promise<
      Array<{ name: string; url: string; metadata?: Record<string, any> }>
    >,
  ): Promise<void> {
    const services = await fetcher();
    const serviceUrlMap: Record<string, string> = {};
    for (const s of services) {
      serviceUrlMap[s.name] = s.url;
    }

    const count = this.discoverFromServiceRegistry(services, serviceUrlMap);
    if (count > 0) {
      console.log(`[GatewayDynamicRoutes] Poll discovered ${count} new routes from ${source}`);
    }
  }

  /**
   * 停止所有轮询
   */
  stopAllPolling(): void {
    for (const [source, timer] of this.pollTimers) {
      clearInterval(timer);
      console.log(`[GatewayDynamicRoutes] Stopped polling for ${source}`);
    }
    this.pollTimers.clear();
  }

  /**
   * 从服务注册表同步所有服务路由
   *
   * 结合静态映射和服务注册表中的元数据，为所有已注册服务注册路由
   */
  syncWithServiceRegistry(): number {
    const services = serviceRegistry.getAllServices();
    const config = getConfig();
    let syncedCount = 0;

    for (const service of services) {
      // 查找默认路由映射
      const mapping = DEFAULT_SERVICE_ROUTE_MAPPING.find(m => m.serviceName === service.name);
      if (!mapping) continue;

      // 优先使用服务注册表中的 URL，fallback 到配置
      const target = service.url || config.services[service.name]?.url;
      if (!target) continue;

      // 如果服务有 api_paths 元数据，优先使用
      const apiPaths = service.metadata?.api_paths || mapping.apiPaths;
      if (!apiPaths || apiPaths.length === 0) continue;

      for (const prefix of apiPaths) {
        const routeId = `${service.name}:${prefix}`;
        const registered = this.registerRoute({
          id: routeId,
          serviceName: service.name,
          prefix,
          target,
          timeout: service.metadata?.timeout || mapping.tokenExchange ? 30000 : (config.services[service.name]?.timeout || 30000),
          stripPrefix: false,
          status: service.status === 'healthy' ? 'active' : 'inactive',
          description: `Auto-discovered from service registry: ${service.name}`,
          metadata: {
            source: 'service-registry',
            discoveredAt: new Date().toISOString(),
            serviceStatus: service.status,
          },
          ...(mapping.tokenExchange && { tokenExchange: mapping.tokenExchange }),
        });

        if (registered) syncedCount++;
      }
    }

    if (syncedCount > 0) {
      console.log(`[GatewayDynamicRoutes] Synced ${syncedCount} routes from service registry`);
    }

    return syncedCount;
  }

  /**
   * 设置服务注册表事件监听器
   *
   * 当服务注册/注销/健康状态变化时，自动更新路由
   */
  setupRegistryListeners(): void {
    // 监听服务注册事件
    const onRegistered = (service: ServiceInfo) => {
      console.log(`[GatewayDynamicRoutes] Service registered: ${service.name}`);
      this.syncWithServiceRegistry();
    };

    // 监听服务注销事件
    const onUnregistered = (service: ServiceInfo) => {
      console.log(`[GatewayDynamicRoutes] Service unregistered: ${service.name}`);
      // 标记该服务的所有路由为 inactive
      for (const [routeId, route] of this.routes) {
        if (route.serviceName === service.name) {
          route.status = 'inactive';
          route.updatedAt = new Date();
          this.routes.set(routeId, route);
        }
      }
    };

    // 监听服务健康状态变化
    const onHealthCheck = (service: ServiceInfo) => {
      const isHealthy = service.status === 'healthy';
      console.log(`[GatewayDynamicRoutes] Service health changed: ${service.name} -> ${service.status}`);

      // 更新该服务的所有路由状态
      for (const [routeId, route] of this.routes) {
        if (route.serviceName === service.name) {
          if (isHealthy && route.status === 'inactive') {
            route.status = 'active';
            route.target = service.url;
            console.log(`[GatewayDynamicRoutes] Reactivated route: ${routeId}`);
          } else if (!isHealthy && route.status === 'active') {
            route.status = 'inactive';
            console.log(`[GatewayDynamicRoutes] Deactivated route: ${routeId}`);
          }
          route.updatedAt = new Date();
          this.routes.set(routeId, route);
        }
      }
    };

    serviceRegistry.on('service:registered', onRegistered);
    serviceRegistry.on('service:unregistered', onUnregistered);
    serviceRegistry.on('service:healthcheck:passed', onHealthCheck);
    serviceRegistry.on('service:healthcheck:failed', onHealthCheck);

    // 保存清理函数
    this.registryListeners.set('service:registered', () => serviceRegistry.off('service:registered', onRegistered));
    this.registryListeners.set('service:unregistered', () => serviceRegistry.off('service:unregistered', onUnregistered));
    this.registryListeners.set('service:healthcheck:passed', () => serviceRegistry.off('service:healthcheck:passed', onHealthCheck));
    this.registryListeners.set('service:healthcheck:failed', () => serviceRegistry.off('service:healthcheck:failed', onHealthCheck));
  }

  /**
   * 移除服务注册表事件监听器
   */
  removeRegistryListeners(): void {
    for (const cleanup of this.registryListeners.values()) {
      cleanup();
    }
    this.registryListeners.clear();
  }

  /**
   * 启动健康检查集成
   *
   * 定期检查所有活跃路由对应的后端服务健康状态
   */
  startHealthCheckIntegration(intervalMs: number = 30000): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    console.log(`[GatewayDynamicRoutes] Starting health check integration (interval: ${intervalMs}ms)`);

    // 立即执行一次
    this.checkAllRoutesHealth().catch((err) => {
      console.error('[GatewayDynamicRoutes] Initial health check failed:', err);
    });

    this.healthCheckTimer = setInterval(() => {
      this.checkAllRoutesHealth().catch((err) => {
        console.error('[GatewayDynamicRoutes] Periodic health check failed:', err);
      });
    }, intervalMs);
  }

  /**
   * 停止健康检查集成
   */
  stopHealthCheckIntegration(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('[GatewayDynamicRoutes] Health check integration stopped');
    }
  }

  /**
   * 检查所有活跃路由的后端服务健康状态
   */
  private async checkAllRoutesHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const activeRoutes = this.listRoutes({ status: 'active' });

    // 按目标 URL 去重
    const checkedTargets = new Set<string>();
    const checkPromises: Promise<void>[] = [];

    for (const route of activeRoutes) {
      if (checkedTargets.has(route.target)) continue;
      checkedTargets.add(route.target);

      checkPromises.push(
        this.checkServiceHealth(route.target).then(healthy => {
          results[route.target] = healthy;
        })
      );
    }

    await Promise.all(checkPromises);

    // 更新路由状态
    for (const [routeId, route] of this.routes) {
      const healthy = results[route.target];
      if (healthy === false && route.status === 'active') {
        route.status = 'inactive';
        route.updatedAt = new Date();
        this.routes.set(routeId, route);
        console.warn(`[GatewayDynamicRoutes] Route ${routeId} marked inactive due to unhealthy backend`);
      } else if (healthy === true && route.status === 'inactive') {
        route.status = 'active';
        route.updatedAt = new Date();
        this.routes.set(routeId, route);
        console.log(`[GatewayDynamicRoutes] Route ${routeId} reactivated (backend healthy)`);
      }
    }

    return results;
  }

  /**
   * 检查单个服务健康状态
   */
  private async checkServiceHealth(url: string, timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${url}/healthz`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 关闭动态路由服务
   */
  shutdown(): void {
    this.stopAllPolling();
    this.stopHealthCheckIntegration();
    this.removeRegistryListeners();
    this.routes.clear();
    this.registeredPrefixes.clear();
    console.log('[GatewayDynamicRoutes] Shutdown complete');
  }

  // ==================== 内部方法 ====================

  /**
   * 在 Fastify 中注册代理路由
   */
  private registerProxyRoute(app: FastifyInstance, config: DynamicRouteConfig): void {
    app.all(`${config.prefix}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
      // 检查路由是否处于活跃状态
      if (config.status === 'inactive') {
        reply.code(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: `Service ${config.serviceName} is currently unavailable`,
          code: 'GATEWAY_UNAVAILABLE',
        });
        return;
      }

      // 模块级灰度路由：基于 tenantId 一致哈希决定目标 URL（TS vs Go）
      const resolved = moduleRoutingService.resolveTarget(config.target, request.raw.url || '', request);
      const target = resolved.target;
      if (resolved.source === 'go') {
        console.log(
          `[GatewayDynamicRoutes] Route ${config.prefix} -> ${target} (module routing: ${resolved.source})`
        );
      }

      let url = request.raw.url || '';

      if (config.stripPrefix && config.prefix !== '/') {
        const strippedPath = url.replace(config.prefix, '') || '/';
        url = strippedPath;
        request.raw.url = strippedPath;
      }

      // Token Exchange（如有）
      if (config.tokenExchange) {
        await tokenExchangeMiddleware(request, reply);
      }

      proxyMiddleware.forward(request, reply, target, {
        timeout: config.timeout || 30000,
        changeOrigin: true,
      });

      reply.hijack();
    });

    console.log(`[GatewayDynamicRoutes] Registered dynamic route: ${config.prefix} -> ${config.target} (${config.serviceName})`);
  }
}

// 导出单例
export const gatewayDynamicRoutes = new GatewayDynamicRoutes();
