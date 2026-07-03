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
 *
 * 数据存储：PostgreSQL（通过 AutoRecoveryRecordRepository + DegradedStateRepository）
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { AutoRecoveryRecordRepository } from '../../repositories/AutoRecoveryRecordRepository';
import { DegradedStateRepository } from '../../repositories/DegradedStateRepository';

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
  private timer?: NodeJS.Timeout;
  private repository: AutoRecoveryRecordRepository;
  private degradedStateRepository: DegradedStateRepository;

  constructor(
    config: Partial<AutoRecoveryConfig> = {},
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repository = new AutoRecoveryRecordRepository(db);
    this.degradedStateRepository = new DegradedStateRepository(db);
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
    const degradedStates = await this.degradedStateRepository.findAllDegraded();
    const now = Date.now();

    for (const state of degradedStates) {
      const elapsed = now - state.degradedAt.getTime();

      if (elapsed >= this.config.minRecoveryTime) {
        logger.debug('[AutoRecovery] Provider %s eligible for recovery (elapsed: %dms)', state.providerId, elapsed);
        await this.attemptRecovery(state.providerId);
      }
    }
  }

  /**
   * 尝试恢复
   */
  async attemptRecovery(providerId: string): Promise<{ attempted: boolean; success: boolean }> {
    // 检查最大尝试次数
    const stats = await this.repository.getAttemptStats(providerId);
    if (stats.attemptCount >= this.config.maxRecoveryAttempts) {
      logger.warn('[AutoRecovery] Max attempts reached for: %s (attempts: %d)', providerId, stats.attemptCount);
      return { attempted: false, success: false };
    }

    // 获取当前成功率（模拟或实际探测）
    const successRate = await this.probeProvider(providerId);
    const success = successRate >= this.config.successThreshold;

    // Persist attempt to repository
    await this.repository.create({
      id: uuidv4(),
      provider_id: providerId,
      attempted_at: new Date(),
      success,
      success_rate: successRate,
      degraded_at: null,
      recovered_at: success ? new Date() : null,
      tenant_id: null,
    });

    if (success) {
      // 从降级列表中移除
      await this.degradedStateRepository.removeByProviderId(providerId);

      this.emit('recovery:success', { providerId, successRate });
      logger.info('[AutoRecovery] Provider recovered: %s (successRate: %.2f)', providerId, successRate);
    } else {
      // Update success rate in degraded state
      const degradedState = await this.degradedStateRepository.findByProviderId(providerId);
      if (degradedState) {
        await this.degradedStateRepository.upsert(providerId, degradedState.degradedAt, successRate);
      }

      this.emit('recovery:failed', { providerId, successRate });
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
    const degradedState = await this.degradedStateRepository.findByProviderId(providerId);
    if (degradedState?.lastSuccessRate !== null && degradedState?.lastSuccessRate !== undefined) {
      return degradedState.lastSuccessRate;
    }

    // 默认返回 60% 成功率（模拟探测结果）
    // 这高于 50% 阈值，表示 Provider 正在恢复
    return 0.6;
  }

  /**
   * 标记 Provider 为降级状态
   */
  async markDegraded(providerId: string): Promise<void> {
    const now = new Date();
    await this.degradedStateRepository.upsert(providerId, now);

    logger.info('[AutoRecovery] Provider marked degraded: %s at %s', providerId, now.toISOString());
  }

  /**
   * 获取恢复统计
   */
  async getRecoveryStats(providerId: string): Promise<RecoveryStats> {
    const stats = await this.repository.getAttemptStats(providerId);

    return {
      providerId,
      attemptCount: stats.attemptCount,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      lastAttempt: stats.lastAttemptAt ?? undefined,
      lastSuccess: stats.lastSuccessAt ?? undefined,
    };
  }

  /**
   * 获取整体成功率
   */
  async getOverallSuccessRate(): Promise<number> {
    const stats = await this.repository.getOverallStats();

    if (stats.totalAttempts === 0) {
      return 0;
    }

    const rate = stats.totalSuccesses / stats.totalAttempts;
    logger.debug('[AutoRecovery] Overall success rate: %.2f (%d/%d)', rate, stats.totalSuccesses, stats.totalAttempts);
    return rate;
  }

  /**
   * 获取所有降级的 Provider
   */
  async getDegradedProviders(): Promise<string[]> {
    const states = await this.degradedStateRepository.findAllDegraded();
    return states.map(s => s.providerId);
  }

  /**
   * 手动清除降级状态
   */
  async clearDegraded(providerId: string): Promise<void> {
    await this.degradedStateRepository.removeByProviderId(providerId);

    logger.info('[AutoRecovery] Provider cleared from degraded list: %s', providerId);
  }

  /**
   * 重置 Provider 的恢复尝试计数
   */
  async resetAttempts(providerId: string): Promise<void> {
    await this.repository.deleteByProviderId(providerId);
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
  async updateProviderSuccessRate(providerId: string, rate: number): Promise<void> {
    const existing = await this.degradedStateRepository.findByProviderId(providerId);
    if (existing) {
      await this.degradedStateRepository.upsert(providerId, existing.degradedAt, rate);
    }
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
  async getAllStats(): Promise<{
    totalProviders: number;
    degradedProviders: number;
    overallSuccessRate: number;
    providers: RecoveryStats[];
  }> {
    const providerIds = await this.repository.getDistinctProviderIds();
    const degradedStates = await this.degradedStateRepository.findAllDegraded();
    const providers = await Promise.all(providerIds.map(id => this.getRecoveryStats(id)));

    return {
      totalProviders: providerIds.length,
      degradedProviders: degradedStates.length,
      overallSuccessRate: await this.getOverallSuccessRate(),
      providers,
    };
  }
}
