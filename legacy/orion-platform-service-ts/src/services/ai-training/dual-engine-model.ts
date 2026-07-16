/**
 * Dual-Engine 数据模型
 *
 * 定义 AST 静态分析引擎和 LLM 智能解析引擎的数据结构
 */

// AST 静态分析引擎配置
export interface AstAnalysisConfig {
  // 支持的编程语言
  supportedLanguages: string[];
  // 解析超时时间(ms)
  parseTimeout: number;
  // 是否启用增量解析
  incrementalParsing: boolean;
  // 解析深度限制
  maxDepth: number;
}

// LLM 智能解析引擎配置
export interface LlmParsingConfig {
  // 使用的 LLM 模型
  model: string;
  // 温度参数
  temperature: number;
  // 最大 token 数
  maxTokens: number;
  // 是否启用上下文学习
  contextLearning: boolean;
  // 上下文窗口大小
  contextWindowSize: number;
}

// 双引擎配置
export interface DualEngineConfig {
  id: string;
  tenantId: string;
  // 引擎名称
  name: string;
  // 引擎描述
  description: string;
  // AST 静态分析引擎配置
  astConfig: AstAnalysisConfig;
  // LLM 智能解析引擎配置
  llmConfig: LlmParsingConfig;
  // 引擎状态
  status: 'active' | 'inactive' | 'error';
  // 创建时间
  createdAt: Date;
  // 更新时间
  updatedAt: Date;
}

// 代码分析结果
export interface CodeAnalysisResult {
  id: string;
  // 引擎 ID
  engineId: string;
  // 代码文件路径
  filePath: string;
  // AST 分析结果
  astResult: AstAnalysisResult;
  // LLM 分析结果
  llmResult: LlmAnalysisResult;
  // 合并后的分析结果
  mergedResult: MergedAnalysisResult;
  // 分析状态
  status: 'pending' | 'processing' | 'completed' | 'failed';
  // 创建时间
  createdAt: Date;
}

// AST 分析结果
export interface AstAnalysisResult {
  // 解析的语法树节点数
  nodeCount: number;
  // 函数列表
  functions: AstFunction[];
  // 类列表
  classes: AstClass[];
  // 导入列表
  imports: string[];
  // 语法错误列表
  syntaxErrors: string[];
  // 复杂度指标
  complexity: ComplexityMetrics;
}

// AST 函数信息
export interface AstFunction {
  name: string;
  startLine: number;
  endLine: number;
  parameters: string[];
  returnType: string;
  complexity: number;
}

// AST 类信息
export interface AstClass {
  name: string;
  startLine: number;
  endLine: number;
  methods: AstFunction[];
  properties: string[];
  parentClass: string | null;
}

// 复杂度指标
export interface ComplexityMetrics {
  // 圈复杂度
  cyclomaticComplexity: number;
  // 认知复杂度
  cognitiveComplexity: number;
  // 代码行数
  linesOfCode: number;
  // 注释比例
  commentRatio: number;
}

// LLM 分析结果
export interface LlmAnalysisResult {
  // 代码摘要
  summary: string;
  // 代码意图
  intent: string;
  // 潜在问题
  potentialIssues: string[];
  // 改进建议
  suggestions: string[];
  // 代码质量评分
  qualityScore: number;
  // 置信度
  confidence: number;
}

// 合并后的分析结果
export interface MergedAnalysisResult {
  // 综合代码质量评分
  overallQualityScore: number;
  // 关键发现
  keyFindings: string[];
  // 风险评估
  riskAssessment: RiskAssessment;
  // 优化建议
  optimizationSuggestions: OptimizationSuggestion[];
}

// 风险评估
export interface RiskAssessment {
  // 风险等级
  level: 'low' | 'medium' | 'high' | 'critical';
  // 风险描述
  description: string;
  // 风险因素
  factors: string[];
}

// 优化建议
export interface OptimizationSuggestion {
  // 建议类型
  type: 'performance' | 'readability' | 'security' | 'maintainability';
  // 优先级
  priority: 'low' | 'medium' | 'high';
  // 描述
  description: string;
  // 预期收益
  expectedBenefit: string;
}

// 双引擎运行状态
export interface DualEngineStatus {
  // 引擎 ID
  engineId: string;
  // AST 引擎状态
  astStatus: 'idle' | 'processing' | 'error';
  // LLM 引擎状态
  llmStatus: 'idle' | 'processing' | 'error';
  // 当前处理文件数
  currentProcessingFiles: number;
  // 已处理文件数
  processedFiles: number;
  // 错误文件数
  errorFiles: number;
  // 最后更新时间
  lastUpdatedAt: Date;
}
