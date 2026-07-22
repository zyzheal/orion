/**
 * Test Selector 类型定义
 *
 * 智能测试选择器 - 用于分析测试依赖、评估变更影响、优化测试执行策略
 */

/**
 * 测试套件 - 代表一个测试文件（如 *.test.ts）
 */
export interface TestSuite {
  /** 唯一标识 */
  id: string;
  /** 套件名称 */
  name: string;
  /** 测试文件路径 */
  filePath: string;
  /** 包含的测试用例数量 */
  testCount: number;
  /** 平均执行时长（毫秒） */
  avgDuration: number;
  /** 历史通过率 (0-1) */
  passRate: number;
  /** 最后执行时间 */
  lastRun: string;
  /** 关联的源文件路径列表 */
  sourceFiles: string[];
}

/**
 * 测试用例 - 代表单个测试（如 it/describe 块）
 */
export interface TestCase {
  /** 唯一标识 */
  id: string;
  /** 所属套件 ID */
  suiteId: string;
  /** 测试名称 */
  name: string;
  /** 测试文件路径 */
  filePath: string;
  /** 依赖的源文件/函数列表 */
  dependencies: TestDependency[];
  /** 平均执行时长（毫秒） */
  avgDuration: number;
  /** 抖动评分 (0-100, 越高越不稳定) */
  flakyScore: number;
  /** 历史执行记录 */
  history: TestExecutionRecord[];
}

/**
 * 测试到代码的依赖关系
 */
export interface TestDependency {
  /** 依赖的源文件路径 */
  filePath: string;
  /** 依赖的具体函数/类/方法（可选） */
  symbol?: string;
  /** 依赖类型 */
  type: 'import' | 'require' | 'dynamic';
}

/**
 * 测试影响分析结果
 */
export interface TestImpact {
  /** 变更的文件路径 */
  changedFile: string;
  /** 变更类型 */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** 受影响的测试 ID 列表 */
  affectedTests: string[];
  /** 影响优先级 (critical/high/medium/low) */
  priority: ImpactPriority;
  /** 预估执行总时长（毫秒） */
  estimatedDuration: number;
  /** 影响评分 (0-100) */
  impactScore: number;
}

/**
 * 影响优先级
 */
export type ImpactPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 测试执行计划
 */
export interface TestExecutionPlan {
  /** 需要执行的测试 */
  selectedTests: SelectedTest[];
  /** 可以跳过的测试 */
  skippedTests: SkippedTest[];
  /** 预估总执行时长（毫秒） */
  estimatedDuration: number;
  /** 并行分组 */
  grouping: TestGroup[];
  /** 执行顺序策略 */
  ordering: 'fail-fast' | 'balanced' | 'coverage-first';
  /** 计划 ID */
  planId: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 选中的测试
 */
export interface SelectedTest {
  /** 测试 ID */
  id: string;
  /** 测试类型 (suite 或 case) */
  type: 'suite' | 'case';
  /** 优先级 */
  priority: ImpactPriority;
  /** 预估时长 */
  estimatedDuration: number;
  /** 选择原因 */
  reason: string;
}

/**
 * 跳过的测试
 */
export interface SkippedTest {
  /** 测试 ID */
  id: string;
  /** 跳过原因 */
  reason: string;
}

/**
 * 测试并行分组
 */
export interface TestGroup {
  /** 组 ID */
  groupId: string;
  /** 组内测试 ID 列表 */
  testIds: string[];
  /** 预估执行时长（毫秒） */
  estimatedDuration: number;
  /** 并行索引 */
  parallelIndex: number;
}

/**
 * 测试执行记录
 */
export interface TestExecutionRecord {
  /** 执行 ID */
  executionId: string;
  /** 是否通过 */
  passed: boolean;
  /** 执行时长（毫秒） */
  duration: number;
  /** 执行时间 */
  timestamp: string;
  /** 失败信息（如果有） */
  failureMessage?: string;
  /** 关联的 PR/变更 ID */
  prId?: string;
}

/**
 * PR 变更信息
 */
export interface PRChange {
  /** PR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** 源分支 */
  sourceBranch: string;
  /** 目标分支 */
  targetBranch: string;
  /** 变更文件列表 */
  changedFiles: ChangedFile[];
}

/**
 * 变更文件
 */
export interface ChangedFile {
  /** 文件路径 */
  path: string;
  /** 变更类型 */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 变更前的文件路径（重命名时） */
  previousPath?: string;
}

/**
 * 测试失败预测
 */
export interface TestFailurePrediction {
  /** 测试 ID */
  testId: string;
  /** 失败概率 (0-1) */
  failureProbability: number;
  /** 预测原因 */
  reasons: string[];
  /** 是否为抖动测试 */
  isFlaky: boolean;
}

/**
 * 测试选择器配置
 */
export interface TestSelectorConfig {
  /** 最大执行时长限制（毫秒） */
  maxExecutionTimeMs?: number;
  /** 执行顺序策略 */
  ordering?: 'fail-fast' | 'balanced' | 'coverage-first';
  /** 最大并行组数 */
  maxParallelGroups?: number;
  /** 每组最大测试数 */
  maxTestsPerGroup?: number;
  /** 是否跳过抖动测试 */
  skipFlakyTests?: boolean;
  /** 抖动阈值 (0-100) */
  flakyThreshold?: number;
  /** 影响评分阈值 (只选择评分 >= 此值的测试) */
  minImpactScore?: number;
  /** 历史数据保留天数 */
  historyRetentionDays?: number;
}

/**
 * 测试到代码映射
 */
export interface TestCodeMapping {
  /** 测试文件路径 */
  testPath: string;
  /** 映射的源文件列表 */
  sourcePaths: string[];
  /** 导入的符号映射 */
  symbolMapping: Map<string, string[]>;
}

/**
 * API 响应类型
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
