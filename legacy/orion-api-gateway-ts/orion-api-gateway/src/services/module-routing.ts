/**
 * 模块级灰度路由服务（Phase 5 P0-4）
 *
 * 支持基于环境变量 MODULE_ROUTING（JSON）的模块级目标切换（TS → Go）。
 * 基于 tenantId 的一致哈希：hash(tenantId) % 100 < goWeight → Go 目标
 *
 * 当前不支持热加载，需重启生效（通过 kubectl rollout restart）。
 *
 * 环境变量示例：
 * MODULE_ROUTING='{"notify":{"goUrl":"http://go-svc:8080","tsUrl":"http://ts-svc:3019","goWeight":50,"enabled":true}}'
 *
 * 架构集成：
 * - 配置解析委托给 config/parseModuleRouting()
 * - 每个请求代理前，proxyMiddleware 调用 resolveTarget 判断是否需要切换到 Go 目标
 * - 不影响业务路由文件，纯基础设施层改动
 */

import { FastifyRequest } from 'fastify';
import { ModuleRouting, ModuleRoutingEntry, parseModuleRouting } from '../config';

/**
 * 路由解析结果
 */
export interface RoutingResolution {
  /** 解析后的目标 URL */
  target: string;
  /** 解析来源：static（未配置灰度）/ go（灰度命中 Go）/ ts（灰度命中 TS）/ disabled（灰度未启用） */
  source: 'static' | 'go' | 'ts' | 'disabled';
}

// ==================== 服务实现 ====================

export class ModuleRoutingService {
  private config: ModuleRouting = {};

  constructor() {
    this.loadConfig();
  }

  /**
   * 加载配置（委托给 config/parseModuleRouting）
   */
  private loadConfig(): void {
    this.config = parseModuleRouting();
  }

  /**
   * 重新加载配置（不对外公开，仅用于开发调试）
   */
  reload(): void {
    this.config = parseModuleRouting();
  }

  /**
   * 解析请求的目标 URL
   *
   * 查找匹配的路由规则，基于 tenantId 哈希决定是否切换到 Go 服务。
   *
   * @param currentTarget 当前路由配置的目标 URL（来自路由注册表）
   * @param requestPath 请求路径（如 /api/v1/notify/templates）
   * @param request 请求对象（用于提取 tenantId 和请求头覆盖）
   */
  resolveTarget(
    currentTarget: string,
    requestPath: string,
    request: FastifyRequest
  ): RoutingResolution {
    // 从请求头读取覆盖（用于测试或手动灰度控制）
    const overrideTarget = (request.headers['x-module-routing-override'] as string) || null;
    if (overrideTarget) {
      return { target: overrideTarget, source: 'static' };
    }

    // 查找匹配的路由规则（精确匹配优先，然后最长前缀匹配）
    const rule = this.matchRule(requestPath);

    if (!rule) {
      // 未配置灰度路由，使用当前目标
      return { target: currentTarget, source: 'static' };
    }

    if (!rule.enabled) {
      // 规则未启用，使用 TS 目标（fallback）
      return { target: rule.tsUrl, source: 'disabled' };
    }

    // 基于 tenantId 的一致哈希
    const tenantId = this.extractTenantId(request);
    const hash = this.consistentHash(tenantId);
    const routedToGo = hash < rule.goWeight;

    if (routedToGo) {
      console.log(
        `[ModuleRouting] Tenant "${tenantId || 'unknown'}" -> Go (${rule.goUrl}) ` +
        `hash=${hash} weight=${rule.goWeight} path="${requestPath}"`
      );
      return { target: rule.goUrl, source: 'go' };
    }

    return { target: rule.tsUrl, source: 'ts' };
  }

  /**
   * 匹配请求路径到路由规则
   *
   * 匹配策略：
   * 1. 精确匹配优先
   * 2. 最长前缀匹配（要求完整路径段，如 /api/v1/notify 匹配 /api/v1/notify/templates）
   * 3. 防止子串误匹配（/api/v1/notif 不匹配 /api/v1/notification）
   */
  private matchRule(requestPath: string): ModuleRoutingEntry | null {
    let matchedRule: ModuleRoutingEntry | null = null;
    let longestPrefixLength = 0;

    for (const [prefix, rule] of Object.entries(this.config)) {
      // 精确匹配
      if (requestPath === prefix) {
        return rule;
      }
      // 前缀匹配
      if (requestPath.startsWith(prefix) && prefix.length > longestPrefixLength) {
        // 确保是完整路径段匹配：前缀后必须是 '/' 或字符串末尾
        const nextChar = requestPath.charAt(prefix.length);
        if (nextChar === '' || nextChar === '/' || prefix.endsWith('/')) {
          longestPrefixLength = prefix.length;
          matchedRule = rule;
        }
      }
    }

    return matchedRule;
  }

  /**
   * 从请求中提取租户 ID
   *
   * 提取顺序：
   * 1. X-Tenant-ID Header
   * 2. Fastify request.tenantId（由 tenant middleware 注入）
   * 3. Fallback: 'unknown'
   */
  private extractTenantId(request: FastifyRequest): string {
    const tenantHeader = request.headers['x-tenant-id'];
    if (tenantHeader && typeof tenantHeader === 'string') {
      return tenantHeader;
    }
    if (request.tenantId) {
      return request.tenantId;
    }
    return 'unknown';
  }

  /**
   * 一致哈希函数（FNV-1a 32-bit）
   *
   * 将 tenantId 映射为 0-99 的整数，保证同一 tenantId 始终映射到相同的桶。
   * 未知租户返回 101（大于 100），确保始终路由到 TS（保守策略）。
   */
  private consistentHash(tenantId: string): number {
    if (!tenantId || tenantId === 'unknown') {
      return 101; // 大于 100，确保不会命中 Go
    }

    // FNV-1a hash (32-bit)
    let hash = 2166136261 >>> 0; // FNV offset basis
    for (let i = 0; i < tenantId.length; i++) {
      hash ^= tenantId.charCodeAt(i);
      hash = (hash * 16777619) >>> 0; // FNV prime
    }

    return hash % 100;
  }

  // ==================== 监控/调试接口 ====================

  /**
   * 获取当前配置（仅用于调试/监控）
   */
  getConfig(): ModuleRouting {
    return { ...this.config };
  }

  /**
   * 获取已启用的规则数量
   */
  getEnabledCount(): number {
    return Object.values(this.config).filter((r) => r.enabled).length;
  }

  /**
   * 获取全部规则数量
   */
  getRuleCount(): number {
    return Object.keys(this.config).length;
  }

  /**
   * 直接对 tenantId 做哈希（用于测试一致性验证）
   */
  static hashTenant(tenantId: string): number {
    if (!tenantId || tenantId === 'unknown') {
      return 101;
    }
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash ^= tenantId.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash % 100;
  }
}

// 导出单例
export const moduleRoutingService = new ModuleRoutingService();
