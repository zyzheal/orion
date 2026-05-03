/**
 * Test Generation 服务入口
 *
 * 导出所有测试生成相关服务和类型
 */

export { TestGeneratorService } from './TestGeneratorService';
export { ChangeAnalyzer } from './ChangeAnalyzer';
export { TestTemplateEngine } from './TestTemplateEngine';

export {
  // 类型导出
  TestGenerationStrategy,
  DEFAULT_TEST_GENERATION_STRATEGY,
  CodeChange,
  ProgrammingLanguage,
  TestFramework,
  TEST_FRAMEWORK_MAP,
  TestGenerationRequest,
  GeneratedTestCase,
  TestCoverageEstimate,
  TestSuggestion,
  TestGenerationResponse,
  ChangeAnalysisResult,
  AnalyzedChange,
  ChangedSymbol,
  ChangeImpactScope,
  ParameterInfo,
  TestTemplate,
  TemplateVariable,
  CoverageSuggestionRequest,
  CoverageSuggestionResponse,
  TestGenerationRecord,
  TestGeneratorConfig,
} from './types';