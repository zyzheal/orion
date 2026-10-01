/**
 * 灰度发布配置（Phase 5 P0-4）
 *
 * 基于 Redis Pub/Sub 的动态路由目标配置，支持 TS → Go 服务迁移期间
 * 的渐进式流量切换。配置变更通过 Redis channel 广播，所有网关实例
 * 无需重启即可实时生效。
 *
 * 环境变量：
 * - GRAY_RELEASE_ENABLED=true    启用灰度发布（默认 false）
 * - GRAY_RELEASE_REDIS_URL      Redis 连接 URL（默认继承 REDIS_HOST/REDIS_PORT）
 * - GRAY_RELEASE_REDIS_KEY      Redis 配置键名（默认 "gray-release:config"）
 * - GRAY_RELEASE_REDIS_CHANNEL  Redis Pub/Sub 频道名（默认 "gray-release:config"）
 * - GRAY_RELEASE_DEFAULT_TARGET 未匹配时的默认目标（默认 "ts"）
 * - GRAY_RELEASE_GO_SERVICE_URL Go 服务 URL（默认继承 PLATFORM_GO_SERVICE_URL）
 * - GRAY_RELEASE_TS_SERVICE_URL TS 服务 URL（默认继承 PLATFORM_SERVICE_URL）
 */

/**
 * 路由目标引用 — Redis 配置中的单条路由规则
 *
 * @example
 * { "path": "/api/v1/pipelines", "target": "go", "weight": 50 }
 *
 * 含义：当请求路径以 /api/v1/pipelines 开头时，50% 的流量路由到 Go 服务。
 */
export interface RouteTargetRef {
  /**
   * 路径前缀（支持最长前缀匹配）
   * 示例："/api/v1/pipelines" 匹配 /api/v1/pipelines/runs/123
   */
  path: string;

  /**
   * 目标后端标识
   * - "go"  → Go 微服务
   * - "ts"  → TS 单体服务（当前权威实现）
   */
  target: 'ts' | 'go';

  /**
   * 流量权重 0-100
   *
   * 当 weight=100 时，所有匹配流量都路由到该目标。
   * 当 weight=50 时，约 50% 流量路由到该目标（基于 tenantId 一致哈希）。
   * 当 weight=0 时，不路由到该目标（等效于未配置）。
   */
  weight: number;
}

/**
 * 灰度发布配置 — Redis 中存储的完整配置结构
 */
export interface GrayReleaseConfig {
  /** 路由目标规则列表（最长前缀匹配） */
  routeTargets: RouteTargetRef[];
  /** 未匹配任何规则时的默认目标 */
  defaultTarget: 'ts' | 'go';
  /** 配置版本号（用于去重，相同 version 不触发热加载） */
  version: number;
}

/**
 * 灰度发布运行时配置 — 从环境变量解析
 */
export interface GrayReleaseRuntimeConfig {
  /** 是否启用灰度发布 */
  enabled: boolean;
  /** Redis 连接 URL（可选，为空时继承 REDIS_HOST/REDIS_PORT） */
  redisUrl: string;
  /** Redis 配置键名 */
  redisKey: string;
  /** Redis Pub/Sub 频道名 */
  redisChannel: string;
  /** 未匹配时的默认目标 */
  defaultTarget: 'ts' | 'go';
  /** Go 服务 URL */
  goServiceUrl: string;
  /** TS 服务 URL */
  tsServiceUrl: string;
}

const DEFAULT_CONFIG: GrayReleaseRuntimeConfig = {
  enabled: process.env.GRAY_RELEASE_ENABLED === 'true',
  redisUrl: process.env.GRAY_RELEASE_REDIS_URL || '',
  redisKey: process.env.GRAY_RELEASE_REDIS_KEY || 'gray-release:config',
  redisChannel: process.env.GRAY_RELEASE_REDIS_CHANNEL || 'gray-release:config',
  defaultTarget: (process.env.GRAY_RELEASE_DEFAULT_TARGET as 'ts' | 'go') || 'ts',
  goServiceUrl: process.env.GRAY_RELEASE_GO_SERVICE_URL || process.env.PLATFORM_GO_SERVICE_URL || 'http://localhost:8080',
  tsServiceUrl: process.env.GRAY_RELEASE_TS_SERVICE_URL || process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
};

export function getGrayConfig(): GrayReleaseRuntimeConfig {
  return { ...DEFAULT_CONFIG };
}
