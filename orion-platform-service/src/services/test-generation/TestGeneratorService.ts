/**
 * TestGeneratorService - AI 测试用例生成服务
 *
 * 功能：
 * 1. 分析代码变更（diff）
 * 2. 识别需要测试的函数/类
 * 3. 生成单元测试用例
 * 4. 生成边界测试用例
 * 5. 支持多语言（TypeScript, Python, Go, Java）
 */

import {
  TestGenerationRequest,
  TestGenerationResponse,
  TestGenerationStrategy,
  DEFAULT_TEST_GENERATION_STRATEGY,
  GeneratedTestCase,
  TestSuggestion,
  TestCoverageEstimate,
  CoverageSuggestionRequest,
  CoverageSuggestionResponse,
  TestGenerationRecord,
  TestGeneratorConfig,
  ChangeAnalysisResult,
  TestFramework,
  ProgrammingLanguage,
} from './types';
import { ChangeAnalyzer } from './ChangeAnalyzer';
import { TestTemplateEngine } from './TestTemplateEngine';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { TestGenerationHistoryRepository } from '../../repositories/TestGenerationHistoryRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * AI Gateway 接口（可选注入）
 */
interface AIGatewayInterface {
  execute<T>(request: {
    scenario: string;
    input: Record<string, unknown>;
    options?: Record<string, unknown>;
  }): Promise<{ success: boolean; data?: T; confidence?: number; error?: string }>;
}

/**
 * 默认测试生成器配置
 */
const DEFAULT_TEST_GENERATOR_CONFIG: TestGeneratorConfig = {
  defaultStrategy: DEFAULT_TEST_GENERATION_STRATEGY,
  maxTestsPerGeneration: 10,
  enableHistory: true,
};

/**
 * AI 测试生成器服务
 */
export class TestGeneratorService {
  private config: TestGeneratorConfig;
  private changeAnalyzer: ChangeAnalyzer;
  private templateEngine: TestTemplateEngine;
  private aiGateway?: AIGatewayInterface;
  private history: Map<string, TestGenerationRecord> = new Map();
  private historyRepo?: TestGenerationHistoryRepository;

  constructor(config: Partial<TestGeneratorConfig> = {}, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.config = { ...DEFAULT_TEST_GENERATOR_CONFIG, ...config };
    this.changeAnalyzer = new ChangeAnalyzer();
    this.templateEngine = new TestTemplateEngine();
    this.aiGateway = config.aiGateway;
    if (db) {
      this.historyRepo = new TestGenerationHistoryRepository(db);
    }
  }

  /**
   * 设置 AI Gateway
   */
  setAIGateway(gateway: AIGatewayInterface): void {
    this.aiGateway = gateway;
  }

