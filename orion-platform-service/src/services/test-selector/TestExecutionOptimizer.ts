/**
 * TestExecutionOptimizer - 测试执行优化器
 *
 * 负责选择最优测试子集、分组并行执行、排序以快速发现失败。
 */

import {
  TestSuite,
  TestCase,
  TestExecutionPlan,
  TestGroup,
  SelectedTest,
  SkippedTest,
  TestFailurePrediction,
  ImpactPriority,
  TestSelectorConfig,
  TestImpact,
} from './types';
import { TestFailurePredictor } from './TestFailurePredictor';
import { TestImpactAnalyzer, ImpactAnalysisResult } from './TestImpactAnalyzer';
import { v4 as uuidv4 } from 'uuid';

/**
 * 测试执行优化器
 *
 * 优化测试选择、分组、排序和执行策略。
 */
export class TestExecutionOptimizer {
  private impactAnalyzer: TestImpactAnalyzer;
  private failurePredictor: TestFailurePredictor;
  private config: Required<TestSelectorConfig>;

  constructor(
    impactAnalyzer: TestImpactAnalyzer,
    failurePredictor: TestFailurePredictor,
    config?: TestSelectorConfig
  ) {
    this.impactAnalyzer = impactAnalyzer;
    this.failurePredictor = failurePredictor;

    // 应用默认配置
    this.config = {
      maxExecutionTimeMs: config?.maxExecutionTimeMs || 600000, // 默认 10 分钟
      ordering: config?.ordering || 'fail-fast',
      maxParallelGroups: config?.maxParallelGroups || 4,
      maxTestsPerGroup: config?.maxTestsPerGroup || 50,
      skipFlakyTests: config?.skipFlakyTests ?? false,
      flakyThreshold: config?.flakyThreshold ?? 70,
      minImpactScore: config?.minImpactScore ?? 0,
      historyRetentionDays: config?.historyRetentionDays ?? 90,
    };
  }

