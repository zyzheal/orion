/**
 * test-selector 模块导出测试
 *
 * 验证 index.ts 正确导出所有公共类和类型
 */

import {
  // 类
  TestDependencyAnalyzer,
  TestImpactAnalyzer,
  TestExecutionOptimizer,
  TestFailurePredictor,
  TestSelectorService,
} from '../index';

// 类型导入（编译时检查）
import type {
  DependencyAnalyzerConfig,
  ImpactAnalysisResult,
  TestHistoryStats,
  TestSelectorServiceConfig,
  EventBusAdapter,
  PRTestResult,
} from '../index';

import type {
  TestSuite,
  TestCase,
  TestDependency,
  TestImpact,
  ImpactPriority,
  TestExecutionPlan,
  SelectedTest,
  SkippedTest,
  TestGroup,
  TestExecutionRecord,
  TestFailurePrediction,
  TestSelectorConfig,
  PRChange,
  ChangedFile,
  TestCodeMapping,
  ApiResponse,
} from '../index';

describe('test-selector 模块导出', () => {
  // ==================== 类导出 ====================

  describe('类导出', () => {
    it('应该导出 TestDependencyAnalyzer', () => {
      expect(TestDependencyAnalyzer).toBeDefined();
      expect(typeof TestDependencyAnalyzer).toBe('function');
    });

    it('应该导出 TestImpactAnalyzer', () => {
      expect(TestImpactAnalyzer).toBeDefined();
      expect(typeof TestImpactAnalyzer).toBe('function');
    });

    it('应该导出 TestExecutionOptimizer', () => {
      expect(TestExecutionOptimizer).toBeDefined();
      expect(typeof TestExecutionOptimizer).toBe('function');
    });

    it('应该导出 TestFailurePredictor', () => {
      expect(TestFailurePredictor).toBeDefined();
      expect(typeof TestFailurePredictor).toBe('function');
    });

    it('应该导出 TestSelectorService', () => {
      expect(TestSelectorService).toBeDefined();
      expect(typeof TestSelectorService).toBe('function');
    });
  });

  // ==================== 类型导出编译验证 ====================

  describe('类型导出编译验证', () => {
    it('TestSuite 类型应可用', () => {
      // 运行时类型检查通过编译验证
      const suite: TestSuite = {
        id: 'test',
        name: 'test',
        filePath: '/test',
        testCount: 1,
        avgDuration: 100,
        passRate: 1,
        lastRun: '2024-01-01',
        sourceFiles: [],
      };
      expect(suite).toBeDefined();
    });

    it('ImpactPriority 类型应支持所有值', () => {
      const priorities: ImpactPriority[] = ['critical', 'high', 'medium', 'low'];
      expect(priorities).toHaveLength(4);
    });

    it('TestSelectorConfig 类型应支持空配置', () => {
      const config: TestSelectorConfig = {};
      expect(config).toBeDefined();
    });

    it('ApiResponse 类型应支持泛型', () => {
      const successResponse: ApiResponse<string> = {
        success: true,
        data: 'test',
        timestamp: '2024-01-01',
      };
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: 'error',
        timestamp: '2024-01-01',
      };
      expect(successResponse.success).toBe(true);
      expect(errorResponse.success).toBe(false);
    });
  });

  // ==================== 实例化验证 ====================

  describe('实例化验证', () => {
    it('TestDependencyAnalyzer 应该有 analyzeTestDependencies 方法', () => {
      const mockPool = { query: jest.fn() };
      const analyzer = new TestDependencyAnalyzer({
        sourceRoot: '/src',
        testRoot: '/test',
      }, mockPool as any);

      expect(analyzer).toBeDefined();
      expect(analyzer.analyzeTestDependencies).toBeDefined();
      expect(typeof analyzer.analyzeTestDependencies).toBe('function');
    });

    it('TestFailurePredictor 应该有 predictFailure 方法', () => {
      const mockPool = { query: jest.fn() };
      const predictor = new TestFailurePredictor(mockPool as any);

      expect(predictor).toBeDefined();
      expect(predictor.predictFailure).toBeDefined();
      expect(typeof predictor.predictFailure).toBe('function');
    });

    it('TestImpactAnalyzer 应该有 analyzeImpact 方法', () => {
      const mockPool = { query: jest.fn() };
      const depAnalyzer = new TestDependencyAnalyzer({
        sourceRoot: '/src',
        testRoot: '/test',
      }, mockPool as any);
      const analyzer = new TestImpactAnalyzer(depAnalyzer);

      expect(analyzer).toBeDefined();
      expect(analyzer.analyzeImpact).toBeDefined();
      expect(typeof analyzer.analyzeImpact).toBe('function');
    });

    it('TestExecutionOptimizer 应该有 optimizeExecution 方法', () => {
      const mockPool = { query: jest.fn() };
      const depAnalyzer = new TestDependencyAnalyzer({
        sourceRoot: '/src',
        testRoot: '/test',
      }, mockPool as any);
      const impactAnalyzer = new TestImpactAnalyzer(depAnalyzer);
      const failurePredictor = new TestFailurePredictor(mockPool as any);
      const optimizer = new TestExecutionOptimizer(impactAnalyzer, failurePredictor);

      expect(optimizer).toBeDefined();
      expect(optimizer.optimizeExecution).toBeDefined();
      expect(typeof optimizer.optimizeExecution).toBe('function');
    });

    it('TestSelectorService 应该有 selectTestsForPR 方法', () => {
      const mockPool = { query: jest.fn() };
      const service = new TestSelectorService({
        analyzerConfig: {
          sourceRoot: '/src',
          testRoot: '/test',
        },
      }, mockPool as any);

      expect(service).toBeDefined();
      expect(service.selectTestsForPR).toBeDefined();
      expect(typeof service.selectTestsForPR).toBe('function');
    });

    it('TestSelectorService 应该有 initialize 方法', () => {
      const mockPool = { query: jest.fn() };
      const service = new TestSelectorService({
        analyzerConfig: {
          sourceRoot: '/src',
          testRoot: '/test',
        },
      }, mockPool as any);

      expect(service.initialize).toBeDefined();
      expect(typeof service.initialize).toBe('function');
    });
  });
});