  /**
   * 生成测试用例
   *
   * @param request 测试生成请求
   * @returns 测试生成响应
   */
  async generateTests(request: TestGenerationRequest): Promise<TestGenerationResponse> {
    const generationId = `gen-${uuidv4().substring(0, 8)}`;
    const startTime = Date.now();

    // 合并策略配置
    const strategy: TestGenerationStrategy = {
      ...DEFAULT_TEST_GENERATION_STRATEGY,
      ...request.strategy,
    };

    logger.info({
      msg: 'Starting test generation',
      generationId,
      filePath: request.change.filePath,
      language: request.change.language,
    });

    // 1. 分析代码变更
    const analysis = await this.changeAnalyzer.analyzeChange(
      request.change.diff,
      request.change.filePath,
      request.change.language,
      request.change.fileContent
    );

    logger.info({
      msg: 'Change analysis completed',
      generationId,
      symbolCount: analysis.changedSymbols.length,
      complexityScore: analysis.impactScope.complexityScore,
    });

    // 2. 生成测试用例
    const tests = await this.generateTestCases(
      analysis,
      strategy,
      request.targetFramework,
      request.existingTests
    );

    // 3. 生成测试建议
    const suggestions = await this.generateSuggestions(analysis, strategy);

    // 4. 计算生成耗时
    const generationTime = Date.now() - startTime;

    // 5. 保存历史记录
    if (this.config.enableHistory) {
      const record: TestGenerationRecord = {
        id: generationId,
        prId: request.prId,
        filePath: request.change.filePath,
        language: request.change.language,
        generatedAt: new Date().toISOString(),
        testCount: tests.length,
        adopted: false,
      };
      this.history.set(generationId, record);
    }

    logger.info({
      msg: 'Test generation completed',
      generationId,
      testCount: tests.length,
      suggestionCount: suggestions.length,
      generationTime,
    });

    return {
      tests,
      suggestions,
      generationTime,
      modelUsage: {
        model: strategy.model,
        tokensUsed: this.estimateTokensUsed(analysis, tests),
        temperature: strategy.temperature,
      },
      generationId,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 分析代码变更
   *
   * @param diff Git diff 内容
   * @param filePath 文件路径
   * @param language 编程语言
   * @returns 变更分析结果
   */
  async analyzeChange(
    diff: string,
    filePath: string,
    language: ProgrammingLanguage
  ): Promise<ChangeAnalysisResult> {
    return this.changeAnalyzer.analyzeChange(diff, filePath, language);
  }

  /**
   * 建议覆盖率改进
   *
   * @param request 覆盖率改进请求
   * @returns 覆盖率改进响应
   */
  async suggestCoverageImprovements(
    request: CoverageSuggestionRequest
  ): Promise<CoverageSuggestionResponse> {
    logger.info({
      msg: 'Analyzing coverage improvements',
      sourceFile: request.sourceFile,
      currentCoverage: request.currentCoverage,
    });

    // 生成覆盖率改进建议
    const suggestions: TestSuggestion[] = [];

    // 如果行覆盖率低，建议更多单元测试
    if (request.currentCoverage.lines < 80) {
      suggestions.push({
        type: 'edge_case',
        description: 'Add more unit tests to cover all code paths',
        priority: 'high',
        codeLocation: request.sourceFile,
      });
    }

    // 如果分支覆盖率低，建议边界测试
    if (request.currentCoverage.branches < 70) {
      suggestions.push({
        type: 'edge_case',
        description: 'Add boundary tests to cover all conditional branches',
        priority: 'high',
        codeLocation: request.sourceFile,
      });
    }

    // 如果函数覆盖率低，建议集成测试
    if (request.currentCoverage.functions < 60) {
      suggestions.push({
        type: 'integration',
        description: 'Add integration tests for uncovered functions',
        priority: 'medium',
        codeLocation: request.sourceFile,
      });
    }

    // 如果提供了未覆盖的行，针对性建议
    if (request.uncoveredLines && request.uncoveredLines.length > 0) {
      suggestions.push({
        type: 'edge_case',
        description: `Add tests to cover lines: ${request.uncoveredLines.slice(0, 10).join(', ')}`,
        priority: 'high',
        codeLocation: `${request.sourceFile}:${request.uncoveredLines[0]}`,
      });
    }

    // 预估覆盖率提升
    const estimatedImprovement: TestCoverageEstimate = {
      lines: Math.min(request.currentCoverage.lines + 20, 95),
      branches: Math.min(request.currentCoverage.branches + 15, 90),
      functions: Math.min(request.currentCoverage.functions + 10, 85),
    };

    // 生成推荐的测试用例
    const recommendedTests: GeneratedTestCase[] = [];

    if (request.sourceContent) {
      // 分析源代码并生成测试
      const mockDiff = `+++ ${request.sourceFile}\n${request.sourceContent.split('\n').map(l => `+${l}`).join('\n')}`;
      const analysis = await this.changeAnalyzer.analyzeChange(
        mockDiff,
        request.sourceFile,
        request.language,
        request.sourceContent
      );

      // 为未覆盖的符号生成测试
      for (const symbol of analysis.changedSymbols.slice(0, 3)) {
        const testCode = this.templateEngine.generateTestCode(symbol, request.sourceFile);
        recommendedTests.push({
          testFile: this.getTestFilePath(request.sourceFile, request.language),
          testCode,
          coverage: {
            lines: 30,
            branches: 20,
            functions: 40,
          },
          explanation: `Basic test for ${symbol.name}`,
          testType: 'unit',
          priority: 'medium',
        });
      }
    }

    return {
      suggestions,
      estimatedImprovement,
      recommendedTests,
    };
  }

  /**
   * 获取测试模板列表
   *
   * @returns 测试模板列表
   */
  getTemplates(): Array<{
    language: ProgrammingLanguage;
    framework: TestFramework;
    templates: Array<{ name: string; description: string }>;
  }> {
    const allTemplates = this.templateEngine.getAllTemplates();

    // 按语言和框架分组
    const grouped = new Map<string, Array<{ name: string; description: string }>>();

    for (const template of allTemplates) {
      const key = `${template.language}-${template.framework}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push({
        name: template.name,
        description: template.description,
      });
    }

    // 转换为输出格式
    const result: Array<{
      language: ProgrammingLanguage;
      framework: TestFramework;
      templates: Array<{ name: string; description: string }>;
    }> = [];

    for (const [key, templates] of Array.from(grouped)) {
      const [language, framework] = key.split('-') as [ProgrammingLanguage, TestFramework];
      result.push({
        language,
        framework,
        templates,
      });
    }

    return result;
  }

  /**
   * 获取生成历史
   */
  getGenerationHistory(): TestGenerationRecord[] {
    return Array.from(this.history.values());
  }

  /**
   * 标记测试被采纳
   */
  markAsAdopted(generationId: string): void {
    const record = this.history.get(generationId);
    if (record) {
      record.adopted = true;
      record.adoptedAt = new Date().toISOString();
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 生成测试用例
   */
  private async generateTestCases(
    analysis: ChangeAnalysisResult,
    strategy: TestGenerationStrategy,
    targetFramework?: TestFramework,
    existingTests?: string
  ): Promise<GeneratedTestCase[]> {
    const tests: GeneratedTestCase[] = [];

    // 筛选需要测试的符号
    const symbolsToTest = analysis.changedSymbols.filter(s => !s.isDeleted);

    // 限制最大测试数
    const maxSymbols = Math.min(symbolsToTest.length, this.config.maxTestsPerGeneration);

    for (let i = 0; i < maxSymbols; i++) {
      const symbol = symbolsToTest[i];

      // 生成单元测试
      if (strategy.unitTests) {
        const unitTest = this.generateUnitTest(symbol, analysis, targetFramework);
        tests.push(unitTest);
      }

      // 生成边界测试
      if (strategy.edgeCaseTests && symbol.parameters && symbol.parameters.length > 0) {
        const edgeCaseTest = this.generateEdgeCaseTest(symbol, analysis, targetFramework);
        tests.push(edgeCaseTest);
      }
    }

    // 如果启用了 AI 增强，使用 AI 优化测试
    if (this.aiGateway && tests.length > 0) {
      tests.push(...await this.enhanceWithAI(analysis, strategy, tests));
    }

    return tests;
  }

  /**
   * 生成单元测试
   */
  private generateUnitTest(
    symbol: ChangeAnalysisResult['changedSymbols'][0],
    analysis: ChangeAnalysisResult,
    targetFramework?: TestFramework
  ): GeneratedTestCase {
    const framework = targetFramework || this.templateEngine.getRecommendedFramework(analysis.language);
    const testCode = this.templateEngine.generateTestCode(symbol, analysis.filePath, framework);

    return {
      testFile: this.getTestFilePath(analysis.filePath, analysis.language),
      testCode,
      coverage: this.estimateCoverage(symbol),
      explanation: `Unit test for ${symbol.type} ${symbol.name}`,
      testType: 'unit',
      priority: symbol.isNew ? 'high' : 'medium',
    };
  }

  /**
   * 生成边界测试
   */
  private generateEdgeCaseTest(
    symbol: ChangeAnalysisResult['changedSymbols'][0],
    analysis: ChangeAnalysisResult,
    targetFramework?: TestFramework
  ): GeneratedTestCase {
    const framework = targetFramework || this.templateEngine.getRecommendedFramework(analysis.language);

    // 构建边界测试上下文
    const edgeCases = this.generateEdgeCases(symbol);

    const testCode = this.templateEngine.generateTestCode(
      { ...symbol, name: `${symbol.name} - Edge Cases` },
      analysis.filePath,
      framework
    );

    // 添加边界测试内容
    const enhancedCode = `${testCode}

describe('${symbol.name} - Edge Cases', () => {
${edgeCases.map(ec => `  it('${ec.description}', () => {
    // ${ec.testName}
    expect(() => ${symbol.name}(${ec.params})).${ec.expectation};
  });`).join('\n')}
});`;

    return {
      testFile: this.getTestFilePath(analysis.filePath, analysis.language),
      testCode: enhancedCode,
      coverage: {
        lines: 10,
        branches: 20,
        functions: 5,
      },
      explanation: `Edge case tests for ${symbol.name}`,
      testType: 'edge_case',
      priority: 'medium',
    };
  }

  /**
   * 生成边界测试场景
   */
  private generateEdgeCases(symbol: ChangeAnalysisResult['changedSymbols'][0]): Array<{
    description: string;
    testName: string;
    params: string;
    expectation: string;
  }> {
    const cases: Array<{
      description: string;
      testName: string;
      params: string;
      expectation: string;
    }> = [];

    if (!symbol.parameters) return cases;

    for (const param of symbol.parameters) {
      // 空值测试
      cases.push({
        description: `should handle null/undefined for ${param.name}`,
        testName: `test_${param.name}_null`,
        params: 'null',
        expectation: 'toThrow()',
      });

      // 类型错误测试
      cases.push({
        description: `should reject wrong type for ${param.name}`,
        testName: `test_${param.name}_wrong_type`,
        params: '"wrong_type"',
        expectation: 'toThrow(TypeError)',
      });

      // 边界值测试（数字类型）
      if (param.type === 'number' || param.type === 'int' || param.type === 'float') {
        cases.push({
          description: `should handle zero for ${param.name}`,
          testName: `test_${param.name}_zero`,
          params: '0',
          expectation: 'toBeDefined()',
        });

        cases.push({
          description: `should handle negative for ${param.name}`,
          testName: `test_${param.name}_negative`,
          params: '-1',
          expectation: 'toBeDefined()',
        });
      }

      // 空字符串测试（字符串类型）
      if (param.type === 'string') {
        cases.push({
          description: `should handle empty string for ${param.name}`,
          testName: `test_${param.name}_empty`,
          params: "''",
          expectation: 'toBeDefined()',
        });
      }
    }

    return cases;
  }

  /**
   * 使用 AI 增强测试
   */
  private async enhanceWithAI(
    analysis: ChangeAnalysisResult,
    strategy: TestGenerationStrategy,
    existingTests: GeneratedTestCase[]
  ): Promise<GeneratedTestCase[]> {
    if (!this.aiGateway) return [];

    try {
      const response = await this.aiGateway.execute<string>({
        scenario: 'test-generation',
        input: {
          prompt: `Analyze the following code changes and suggest additional test cases:\n\nFile: ${analysis.filePath}\n\nSymbols changed:\n${analysis.changedSymbols.map(s => `- ${s.type} ${s.name}: ${s.signature}`).join('\n')}\n\nExisting tests:\n${existingTests.map(t => t.explanation).join('\n')}\n\nProvide 3 additional high-priority test cases that are missing.`,
          language: analysis.language,
          strategy,
        },
        options: {
          temperature: strategy.temperature,
          maxTokens: 1000,
        },
      });

      if (response.success && response.data) {
        // 解析 AI 响应，生成测试用例
        // 这里简化处理，实际需要解析 AI 返回的结构化内容
        logger.info({
          msg: 'AI enhancement completed',
          confidence: response.confidence,
        });
      }
    } catch (error) {
      logger.warn({
        msg: 'AI enhancement failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return [];
  }

  /**
   * 生成测试建议
   */
  private async generateSuggestions(
    analysis: ChangeAnalysisResult,
    strategy: TestGenerationStrategy
  ): Promise<TestSuggestion[]> {
    const suggestions: TestSuggestion[] = [];

    // 基于变更分析生成建议
    for (const symbol of analysis.changedSymbols) {
      // 新增的复杂符号建议集成测试
      if (symbol.isNew && symbol.type === 'class') {
        suggestions.push({
          type: 'integration',
          description: `Add integration tests for new class ${symbol.name}`,
          priority: 'high',
          codeLocation: `${analysis.filePath}:${symbol.lineRange.start}`,
          suggestedTestName: `Test${symbol.name}Integration`,
        });
      }

      // 修改的方法建议回归测试
      if (symbol.isModified) {
        suggestions.push({
          type: 'edge_case',
          description: `Add regression tests for modified ${symbol.type} ${symbol.name}`,
          priority: 'high',
          codeLocation: `${analysis.filePath}:${symbol.lineRange.start}`,
        });
      }

      // 异步函数建议错误处理测试
      if (symbol.signature?.includes('async')) {
        suggestions.push({
          type: 'error_case',
          description: `Add error handling tests for async ${symbol.name}`,
          priority: 'medium',
          codeLocation: `${analysis.filePath}:${symbol.lineRange.start}`,
        });
      }
    }

    // 基于复杂度评分的建议
    if (analysis.impactScope.complexityScore > 70) {
      suggestions.push({
        type: 'integration',
        description: 'High complexity change - recommend comprehensive integration tests',
        priority: 'high',
      });
    }

    // 基于风险评分的建议
    if (analysis.impactScope.riskScore > 60) {
      suggestions.push({
        type: 'edge_case',
        description: 'High risk change - add boundary and negative tests',
        priority: 'high',
      });
    }

    return suggestions;
  }

  /**
   * 获取测试文件路径
   */
  private getTestFilePath(sourcePath: string, language: ProgrammingLanguage): string {
    // 移除 src/ 前缀
    let testPath = sourcePath.replace(/^src\//, '');

    // 根据语言调整测试文件路径
    switch (language) {
      case 'typescript':
      case 'javascript':
        // Jest/Vitest convention: src/file.ts -> src/file.test.ts
        testPath = testPath.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
        break;

      case 'python':
        // pytest convention: src/file.py -> tests/test_file.py
        testPath = testPath.replace(/^app\//, 'tests/');
        testPath = testPath.replace(/\.(py)$/, '/test_$1');
        testPath = testPath.replace(/\/([^/]+)\.py$/, '/test_$1.py');
        break;

      case 'go':
        // Go convention: file.go -> file_test.go
        testPath = testPath.replace(/\.(go)$/, '_test.$1');
        break;

      case 'java':
        // JUnit convention: src/main/java/File.java -> src/test/java/FileTest.java
        testPath = testPath.replace(/src\/main\/java/, 'src/test/java');
        testPath = testPath.replace(/\.(java)$/, 'Test.$1');
        break;
    }

    return testPath;
  }

  /**
   * 预估覆盖率
   */
  private estimateCoverage(symbol: ChangeAnalysisResult['changedSymbols'][0]): TestCoverageEstimate {
    // 基础覆盖率
    let lines = 30;
    let branches = 20;
    let functions = 50;

    // 根据符号类型调整
    if (symbol.type === 'function') {
      lines = 40;
      functions = 100;
    } else if (symbol.type === 'class') {
      lines = 20;
      functions = 30;
    }

    // 根据参数数量调整分支覆盖率
    if (symbol.parameters) {
      branches += symbol.parameters.length * 10;
    }

    // 限制最大值
    return {
      lines: Math.min(lines, 80),
      branches: Math.min(branches, 60),
      functions: Math.min(functions, 80),
    };
  }

  /**
   * 预估 Token 使用量
   */
  private estimateTokensUsed(
    analysis: ChangeAnalysisResult,
    tests: GeneratedTestCase[]
  ): number {
    // 简化估算：每行代码约 10 tokens
    const analysisLines = analysis.changes.reduce((sum, c) => sum + c.content.split('\n').length, 0);
    const testLines = tests.reduce((sum, t) => sum + t.testCode.split('\n').length, 0);

    return (analysisLines + testLines) * 10;
  }
}