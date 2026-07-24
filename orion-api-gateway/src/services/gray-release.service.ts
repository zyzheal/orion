/**
 * 灰度发布服务（Phase 5 P0-4）
 *
 * 基于 Redis Pub/Sub 的动态路由目标服务。
 *
 * 架构：
 * 1. 订阅 Redis channel (gray-release:config)，监听配置变更广播
 * 2. 启动时从 Redis key 读取当前配置（fallback：使用模块级路由配置）
 * 3. 暴露 getTarget(path, request) 方法，返回 "ts" | "go"
 * 4. 配置热加载：Redis pub 新配置后，所有网关实例自动生效
 *
 * 优雅降级：
 * - Redis 不可用时，降级到 config.moduleRouting（环境变量 MODULE_ROUTING）
 * - 配置解析失败时，使用默认配置
 *
 * 集成方式：
 * - app.ts 中初始化并传入 app.addHook('onRequest') 的中间件
 * - proxy middleware 读取 req.grayReleaseTarget 决定目标 URL
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { FastifyRequest } from 'fastify';
import { getGrayConfig, GrayReleaseConfig, GrayReleaseRuntimeConfig, RouteTargetRef } from '../config/gray-config';
import { moduleRoutingService } from './module-routing';
import { SERVICE_ROUTES } from '../middleware/proxy';

/**
 * 路由解析结果
 */
export interface GrayRoutingResult {
  /** 解析后的目标 URL */
  target: string;
  /** 目标标识 */
  targetId: 'ts' | 'go';
  /** 解析来源：redis（Redis 热配置）/ fallback（环境变量降级）/ static（未启用灰度） */
  source: 'redis' | 'fallback' | 'static';
  /** 匹配的路由规则（用于调试/可观测性） */
  matchedRule?: RouteTargetRef;
}

/**
 * 灰度发布服务配置变更事件
 */
export interface GrayConfigChangeEvent {
  config: GrayReleaseConfig;
  /** 触发方式：startup（启动加载）/ pubsub（Redis 广播）/ manual（手动 reload） */
  trigger: 'startup' | 'pubsub' | 'manual';
}

export class GrayReleaseService {
  private static instance: GrayReleaseService | null = null;
  private static eventEmitter: EventEmitter | null = null;

  private redis: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private currentConfig: GrayReleaseConfig | null = null;
  private config: GrayReleaseRuntimeConfig;
  private enabled: boolean;

  constructor(runtimeConfig?: GrayReleaseRuntimeConfig) {
    this.config = runtimeConfig ?? getGrayConfig();
    this.enabled = this.config.enabled;
  }

  /**
   * 获取单例
   */
  static getInstance(): GrayReleaseService {
    if (!GrayReleaseService.instance) {
      GrayReleaseService.instance = new GrayReleaseService();
    }
    return GrayReleaseService.instance;
  }

  /**
   * 获取事件发射器
   */
  static getEventEmitter(): EventEmitter {
    if (!GrayReleaseService.eventEmitter) {
      GrayReleaseService.eventEmitter = new EventEmitter();
      GrayReleaseService.eventEmitter.setMaxListeners(10);
    }
    return GrayReleaseService.eventEmitter;
  }

  /**
   * 连接 Redis 并加载配置
   */
  async connect(): Promise<void> {
    if (!this.enabled) {
      console.log('[GrayRelease] Disabled, skipping Redis connection');
      return;
    }

    try {
      // 1. 建立 Redis 连接（用于读取配置）
      const redisConfig = this.buildRedisConfig();
      this.redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        retryStrategy: (times: number) => {
          if (times > 10) return null;
          return Math.min(times * 100, 3000);
        },
      });

      this.redis.on('error', (err) => {
        console.error('[GrayRelease] Redis error:', err.message);
      });

      await new Promise<void>((resolve, reject) => {
        this.redis!.once('ready', resolve);
        this.redis!.once('error', reject);
      });

      console.log('[GrayRelease] Redis connected');

      // 2. 启动时从 Redis key 读取当前配置
      await this.loadConfigFromRedis();

      // 3. 订阅 Redis channel 监听配置变更
      await this.subscribeToChanges();

