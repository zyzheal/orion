/**
 * TestSelectorService - 智能测试选择服务
 *
 * 编排测试依赖分析、影响分析、执行优化和失败预测的完整工作流。
 * 支持通过事件总线订阅 code.pr.opened 等事件，自动触发测试选择。
 * PostgreSQL Repository 模式：PR 测试结果存储在 test_selector_pr_results 表中。
 */

import {
  PRChange,
  TestExecutionPlan,
  TestSelectorConfig,
  TestSuite,
  TestCase,
  TestImpact,
  ApiResponse,
} from './types';
import { TestDependencyAnalyzer, DependencyAnalyzerConfig } from './TestDependencyAnalyzer';
import { TestImpactAnalyzer, ImpactAnalysisResult } from './TestImpactAnalyzer';
import { TestExecutionOptimizer } from './TestExecutionOptimizer';
import { TestFailurePredictor, TestHistoryStats } from './TestFailurePredictor';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { PRTestResultDependencyRepository } from '../../repositories/TestDependencyRepository';

const logger = createLogger('test-selector-service');

/**
 * 事件总线接口（兼容 EventBusService）
 */
export interface EventBusAdapter {
  publish: (subject: string, data: any, options?: any) => Promise<string>;
  subscribe: (eventType: string, handler: (event: any) => Promise<void>) => Promise<() => Promise<void>>;
  isHealthy?: () => boolean;
}

/**
 * 测试选择服务配置
 */
export interface TestSelectorServiceConfig {
  /** 依赖分析器配置 */
  analyzerConfig: DependencyAnalyzerConfig;
  /** 执行优化配置 */
  optimizerConfig?: TestSelectorConfig;
  /** 事件总线（可选） */
  eventBus?: EventBusAdapter;
  /** 是否自动订阅 PR 事件 */
  autoSubscribePREvents?: boolean;
}

/**
 * PR 测试结果
 */
export interface PRTestResult {
  /** PR ID */
  prId: string;
  /** 测试计划 */
  plan: TestExecutionPlan;
  /** 影响分析 */
  impact: ImpactAnalysisResult;
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 智能测试选择服务
 *
 * 端到端的测试选择工作流：
 * 1. 分析测试依赖关系
 * 2. 根据代码变更评估影响
 * 3. 优化测试执行策略
 * 4. 预测测试失败概率
 */
export class TestSelectorService {
  private dependencyAnalyzer: TestDependencyAnalyzer;
  private impactAnalyzer: TestImpactAnalyzer;
  private executionOptimizer: TestExecutionOptimizer;
  private failurePredictor: TestFailurePredictor;
  private eventBus?: EventBusAdapter;
  private isInitialized = false;
  private unsubscribe?: () => Promise<void>;
  private prResultRepo: PRTestResultDependencyRepository;
  private tenantId: string;

  constructor(
    config: TestSelectorServiceConfig,
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId: string = 'default',
  ) {
    this.tenantId = tenantId;
    // 初始化组件
    this.dependencyAnalyzer = new TestDependencyAnalyzer(config.analyzerConfig, db, tenantId);
    this.impactAnalyzer = new TestImpactAnalyzer(this.dependencyAnalyzer);
    this.failurePredictor = new TestFailurePredictor(db, tenantId);
    this.executionOptimizer = new TestExecutionOptimizer(
      this.impactAnalyzer,
      this.failurePredictor,
      config.optimizerConfig
    );
    this.eventBus = config.eventBus;
    this.prResultRepo = new PRTestResultDependencyRepository(db);
  }

  /**
   * 初始化服务
   *
   * 分析测试依赖关系并设置事件订阅。
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('Analyzing test dependencies...');
    const dependencyResult = await this.dependencyAnalyzer.analyzeTestDependencies();
    logger.info({ suites: dependencyResult.suites.length, cases: dependencyResult.cases.length }, 'Found test suites and cases');

    // 自动订阅 PR 事件
    if (this.eventBus) {
      await this.subscribeToPREvents();
    }

    this.isInitialized = true;
  }

  /**
   * 为 PR 选择测试
   *
   * 端到端工作流：分析变更 -> 评估影响 -> 生成执行计划
   *
   * @param prChange PR 变更信息
   * @returns 测试执行计划
   */
  async selectTestsForPR(prChange: PRChange): Promise<TestExecutionPlan> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info({ prId: prChange.prId, changedFiles: prChange.changedFiles.length }, 'Selecting tests for PR');

    // 1. 分析变更影响
    const impactResult = await this.impactAnalyzer.analyzeImpact(prChange.changedFiles);

    if (impactResult.allAffectedTestIds.size === 0) {
      logger.info('No tests affected by changes');
    } else {
      logger.info({ count: impactResult.allAffectedTestIds.size }, 'Found affected tests');
    }

    // 2. 优化执行
    const plan = await this.executionOptimizer.optimizeExecution(impactResult, prChange.prId);

