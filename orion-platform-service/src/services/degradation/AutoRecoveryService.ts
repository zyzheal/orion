/**
 * 自动恢复服务 - AI Provider 自动恢复管理
 *
 * 功能：
 * 1. 监控降级的 Provider
 * 2. 在 minRecoveryTime 后尝试恢复
 * 3. 跟踪恢复尝试次数（最大 3 次）
 * 4. 当 successRate > 50% 时恢复正常状态
 * 5. 发送 recovery:success 和 recovery:failed 事件
 * 6. 跟踪整体成功率（目标 >80%）
 */

import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface AutoRecoveryConfig {
  recoveryCheckInterval: number;   // 检查间隔，默认 30 秒
  minRecoveryTime: number;         // 最小恢复时间，默认 60 秒
  successThreshold: number;        // 成功阈值，默认 50%
  maxRecoveryAttempts: number;     // 最大尝试次数，默认 3 次
}

export interface RecoveryAttempt {
  providerId: string;
  attemptedAt: Date;
  success: boolean;
  successRate: number;
}

export interface RecoveryStats {
  providerId: string;
  attemptCount: number;
  successCount: number;
  failureCount: number;
  lastAttempt?: Date;
  lastSuccess?: Date;
}

const DEFAULT_CONFIG: AutoRecoveryConfig = {
  recoveryCheckInterval: 30000,    // 30 seconds
  minRecoveryTime: 60000,          // 60 seconds after degradation
  successThreshold: 0.5,           // 50% success rate to recover
  maxRecoveryAttempts: 3,          // 3 attempts max
};

export class AutoRecoveryService extends EventEmitter {
  private config: AutoRecoveryConfig;
  private recoveryAttempts: Map<string, RecoveryAttempt[]> = new Map();
  private degradedProviders: Map<string, Date> = new Map();
  private providerSuccessRates: Map<string, number> = new Map();
  private timer?: NodeJS.Timeout;

