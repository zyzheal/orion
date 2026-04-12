/**
 * API 路由注册 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineEngine } from '../engine/PipelineEngine';
import { StageExecutor } from '../engine/StageExecutor';
import { TaskRunner } from '../engine/TaskRunner';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { EventBusService } from '../services/event-bus-service';
import cmdbRoutes from '../routes-cmdb';
import buildRoutes from './build-routes';
import codeRepoRoutes from './code-repo-routes';
import costRoutes from './cost-routes';
import configRoutes from './config-routes';
import riskRoutes from './risk-routes';
import finopsV2Routes from './finops-v2-routes';
import aiReviewRoutes from './ai-review-routes';
import diagnosticRoutes from './diagnostic-routes';
import testSelectorRoutes from './test-selector-routes';

export interface ApiRoutesOptions {
  eventBus?: EventBusService;
}

export default async function apiRoutes(app: FastifyInstance, options: ApiRoutesOptions): Promise<void> {
  // 初始化服务
  const eventPublisher = new PipelineEventPublisher(options.eventBus ? {
    eventBus: {
      publish: (subject: string, data: any) => options.eventBus!.publish(subject, data),
      isHealthy: () => true,
    }
  } : undefined);
  const pipelineService = new PipelineService();
  const runService = new PipelineRunService(eventPublisher);
  const taskRunner = new TaskRunner();
  const stageExecutor = new StageExecutor(taskRunner, eventPublisher);
  const engine = new PipelineEngine(pipelineService, runService, eventPublisher, stageExecutor);

  // 初始化控制器
  const pipelineController = new PipelineController(pipelineService);
  const pipelineRunController = new PipelineRunController(runService, engine);
  const stageController = new StageController(runService, stageExecutor);
  const taskController = new TaskController(runService);

  // ==================== Pipeline 路由 ====================

  // POST /api/v1/pipelines - 创建 Pipeline
  app.post('/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.create(request, reply);
  });

  // GET /api/v1/pipelines - 获取 Pipeline 列表
  app.get('/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.list(request, reply);
  });

  // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
  app.get('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getById(request, reply);
  });

  // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
  app.get('/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.getVersions(request, reply);
  });

  // PUT /api/v1/pipelines/:id - 更新 Pipeline
  app.put('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.update(request, reply);
  });

  // DELETE /api/v1/pipelines/:id - 删除 Pipeline
  app.delete('/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.delete(request, reply);
  });

  // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
  app.post('/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineController.validate(request, reply);
  });

  // ==================== PipelineRun 路由 ====================

  // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
  app.post('/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.trigger(request, reply);
  });

  // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
  app.get('/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.list(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
  app.get('/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getById(request, reply);
  });

  // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
  app.post('/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.cancel(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
  app.get('/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getStages(request, reply);
  });

  // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
  app.get('/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    return pipelineRunController.getTasks(request, reply);
  });

  // ==================== Stage 路由 ====================

  // GET /api/v1/stages/:id - 获取 Stage 详情
  app.get('/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.getById(request, reply);
  });

  // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
  app.get('/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.getTasks(request, reply);
  });

  // POST /api/v1/stages/:id/retry - 重试 Stage
  app.post('/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    return stageController.retry(request, reply);
  });

  // ==================== Task 路由 ====================

  // GET /api/v1/tasks/:id - 获取 Task 详情
  app.get('/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.getById(request, reply);
  });

  // GET /api/v1/tasks/:id/log - 获取 Task 日志
  app.get('/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.getLog(request, reply);
  });

  // POST /api/v1/tasks/:id/retry - 重试 Task
  app.post('/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
    return taskController.retry(request, reply);
  });

  // ==================== CMDB 路由 ====================

  // 注册 CMDB API 路由
  await app.register(cmdbRoutes, { prefix: '/cmdb' });

  // ==================== 构建环境管理路由 ====================

  // 注册 Build Environment API 路由
  await app.register(buildRoutes, { prefix: '/build' });

  // 注册 Code Repository Integration API 路由
  await app.register(codeRepoRoutes, { prefix: '/code-repo' });

  // 注册 Configuration Management API 路由
  await app.register(configRoutes, { prefix: '/config' });

  // 注册 FinOps 成本管理 API 路由
  await app.register(costRoutes, { prefix: '/cost' });

  // 注册风险评估 API 路由
  await app.register(riskRoutes, { prefix: '/risk' });

  // 注册 FinOps 成本追踪与 ROI API 路由 (TASK-502)
  await app.register(finopsV2Routes, { prefix: '/finops' });

  // 注册 AI Code Review API 路由 (TASK-302)
  await app.register(aiReviewRoutes, { prefix: '/ai-review' });

  // 注册诊断 Agent API 路由 (TASK-305)
  await app.register(diagnosticRoutes, { prefix: '/diagnostic' });

  // 注册智能测试选择器 API 路由 (TASK-303)
  await app.register(testSelectorRoutes, { prefix: '/test-selector' });
}