  /**
   * 优化测试执行
   *
   * 根据变更影响分析和预测结果，生成最优测试执行计划。
   *
   * @param impactResult 影响分析结果
   * @param prId 关联的 PR ID
   * @returns 测试执行计划
   */
  async optimizeExecution(
    impactResult: ImpactAnalysisResult,
    prId?: string
  ): Promise<TestExecutionPlan> {
    const allSuites = this.impactAnalyzer['dependencyAnalyzer'].getSuites();
    const allCases = this.impactAnalyzer['dependencyAnalyzer'].getCases();
    const affectedIds = impactResult.allAffectedTestIds;

    // 选择需要执行的测试
    const selectedTests: SelectedTest[] = [];
    const skippedTests: SkippedTest[] = [];

    // 预测所有受影响测试的失败概率
    const predictions = await this.predictAffectedTests(Array.from(affectedIds));

    for (const testId of affectedIds) {
      const prediction = predictions.find(p => p.testId === testId);
      const isFlaky = prediction?.isFlaky ?? false;
      const flakyScore = this.getFlakyScore(testId, allSuites, allCases);

      // 根据配置决定是否跳过抖动测试
      if (this.config.skipFlakyTests && isFlaky) {
        skippedTests.push({
          id: testId,
          reason: `Flaky test detected (score: ${flakyScore})`,
        });
        continue;
      }

      // 根据影响评分过滤
      const impactForTest = this.findImpactForTest(testId, impactResult.impacts);
      if (impactForTest && impactForTest.impactScore < this.config.minImpactScore) {
        skippedTests.push({
          id: testId,
          reason: `Impact score ${impactForTest.impactScore} below threshold ${this.config.minImpactScore}`,
        });
        continue;
      }

      const suite = allSuites.find(s => s.id === testId);
      const testCase = allCases.find(c => c.id === testId);
      const estimatedDuration = suite
        ? (suite.avgDuration || 1000)
        : (testCase?.avgDuration || 500);

      // 确定优先级
      let priority: ImpactPriority = 'medium';
      if (prediction) {
        if (prediction.failureProbability > 0.7) {
          priority = 'critical';
        } else if (prediction.failureProbability > 0.4) {
          priority = 'high';
        } else if (prediction.failureProbability > 0.2) {
          priority = 'medium';
        } else {
          priority = 'low';
        }
      }

      // 如果影响分析中有明确的优先级，使用它
      if (impactForTest) {
        const impactPriorityOrder: Record<ImpactPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        if (impactPriorityOrder[impactForTest.priority] > impactPriorityOrder[priority]) {
          priority = impactForTest.priority;
        }
      }

      const reason = this.generateSelectionReason(testId, impactForTest, prediction);

      selectedTests.push({
        id: testId,
        type: suite ? 'suite' : 'case',
        priority,
        estimatedDuration,
        reason,
      });
    }

    // 将所有未受影响的测试标记为跳过
    const allTestIds = new Set([
      ...allSuites.map(s => s.id),
      ...allCases.map(c => c.id),
    ]);

    for (const testId of allTestIds) {
      if (!affectedIds.has(testId)) {
        skippedTests.push({
          id: testId,
          reason: 'Not affected by current changes',
        });
      }
    }

    // 根据排序策略排序
    const orderedTests = this.orderTests(selectedTests, predictions);

    // 检查总时长限制，如果需要则裁剪
    const trimmedTests = this.trimToTimeLimit(orderedTests, skippedTests);

    // 生成分组
    const groups = this.groupForParallel(trimmedTests);

    // 计算预估总时长
    const estimatedDuration = trimmedTests.reduce((sum, t) => sum + t.estimatedDuration, 0);

    return {
      selectedTests: trimmedTests,
      skippedTests,
      estimatedDuration,
      grouping: groups,
      ordering: this.config.ordering,
      planId: `plan-${uuidv4().substring(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 为并行执行分组测试
   *
   * 根据测试时长均匀分配到各组，以实现负载均衡。
   *
   * @param tests 需要执行的测试
   * @returns 并行分组
   */
  groupForParallel(tests: SelectedTest[]): TestGroup[] {
    const maxGroups = Math.min(this.config.maxParallelGroups, tests.length);
    if (maxGroups === 0) return [];
    if (maxGroups === 1) {
      return [{
        groupId: 'group-0',
        testIds: tests.map(t => t.id),
        estimatedDuration: tests.reduce((sum, t) => sum + t.estimatedDuration, 0),
        parallelIndex: 0,
      }];
    }

    // 按预估时长降序排序（用于最佳适配装箱算法）
    const sorted = [...tests].sort((a, b) => b.estimatedDuration - a.estimatedDuration);

    // 初始化组
    const groups: TestGroup[] = Array.from({ length: maxGroups }, (_, i) => ({
      groupId: `group-${i}`,
      testIds: [],
      estimatedDuration: 0,
      parallelIndex: i,
    }));

    // 最佳适配：分配到当前总时长最短的组
    for (const test of sorted) {
      // 找到当前总时长最短的组
      let minGroup = groups[0];
      for (const group of groups) {
        if (
          group.testIds.length < this.config.maxTestsPerGroup &&
          group.estimatedDuration < minGroup.estimatedDuration
        ) {
          minGroup = group;
        }
      }

      minGroup.testIds.push(test.id);
      minGroup.estimatedDuration += test.estimatedDuration;
    }

    // 移除空组
    return groups.filter(g => g.testIds.length > 0);
  }

  /**
   * 为 fail-fast 策略排序测试
   *
   * 优先运行容易失败的测试，以便快速发现问题。
   *
   * @param tests 需要排序的测试
   * @param predictions 失败预测
   * @returns 排序后的测试列表
   */
  orderForFailFast(
    tests: SelectedTest[],
    predictions?: TestFailurePrediction[]
  ): SelectedTest[] {
    const predMap = new Map<string, TestFailurePrediction>();
    if (predictions) {
      predictions.forEach(p => predMap.set(p.testId, p));
    }

    return [...tests].sort((a, b) => {
      // 优先级高的先执行
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // 预测失败概率高的先执行
      const predA = predMap.get(a.id);
      const predB = predMap.get(b.id);
      if (predA && predB) {
        const probDiff = predB.failureProbability - predA.failureProbability;
        if (Math.abs(probDiff) > 0.01) return probDiff;
      }

      // 执行时间短的先执行（快速反馈）
      return a.estimatedDuration - b.estimatedDuration;
    });
  }

  /**
   * 预测受影响测试的失败情况
   */
  private async predictAffectedTests(testIds: string[]): Promise<TestFailurePrediction[]> {
    const predictions: TestFailurePrediction[] = [];

    for (const testId of testIds) {
      const prediction = await this.failurePredictor.predictFailure(testId);
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * 获取测试的抖动评分
   */
  private getFlakyScore(
    testId: string,
    allSuites: TestSuite[],
    allCases: TestCase[]
  ): number {
    const testCase = allCases.find(c => c.id === testId);
    if (testCase) {
      return testCase.flakyScore;
    }
    // 对于 suite，取其包含用例的平均抖动评分
    return 0;
  }

  /**
   * 找到测试对应的影响分析
   */
  private findImpactForTest(testId: string, impacts: TestImpact[]): TestImpact | null {
    for (const impact of impacts) {
      if (impact.affectedTests.includes(testId)) {
        return impact;
      }
    }
    return null;
  }

  /**
   * 生成选择原因
   */
  private generateSelectionReason(
    testId: string,
    impact: any,
    prediction: TestFailurePrediction | undefined
  ): string {
    const reasons: string[] = [];

    if (impact) {
      reasons.push(`Changed file: ${impact.changedFile}`);
      reasons.push(`Impact score: ${impact.impactScore}`);
    }

    if (prediction) {
      if (prediction.failureProbability > 0.5) {
        reasons.push(`High failure probability: ${(prediction.failureProbability * 100).toFixed(0)}%`);
      }
      if (prediction.isFlaky) {
        reasons.push('Flaky test');
      }
      reasons.push(...prediction.reasons);
    }

    return reasons.join('; ') || 'Affected by code changes';
  }

  /**
   * 排序测试
   */
  private orderTests(
    tests: SelectedTest[],
    predictions: TestFailurePrediction[]
  ): SelectedTest[] {
    switch (this.config.ordering) {
      case 'fail-fast':
        return this.orderForFailFast(tests, predictions);
      case 'coverage-first':
        // 优先执行覆盖率高的测试（执行时间长的套件通常覆盖更广）
        return [...tests].sort((a, b) => b.estimatedDuration - a.estimatedDuration);
      case 'balanced':
      default:
        // 混合策略：优先级为主，时长为辅
        return [...tests].sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.estimatedDuration - b.estimatedDuration;
        });
    }
  }

  /**
   * 根据时间限制裁剪测试列表
   */
  private trimToTimeLimit(
    orderedTests: SelectedTest[],
    skippedTests: SkippedTest[]
  ): SelectedTest[] {
    let totalDuration = 0;
    const trimmed: SelectedTest[] = [];

    for (const test of orderedTests) {
      if (totalDuration + test.estimatedDuration <= this.config.maxExecutionTimeMs) {
        trimmed.push(test);
        totalDuration += test.estimatedDuration;
      } else {
        skippedTests.push({
          id: test.id,
          reason: `Exceeds max execution time limit (${this.config.maxExecutionTimeMs}ms)`,
        });
      }
    }

    return trimmed;
  }
}
