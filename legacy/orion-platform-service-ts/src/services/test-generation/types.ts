/**
 * Test Generation 类型定义
 *
 * AI 测试用例生成服务 - 基于代码变更自动生成单元测试和冒烟测试
 */

/**
 * 测试生成策略配置
 */
export interface TestGenerationStrategy {
  // 测试类型
  unitTests: boolean;        // 单元测试
  integrationTests: boolean; // 集成测试
  edgeCaseTests: boolean;    // 边界测试

  // 生成选项
  coverageTarget: number;    // 目标覆盖率 (0-100)
  includeMocking: boolean;   // 自动生成 Mock
  includeAssertions: boolean; // 自动生成断言

  // AI 配置
  model: string;             // AI 模型名称
  temperature: number;       // 生成温度 (0-1)
  maxTokens: number;         // 最大 Token 数
}

/**
 * 默认测试生成策略
 */
export const DEFAULT_TEST_GENERATION_STRATEGY: TestGenerationStrategy = {
  unitTests: true,
  integrationTests: false,
  edgeCaseTests: true,
  coverageTarget: 80,
  includeMocking: true,
  includeAssertions: true,
  model: 'gpt-4',
  temperature: 0.3,
  maxTokens: 4000,
};

/**
 * 代码变更信息
 */
export interface CodeChange {
  /** Git diff 内容 */
  diff: string;
  /** 文件路径 */
  filePath: string;
  /** 编程语言 */
  language: ProgrammingLanguage;
  /** 文件内容（可选，用于更准确的分析） */
  fileContent?: string;
}

/**
 * 支持的编程语言
 */
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'java';

/**
 * 测试框架映射
 */
export const TEST_FRAMEWORK_MAP: Record<ProgrammingLanguage, TestFramework[]> = {
  typescript: ['jest', 'vitest', 'mocha'],
  javascript: ['jest', 'mocha', 'jasmine'],
  python: ['pytest', 'unittest'],
  go: ['go-testing'],
  java: ['junit5', 'junit4'],
};

/**
 * 测试框架类型
 */
export type TestFramework =
  | 'jest'
  | 'vitest'
  | 'mocha'
  | 'jasmine'
  | 'pytest'
  | 'unittest'
  | 'go-testing'
  | 'junit5'
  | 'junit4';

/**
 * 测试生成请求
 */
export interface TestGenerationRequest {
  /** 代码变更信息 */
  change: CodeChange;
  /** 测试生成策略（可选，使用默认策略） */
  strategy?: Partial<TestGenerationStrategy>;
  /** 现有测试代码（可选，用于增量生成） */
  existingTests?: string;
  /** 目标测试框架（可选） */
  targetFramework?: TestFramework;
  /** PR ID（可选，用于关联） */
  prId?: string;
}

/**
 * 生成的测试用例
 */
export interface GeneratedTestCase {
  /** 测试文件路径 */
  testFile: string;
  /** 测试代码 */
  testCode: string;
  /** 预估覆盖率 */
  coverage: TestCoverageEstimate;
  /** 测试说明 */
  explanation: string;
  /** 测试类型 */
  testType: 'unit' | 'integration' | 'edge_case';
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
}

/**
 * 测试覆盖率预估
 */
export interface TestCoverageEstimate {
  /** 行覆盖率预估 */
  lines: number;
  /** 分支覆盖率预估 */
  branches: number;
  /** 函数覆盖率预估 */
  functions: number;
}

/**
 * 测试改进建议
 */
export interface TestSuggestion {
  /** 建议类型 */
  type: 'edge_case' | 'error_case' | 'integration' | 'performance' | 'security';
  /** 建议描述 */
  description: string;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 相关代码位置 */
  codeLocation?: string;
  /** 建议的测试名称 */
  suggestedTestName?: string;
}

/**
 * 测试生成响应
 */
