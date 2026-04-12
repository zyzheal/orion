/**
 * Test Selector 模块导出
 *
 * 智能测试选择器 - 用于分析测试依赖、评估变更影响、优化测试执行策略
 */

export { TestDependencyAnalyzer } from './TestDependencyAnalyzer';
export type { DependencyAnalyzerConfig } from './TestDependencyAnalyzer';

export { TestImpactAnalyzer } from './TestImpactAnalyzer';
export type { ImpactAnalysisResult } from './TestImpactAnalyzer';

export { TestExecutionOptimizer } from './TestExecutionOptimizer';

export { TestFailurePredictor } from './TestFailurePredictor';
export type { TestHistoryStats } from './TestFailurePredictor';

export { TestSelectorService } from './TestSelectorService';
export type {
  TestSelectorServiceConfig,
  EventBusAdapter,
  PRTestResult,
} from './TestSelectorService';

export type {
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
} from './types';
