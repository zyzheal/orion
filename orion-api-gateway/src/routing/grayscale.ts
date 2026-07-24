/**
 * 灰度发布路由抽象层 (Phase 5 P0-4)
 *
 * 在现有 services/gray-release.service.ts 基础设施之上，
 * 提供面向路由注册表的灰度路由策略接口。
 *
 * 核心能力：
 * 1. 基于权重的随机分发 (weight-based dispatch)
 * 2. 基于 header 的精确路由 (header-based targeting)
 * 3. 逐步放量 (gradual rollout, 0-100%)
 * 4. 最长前缀匹配 (longest prefix matching)
 *
 * 与现有系统关系：
 * - services/gray-release.service.ts: Redis-backed 动态配置，运行时热加载
 * - middleware/gray-route.ts: Fastify hook，请求拦截和目标解析
 * - config/gray-config.ts: 环境变量解析，GrayReleaseRuntimeConfig
 * - config/parseModuleRouting.ts: MODULE_ROUTING JSON 解析
 * - routing/grayscale.ts: 本模块，路由注册表集成 + 灰度路由策略定义
 *
 * 使用方式：
 * ```typescript
 * const routes = [
 *   createGrayscaleRoute({
 *     path: '/api/v1/pipelines',
 *     oldService: 'http://ts-svc:3001',   // TS 单体 (当前权威)
 *     newService: 'http://go-svc:8080',   // Go 微服务 (灰度目标)
 *     weight: 50,
 *     canaryHeaders: { 'X-Canary-User': 'admin-team' },
 *   }),
 * ];
 *
 * const dispatcher = createGrayscaleDispatcher(routes);
 * const target = dispatcher.resolve(request.url, request.headers);
 * ```
 */

import type { FastifyRequest } from 'fastify';

// ==================== 类型定义 ====================

/**
 * 灰度路由配置 — 单条路由规则
 *
 * 定义一个 API 路径在灰度发布期间的双目标分发策略。
 * oldService 是当前权威服务 (TS 单体)，newService 是灰度目标 (Go 微服务)。
 */
export interface GrayscaleRoute {
  /**
   * 路由路径前缀 (最长前缀匹配)
   * 示例: "/api/v1/pipelines" 匹配 /api/v1/pipelines/runs/123
   */
  path: string;

  /**
   * 旧服务 URL (当前权威实现)
   * 通常指向 orion-platform-service (Node.js 单体)
   */
  oldService: string;

  /**
   * 新服务 URL (灰度目标)
   * 通常指向 orion-platform-svc-go (Go 微服务)
   */
  newService: string;

  /**
   * 新服务流量权重 0-100
   * - 0:  所有流量路由到 oldService (灰度未开始)
   * - 50: 约 50% 流量路由到 newService
   * - 100: 所有流量路由到 newService (灰度完成)
   */
  weight: number;

  /**
   * 金丝雀 Header 映射
   *
   * 当请求 Header 匹配时，无论权重如何，强制路由到对应目标。
   * 用于 QA/运维人员的精确验证。
   *
   * @example
   * {
   *   'X-Orion-Canary': 'true',      // 强制路由到 newService
   *   'X-Orion-Stable': 'true',      // 强制路由到 oldService
   * }
   */
  canaryHeaders: { [key: string]: string };
}

/**
 * 灰度路由解析结果
 */
export interface GrayscaleResolution {
  /** 目标服务 URL */
  target: string;
  /** 目标标识: old | new */
  targetId: 'old' | 'new';
  /** 解析来源: weight | header | default | none */
  source: 'weight' | 'header' | 'default' | 'none';
  /** 匹配的路由规则 (无匹配时为 undefined) */
  matchedRoute?: GrayscaleRoute;
}

// ==================== 内部辅助 ====================

/**
 * 获取请求中的 tenantId，用于一致性哈希
 */
function getTenantId(request: { headers?: { [key: string]: string | string[] | undefined } }): string | undefined {
  const h = request.headers;
  if (!h) return undefined;
  // 优先 X-Tenant-ID，其次 tenant_id，最后 cookie
  const tenantId = h['x-tenant-id'] || h['x-tenant'] || h['tenant_id'];
  if (typeof tenantId === 'string') return tenantId;
  return undefined;
}

/**
 * 获取请求的用户 ID，用于金丝雀用户路由
 */
function getUserId(request: { headers?: { [key: string]: string | string[] | undefined } }): string | undefined {
  const h = request.headers;
  if (!h) return undefined;
  return h['x-user-id'] as string | undefined;
}