export interface TestGenerationResponse {
  /** 生成的测试用例列表 */
  tests: GeneratedTestCase[];
  /** 测试改进建议 */
  suggestions: TestSuggestion[];
  /** 生成耗时（毫秒） */
  generationTime: number;
  /** AI 模型使用情况 */
  modelUsage: {
    model: string;
    tokensUsed: number;
    temperature: number;
  };
  /** 生成 ID */
  generationId: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 变更分析结果
 */
export interface ChangeAnalysisResult {
  /** 文件路径 */
  filePath: string;
  /** 语言 */
  language: ProgrammingLanguage;
  /** 变更类型列表 */
  changes: AnalyzedChange[];
  /** 变更的函数/类列表 */
  changedSymbols: ChangedSymbol[];
  /** 变更影响范围 */
  impactScope: ChangeImpactScope;
  /** 分析 ID */
  analysisId: string;
  /** 分析时间 */
  analyzedAt: string;
}

/**
 * 分析后的单个变更
 */
export interface AnalyzedChange {
  /** 变更类型 */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 变更内容 */
  content: string;
  /** 关联的符号（函数/类名） */
  relatedSymbol?: string;
}

/**
 * 变更的符号（函数/类）
 */
export interface ChangedSymbol {
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  type: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable';
  /** 签名信息 */
  signature?: string;
  /** 参数列表 */
  parameters?: ParameterInfo[];
  /** 返回类型 */
  returnType?: string;
  /** 是否新增 */
  isNew: boolean;
  /** 是否修改 */
  isModified: boolean;
  /** 是否删除 */
  isDeleted: boolean;
  /** 行号范围 */
  lineRange: {
    start: number;
    end: number;
  };
  /** 测试建议 */
  testRecommendations: string[];
}

/**
 * 参数信息
 */
export interface ParameterInfo {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: string;
  /** 是否可选 */
  optional: boolean;
  /** 默认值 */
  defaultValue?: string;
}

/**
 * 变更影响范围
 */
export interface ChangeImpactScope {
  /** 直接影响的文件 */
  directFiles: string[];
  /** 可能间接影响的文件 */
  indirectFiles: string[];
  /** 需要测试的函数/类 */
  symbolsToTest: string[];
  /** 复杂度评分 (0-100) */
  complexityScore: number;
  /** 风险评分 (0-100) */
  riskScore: number;
}

/**
 * 测试模板
 */
export interface TestTemplate {
  /** 模板名称 */
  name: string;
  /** 适用语言 */
  language: ProgrammingLanguage;
  /** 适用框架 */
  framework: TestFramework;
  /** 模板内容 */
  template: string;
  /** 模板变量列表 */
  variables: TemplateVariable[];
  /** 模板描述 */
  description: string;
}

/**
 * 模板变量
 */
export interface TemplateVariable {
  /** 变量名称 */
  name: string;
  /** 变量类型 */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** 是否必需 */
  required: boolean;
  /** 默认值 */
  defaultValue?: unknown;
  /** 描述 */
  description: string;
}

/**
 * 覆盖率改进建议请求
 */
export interface CoverageSuggestionRequest {
  /** 源文件路径 */
  sourceFile: string;
  /** 语言 */
  language: ProgrammingLanguage;
  /** 当前覆盖率 */
  currentCoverage: TestCoverageEstimate;
  /** 未覆盖的代码行（可选） */
  uncoveredLines?: number[];
  /** 源代码内容（可选） */
  sourceContent?: string;
}

/**
 * 覆盖率改进建议响应
 */
export interface CoverageSuggestionResponse {
  /** 建议列表 */
  suggestions: TestSuggestion[];
  /** 预估覆盖率提升 */
  estimatedImprovement: TestCoverageEstimate;
  /** 建议生成的测试用例 */
  recommendedTests: GeneratedTestCase[];
}

/**
 * 测试生成历史记录
 */
export interface TestGenerationRecord {
  /** 记录 ID */
  id: string;
  /** PR ID（可选） */
  prId?: string;
  /** 文件路径 */
  filePath: string;
  /** 语言 */
  language: ProgrammingLanguage;
  /** 生成时间 */
  generatedAt: string;
  /** 生成的测试数量 */
  testCount: number;
  /** 是否被采纳 */
  adopted: boolean;
  /** 采纳时间（可选） */
  adoptedAt?: string;
  /** 实际覆盖率（可选，执行后更新） */
  actualCoverage?: TestCoverageEstimate;
}

/**
 * AI 测试生成器配置
 */
export interface TestGeneratorConfig {
  /** 默认策略 */
  defaultStrategy: TestGenerationStrategy;
  /** 模板目录 */
  templateDir?: string;
  /** 最大生成测试数 */
  maxTestsPerGeneration: number;
  /** 是否启用历史记录 */
  enableHistory: boolean;
  /** AI Gateway 实例（可选） */
  aiGateway?: any;
}