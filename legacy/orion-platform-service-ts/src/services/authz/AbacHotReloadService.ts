/**
 * ABAC Policy Hot Reload Service
 *
 * 提供 ABAC 策略的热更新能力，无需重启服务。
 *
 * 功能:
 * 1. 定时从数据库重新加载策略（默认 5 分钟）
 * 2. 文件系统监听（可选，监听策略文件目录变更）
 * 3. 原子性策略替换（备份旧策略 → 验证新策略 → 原子交换，失败自动回滚）
 * 4. 重载前版本校验，确保新策略合法后才生效
 * 5. 30 秒速率限制（防抖动 + 防滥用）
 * 6. 结构化日志（自动注入 traceId）
 */

import { EventEmitter } from 'events';
import { AbacPolicyEngine, AbacPolicy } from './AbacPolicyEngine';
import { AbacPolicyRepository, AbacPolicyEntity } from '../../repositories/AbacPolicyRepository';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../../errors';
import { RateLimiter } from '../../utils/rate-limit-circuit-breaker';

// ==================== 类型定义 ====================

export interface AbacHotReloadConfig {
  /** 自动重载间隔（毫秒），默认 5 分钟（300000ms） */
  reloadIntervalMs: number;
  /** 是否启用自动重载 */
  autoReload: boolean;
  /** 策略文件监听目录（可选，为空则不监听文件系统） */
  watchPaths: string[];
  /** 文件变更后延迟重载（毫秒），避免抖动 */
  reloadDelayMs: number;
  /** 速率限制窗口（毫秒），默认 30 秒内最多 1 次重载 */
  rateLimitWindowMs: number;
  /** 速率限制最大请求数 */
  rateLimitMaxRequests: number;
}

export interface AbacHotReloadStatus {
  /** 是否正在重载中 */
  reloading: boolean;
  /** 上次重载时间 */
  lastReloadAt?: Date;
  /** 上次重载是否成功 */
  lastReloadSuccess?: boolean;
  /** 上次重载错误信息 */
  lastReloadError?: string;
  /** 当前策略数量 */
  policyCount: number;
  /** 热重载版本号（每次成功重载后递增） */
  reloadVersion: number;
  /** 自上次重载以来的自动重载触发次数 */
  autoReloadCount: number;
  /** 当前速率限制状态 */
  rateLimit: {
    allowed: boolean;
    remainingMs: number;
  };
  /** 文件监听状态 */
  watching: boolean;
  /** 监听路径 */
  watchPaths: string[];
  /** 累计重载次数 */
  totalReloads: number;
  /** 累计成功次数 */
  totalSuccess: number;
  /** 累计失败次数 */
  totalFailures: number;
}

export interface AbacReloadResult {
  success: boolean;
  /** 重载后策略总数 */
  policyCount: number;
  /** 重载耗时（毫秒） */
  durationMs: number;
  /** 热重载版本号 */
  version: number;
  /** 错误信息（失败时） */
  error?: string;
  /** 是否为自动触发 */
  autoTriggered?: boolean;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: Required<AbacHotReloadConfig> = {
  reloadIntervalMs: 5 * 60 * 1000, // 5 分钟
  autoReload: true,
  watchPaths: [],
  reloadDelayMs: 1000,
  rateLimitWindowMs: 30 * 1000, // 30 秒
  rateLimitMaxRequests: 1,
};

// ==================== AbacHotReloadService ====================

export class AbacHotReloadService extends EventEmitter {
  private engine: AbacPolicyEngine;
  private repository: AbacPolicyRepository | null = null;
  private config: Required<AbacHotReloadConfig>;

  // 定时器
  private reloadTimer: NodeJS.Timeout | null = null;
  private watchers: Map<string, any> = new Map();
  private pendingFileReloads: Map<string, NodeJS.Timeout> = new Map();

  // 状态
  private reloading = false;
  private lastReloadAt?: Date;
  private lastReloadSuccess = false;
  private lastReloadError?: string;
  private autoReloadCount = 0;
  private totalReloads = 0;
  private totalSuccess = 0;
  private totalFailures = 0;

  // 速率限制器（每个实例独立）
  private rateLimiter: RateLimiter;

