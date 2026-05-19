/**
 * Test Selector API Routes
 *
 * 智能测试选择器 REST API
 * 路由前缀: /api/v1/test-selector
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { TestSelectorService, TestSelectorServiceConfig } from '../services/test-selector/TestSelectorService';
import { DependencyAnalyzerConfig } from '../services/test-selector/TestDependencyAnalyzer';
import {
  PRChange,
  TestSelectorConfig,
} from '../services/test-selector/types';

/**
 * 创建测试选择器路由
 */
export default async function testSelectorRoutes(
  app: FastifyInstance,
  options: { testSelectorService?: TestSelectorService; analyzerConfig?: DependencyAnalyzerConfig; optimizerConfig?: TestSelectorConfig }
): Promise<void> {

  // 获取或创建服务实例
  const getService = (): TestSelectorService => {
    if (options.testSelectorService) {
      return options.testSelectorService;
    }

    const analyzerConfig = options.analyzerConfig || {
      sourceRoot: 'src',
      testRoot: 'src',
    };

    const config: TestSelectorServiceConfig = {
      analyzerConfig,
      optimizerConfig: options.optimizerConfig,
    };

    return new TestSelectorService(config);
  };

  const service = getService();

  // ==================== 测试选择 ====================

  /**
   * POST /select
   *
   * 为 PR 变更选择需要执行的测试
   */
  app.post('/select', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
    schema: {
      body: {
        type: 'object',
        required: ['prId', 'repoId', 'sourceBranch', 'targetBranch', 'changedFiles'],
        properties: {
          prId: { type: 'string' },
          repoId: { type: 'string' },
          sourceBranch: { type: 'string' },
          targetBranch: { type: 'string' },
          changedFiles: {
            type: 'array',
            items: {
              type: 'object',
              required: ['path', 'changeType'],
              properties: {
                path: { type: 'string' },
                changeType: { type: 'string', enum: ['added', 'modified', 'deleted', 'renamed'] },
                additions: { type: 'number' },
                deletions: { type: 'number' },
                previousPath: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: PRChange }>, reply: FastifyReply) => {
    try {
      const plan = await service.selectTestsForPR(request.body);

      return reply.status(200).send({
        success: true,
        data: plan,
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

  // ==================== 测试计划 ====================

  /**
   * GET /plan/:planId
   *
   * 获取测试执行计划详情
   */
  app.get('/plan/:planId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: { planId: string } }>, reply: FastifyReply) => {
    try {
      const plan = await service.getTestPlan(request.params.planId);

      if (!plan) {
        return reply.status(404).send({
          success: false,
          error: 'Test plan not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: plan,
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

  // ==================== PR 测试结果 ====================

  /**
   * GET /pr/:prId
   *
   * 获取 PR 的测试选择和执行结果
   */
  app.get('/pr/:prId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: { prId: string } }>, reply: FastifyReply) => {
    try {
      const result = await service.getPRTestResult(request.params.prId);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: 'PR test result not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
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

  // ==================== 测试历史 ====================

  /**
   * GET /history/:testId
   *
   * 获取单个测试的历史统计
   */
  app.get('/history/:testId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: { testId: string } }>, reply: FastifyReply) => {
    try {
      const stats = service.getTestHistory(request.params.testId);

      return reply.status(200).send({
        success: true,
        data: stats,
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
   * GET /history
   *
   * 获取所有测试的历史汇总
   */
  app.get('/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allStats = service.getAllTestHistory();

      return reply.status(200).send({
        success: true,
        data: allStats,
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

  // ==================== 测试记录 ====================

  /**
   * POST /record
   *
   * 记录测试执行结果（用于更新历史数据和改进预测）
   */
  app.post('/record', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
    schema: {
      body: {
        type: 'object',
        required: ['testId', 'passed', 'duration'],
        properties: {
          testId: { type: 'string' },
          passed: { type: 'boolean' },
          duration: { type: 'number' },
          failureMessage: { type: 'string' },
          prId: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { testId: string; passed: boolean; duration: number; failureMessage?: string; prId?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { testId, passed, duration, failureMessage, prId } = request.body;

      await service.recordTestResult(testId, passed, duration, failureMessage, prId);

      return reply.status(200).send({
        success: true,
        data: { message: 'Test result recorded' },
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

  // ==================== 抖动测试 ====================

  /**
   * GET /flaky
   *
   * 获取检测到的抖动测试列表
   */
  app.get('/flaky', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const threshold = request.query && typeof (request.query as any).threshold === 'string'
        ? parseInt((request.query as any).threshold, 10)
        : undefined;

      const flakyTests = await service.getFlakyTests(threshold);

      return reply.status(200).send({
        success: true,
        data: { flakyTests, threshold: threshold ?? 50 },
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

  // ==================== 覆盖率 ====================

  /**
   * GET /coverage
   *
   * 获取测试覆盖率统计
   */
  app.get('/coverage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const coverage = service.getTestCoverage();

      const coverageMap = new Map();
      coverage.forEach((value, key) => {
        coverageMap.set(key, value);
      });

      return reply.status(200).send({
        success: true,
        data: Object.fromEntries(coverageMap),
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

  // ==================== 测试套件 ====================

  /**
   * GET /suites
   *
   * 获取所有测试套件
   */
  app.get('/suites', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const suites = service.getSuites();

      return reply.status(200).send({
        success: true,
        data: suites,
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
   * GET /cases
   *
   * 获取所有测试用例
   */
  app.get('/cases', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cases = service.getCases();

      return reply.status(200).send({
        success: true,
        data: cases,
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

  // ==================== 重新分析 ====================

  /**
   * POST /reanalyze
   *
   * 重新分析测试依赖关系
   */
  app.post('/reanalyze', {
    onRequest: [authenticateUser, requirePermission({ resource: 'test', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await service.reanalyze();

      return reply.status(200).send({
        success: true,
        data: { message: 'Test dependency analysis completed' },
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
}
