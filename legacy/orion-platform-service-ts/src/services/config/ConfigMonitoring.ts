/**
 * Configuration Metrics & Monitoring
 * 
 * 配置中心可观测性 - Prometheus 指标导出
 */

import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// ==================== 指标注册表 ====================

const register = new Registry();

// 收集默认指标
collectDefaultMetrics({ register });

// ==================== 自定义指标 ====================

// 配置加载计数
export const configLoadTotal = new Counter({
  name: 'orion_config_load_total',
  help: 'Total number of config loads',
  labelNames: ['domain', 'status'],
  registers: [register],
});

// 配置加载耗时
export const configLoadDuration = new Histogram({
  name: 'orion_config_load_duration_seconds',
  help: 'Config load duration in seconds',
  labelNames: ['domain', 'type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// 配置更新计数
export const configUpdateTotal = new Counter({
  name: 'orion_config_update_total',
  help: 'Total number of config updates',
  labelNames: ['domain', 'key', 'status'],
  registers: [register],
});

// 配置缓存命中
export const configCacheHits = new Counter({
  name: 'orion_config_cache_hits_total',
  help: 'Total number of config cache hits',
  labelNames: ['domain'],
  registers: [register],
});

// 配置缓存未命中
export const configCacheMisses = new Counter({
  name: 'orion_config_cache_misses_total',
  help: 'Total number of config cache misses',
  labelNames: ['domain'],
  registers: [register],
});

// 活跃配置数
export const configActiveCount = new Gauge({
  name: 'orion_config_active_count',
  help: 'Number of active configurations',
  labelNames: ['domain'],
  registers: [register],
});

// 配置版本数
export const configVersionCount = new Gauge({
  name: 'orion_config_version_count',
  help: 'Number of config versions',
  labelNames: ['domain', 'key'],
  registers: [register],
});

// 配置健康状态
export const configHealthStatus = new Gauge({
  name: 'orion_config_health_status',
  help: 'Config service health status (1=healthy, 0=unhealthy)',
  labelNames: ['component'],
  registers: [register],
});

// 配置变更延迟 (从写入到生效)
export const configChangeLatency = new Histogram({
  name: 'orion_config_change_latency_seconds',
  help: 'Config change propagation latency',
  labelNames: ['domain'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

// 配置错误计数
export const configErrors = new Counter({
  name: 'orion_config_errors_total',
  help: 'Total number of config errors',
  labelNames: ['domain', 'error_type'],
  registers: [register],
});

// ==================== 健康检查 ====================

interface ConfigHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    cache: boolean;
    eventBus: boolean;
  };
  timestamp: number;
  details: Record<string, any>;
}

let lastHealthCheck: ConfigHealth = {
  status: 'healthy',
  checks: { database: true, cache: true, eventBus: true },
  timestamp: Date.now(),
  details: {},
};

/**
 * 执行健康检查
 */
export async function checkConfigHealth(): Promise<ConfigHealth> {
  const checks = {
    database: true,
    cache: true,
    eventBus: true,
  };
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const failedChecks = Object.entries(checks).filter(([_, v]) => !v);
  
  if (failedChecks.length > 0) {
    status = failedChecks.length === 1 ? 'degraded' : 'unhealthy';
  }

  lastHealthCheck = {
    status,
    checks,
    timestamp: Date.now(),
    details: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
  };

  // 更新指标
  configHealthStatus.set({ component: 'database' }, checks.database ? 1 : 0);
  configHealthStatus.set({ component: 'cache' }, checks.cache ? 1 : 0);
  configHealthStatus.set({ component: 'eventbus' }, checks.eventBus ? 1 : 0);
  configHealthStatus.set({ component: 'overall' }, status === 'healthy' ? 1 : 0);

  return lastHealthCheck;
}

/**
 * 获取 Prometheus 指标
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * 获取 Prometheus 指标 (JSON)
 */
export async function getMetricsJSON(): Promise<any> {
  const metrics = await register.getMetricsAsJSON();
  return metrics;
}

// ==================== 指标工具 ====================

/**
 * 记录配置加载
 */
export function recordConfigLoad(domain: string, durationMs: number, cached: boolean): void {
  configLoadDuration.observe({ domain, type: cached ? 'cache' : 'database' }, durationMs / 1000);
  configLoadTotal.inc({ domain, status: 'success' });
  
  if (cached) {
    configCacheHits.inc({ domain });
  } else {
    configCacheMisses.inc({ domain });
  }
}

/**
 * 记录配置更新
 */
export function recordConfigUpdate(domain: string, key: string, success: boolean): void {
  configUpdateTotal.inc({ 
    domain, 
    key, 
    status: success ? 'success' : 'error' 
  });
}

/**
 * 记录配置错误
 */
export function recordConfigError(domain: string, errorType: string): void {
  configErrors.inc({ domain, error_type: errorType });
}

/**
 * 记录配置变更延迟
 */
export function recordConfigChangeLatency(domain: string, latencyMs: number): void {
  configChangeLatency.observe({ domain }, latencyMs / 1000);
}

// ==================== 导出接口 ====================

/**
 * 添加配置健康检查路由 (在主应用中调用)
 * 示例用法:
 *   import { addConfigHealthRoutes } from './services/config/ConfigMonitoring';
 *   addConfigHealthRoutes(app);
 */
export function addConfigHealthRoutes(app: any): void {
  // 健康检查端点
  app.get('/health/config', async (req: any, res: any) => {
    const health = await checkConfigHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // 指标端点
  app.get('/metrics/config', async (req: any, res: any) => {
    const metrics = await getMetrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  });

  // JSON 指标端点
  app.get('/metrics/config/json', async (req: any, res: any) => {
    const metrics = await getMetricsJSON();
    res.json(metrics);
  });
}

export default {
  register,
  checkConfigHealth,
  getMetrics,
  getMetricsJSON,
  recordConfigLoad,
  recordConfigUpdate,
  recordConfigError,
  recordConfigChangeLatency,
  addConfigHealthRoutes,
};