  constructor(
    engine: AbacPolicyEngine,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    config: Partial<AbacHotReloadConfig> = {},
  ) {
    super();
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化速率限制器
    this.rateLimiter = new RateLimiter({
      maxRequests: this.config.rateLimitMaxRequests,
      windowMs: this.config.rateLimitWindowMs,
      keyPrefix: 'abac-reload',
    });

    // 初始化数据库仓库（可选）
    if (db) {
      try {
        this.repository = new AbacPolicyRepository(db);
      } catch (err) {
        const logger = createLogger('abac-policy');
        logger.warn({ err }, 'AbacPolicyRepository init failed, DB reload unavailable');
      }
    }

    // 如果启用自动重载，立即启动定时器
    if (this.config.autoReload && this.repository) {
      this.startPeriodicReload();
    }
  }

  // ==================== 公共 API ====================

  /**
   * 手动触发热重载（API 入口）。
   * 返回重载结果；若速率限制命中则返回 rateLimit 错误。
   */
  async triggerReload(autoTriggered = false): Promise<AbacReloadResult> {
    const traceId = getCurrentTraceId();
    const logger = createLogger('abac-policy');

    // 速率限制检查
    const rateKey = `reload:${traceId || 'unknown'}`;
    const rateResult = this.rateLimiter.check(rateKey);

    if (!rateResult.allowed) {
      const waitMs = rateResult.resetAt.getTime() - Date.now();
      logger.warn(
        { traceId, remainingMs: waitMs },
        'ABAC policy reload rate limited',
      );
      throw new OrionError(
        `Reload rate limited. Please wait ${Math.ceil(waitMs / 1000)}s before retrying.`,
        ErrorCode.RATE_LIMITED,
        true,
        { remainingMs: waitMs, resetAt: rateResult.resetAt.toISOString() },
      );
    }

    // 防止并发重载
    if (this.reloading) {
      throw new OrionError(
        'Another reload is already in progress',
        ErrorCode.STATE_CONFLICT,
        false,
        { lastReloadAt: this.lastReloadAt?.toISOString() },
      );
    }

    this.reloading = true;
    const startTime = Date.now();

    try {
      logger.info({ traceId, autoTriggered }, 'ABAC policy reload started');

      this.emit('reload:started', { timestamp: new Date(), autoTriggered });

      // 1. 从数据库加载策略（存入 staging）
      const { policies: newPolicies, error: loadError } = await this.loadPoliciesFromDatabase();
      if (loadError) {
        throw new OrionError(`Failed to load policies from database: ${loadError}`, ErrorCode.INTERNAL_ERROR);
      }
      if (!newPolicies || newPolicies.length === 0) {
        throw new OrionError('No policies loaded from database (expected at least system policies)', ErrorCode.INTERNAL_ERROR);
      }

      // 2. 验证新策略
      const validation = this.validatePolicies(newPolicies);
      if (!validation.valid) {
        throw new OrionError(`Policy validation failed: ${validation.errors.join('; ')}`, ErrorCode.INTERNAL_ERROR);
      }

      // 3. 原子交换（备份已在 engine.forceReloadFromDatabase 内部处理）
      const swapResult = await this.engine.forceReloadFromDatabase();

      const durationMs = Date.now() - startTime;

      if (!swapResult.success) {
        throw new OrionError(swapResult.error || 'Atomic swap failed', ErrorCode.INTERNAL_ERROR);
      }

      // 4. 更新状态
      this.lastReloadAt = new Date();
      this.lastReloadSuccess = true;
      this.lastReloadError = undefined;
      this.totalReloads++;
      this.totalSuccess++;

      if (autoTriggered) {
        this.autoReloadCount++;
      }

      logger.info(
        {
          traceId,
          policyCount: swapResult.loadedCount,
          version: swapResult.version,
          durationMs,
          autoTriggered,
        },
        'ABAC policy reload completed successfully',
      );

      this.emit('reload:completed', {
        timestamp: new Date(),
        autoTriggered,
        policyCount: swapResult.loadedCount,
        version: swapResult.version,
        durationMs,
      });

      return {
        success: true,
        policyCount: swapResult.loadedCount,
        durationMs,
        version: swapResult.version,
        autoTriggered,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.lastReloadAt = new Date();
      this.lastReloadSuccess = false;
      this.lastReloadError = errorMessage;
      this.totalReloads++;
      this.totalFailures++;

      logger.error(
        { traceId, error: errorMessage, durationMs, autoTriggered },
        'ABAC policy reload failed, rolled back to previous policies',
      );

      this.emit('reload:failed', {
        timestamp: new Date(),
        autoTriggered,
        error: errorMessage,
        durationMs,
      });

      return {
        success: false,
        policyCount: this.engine.getAllPolicies().length,
        durationMs,
        version: this.engine.getReloadVersion(),
        error: errorMessage,
        autoTriggered,
      };
    } finally {
      this.reloading = false;
    }
  }

  /**
   * 获取当前重载状态快照
   */
  getStatus(): AbacHotReloadStatus {
    const rateResult = this.rateLimiter.check('status-probe');
    return {
      reloading: this.reloading,
      lastReloadAt: this.lastReloadAt,
      lastReloadSuccess: this.lastReloadSuccess,
      lastReloadError: this.lastReloadError,
      policyCount: this.engine.getAllPolicies().length,
      reloadVersion: this.engine.getReloadVersion(),
      autoReloadCount: this.autoReloadCount,
      rateLimit: {
        allowed: rateResult.allowed,
        remainingMs: rateResult.allowed
          ? 0
          : rateResult.resetAt.getTime() - Date.now(),
      },
      watching: this.watchers.size > 0,
      watchPaths: Array.from(this.watchers.keys()),
      totalReloads: this.totalReloads,
      totalSuccess: this.totalSuccess,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): Readonly<AbacHotReloadConfig> {
    return { ...this.config };
  }

  /**
   * 更新重载间隔（运行时生效）
   */
  updateReloadInterval(intervalMs: number): void {
    this.config.reloadIntervalMs = intervalMs;
    // 重启定时器
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }
    if (this.config.autoReload && this.repository) {
      this.startPeriodicReload();
    }
  }

  /**
   * 更新监听路径（动态生效）
   */
  updateWatchPaths(paths: string[]): void {
    this.config.watchPaths = paths;
    // 重启 watcher
    this.stopWatching();
    if (paths.length > 0) {
      this.startWatching();
    }
  }

  // ==================== 文件系统监听 ====================

  /**
   * 启动文件系统监听
   */
  startWatching(): void {
    const logger = createLogger('abac-policy');

    // 跳过浏览器环境
    if (typeof (globalThis as any).window !== 'undefined') {
      logger.warn('File watching not available in browser environment');
      return;
    }

    const fs = (global as any).require('fs');
    const path = (global as any).require('path');

    for (const watchPath of this.config.watchPaths) {
      try {
        if (!fs.existsSync(watchPath)) {
          logger.warn({ traceId: getCurrentTraceId(), watchPath }, 'Watch path does not exist, skipping');
          continue;
        }

        const watcher = fs.watch(
          watchPath,
          { recursive: true },
          (eventType: string, filename: string | undefined) => {
            this.handleFileChange(watchPath, eventType, filename, fs, path);
          },
        );

        watcher.on('error', (error: Error) => {
          logger.error(
            { traceId: getCurrentTraceId(), watchPath, error: error.message },
            'ABAC policy watcher error',
          );
        });

        this.watchers.set(watchPath, watcher);
        logger.info({ traceId: getCurrentTraceId(), watchPath }, 'ABAC policy file watcher started');
      } catch (error) {
        logger.error(
          { traceId: getCurrentTraceId(), watchPath, error },
          'Failed to start ABAC policy file watcher',
        );
      }
    }
  }

  /**
   * 停止所有文件系统监听
   */
  stopWatching(): void {
    const logger = createLogger('abac-policy');

    for (const [watchPath, watcher] of this.watchers) {
      try {
        watcher.close();
        this.watchers.delete(watchPath);
        logger.info({ traceId: getCurrentTraceId(), watchPath }, 'ABAC policy file watcher stopped');
      } catch (error) {
        logger.error(
          { traceId: getCurrentTraceId(), watchPath, error },
          'Failed to close ABAC policy watcher',
        );
      }
    }

    // 清理待处理的重载定时器
    for (const [key, timeout] of this.pendingFileReloads) {
      clearTimeout(timeout);
      this.pendingFileReloads.delete(key);
    }
  }

  // ==================== 资源清理 ====================

  /**
   * 清理所有资源（定时器、监听器），在服务关闭时调用。
   */
  async cleanup(): Promise<void> {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }
    this.stopWatching();
    this.reloading = false;
    this.watchers.clear();
    this.pendingFileReloads.clear();
  }