    // 3. 保存结果到 PostgreSQL
    await this.prResultRepo.create({
      id: uuidv4(),
      tenantId: this.tenantId,
      prId: prChange.prId,
      planData: plan as unknown as Record<string, unknown>,
      impactData: impactResult as unknown as Record<string, unknown>,
      status: 'pending',
    });

    // 4. 发布事件
    await this.publishTestSelectionEvent(prChange.prId, plan);

    return plan;
  }

  /**
   * 获取测试计划
   *
   * @param planId 计划 ID
   * @returns 测试执行计划
   */
  async getTestPlan(planId: string): Promise<TestExecutionPlan | null> {
    const entity = await this.prResultRepo.findByPlanId(planId, this.tenantId);
    if (entity) {
      return entity.planData as unknown as TestExecutionPlan;
    }
    return null;
  }

  /**
   * 获取 PR 的测试结果
   */
  async getPRTestResult(prId: string): Promise<PRTestResult | null> {
    const entity = await this.prResultRepo.findByPrId(prId, this.tenantId);
    if (!entity) return null;

    return {
      prId: entity.prId,
      plan: entity.planData as unknown as TestExecutionPlan,
      impact: entity.impactData as unknown as ImpactAnalysisResult,
      status: entity.status as 'pending' | 'running' | 'completed' | 'failed',
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * 更新 PR 测试执行状态
   */
  async updatePRTestStatus(prId: string, status: 'running' | 'completed' | 'failed'): Promise<void> {
    const entity = await this.prResultRepo.findByPrId(prId, this.tenantId);
    if (entity) {
      await this.prResultRepo.updateStatus(entity.id, status);
    }
  }

  /**
   * 记录测试执行结果
   *
   * 用于更新历史数据和改进预测。
   */
  async recordTestResult(
    testId: string,
    passed: boolean,
    duration: number,
    failureMessage?: string,
    prId?: string
  ): Promise<void> {
    const record = {
      executionId: `exec-${uuidv4().substring(0, 8)}`,
      passed,
      duration,
      timestamp: new Date().toISOString(),
      failureMessage,
      prId,
    };

    await this.failurePredictor.updateTestHistory(testId, record);
  }

  /**
   * 获取测试历史
   */
  async getTestHistory(testId: string): Promise<TestHistoryStats> {
    return this.failurePredictor.getStats(testId);
  }

  /**
   * 获取所有测试历史汇总
   */
  async getAllTestHistory(): Promise<TestHistoryStats[]> {
    return this.failurePredictor.getAllStats();
  }

  /**
   * 获取抖动测试
   */
  async getFlakyTests(threshold?: number): Promise<string[]> {
    return this.failurePredictor.getFlakyTests(threshold);
  }

  /**
   * 获取测试覆盖率
   */
  getTestCoverage(): Map<string, { testCount: number; testIds: string[] }> {
    return this.impactAnalyzer.getCoverageStats();
  }

  /**
   * 获取测试套件列表
   */
  async getSuites(): Promise<TestSuite[]> {
    return this.dependencyAnalyzer.getSuites();
  }

  /**
   * 获取测试用例列表
   */
  async getCases(): Promise<TestCase[]> {
    return this.dependencyAnalyzer.getCases();
  }

  /**
   * 获取影响分析结果
   */
  async analyzeImpactForFiles(changedFiles: Array<{ path: string; changeType: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>): Promise<ImpactAnalysisResult> {
    return this.impactAnalyzer.analyzeImpact(changedFiles);
  }

  /**
   * 重新分析依赖
   */
  async reanalyze(): Promise<void> {
    this.dependencyAnalyzer.clearCache();
    await this.failurePredictor.clearHistory();
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    if (this.unsubscribe) {
      await this.unsubscribe();
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 订阅 PR 事件
   */
  private async subscribeToPREvents(): Promise<void> {
    if (!this.eventBus) return;

    try {
      const unsubscribe = await this.eventBus.subscribe('code.pr.opened', async (event: any) => {
        logger.info({ prId: event.data?.prId }, 'Received code.pr.opened event');
        // 事件处理需要 PR 变更数据，这里仅做记录
        // 实际的测试选择需要外部提供变更文件列表
      });

      this.unsubscribe = unsubscribe;
      logger.info('Subscribed to code.pr.opened events');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to subscribe to PR events');
    }
  }

  /**
   * 发布测试选择事件
   */
  private async publishTestSelectionEvent(prId: string, plan: TestExecutionPlan): Promise<void> {
    if (!this.eventBus) return;

    try {
      await this.eventBus.publish('test.selection.completed', {
        prId,
        selectedCount: plan.selectedTests.length,
        skippedCount: plan.skippedTests.length,
        estimatedDuration: plan.estimatedDuration,
        groupCount: plan.grouping.length,
        planId: plan.planId,
      });
    } catch (error) {
      logger.warn({ err: error }, 'Failed to publish test selection event');
    }
  }
}
