/**
 * Test Generation API Routes
 *
 * AI 测试用例生成 REST API
 * 路由前缀: /api/v1/test-generation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import {
  TestGeneratorService,
  TestGenerationRequest,
  TestGenerationResponse,
  ChangeAnalysisResult,
  CoverageSuggestionRequest,
  CoverageSuggestionResponse,
  ProgrammingLanguage,
  TestFramework,
} from '../services/test-generation';
import { AIGateway } from '../services/ai/AIGateway';

/**
 * 创建测试生成路由
 */
export default async function testGenerationRoutes(
  app: FastifyInstance,
  options: {
    testGeneratorService?: TestGeneratorService;
    aiGateway?: AIGateway;
  }
): Promise<void> {
  // 获取或创建服务实例
  const getService = (): TestGeneratorService => {
    if (options.testGeneratorService) {
      return options.testGeneratorService;
    }

    const service = new TestGeneratorService();

    // 如果提供了 AI Gateway，注入
    if (options.aiGateway) {
      service.setAIGateway(options.aiGateway);
    }

    return service;
  };

  const service = getService();

  // ==================== 测试生成 ====================

  /**
   * POST /api/v1/test/generate
   *
   * 生成测试用例
   */
  app.post('/generate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
    schema: {
      body: {
        type: 'object',
        required: ['change'],
        properties: {
          change: {
            type: 'object',
            required: ['diff', 'filePath', 'language'],
            properties: {
              diff: { type: 'string' },
              filePath: { type: 'string' },
              language: { type: 'string', enum: ['typescript', 'javascript', 'python', 'go', 'java'] },
              fileContent: { type: 'string' },
            },
          },
          strategy: {
            type: 'object',
            properties: {
              unitTests: { type: 'boolean' },
              integrationTests: { type: 'boolean' },
              edgeCaseTests: { type: 'boolean' },
              coverageTarget: { type: 'number' },
              includeMocking: { type: 'boolean' },
              includeAssertions: { type: 'boolean' },
              model: { type: 'string' },
              temperature: { type: 'number' },
              maxTokens: { type: 'number' },
            },
          },
          existingTests: { type: 'string' },
          targetFramework: { type: 'string' },
          prId: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result = await service.generateTests(request.body as any);

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      request.log.error({
        msg: 'Test generation failed',
        error: error.message,
        filePath: (request.body as any)?.change?.filePath,
      });

      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ==================== 变更分析 ====================

  /**
   * POST /api/v1/test/analyze-change
   *
   * 分析代码变更
   */
  app.post('/analyze-change', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
    schema: {
      body: {
        type: 'object',
        required: ['diff', 'filePath', 'language'],
        properties: {
          diff: { type: 'string' },
          filePath: { type: 'string' },
          language: { type: 'string', enum: ['typescript', 'javascript', 'python', 'go', 'java'] },
          fileContent: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const body = request.body as any;
      const result: ChangeAnalysisResult = await service.analyzeChange(
        body.diff,
        body.filePath,
        body.language
      );

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      request.log.error({
        msg: 'Change analysis failed',
        error: error.message,
        filePath: (request.body as any)?.filePath,
      });

      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ==================== 覆盖率改进建议 ====================

  /**
   * POST /api/v1/test/suggest-coverage
   *
   * 建议覆盖率改进
   */
  app.post('/suggest-coverage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
    schema: {
      body: {
        type: 'object',
        required: ['sourceFile', 'language', 'currentCoverage'],
        properties: {
          sourceFile: { type: 'string' },
          language: { type: 'string', enum: ['typescript', 'javascript', 'python', 'go', 'java'] },
          currentCoverage: {
            type: 'object',
            required: ['lines', 'branches', 'functions'],
            properties: {
              lines: { type: 'number' },
              branches: { type: 'number' },
              functions: { type: 'number' },
            },
          },
          uncoveredLines: {
            type: 'array',
            items: { type: 'number' },
          },
          sourceContent: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result: CoverageSuggestionResponse = await service.suggestCoverageImprovements(request.body as any);

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      request.log.error({
        msg: 'Coverage suggestion failed',
        error: error.message,
        sourceFile: (request.body as any)?.sourceFile,
      });

      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ==================== 测试模板 ====================

  /**
   * GET /api/v1/test/templates
   *
   * 获取测试模板列表
   */
  app.get('/templates', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const templates = service.getTemplates();

      return reply.status(200).send({
        success: true,
        data: templates,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/v1/test/templates/:language/:framework
   *
   * 获取指定语言和框架的模板
   */
  app.get('/templates/:language/:framework', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const params = request.params as any;
      const allTemplates = service.getTemplates();
      const filtered = allTemplates.filter(
        t => t.language === params.language && t.framework === params.framework
      );

      if (filtered.length === 0) {
        return reply.status(404).send({
          success: false,
          error: `No templates found for ${params.language}/${params.framework}`,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: filtered[0],
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ==================== 历史记录 ====================

  /**
   * GET /api/v1/test/history
   *
   * 获取生成历史记录
   */
  app.get('/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const history = service.getGenerationHistory();

      return reply.status(200).send({
        success: true,
        data: history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/v1/test/history/:generationId/adopt
   *
   * 标记测试被采纳
   */
  app.post('/history/:generationId/adopt', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      service.markAsAdopted((request.params as any).generationId);

      return reply.status(200).send({
        success: true,
        data: { message: 'Generation marked as adopted' },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ==================== 语言支持 ====================

  /**
   * GET /api/v1/test/supported-languages
   *
   * 获取支持的编程语言列表
   */
  app.get('/supported-languages', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const languages: Array<{
      language: ProgrammingLanguage;
      frameworks: TestFramework[];
    }> = [
      { language: 'typescript', frameworks: ['jest', 'vitest', 'mocha'] },
      { language: 'javascript', frameworks: ['jest', 'mocha', 'jasmine'] },
      { language: 'python', frameworks: ['pytest', 'unittest'] },
      { language: 'go', frameworks: ['go-testing'] },
      { language: 'java', frameworks: ['junit5', 'junit4'] },
    ];

    return reply.status(200).send({
      success: true,
      data: languages,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/test/supported-frameworks
   *
   * 获取支持的测试框架列表
   */
  app.get('/supported-frameworks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const frameworks: Array<{
      framework: TestFramework;
      languages: ProgrammingLanguage[];
      description: string;
    }> = [
      { framework: 'jest', languages: ['typescript', 'javascript'], description: 'Jest - Delightful JavaScript Testing' },
      { framework: 'vitest', languages: ['typescript', 'javascript'], description: 'Vitest - Vite-powered testing framework' },
      { framework: 'mocha', languages: ['typescript', 'javascript'], description: 'Mocha - flexible JavaScript test framework' },
      { framework: 'pytest', languages: ['python'], description: 'pytest - Python testing framework' },
      { framework: 'unittest', languages: ['python'], description: 'unittest - Python built-in testing' },
      { framework: 'go-testing', languages: ['go'], description: 'Go testing package' },
      { framework: 'junit5', languages: ['java'], description: 'JUnit 5 - Modern Java testing' },
      { framework: 'junit4', languages: ['java'], description: 'JUnit 4 - Classic Java testing' },
    ];

    return reply.status(200).send({
      success: true,
      data: frameworks,
      timestamp: new Date().toISOString(),
    });
  });
}