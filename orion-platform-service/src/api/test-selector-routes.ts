/**
 * Test Selector API Routes
 *
 * 智能测试选择器 REST API
 * 路由前缀: /api/v1/test-selector
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrionError, NotFoundError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'test-selector-routes' });
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { TestSelectorService, TestSelectorServiceConfig } from '../services/test-selector/TestSelectorService';
import { DependencyAnalyzerConfig } from '../services/test-selector/TestDependencyAnalyzer';
import { DatabasePool } from '../services/database';
import {
  TestCaseRepository,
  TestSuiteRepository,
  TestRunRepository,
  TestTagRepository,
  TestCoverageRepository,
} from '../repositories/TestSelectorRepository';
import {
  PRChange,
  TestSelectorConfig,
} from '../services/test-selector/types';

/**
 * 创建测试选择器路由
 */
export default async function testSelectorRoutes(
  app: FastifyInstance,
  options: {
    testSelectorService?: TestSelectorService;
    analyzerConfig?: DependencyAnalyzerConfig;
    optimizerConfig?: TestSelectorConfig;
    database?: DatabasePool;
  }
): Promise<void> {

  // 初始化数据库 Repository（如果提供了 database）
  let testCaseRepo: TestCaseRepository | null = null;
  let testSuiteRepo: TestSuiteRepository | null = null;
  let testRunRepo: TestRunRepository | null = null;
  let testTagRepo: TestTagRepository | null = null;
  let testCoverageRepo: TestCoverageRepository | null = null;

  if (options.database) {
    testCaseRepo = new TestCaseRepository(options.database);
    testSuiteRepo = new TestSuiteRepository(options.database);
    testRunRepo = new TestRunRepository(options.database);
    testTagRepo = new TestTagRepository(options.database);
    testCoverageRepo = new TestCoverageRepository(options.database);
    logger.info('Database repositories initialized');
  } else {
    logger.warn('No database provided, using in-memory storage');
  }

  // 获取或创建服务实例
  const getService = (): TestSelectorService => {
    if (options.testSelectorService) {
      return options.testSelectorService;
    }

    if (!options.database) {
      throw new Error('Database is required for TestSelectorService');
    }

    const analyzerConfig = options.analyzerConfig || {
      sourceRoot: 'src',
      testRoot: 'src',
    };

    const config: TestSelectorServiceConfig = {
      analyzerConfig,
      optimizerConfig: options.optimizerConfig,
    };

    return new TestSelectorService(config, options.database);
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plan = await service.selectTestsForPR(request.body as any);

      return reply.status(200).send({
        success: true,
        data: plan,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plan = await service.getTestPlan((request.params as any).planId);

      if (!plan) {
        return handleError(reply, new NotFoundError('Test plan not found'))
      }

      return reply.status(200).send({
        success: true,
        data: plan,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await service.getPRTestResult((request.params as any).prId);

      if (!result) {
        return handleError(reply, new NotFoundError('PR test result not found'))
      }

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await service.getTestHistory((request.params as any).testId);

      return reply.status(200).send({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
      const allStats = await service.getAllTestHistory();

      return reply.status(200).send({
        success: true,
        data: allStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const { testId, passed, duration, failureMessage, prId } = request.body as any;

      await service.recordTestResult(testId, passed, duration, failureMessage, prId);

      return reply.status(200).send({
        success: true,
        data: { message: 'Test result recorded' },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
      let suites;
      if (testSuiteRepo) {
        suites = await testSuiteRepo.findAllWithStats();
      } else {
        suites = await service.getSuites();
      }

      return reply.status(200).send({
        success: true,
        data: suites,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
      const query = request.query as any;
      let cases;

      if (testCaseRepo) {
        // 从数据库获取，支持过滤
        if (query.suite) {
          cases = await testCaseRepo.findBySuite(query.suite);
        } else if (query.status) {
          cases = await testCaseRepo.findByStatus(query.status);
        } else {
          const result = await testCaseRepo.findAll();
          cases = result.data;
        }
      } else {
        cases = await service.getCases();
      }

      return reply.status(200).send({
        success: true,
        data: cases,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
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
      return handleError(reply, new OrionError(error.message, ErrorCode.INTERNAL_ERROR))
    }
  });
}