  constructor(config: Partial<AutoRecoveryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动监控
   */
  startMonitoring(): void {
    if (this.timer) {
      logger.warn('[AutoRecovery] Monitoring already running');
      return;
    }

    this.timer = setInterval(async () => {
      await this.checkRecoveryCandidates();
    }, this.config.recoveryCheckInterval);

    logger.info('[AutoRecovery] Monitoring started with interval: %dms', this.config.recoveryCheckInterval);
  }

  /**
   * 检查恢复候选
   */
  async checkRecoveryCandidates(): Promise<void> {
    for (const [providerId, degradedAt] of this.degradedProviders) {
      const elapsed = Date.now() - degradedAt.getTime();

      if (elapsed >= this.config.minRecoveryTime) {
        logger.debug('[AutoRecovery] Provider %s eligible for recovery (elapsed: %dms)', providerId, elapsed);
        await this.attemptRecovery(providerId);
      }
    }
  }

  /**
   * 尝试恢复
   */
  async attemptRecovery(providerId: string): Promise<{ attempted: boolean; success: boolean }> {
    const attempts = this.recoveryAttempts.get(providerId) || [];

    // 检查最大尝试次数
    if (attempts.length >= this.config.maxRecoveryAttempts) {
      logger.warn('[AutoRecovery] Max attempts reached for: %s (attempts: %d)', providerId, attempts.length);
      return { attempted: false, success: false };
    }

    // 获取当前成功率（模拟或实际探测）
    const successRate = await this.probeProvider(providerId);
    const success = successRate >= this.config.successThreshold;

    const attempt: RecoveryAttempt = {
      providerId,
      attemptedAt: new Date(),
      success,
      successRate,
    };

    attempts.push(attempt);
    this.recoveryAttempts.set(providerId, attempts);
    this.providerSuccessRates.set(providerId, successRate);

    if (success) {
      // 从降级列表中移除
      this.degradedProviders.delete(providerId);
      this.emit('recovery:success', { providerId, attempt, successRate });
      logger.info('[AutoRecovery] Provider recovered: %s (successRate: %.2f)', providerId, successRate);
    } else {
      this.emit('recovery:failed', { providerId, attempt, successRate });
      logger.warn('[AutoRecovery] Recovery failed for: %s (successRate: %.2f, threshold: %.2f)',
        providerId, successRate, this.config.successThreshold);
    }

    return { attempted: true, success };
  }

  /**
   * 探测 Provider（模拟实现）
   * 在生产环境中，这里会发送测试请求来检测 Provider 健康状态
   */
  private async probeProvider(providerId: string): Promise<number> {
    // 生产环境实现：
    // 1. 发送一个轻量级测试请求到 Provider
    // 2. 计算最近 N 次请求的成功率
    // 3. 返回成功率

    // 模拟实现：基于历史数据或默认值
    const recentRequests = this.getRecentRequestStats(providerId);

    if (recentRequests.total > 0) {
      return recentRequests.successes / recentRequests.total;
    }

    // 默认返回 60% 成功率（模拟探测结果）
    // 这高于 50% 阈值，表示 Provider 正在恢复
    return 0.6;
  }

  /**
   * 获取最近请求统计（占位实现）
   */
  private getRecentRequestStats(providerId: string): { total: number; successes: number } {
    // 在生产环境中从请求日志或监控数据获取
    // 占位实现返回模拟数据
    const existingRate = this.providerSuccessRates.get(providerId);
    if (existingRate !== undefined) {
      return { total: 10, successes: Math.round(10 * existingRate) };
    }
    return { total: 0, successes: 0 };
  }

  /**
   * 标记 Provider 为降级状态
   */
  markDegraded(providerId: string): void {
    const now = new Date();
    this.degradedProviders.set(providerId, now);
    logger.info('[AutoRecovery] Provider marked degraded: %s at %s', providerId, now.toISOString());
  }

  /**
   * 获取恢复统计
   */
  getRecoveryStats(providerId: string): RecoveryStats {
    const attempts = this.recoveryAttempts.get(providerId) || [];
    const successes = attempts.filter(a => a.success);
    const failures = attempts.filter(a => !a.success);

    return {
      providerId,
      attemptCount: attempts.length,
      successCount: successes.length,
      failureCount: failures.length,
      lastAttempt: attempts.length > 0 ? attempts[attempts.length - 1].attemptedAt : undefined,
      lastSuccess: successes.length > 0 ? successes[successes.length - 1].attemptedAt : undefined,
    };
  }

  /**
   * 获取整体成功率
   */
  getOverallSuccessRate(): number {
    const allAttempts = Array.from(this.recoveryAttempts.values()).flat();
    const successes = allAttempts.filter(a => a.success);

    if (allAttempts.length === 0) {
      return 0;
    }

    const rate = successes.length / allAttempts.length;
    logger.debug('[AutoRecovery] Overall success rate: %.2f (%d/%d)', rate, successes.length, allAttempts.length);
    return rate;
  }

  /**
   * 获取所有降级的 Provider
   */
  getDegradedProviders(): string[] {
    return Array.from(this.degradedProviders.keys());
  }

  /**
   * 手动清除降级状态
   */
  clearDegraded(providerId: string): void {
    this.degradedProviders.delete(providerId);
    logger.info('[AutoRecovery] Provider cleared from degraded list: %s', providerId);
  }

  /**
   * 重置 Provider 的恢复尝试计数
   */
  resetAttempts(providerId: string): void {
    this.recoveryAttempts.delete(providerId);
    logger.info('[AutoRecovery] Attempts reset for: %s', providerId);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      logger.info('[AutoRecovery] Monitoring stopped');
    }
  }

  /**
   * 更新 Provider 成功率（供外部调用）
   */
  updateProviderSuccessRate(providerId: string, rate: number): void {
    this.providerSuccessRates.set(providerId, rate);
  }

  /**
   * 获取配置
   */
  getConfig(): AutoRecoveryConfig {
    return { ...this.config };
  }

  /**
   * 获取所有 Provider 的恢复统计摘要
   */
  getAllStats(): {
    totalProviders: number;
    degradedProviders: number;
    overallSuccessRate: number;
    providers: RecoveryStats[];
  } {
    const providers = Array.from(this.recoveryAttempts.keys()).map(id => this.getRecoveryStats(id));

    return {
      totalProviders: this.recoveryAttempts.size,
      degradedProviders: this.degradedProviders.size,
      overallSuccessRate: this.getOverallSuccessRate(),
      providers,
    };
  }
}