      console.log(`[GrayRelease] Initialized — config version=${this.currentConfig?.version ?? 'none'}, ` +
        `targets=${this.currentConfig?.routeTargets?.length ?? 0}`);
    } catch (err) {
      console.warn('[GrayRelease] Failed to connect to Redis, falling back to static config:', err);
      // 优雅降级：使用空的灰度配置，后续请求降级到 moduleRouting
      this.enabled = false;
    }
  }

  /**
   * 从 Redis key 加载配置
   */
  private async loadConfigFromRedis(): Promise<void> {
    if (!this.redis || this.redis.status !== 'ready') {
      return;
    }

    try {
      const raw = await this.redis.get(this.config.redisKey);
      if (!raw) {
        console.log('[GrayRelease] No config found in Redis key:', this.config.redisKey);
        // 没有配置时使用空配置，所有流量走默认目标（ts）
        this.currentConfig = this.buildEmptyConfig();
        return;
      }

      const parsed = this.parseConfig(raw);
      if (parsed) {
        this.currentConfig = parsed;
      } else {
        console.warn('[GrayRelease] Invalid config in Redis, using empty config');
        this.currentConfig = this.buildEmptyConfig();
      }
    } catch (err) {
      console.error('[GrayRelease] Failed to load config from Redis:', err);
    }
  }

  /**
   * 订阅 Redis channel 监听配置变更
   */
  private async subscribeToChanges(): Promise<void> {
    if (!this.redis || this.redis.status !== 'ready') {
      return;
    }

    try {
      this.redisSubscriber = new Redis({
        host: this.buildRedisConfig().host,
        port: this.buildRedisConfig().port,
        password: this.buildRedisConfig().password,
        db: this.buildRedisConfig().db,
      });

      await this.redisSubscriber.subscribe(this.config.redisChannel);

      this.redisSubscriber.on('message', (channel, message) => {
        if (channel === this.config.redisChannel) {
          this.handleConfigMessage(message);
        }
      });

      this.redisSubscriber.on('error', (err) => {
        console.error('[GrayRelease] Subscriber error:', err.message);
      });

      console.log(`[GrayRelease] Subscribed to channel: ${this.config.redisChannel}`);
    } catch (err) {
      console.error('[GrayRelease] Failed to subscribe to Redis channel:', err);
    }
  }

  /**
   * 处理 Redis 消息
   */
  private handleConfigMessage(message: string): void {
    try {
      const parsed = JSON.parse(message) as GrayReleaseConfig;

      // 验证配置
      if (!parsed.routeTargets || !Array.isArray(parsed.routeTargets) || typeof parsed.version !== 'number') {
        console.warn('[GrayRelease] Invalid config message received, ignoring');
        return;
      }

      // 去重：相同 version 不触发变更
      if (this.currentConfig && this.currentConfig.version === parsed.version) {
        console.log(`[GrayRelease] Same version ${parsed.version}, skipping update`);
        return;
      }

      // 应用新配置
      this.currentConfig = parsed;

      console.log(`[GrayRelease] Config updated — version=${parsed.version}, ` +
        `targets=${parsed.routeTargets.length}`);

      // 触发事件
      GrayReleaseService.getEventEmitter().emit('config:changed', {
        config: parsed,
        trigger: 'pubsub',
      } as GrayConfigChangeEvent);
    } catch (err) {
      console.error('[GrayRelease] Failed to parse config message:', err);
    }
  }

  /**
   * 解析 Redis 配置 JSON
   */
  private parseConfig(raw: string): GrayReleaseConfig | null {
    try {
      const parsed = JSON.parse(raw) as GrayReleaseConfig;

      // 验证必需字段
      if (!parsed.routeTargets || !Array.isArray(parsed.routeTargets)) {
        return null;
      }
      if (parsed.defaultTarget !== 'ts' && parsed.defaultTarget !== 'go') {
        parsed.defaultTarget = 'ts';
      }
      if (typeof parsed.version !== 'number') {
        parsed.version = 0;
      }

      // 验证并裁剪 weight
      parsed.routeTargets = parsed.routeTargets.filter((rule) => {
        if (!rule.path || !rule.target || typeof rule.weight !== 'number') {
          return false;
        }
        rule.target = (rule.target === 'go' ? 'go' : 'ts');
        rule.weight = Math.max(0, Math.min(100, rule.weight));
        return true;
      });

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * 构建空配置（所有流量走默认目标）
   */
  private buildEmptyConfig(): GrayReleaseConfig {
    return {
      routeTargets: [],
      defaultTarget: this.config.defaultTarget,
      version: 0,
    };
  }

  /**
   * 构建 Redis 连接配置
   */
  private buildRedisConfig(): { host: string; port: number; password?: string; db: number } {
    if (this.config.redisUrl) {
      // 从 URL 解析（如 redis://localhost:6379）
      const url = new URL(this.config.redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        db: parseInt(url.pathname.substring(1) || '0', 10) || 0,
      };
    }
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    };
  }

  // ==================== 公开 API ====================

  /**
   * 获取请求的目标后端
   *
   * 优先级：
   * 1. Redis 热配置（最长前缀匹配 + weight）
   * 2. 环境变量 MODULE_ROUTING（降级）
   * 3. 默认目标（ts）
   */
  getTarget(requestPath: string, request: FastifyRequest): GrayRoutingResult {
    // 灰度发布未启用
    if (!this.enabled) {
      // 降级到 moduleRouting（已有的 TS→Go 路由）
      // 使用 moduleRoutingService 解析
      const fallbackTarget = moduleRoutingService.resolveTarget(
        this.config.tsServiceUrl, requestPath, request
      );
      return {
        target: fallbackTarget.target,
        targetId: fallbackTarget.target === this.config.goServiceUrl ? 'go' : 'ts',
        source: 'fallback',
      };
    }

    // 尝试使用 Redis 配置
    if (this.currentConfig && this.currentConfig.routeTargets.length > 0) {
      const matched = this.matchRule(requestPath);
      if (matched) {
        // 基于 weight 的流量分配
        if (this.applyWeight(matched, request)) {
          return {
            target: this.config.goServiceUrl,
            targetId: 'go',
            source: 'redis',
            matchedRule: matched,
          };
        } else {
          return {
            target: this.config.tsServiceUrl,
            targetId: 'ts',
            source: 'redis',
            matchedRule: matched,
          };
        }
      }

      // 未匹配任何规则，使用默认目标
      const defaultUrl = this.currentConfig.defaultTarget === 'go'
        ? this.config.goServiceUrl
        : this.config.tsServiceUrl;
      return {
        target: defaultUrl,
        targetId: this.currentConfig.defaultTarget,
        source: 'redis',
      };
    }

    // Redis 配置为空，降级到环境变量
    const fallback = moduleRoutingService.resolveTarget(
      this.config.tsServiceUrl, requestPath, request
    );
    return {
      target: fallback.target,
      targetId: fallback.target === this.config.goServiceUrl ? 'go' : 'ts',
      source: 'fallback',
    };
  }

  /**
   * 匹配请求路径到路由规则（最长前缀匹配）
   */
  private matchRule(requestPath: string): RouteTargetRef | null {
    if (!this.currentConfig || this.currentConfig.routeTargets.length === 0) {
      return null;
    }

    let matched: RouteTargetRef | null = null;
    let longestLen = 0;

    for (const rule of this.currentConfig.routeTargets) {
      // 精确匹配
      if (requestPath === rule.path) {
        return rule;
      }
      // 前缀匹配（要求完整路径段）
      if (requestPath.startsWith(rule.path) && rule.path.length > longestLen) {
        const nextChar = requestPath.charAt(rule.path.length);
        if (nextChar === '' || nextChar === '/' || rule.path.endsWith('/')) {
          longestLen = rule.path.length;
          matched = rule;
        }
      }
    }

    return matched;
  }

  /**
   * 应用 weight 规则（基于 tenantId 一致哈希）
   *
   * 优先级：
   * 1. x-gray-release-override header（手动覆盖）
   * 2. weight=0 → 不匹配规则（返回 false，走 TS fallback）
   * 3. weight=100 → 使用 rule.target
   * 4. 其他 weight → tenantId 哈希分流
   *
   * @returns true 表示路由到 Go，false 表示路由到 TS
   */
  private applyWeight(rule: RouteTargetRef, request: FastifyRequest): boolean {
    // 1. Header 覆盖优先
    const overrideTarget = (request.headers['x-gray-release-override'] as string) || null;
    if (overrideTarget === 'go') return true;
    if (overrideTarget === 'ts') return false;

    // 2. weight=0 → 规则不生效，降级到 TS
    if (rule.weight === 0) {
      return false;
    }

    // 3. weight=100 → 直接使用 rule.target
    if (rule.weight === 100) {
      return rule.target === 'go';
    }

    // 4. 其他 weight → tenantId 一致哈希分流
    const tenantId = this.extractTenantId(request);
    const hash = this.consistentHash(tenantId);
    return hash < rule.weight;
  }

  /**
   * 从请求中提取租户 ID
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
   */
  private consistentHash(tenantId: string): number {
    if (!tenantId || tenantId === 'unknown') {
      return 101; // 大于 100，始终路由到 TS
    }
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash ^= tenantId.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash % 100;
  }

  // ==================== 配置管理 ====================

  /**
   * 手动加载配置（用于测试/调试）
   */
  loadConfig(config: GrayReleaseConfig): void {
    this.currentConfig = this.parseConfig(JSON.stringify(config));
    GrayReleaseService.getEventEmitter().emit('config:changed', {
      config: this.currentConfig,
      trigger: 'manual',
    } as GrayConfigChangeEvent);
  }

  /**
   * 获取当前配置（仅用于调试/监控）
   */
  getConfig(): GrayReleaseConfig | null {
    return this.currentConfig;
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 优雅关闭
   */
  async close(): Promise<void> {
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit().catch(() => {});
      this.redisSubscriber = null;
    }
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
    console.log('[GrayRelease] Closed');
  }
}

// 导出单例
export const grayReleaseService = GrayReleaseService.getInstance();
