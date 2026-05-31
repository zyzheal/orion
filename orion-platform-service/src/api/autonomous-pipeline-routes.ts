/**
 * Autonomous Pipeline API Routes (Phase 2)
 *
 * Routes for error classification, adaptive timeout, and auto-retry.
 * Mounts under /api/v1/autonomous
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { ErrorClassifier } from '../services/pipeline/ErrorClassifier';
import { AdaptiveTimeoutService } from '../services/pipeline/AdaptiveTimeoutService';
import { AutoRetryService } from '../services/pipeline/AutoRetryService';
import { AutonomousPipelineController } from './controllers/AutonomousPipelineController';
import { OrionError, ErrorCode } from '../errors';

interface AutonomousPipelineRoutesOptions {
  database?: DatabasePool;
}

export default async function autonomousPipelineRoutes(
  app: FastifyInstance,
  options: AutonomousPipelineRoutesOptions
): Promise<void> {
  if (!options.database) {
    throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Autonomous pipeline routes require a database connection');
  }
  const db = options.database;

  // Initialize services
  const errorClassifier = new ErrorClassifier(db);
  const timeoutService = new AdaptiveTimeoutService(db);
  const retryService = new AutoRetryService(db, errorClassifier);
  const controller = new AutonomousPipelineController(
    errorClassifier,
    timeoutService,
    retryService
  );

  // ==================== 错误分类 ====================

  // POST /v1/autonomous/classify-error - 分类错误
  app.post('/classify-error', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.classifyError(request, reply);
  });

  // GET /v1/autonomous/error-stats - 错误统计
  app.get('/error-stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getErrorStats(request, reply);
  });

  // ==================== 自适应超时 ====================

  // GET /v1/autonomous/timeout/:stageName - 获取建议超时
  app.get('/timeout/:stageName', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTimeoutForStage(request, reply);
  });

  // POST /v1/autonomous/record-execution - 记录执行数据
  app.post('/record-execution', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordExecution(request, reply);
  });

  // ==================== 自动重试 ====================

  // GET /v1/autonomous/retry-stats/:pipelineId - 重试统计
  app.get('/retry-stats/:pipelineId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRetryStats(request, reply);
  });

  // POST /v1/autonomous/configure-retry - 配置重试策略
  app.post('/configure-retry', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.configureRetry(request, reply);
  });

  // ==================== 自修复推荐 ====================

  // POST /v1/autonomous/self-healing/recommend - 获取自修复推荐
  app.post('/self-healing/recommend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recommendSelfHealing(request, reply);
  });

  // GET /v1/autonomous/self-healing/actions - 获取自修复动作目录
  app.get('/self-healing/actions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'autonomous-pipeline', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSelfHealingActions(request, reply);
  });
}
