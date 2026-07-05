/**
 * TestExecutionOptimizer 单元测试
 */

import { TestExecutionOptimizer } from '../TestExecutionOptimizer';
import { TestImpactAnalyzer } from '../TestImpactAnalyzer';
import { TestFailurePredictor } from '../TestFailurePredictor';
import { TestDependencyAnalyzer } from '../TestDependencyAnalyzer';
import { ImpactAnalysisResult, ChangedFile, SelectedTest, TestFailurePrediction } from '../types';

// 模拟依赖
jest.mock('../TestImpactAnalyzer');
jest.mock('../TestFailurePredictor');
jest.mock('../TestDependencyAnalyzer');

describe('TestExecutionOptimizer', () => {
  let optimizer: TestExecutionOptimizer;
  let mockImpactAnalyzer: jest.Mocked<TestImpactAnalyzer>;
  let mockPredictor: jest.Mocked<TestFailurePredictor>;

  const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

  beforeEach(() => {
    // 创建模拟依赖分析器
    const mockDepAnalyzer = new TestDependencyAnalyzer({
      sourceRoot: '/src',
      testRoot: '/src',
    }, mockDb as any) as jest.Mocked<TestDependencyAnalyzer>;
    mockDepAnalyzer.getSuites = jest.fn().mockReturnValue([
      { id: 'suite-001', name: 'UserService.test', avgDuration: 2000 },
      { id: 'suite-002', name: 'OrderService.test', avgDuration: 3000 },
      { id: 'suite-003', name: 'Helper.test', avgDuration: 500 },
    ]);
    mockDepAnalyzer.getCases = jest.fn().mockReturnValue([
      { id: 'case-001', suiteId: 'suite-001', name: 'test1', avgDuration: 500, flakyScore: 0 },
      { id: 'case-002', suiteId: 'suite-002', name: 'test2', avgDuration: 800, flakyScore: 30 },
    ]);

    // 创建模拟影响分析器
    mockImpactAnalyzer = new TestImpactAnalyzer(mockDepAnalyzer) as jest.Mocked<TestImpactAnalyzer>;
    mockImpactAnalyzer['dependencyAnalyzer'] = mockDepAnalyzer;

    // 创建模拟预测器
    mockPredictor = new TestFailurePredictor(mockDb as any) as jest.Mocked<TestFailurePredictor>;
    mockPredictor.predictFailure = jest.fn().mockResolvedValue({
      testId: '',
      failureProbability: 0.1,
      reasons: [],
      isFlaky: false,
    });

    optimizer = new TestExecutionOptimizer(mockImpactAnalyzer, mockPredictor);
  });

  describe('optimizeExecution', () => {
    it('应该生成测试执行计划', async () => {
      const impactResult: ImpactAnalysisResult = {
        impacts: [
          {
            changedFile: 'src/UserService.ts',
            changeType: 'modified',
            affectedTests: ['suite-001'],
            priority: 'high',
            estimatedDuration: 2000,
            impactScore: 60,
          },
        ],
        allAffectedTestIds: new Set(['suite-001']),
        totalEstimatedDuration: 2000,
      };

      const plan = await optimizer.optimizeExecution(impactResult, 'pr-001');

      expect(plan.selectedTests.length).toBeGreaterThan(0);
      expect(plan.planId).toBeDefined();
      expect(plan.createdAt).toBeDefined();
      expect(plan.ordering).toBe('fail-fast');
    });

    it('应该跳过抖动测试当配置启用时', async () => {
      const optimizerWithFlakySkip = new TestExecutionOptimizer(
        mockImpactAnalyzer,
        mockPredictor,
        { skipFlakyTests: true, flakyThreshold: 50 }
      );

      mockPredictor.predictFailure = jest.fn().mockResolvedValue({
        testId: 'case-002',
        failureProbability: 0.3,
        reasons: [],
        isFlaky: true,
      });

      const impactResult: ImpactAnalysisResult = {
        impacts: [{
          changedFile: 'src/OrderService.ts',
          changeType: 'modified',
          affectedTests: ['case-002'],
          priority: 'medium',
          estimatedDuration: 800,
          impactScore: 40,
        }],
        allAffectedTestIds: new Set(['case-002']),
        totalEstimatedDuration: 800,
      };

      const plan = await optimizerWithFlakySkip.optimizeExecution(impactResult, 'pr-002');

      expect(plan.selectedTests.find(t => t.id === 'case-002')).toBeUndefined();
      expect(plan.skippedTests.some(s => s.id === 'case-002' && s.reason.includes('Flaky'))).toBe(true);
    });

    it('应该应用执行时间限制', async () => {
      const limitedOptimizer = new TestExecutionOptimizer(
        mockImpactAnalyzer,
        mockPredictor,
        { maxExecutionTimeMs: 1500 }
      );

      const impactResult: ImpactAnalysisResult = {
        impacts: [{
          changedFile: 'src/multi.ts',
          changeType: 'modified',
          affectedTests: ['suite-001', 'suite-002', 'suite-003'],
          priority: 'high',
          estimatedDuration: 5500,
          impactScore: 70,
        }],
        allAffectedTestIds: new Set(['suite-001', 'suite-002', 'suite-003']),
        totalEstimatedDuration: 5500,
      };

      const plan = await limitedOptimizer.optimizeExecution(impactResult, 'pr-003');

      const totalDuration = plan.selectedTests.reduce((s, t) => s + t.estimatedDuration, 0);
      expect(totalDuration).toBeLessThanOrEqual(1500);
    });

    it('应该过滤低影响评分的测试', async () => {
      const filteredOptimizer = new TestExecutionOptimizer(
        mockImpactAnalyzer,
        mockPredictor,
        { minImpactScore: 50 }
      );

      const impactResult: ImpactAnalysisResult = {
        impacts: [{
          changedFile: 'src/Helper.ts',
          changeType: 'modified',
          affectedTests: ['suite-003'],
          priority: 'low',
          estimatedDuration: 500,
          impactScore: 20,
        }],
        allAffectedTestIds: new Set(['suite-003']),
        totalEstimatedDuration: 500,
      };

      const plan = await filteredOptimizer.optimizeExecution(impactResult, 'pr-004');

      expect(plan.selectedTests.find(t => t.id === 'suite-003')).toBeUndefined();
    });
  });

  describe('groupForParallel', () => {
    it('应该均匀分配测试到并行组', () => {
      const tests: SelectedTest[] = [
        { id: 't1', type: 'suite', priority: 'high', estimatedDuration: 3000, reason: '' },
        { id: 't2', type: 'suite', priority: 'high', estimatedDuration: 2000, reason: '' },
        { id: 't3', type: 'suite', priority: 'medium', estimatedDuration: 1000, reason: '' },
        { id: 't4', type: 'suite', priority: 'medium', estimatedDuration: 500, reason: '' },
      ];

      const groups = optimizer.groupForParallel(tests);

      expect(groups.length).toBeGreaterThan(0);
      expect(groups.length).toBeLessThanOrEqual(4);

      // 所有测试应该都被分配
      const allGroupedIds = groups.flatMap(g => g.testIds);
      expect(allGroupedIds).toHaveLength(4);
    });

    it('单个测试应该只有一个组', () => {
      const tests: SelectedTest[] = [
        { id: 't1', type: 'suite', priority: 'high', estimatedDuration: 1000, reason: '' },
      ];

      const groups = optimizer.groupForParallel(tests);

      expect(groups).toHaveLength(1);
      expect(groups[0].testIds).toEqual(['t1']);
    });

    it('空测试列表应该返回空组', () => {
      const groups = optimizer.groupForParallel([]);
      expect(groups).toEqual([]);
    });

    it('应该遵守每组最大测试数限制', () => {
      const limitedOptimizer = new TestExecutionOptimizer(
        mockImpactAnalyzer,
        mockPredictor,
        { maxParallelGroups: 3, maxTestsPerGroup: 2 }
      );

      const tests: SelectedTest[] = [
        { id: 't1', type: 'suite', priority: 'high', estimatedDuration: 1000, reason: '' },
        { id: 't2', type: 'suite', priority: 'high', estimatedDuration: 1000, reason: '' },
        { id: 't3', type: 'suite', priority: 'medium', estimatedDuration: 1000, reason: '' },
        { id: 't4', type: 'suite', priority: 'medium', estimatedDuration: 1000, reason: '' },
      ];

      const groups = limitedOptimizer.groupForParallel(tests);

      groups.forEach(g => {
        expect(g.testIds.length).toBeLessThanOrEqual(2);
      });

      // 所有测试应该都被分配
      const allGroupedIds = groups.flatMap(g => g.testIds);
      expect(allGroupedIds).toHaveLength(4);
    });
  });

  describe('orderForFailFast', () => {
    it('应该优先排序高失败概率的测试', () => {
      const tests: SelectedTest[] = [
        { id: 't1', type: 'suite', priority: 'low', estimatedDuration: 1000, reason: '' },
        { id: 't2', type: 'suite', priority: 'high', estimatedDuration: 1000, reason: '' },
        { id: 't3', type: 'suite', priority: 'critical', estimatedDuration: 1000, reason: '' },
      ];

      const predictions: TestFailurePrediction[] = [
        { testId: 't1', failureProbability: 0.1, reasons: [], isFlaky: false },
        { testId: 't2', failureProbability: 0.5, reasons: [], isFlaky: false },
        { testId: 't3', failureProbability: 0.8, reasons: [], isFlaky: false },
      ];

      const ordered = optimizer.orderForFailFast(tests, predictions);

      // critical 应该在最前
      expect(ordered[0].id).toBe('t3');
      expect(ordered[0].priority).toBe('critical');
    });

    it('相同优先级时失败概率高的在前', () => {
      const tests: SelectedTest[] = [
        { id: 't1', type: 'suite', priority: 'high', estimatedDuration: 1000, reason: '' },
        { id: 't2', type: 'suite', priority: 'high', estimatedDuration: 1000, reason: '' },
      ];

      const predictions: TestFailurePrediction[] = [
        { testId: 't1', failureProbability: 0.2, reasons: [], isFlaky: false },
        { testId: 't2', failureProbability: 0.9, reasons: [], isFlaky: false },
      ];

      const ordered = optimizer.orderForFailFast(tests, predictions);

      expect(ordered[0].id).toBe('t2');
      expect(ordered[1].id).toBe('t1');
    });

    it('没有预测时应该按优先级排序', () => {
      const tests: SelectedTest[] = [
        { id: 't1', type: 'suite', priority: 'low', estimatedDuration: 500, reason: '' },
        { id: 't2', type: 'suite', priority: 'critical', estimatedDuration: 1000, reason: '' },
        { id: 't3', type: 'suite', priority: 'medium', estimatedDuration: 750, reason: '' },
      ];

      const ordered = optimizer.orderForFailFast(tests);

      expect(ordered[0].priority).toBe('critical');
      expect(ordered[1].priority).toBe('medium');
      expect(ordered[2].priority).toBe('low');
    });
  });
});
