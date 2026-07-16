import { DualEngineRepository } from './dual-engine-repository';
import {
  DualEngineConfig,
  DualEngineStatus,
  CodeAnalysisResult,
  AstAnalysisConfig,
  LlmParsingConfig,
} from './dual-engine-model';

export class DualEngineError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DualEngineError';
  }
}

export class DualEngineService {
  private repository: DualEngineRepository;

  constructor(repository: DualEngineRepository) {
    this.repository = repository;
  }

  /**
   * 创建双引擎配置
   */
  async createDualEngine(
    tenantId: string,
    name: string,
    description: string,
    astConfig: AstAnalysisConfig,
    llmConfig: LlmParsingConfig
  ): Promise<DualEngineConfig> {
    if (!tenantId || !name) {
      throw new DualEngineError('Tenant ID and name required', 'INVALID_INPUT');
    }

    // 验证 AST 配置
    this.validateAstConfig(astConfig);

    // 验证 LLM 配置
    this.validateLlmConfig(llmConfig);

    return this.repository.create(tenantId, name, description, astConfig, llmConfig);
  }

  /**
   * 获取双引擎配置
   */
  async getDualEngine(id: string): Promise<DualEngineConfig> {
    const engine = await this.repository.findById(id);
    if (!engine) {
      throw new DualEngineError(`Dual engine not found: ${id}`, 'NOT_FOUND');
    }
    return engine;
  }

  /**
   * 获取租户下所有双引擎配置
   */
  async listDualEngines(tenantId: string): Promise<DualEngineConfig[]> {
    return this.repository.findAll(tenantId);
  }

  /**
   * 更新双引擎配置
   */
  async updateDualEngine(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      astConfig: AstAnalysisConfig;
      llmConfig: LlmParsingConfig;
      status: 'active' | 'inactive' | 'error';
    }>
  ): Promise<DualEngineConfig> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new DualEngineError(`Dual engine not found: ${id}`, 'NOT_FOUND');
    }

    // 验证配置更新
    if (updates.astConfig) {
      this.validateAstConfig(updates.astConfig);
    }
    if (updates.llmConfig) {
      this.validateLlmConfig(updates.llmConfig);
    }

    const updated = await this.repository.update(id, updates);
    if (!updated) {
      throw new DualEngineError(`Failed to update dual engine: ${id}`, 'UPDATE_FAILED');
    }
    return updated;
  }

  /**
   * 删除双引擎配置
   */
  async deleteDualEngine(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * 获取双引擎运行状态
   */
  async getDualEngineStatus(engineId: string): Promise<DualEngineStatus> {
    const status = await this.repository.getStatus(engineId);
    if (!status) {
      throw new DualEngineError(`Dual engine status not found: ${engineId}`, 'NOT_FOUND');
    }
    return status;
  }

  /**
   * 启动代码分析
   */
  async startAnalysis(
    engineId: string,
    filePaths: string[]
  ): Promise<CodeAnalysisResult[]> {
    const engine = await this.getDualEngine(engineId);

    if (engine.status !== 'active') {
      throw new DualEngineError('Dual engine is not active', 'ENGINE_INACTIVE');
    }

    if (!filePaths || filePaths.length === 0) {
      throw new DualEngineError('File paths required', 'INVALID_INPUT');
    }

    // 更新状态为处理中
    await this.repository.updateStatus(engineId, {
      astStatus: 'processing',
      llmStatus: 'processing',
      currentProcessingFiles: filePaths.length,
    });

    // 模拟分析过程
    const results: CodeAnalysisResult[] = [];
    for (const filePath of filePaths) {
      const result = await this.analyzeFile(engineId, filePath);
      results.push(result);
    }

    // 更新状态为完成
    await this.repository.updateStatus(engineId, {
      astStatus: 'idle',
      llmStatus: 'idle',
      currentProcessingFiles: 0,
      processedFiles: filePaths.length,
    });

    return results;
  }

  /**
   * 分析单个文件
   */
  private async analyzeFile(
    engineId: string,
    filePath: string
  ): Promise<CodeAnalysisResult> {
    // 模拟 AST 分析
    const astResult = {
      nodeCount: 150,
      functions: [
        {
          name: 'main',
          startLine: 1,
          endLine: 50,
          parameters: [],
          returnType: 'void',
          complexity: 5,
        },
      ],
      classes: [],
      imports: ['os', 'sys'],
      syntaxErrors: [],
      complexity: {
        cyclomaticComplexity: 8,
        cognitiveComplexity: 12,
        linesOfCode: 200,
        commentRatio: 0.15,
      },
    };

    // 模拟 LLM 分析
    const llmResult = {
      summary: 'A Python script that processes data',
      intent: 'Data processing and transformation',
      potentialIssues: ['Missing error handling in line 42'],
      suggestions: ['Add type hints for better readability'],
      qualityScore: 7.5,
      confidence: 0.85,
    };

    // 合并结果
    const mergedResult = {
      overallQualityScore: 7.8,
      keyFindings: ['Good code structure', 'Minor error handling issues'],
      riskAssessment: {
        level: 'low' as const,
        description: 'Low risk code with minor issues',
        factors: ['Good test coverage', 'Clear naming conventions'],
      },
      optimizationSuggestions: [
        {
          type: 'readability' as const,
          priority: 'medium' as const,
          description: 'Add type hints',
          expectedBenefit: 'Improved code maintainability',
        },
      ],
    };

    return {
      id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      engineId,
      filePath,
      astResult,
      llmResult,
      mergedResult,
      status: 'completed',
      createdAt: new Date(),
    };
  }

  /**
   * 验证 AST 配置
   */
  private validateAstConfig(config: AstAnalysisConfig): void {
    if (!config.supportedLanguages || config.supportedLanguages.length === 0) {
      throw new DualEngineError('Supported languages required', 'INVALID_AST_CONFIG');
    }
    if (config.parseTimeout <= 0) {
      throw new DualEngineError('Parse timeout must be positive', 'INVALID_AST_CONFIG');
    }
    if (config.maxDepth <= 0) {
      throw new DualEngineError('Max depth must be positive', 'INVALID_AST_CONFIG');
    }
  }

  /**
   * 验证 LLM 配置
   */
  private validateLlmConfig(config: LlmParsingConfig): void {
    if (!config.model) {
      throw new DualEngineError('LLM model required', 'INVALID_LLM_CONFIG');
    }
    if (config.temperature < 0 || config.temperature > 2) {
      throw new DualEngineError('Temperature must be between 0 and 2', 'INVALID_LLM_CONFIG');
    }
    if (config.maxTokens <= 0) {
      throw new DualEngineError('Max tokens must be positive', 'INVALID_LLM_CONFIG');
    }
  }
}