/**
 * 一致性哈希：将输入字符串映射到 [0, 100) 区间
 *
 * 使用 FNV-1a 哈希算法，轻量且分布均匀。
 * 相同输入 (如 tenantId) 始终产生相同输出，保证同一租户
 * 在灰度期间始终访问同一后端，避免 session 不一致问题。
 *
 * @param input 输入字符串
 * @returns [0, 100) 区间的整数
 */
function consistentHash(input: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + Math.imul(hash, 0x01000193)) >>> 0;
  }
  return Math.floor((hash % 1000) / 10);
}

/**
 * 查找匹配的路由规则 (最长前缀匹配)
 *
 * 当多个规则匹配时，选择 path 最长的那个。
 * 例如: /api/v1/pipelines/runs 比 /api/v1/pipelines 优先级高。
 */
function findMatchingRoute(url: string, routes: GrayscaleRoute[]): GrayscaleRoute | undefined {
  let bestMatch: GrayscaleRoute | undefined;
  let bestLength = -1;

  for (const route of routes) {
    if (url.startsWith(route.path) && route.path.length > bestLength) {
      bestMatch = route;
      bestLength = route.path.length;
    }
  }

  return bestMatch;
}

// ==================== 金丝雀 Header 路由 ====================

/**
 * 检查请求是否命中金丝雀 Header
 *
 * 扫描路由规则中定义的所有 canaryHeaders，
 * 如果请求 Header 匹配，返回对应的目标 (newService / oldService)。
 */
function checkCanaryHeaders(
  request: { headers?: { [key: string]: string | string[] | undefined } },
  route: GrayscaleRoute,
): { target: 'new' | 'old' | null } {
  const headers = request.headers || {};

  for (const [headerName, headerValue] of Object.entries(route.canaryHeaders)) {
    const requestValue = headers[headerName.toLowerCase()];
    // 支持数组 header (如多个 Cookie)
    const normalized = Array.isArray(requestValue) ? requestValue[0] : requestValue;
    if (normalized === headerValue) {
      // X-Orion-Canary: true → 强制路由到新服务
      // X-Orion-Stable: true → 强制路由到旧服务
      if (headerName.toLowerCase().includes('canary')) {
        return { target: 'new' };
      }
      if (headerName.toLowerCase().includes('stable')) {
        return { target: 'old' };
      }
      // 通用规则: 匹配的 header 路由到新服务
      return { target: 'new' };
    }
  }

  return { target: null };
}

// ==================== 权重路由 ====================

/**
 * 基于权重和一致性哈希计算目标
 *
 * 策略：
 * 1. 有 tenantId → 使用一致性哈希 (保证同一租户路由一致)
 * 2. 有 userId → 使用 userId 哈希 (保证同一用户路由一致)
 * 3. 均无 → 使用随机数 (请求级随机分发)
 *
 * @param weight 新服务权重 0-100
 * @param request FastifyRequest
 * @returns 目标服务 ('new' | 'old')
 */
function resolveByWeight(weight: number, request: FastifyRequest | { headers?: { [key: string]: string | string[] | undefined } }): 'new' | 'old' {
  if (weight <= 0) return 'old';
  if (weight >= 100) return 'new';

  // 尝试一致性哈希 (租户级别)
  const tenantId = getTenantId(request);
  if (tenantId) {
    return consistentHash(tenantId) < weight ? 'new' : 'old';
  }

  // 尝试用户级别哈希
  const userId = getUserId(request);
  if (userId) {
    return consistentHash(userId) < weight ? 'new' : 'old';
  }

  // 请求级随机分发
  return Math.random() * 100 < weight ? 'new' : 'old';
}

// ==================== 灰度路由分发器 ====================

/**
 * 灰度路由分发器 — 核心分发逻辑
 *
 * 集成到 Fastify 代理中间件，在代理前决定目标后端。
 */
export class GrayscaleDispatcher {
  private routes: GrayscaleRoute[];

  constructor(routes: GrayscaleRoute[]) {
    this.routes = routes;
  }

  /**
   * 动态更新路由规则 (支持运行时热更新)
   */
  updateRoutes(routes: GrayscaleRoute[]): void {
    this.routes = routes;
  }

