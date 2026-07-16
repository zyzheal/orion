/**
 * TestFailurePredictor - 测试失败预测器
 *
 * 基于历史数据预测测试失败概率，检测抖动测试。
 * PostgreSQL Repository 模式：主数据存储在 test_selector_execution_history 表中。
 */

import {
  TestExecutionRecord,
  TestFailurePrediction,
} from './types';
import { TestExecutionHistoryDependencyRepository } from '../../repositories/TestDependencyRepository';
import { v4 as uuidv4 } from 'uuid';

/**
 * 测试历史统计
 */
export interface TestHistoryStats {
  /** 测试 ID */
  testId: string;
  /** 总执行次数 */
  totalRuns: number;
  /** 通过次数 */
  passedRuns: number;
  /** 失败次数 */
  failedRuns: number;
  /** 通过率 */
  passRate: number;
  /** 平均执行时长 (ms) */
  avgDuration: number;
  /** 抖动评分 (0-100) */
  flakyScore: number;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 最近失败信息 */
  recentFailures: string[];
  /** 历史记录 */
  history: TestExecutionRecord[];
}

/**
 * 测试失败预测器
 *
 * 使用历史执行数据预测测试失败概率，识别不稳定的抖动测试。
 */
export class TestFailurePredictor {
  // 统计信息缓存（从 DB 加载后缓存，写入时失效）
  private statsCache: Map<string, TestHistoryStats> = new Map();
  /** PostgreSQL 持久化 */
  private historyRepo: TestExecutionHistoryDependencyRepository;
  private tenantId: string;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId: string = 'default',
  ) {
    this.historyRepo = new TestExecutionHistoryDependencyRepository(db);
    this.tenantId = tenantId;
  }

  /**
   * 预测测试失败概率
   *
   * 基于以下因素综合评估：
   * 1. 历史失败率
   * 2. 抖动评分
   * 3. 最近执行趋势
   * 4. 执行时长异常
   *
   * @param testId 测试 ID
   * @returns 失败预测
   */
  async predictFailure(testId: string): Promise<TestFailurePrediction> {
    const stats = await this.getStats(testId);
    const reasons: string[] = [];

    // 基础失败概率（基于历史通过率）
    let failureProbability = 1.0 - stats.passRate;

    // 如果没有历史数据，使用默认值
    if (stats.totalRuns === 0) {
      return {
        testId,
        failureProbability: 0.1, // 新测试默认低概率
        reasons: ['No historical data available'],
        isFlaky: false,
      };
    }

    // 因素 1：连续失败会增加预测概率
    if (stats.consecutiveFailures > 0) {
      const consecutiveBonus = Math.min(0.3, stats.consecutiveFailures * 0.1);
      failureProbability += consecutiveBonus;
      reasons.push(`${stats.consecutiveFailures} consecutive failure(s)`);
    }

    // 因素 2：抖动测试的失败概率更高
    if (stats.flakyScore > 50) {
      const flakyBonus = (stats.flakyScore / 100) * 0.2;
      failureProbability += flakyBonus;
      reasons.push(`High flakiness score: ${stats.flakyScore}`);
    }

    // 因素 3：时长异常（执行时间波动大说明不稳定）
    if (stats.history.length > 2) {
      const durations = stats.history.map(h => h.duration);
      const avg = stats.avgDuration;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = avg > 0 ? stdDev / avg : 0;

      if (coefficientOfVariation > 0.5) {
        failureProbability += 0.1;
        reasons.push(`High duration variance (CV: ${(coefficientOfVariation * 100).toFixed(0)}%)`);
      }
    }

    // 因素 4：最近趋势（如果最近执行表现变差）
    if (stats.history.length >= 3) {
      const recentHistory = stats.history.slice(-5);
      const recentPassRate = recentHistory.filter(h => h.passed).length / recentHistory.length;
      const overallPassRate = stats.passRate;

      if (recentPassRate < overallPassRate * 0.8) {
        failureProbability += 0.15;
        reasons.push('Declining recent pass rate trend');
      }
    }

    // 限制在 0-1 范围
    failureProbability = Math.min(1.0, Math.max(0.0, failureProbability));

    // 判断是否为抖动测试
    const isFlaky = stats.flakyScore > 50;

    return {
      testId,
      failureProbability: Math.round(failureProbability * 100) / 100, // 保留两位小数
      reasons: reasons.length > 0 ? reasons : ['Based on historical pass rate'],
      isFlaky,
    };
  }

  /**
   * 更新测试执行历史
   *
   * 记录一次测试执行的结果。
   *
   * @param testId 测试 ID
   * @param record 执行记录
   */
  async updateTestHistory(testId: string, record: TestExecutionRecord): Promise<void> {
    // 写入 PostgreSQL
    await this.historyRepo.create({
      id: uuidv4(),
      tenantId: this.tenantId,
      testId,
      executionId: record.executionId,
      passed: record.passed,
      duration: record.duration,
      failureMessage: record.failureMessage || null,
      prId: record.prId || null,
      executedAt: new Date(record.timestamp),
    });

    // 清除该测试的统计缓存
    this.statsCache.delete(testId);
  }

  /**
   * 批量更新测试执行历史
   */
  async updateTestHistoryBatch(records: Array<{ testId: string; record: TestExecutionRecord }>): Promise<void> {
    for (const { testId, record } of records) {
      await this.updateTestHistory(testId, record);
    }
  }

  /**
   * 获取抖动测试列表
   *
   * 抖动测试定义：在过去 20 次执行中，既有通过也有失败，且通过率在 50%-95% 之间。
   *
   * @param threshold 抖动评分阈值（默认 50）
   * @returns 抖动测试 ID 列表
   */
  async getFlakyTests(threshold: number = 50): Promise<string[]> {
    const flakyTests: string[] = [];
    const allTestIds = await this.historyRepo.findAllTestIds(this.tenantId);

    for (const testId of allTestIds) {
      const historyEntities = await this.historyRepo.findByTestId(testId, 20);
      if (historyEntities.length < 5) continue; // 至少 5 次执行才能判断

      const recentHistory: TestExecutionRecord[] = historyEntities.map(e => ({
        executionId: e.executionId,
        passed: e.passed,
        duration: e.duration,
        timestamp: e.executedAt.toISOString(),
        failureMessage: e.failureMessage || undefined,
        prId: e.prId || undefined,
      }));

      const passedCount = recentHistory.filter(h => h.passed).length;
      const passRate = passedCount / recentHistory.length;

      // 抖动测试：通过率在 50%-95% 之间（既不是完全通过也不是完全失败）
      if (passRate >= 0.5 && passRate <= 0.95) {
        // 检查是否有交替通过/失败的模式
        const alternations = this.countAlternations(recentHistory);
        if (alternations >= 2) {
          flakyTests.push(testId);
        }
      }
    }

    return flakyTests;
  }

  /**
   * 获取测试统计信息
   */
  async getStats(testId: string): Promise<TestHistoryStats> {
    // 返回缓存
    if (this.statsCache.has(testId)) {
      return this.statsCache.get(testId)!;
    }

    // 从 DB 加载历史记录
    const historyEntities = await this.historyRepo.findByTestId(testId, 200);
    const history: TestExecutionRecord[] = historyEntities.map(e => ({
      executionId: e.executionId,
      passed: e.passed,
      duration: e.duration,
      timestamp: e.executedAt.toISOString(),
      failureMessage: e.failureMessage || undefined,
      prId: e.prId || undefined,
    }));

    const stats = this.computeStats(testId, history);
    this.statsCache.set(testId, stats);
    return stats;
  }

  /**
   * 获取所有测试的统计汇总
   */
  async getAllStats(): Promise<TestHistoryStats[]> {
    const allTestIds = await this.historyRepo.findAllTestIds(this.tenantId);
    const allStats: TestHistoryStats[] = [];
    for (const testId of allTestIds) {
      allStats.push(await this.getStats(testId));
    }
    return allStats;
  }

  /**
   * 清除旧历史数据
   *
   * @param retentionDays 保留天数
   */
  async pruneOldHistory(retentionDays: number = 90): Promise<number> {
    const prunedCount = await this.historyRepo.pruneOld(retentionDays);
    // 清除所有缓存（数据已变化）
    this.statsCache.clear();
    return prunedCount;
  }

  /**
   * 获取测试历史
   */
  async getHistory(testId: string): Promise<TestExecutionRecord[]> {
    const historyEntities = await this.historyRepo.findByTestId(testId, 200);
    return historyEntities.map(e => ({
      executionId: e.executionId,
      passed: e.passed,
      duration: e.duration,
      timestamp: e.executedAt.toISOString(),
      failureMessage: e.failureMessage || undefined,
      prId: e.prId || undefined,
    }));
  }

  /**
   * 清空所有历史
   */
  async clearHistory(): Promise<void> {
    await this.historyRepo.deleteByTenant(this.tenantId);
    this.statsCache.clear();
  }

  // ==================== 私有方法 ====================

  /**
   * 从执行记录计算统计信息
   */
  private computeStats(testId: string, history: TestExecutionRecord[]): TestHistoryStats {
    const passedRuns = history.filter(h => h.passed).length;
    const failedRuns = history.length - passedRuns;
    const passRate = history.length > 0 ? passedRuns / history.length : 0;

    const avgDuration = history.length > 0
      ? history.reduce((sum, h) => sum + h.duration, 0) / history.length
      : 0;

    const flakyScore = this.calculateFlakyScore(history);

    // 计算连续失败次数
    let consecutiveFailures = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].passed) break;
      consecutiveFailures++;
    }

    // 最近的失败信息
    const recentFailures = history
      .filter(h => !h.passed && h.failureMessage)
      .slice(-3)
      .map(h => h.failureMessage!);

    return {
      testId,
      totalRuns: history.length,
      passedRuns,
      failedRuns,
      passRate: Math.round(passRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      flakyScore,
      consecutiveFailures,
      recentFailures,
      history,
    };
  }

  /**
   * 计算抖动评分
   *
   * 基于执行历史中通过/失败交替的频率。
   */
  private calculateFlakyScore(history: TestExecutionRecord[]): number {
    if (history.length < 3) return 0;

    const recentHistory = history.slice(-20);
    if (recentHistory.length < 3) return 0;

    // 计算交替次数
    const alternations = this.countAlternations(recentHistory);

    // 通过率
    const passedCount = recentHistory.filter(h => h.passed).length;
    const passRate = passedCount / recentHistory.length;

    // 抖动评分计算
    let score = 0;

    // 交替越多，越抖动
    score += Math.min(50, alternations * 10);

    // 通过率在中间区域（既不是 0% 也不是 100%）越抖动
    if (passRate > 0 && passRate < 1) {
      const distanceFromEdge = Math.min(passRate, 1 - passRate);
      score += Math.min(50, distanceFromEdge * 100);
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * 计算通过/失败交替次数
   */
  private countAlternations(history: TestExecutionRecord[]): number {
    let alternations = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].passed !== history[i - 1].passed) {
        alternations++;
      }
    }
    return alternations;
  }
}