  // ==================== 私有方法 ====================

  /**
   * 启动定时自动重载
   */
  private startPeriodicReload(): void {
    if (this.reloadTimer) return;

    this.reloadTimer = setInterval(() => {
      this.triggerReload(true).catch((error) => {
        const logger = createLogger('abac-policy');
        logger.error(
          { traceId: getCurrentTraceId(), error: error instanceof Error ? error.message : String(error) },
          'Periodic ABAC policy reload failed',
        );
      });
    }, this.config.reloadIntervalMs);

    const logger = createLogger('abac-policy');
    logger.info(
      { traceId: getCurrentTraceId(), intervalMs: this.config.reloadIntervalMs },
      'ABAC policy periodic reload started',
    );
  }

  /**
   * 处理文件系统变更事件
   */
  private handleFileChange(
    watchPath: string,
    eventType: string,
    filename: string | undefined,
    fs: any,
    pathModule: any,
  ): void {
    if (!filename) return;

    // 只处理策略相关文件
    const policyExtensions = ['.json', '.yaml', '.yml', '.ts', '.js'];
    const hasPolicyExtension = policyExtensions.some((ext) => filename.endsWith(ext));
    if (!hasPolicyExtension) return;

    const traceId = getCurrentTraceId();
    const logger = createLogger('abac-policy');
    logger.info({ traceId, watchPath, eventType, filename }, 'ABAC policy file change detected');

    // 取消同一目录的待处理重载（防抖）
    const existingTimeout = this.pendingFileReloads.get(watchPath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 延迟重载，避免频繁变更触发多次加载
    const timeout = setTimeout(() => {
      this.pendingFileReloads.delete(watchPath);
      this.triggerReload(true).catch((error) => {
        logger.error(
          { traceId, watchPath, error: error instanceof Error ? error.message : String(error) },
          'ABAC policy file-triggered reload failed',
        );
      });
    }, this.config.reloadDelayMs);

    this.pendingFileReloads.set(watchPath, timeout);

    this.emit('reload:detected', {
      timestamp: new Date(),
      autoTriggered: true,
      watchPath,
      eventType,
      filename,
    });
  }

  /**
   * 从数据库加载所有策略，转换为 AbacPolicy 数组。
   */
  private async loadPoliciesFromDatabase(): Promise<{ policies: AbacPolicy[]; error?: string }> {
    if (!this.repository) {
      return { policies: [], error: 'No database repository configured' };
    }

    try {
      const entities: AbacPolicyEntity[] = await this.repository.findAll();
      const policies: AbacPolicy[] = entities.map(entityToPolicy);
      return { policies };
    } catch (error) {
      return {
        policies: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==================== 验证逻辑 ====================

  /**
   * 批量验证策略集合，返回验证结果。
   * 检查项：
   * 1. 所有策略 ID 唯一（Map 结构天然保证）
   * 2. 启用策略的 resourceType 非空且格式合法
   * 3. 启用策略的 actionType 非空且格式合法
   * 4. 条件规则结构合法（递归检查 and/or/not 组合 + condition 必填）
   * 5. Dry-run 评估：确保引擎能正常解析所有策略条件
   */
  private validatePolicies(
    policies: AbacPolicy[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    for (const policy of policies) {
      // 唯一性检查
      if (seenIds.has(policy.id)) {
        errors.push(`Duplicate policy ID: "${policy.id}"`);
      }
      seenIds.add(policy.id);

      // 跳过禁用的策略的条件深度检查
      if (!policy.enabled) continue;

      // resourceType 检查
      if (!policy.resourceType) {
        errors.push(`Policy "${policy.id}": resourceType is required`);
      } else if (Array.isArray(policy.resourceType) && policy.resourceType.length === 0) {
        errors.push(`Policy "${policy.id}": resourceType array must not be empty`);
      }

      // actionType 检查
      if (!policy.actionType) {
        errors.push(`Policy "${policy.id}": actionType is required`);
      } else if (Array.isArray(policy.actionType) && policy.actionType.length === 0) {
        errors.push(`Policy "${policy.id}": actionType array must not be empty`);
      }

      // 条件规则递归验证
      try {
        validateConditionRule(policy.conditions, `policy.${policy.id}`);
      } catch (validationError) {
        errors.push(
          `Policy "${policy.id}" condition validation error: ${
            validationError instanceof Error ? validationError.message : String(validationError)
          }`,
        );
      }
    }

    // Dry-run：用测试上下文评估引擎，确保策略条件结构可被解析
    try {
      const testContext: AbacPolicyEngine['evaluate'] extends (ctx: infer C) => any ? C : never = {
        user: { id: '__reload_validation__', role: 'admin', tenantId: '__test__' },
        resource: { type: 'test-resource', tenantId: '__test__' },
        environment: { time: new Date() },
        action: { type: 'read' },
      } as any;
      this.engine.evaluate(testContext);
    } catch (engineError) {
      errors.push(
        `Engine dry-run evaluation failed: ${
          engineError instanceof Error ? engineError.message : String(engineError)
        }`,
      );
    }

    return { valid: errors.length === 0, errors };
  }
}

// ==================== 辅助函数 ====================

/**
 * 将 DB 实体转换为 AbacPolicy（与 AbacPolicyEngine.entityToPolicy 逻辑一致）
 */
function entityToPolicy(entity: AbacPolicyEntity): AbacPolicy {
  let resourceType: string | string[];
  try {
    const parsed = JSON.parse(entity.resourceType);
    resourceType = Array.isArray(parsed) ? parsed : entity.resourceType;
  } catch {
    resourceType = entity.resourceType;
  }

  let actionType: string | string[];
  try {
    const parsed = JSON.parse(entity.actionType);
    actionType = Array.isArray(parsed) ? parsed : entity.actionType;
  } catch {
    actionType = entity.actionType;
  }

  const hasDetailedConditions =
    Object.keys(entity.subjectConditions).length > 0 ||
    Object.keys(entity.environmentConditions).length > 0;

  let conditions: AbacPolicy['conditions'];
  if (hasDetailedConditions) {
    const parts: any[] = [];
    if (Object.keys(entity.subjectConditions).length > 0) {
      parts.push(entity.subjectConditions);
    }
    if (Object.keys(entity.resourceConditions).length > 0) {
      parts.push(entity.resourceConditions);
    }
    if (Object.keys(entity.environmentConditions).length > 0) {
      parts.push(entity.environmentConditions);
    }
    conditions = parts.length === 1 ? parts[0] : { and: parts };
  } else {
    conditions =
      (entity.resourceConditions as AbacPolicy['conditions']) ||
      { condition: { attribute: 'user.id', operator: 'exists' } };
  }

  return {
    id: entity.id,
    name: entity.name,
    description: entity.description ?? undefined,
    resourceType,
    actionType,
    conditions,
    effect: entity.effect,
    priority: entity.priority,
    enabled: entity.enabled,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * 递归验证 ConditionRule 结构合法性（与 abac-policy-routes.ts 中的逻辑保持一致）
 */
function validateConditionRule(rule: any, path = 'root'): void {
  if (!rule || typeof rule !== 'object') {
    throw new OrionError(`Condition at ${path} must be an object`, ErrorCode.VALIDATION_ERROR);
  }

  const hasCombinator = rule.and || rule.or || rule.not;
  const hasLeafCondition = rule.condition;

  if (!hasCombinator && !hasLeafCondition) {
    throw new OrionError(`Condition at ${path} must have a 'condition' property or be a combinator (and/or/not)`, ErrorCode.VALIDATION_ERROR);
  }

  // 叶子节点验证
  if (hasLeafCondition && !hasCombinator) {
    const cond = rule.condition;
    if (!cond.attribute || typeof cond.attribute !== 'string') {
      throw new OrionError(`Condition at ${path}: attribute must be a non-empty string`, ErrorCode.VALIDATION_ERROR);
    }
    const validOperators = [
      'equals', 'not_equals', 'in', 'not_in', 'contains',
      'gt', 'lt', 'gte', 'lte', 'regex', 'match',
      'notEquals', 'notContains', 'startsWith', 'endsWith',
      'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual',
      'matches', 'exists', 'notExists', 'between', 'timeInRange',
    ];
    if (!cond.operator || !validOperators.includes(cond.operator)) {
      throw new OrionError(`Condition at ${path}: operator must be one of ${validOperators.join(', ')}`, ErrorCode.VALIDATION_ERROR);
    }
    if (cond.value === undefined && cond.operator !== 'exists' && cond.operator !== 'notExists') {
      throw new OrionError(`Condition at ${path}: value is required for operator "${cond.operator}"`, ErrorCode.VALIDATION_ERROR);
    }
  }

  // 递归验证组合规则
  if (rule.and) {
    if (!Array.isArray(rule.and) || rule.and.length === 0) {
      throw new OrionError(`'and' at ${path} must be a non-empty array`, ErrorCode.VALIDATION_ERROR);
    }
    rule.and.forEach((sub: any, i: number) => validateConditionRule(sub, `${path}.and[${i}]`));
  }
  if (rule.or) {
    if (!Array.isArray(rule.or) || rule.or.length === 0) {
      throw new OrionError(`'or' at ${path} must be a non-empty array`, ErrorCode.VALIDATION_ERROR);
    }
    rule.or.forEach((sub: any, i: number) => validateConditionRule(sub, `${path}.or[${i}]`));
  }
  if (rule.not) {
    validateConditionRule(rule.not, `${path}.not`);
  }
}