  /**
   * 解析请求目标
   *
   * 解析流程：
   * 1. 检查金丝雀 Header → 精确路由
   * 2. 基于权重分发 → 随机/一致性哈希
   * 3. 默认路由 → 旧服务 (降级安全)
   *
   * @param url 请求 URL
   * @param request FastifyRequest 或包含 headers 的对象
   * @returns 灰度路由解析结果
   */
  resolve(url: string, request: FastifyRequest | { headers?: { [key: string]: string | string[] | undefined } }): GrayscaleResolution {
    // 步骤 1: 查找匹配的路由规则
    const matchedRoute = findMatchingRoute(url, this.routes);

    if (!matchedRoute) {
      // 无匹配规则，使用默认路由 (旧服务)
      return {
        target: url.includes('go') ? matchedRoute?.newService || 'default' : 'old',
        targetId: 'old',
        source: 'none',
      };
    }

    // 步骤 2: 检查金丝雀 Header
    const canaryResult = checkCanaryHeaders(request, matchedRoute);
    if (canaryResult.target) {
      return {
        target: canaryResult.target === 'new' ? matchedRoute.newService : matchedRoute.oldService,
        targetId: canaryResult.target,
        source: 'header',
        matchedRoute,
      };
    }

    // 步骤 3: 基于权重分发
    const target = resolveByWeight(matchedRoute.weight, request);

    return {
      target: target === 'new' ? matchedRoute.newService : matchedRoute.oldService,
      targetId: target,
      source: 'weight',
      matchedRoute,
    };
  }

  /**
   * 获取当前路由规则 (用于调试/监控)
   */
  getRoutes(): GrayscaleRoute[] {
    return this.routes;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建灰度路由分发器
 */
export function createGrayscaleDispatcher(routes: GrayscaleRoute[]): GrayscaleDispatcher {
  return new GrayscaleDispatcher(routes);
}

/**
 * 创建单条灰度路由配置
 *
 * @example
 * const route = createGrayscaleRoute({
 *   path: '/api/v1/pipelines',
 *   oldService: 'http://localhost:3001',
 *   newService: 'http://localhost:8080',
 *   weight: 50,
 *   canaryHeaders: { 'X-Orion-Canary': 'true' },
 * });
 */
export function createGrayscaleRoute(config: Omit<GrayscaleRoute, 'canaryHeaders'> & {
  canaryHeaders?: { [key: string]: string };
}): GrayscaleRoute {
  return {
    path: config.path,
    oldService: config.oldService,
    newService: config.newService,
    weight: Math.max(0, Math.min(100, config.weight)),
    canaryHeaders: config.canaryHeaders || {},
  };
}

// ==================== 逐步放量工具 ====================

/**
 * 逐步放量策略 — 定义灰度发布的阶段
 *
 * 支持按时间或按比例的渐进式放量。
 */
export interface GradualRolloutPhase {
  /** 阶段名称 (如: "init", "canary-5pct", "canary-25pct", "full") */
  name: string;
  /** 新服务权重 0-100 */
  weight: number;
  /** 持续时间 (小时，可选) */
  durationHours?: number;
  /** 触发条件 (可选，用于自动化推进) */
  condition?: string;
}

/**
 * 默认逐步放量策略 (保守策略)
 *
 * 阶段: 1% → 5% → 10% → 25% → 50% → 100%
 * 每阶段至少运行 4 小时，观察无异常后推进。
 */
export const DEFAULT_ROLLOUT_PHASES: GradualRolloutPhase[] = [
  { name: 'init', weight: 0, durationHours: 0, condition: 'manual-start' },
  { name: 'canary-1pct', weight: 1, durationHours: 4, condition: 'error-rate < 1%' },
  { name: 'canary-5pct', weight: 5, durationHours: 8, condition: 'error-rate < 1% and latency-p99 < 500ms' },
  { name: 'canary-10pct', weight: 10, durationHours: 12, condition: 'error-rate < 0.5%' },
  { name: 'canary-25pct', weight: 25, durationHours: 24, condition: 'error-rate < 0.5% and no-regression' },
  { name: 'canary-50pct', weight: 50, durationHours: 24, condition: 'manual-confirm' },
  { name: 'full', weight: 100, durationHours: 0, condition: 'rollback-window-closed' },
];

/**
 * 根据当前阶段索引获取权重
 *
 * @param phases 放量阶段列表
 * @param phaseIndex 当前阶段索引
 * @returns 当前权重
 */
export function getPhaseWeight(phases: GradualRolloutPhase[], phaseIndex: number): number {
  if (phaseIndex < 0) return 0;
  if (phaseIndex >= phases.length) return 100;
  return phases[phaseIndex].weight;
}

/**
 * 逐步推进放量阶段
 *
 * @param phases 放量阶段列表
 * @param currentPhaseIndex 当前阶段索引
 * @param step 推进步数 (默认 1)
 * @returns 新的阶段索引
 */
export function advancePhase(phases: GradualRolloutPhase[], currentPhaseIndex: number, step: number = 1): number {
  const newIndex = currentPhaseIndex + step;
  return Math.min(phases.length - 1, Math.max(0, newIndex));
}
