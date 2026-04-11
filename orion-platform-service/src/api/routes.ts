/**
 * API 路由注册
 */

import { Router } from 'express';
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

export function createApiRouter(options: {
  eventBus?: EventBusService;
}): Router {
  const router = Router();

  // 初始化服务
  const eventPublisher = new PipelineEventPublisher(options.eventBus);
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
  router.post('/pipelines', (req, res) => pipelineController.create(req, res));

  // GET /api/v1/pipelines - 获取 Pipeline 列表
  router.get('/pipelines', (req, res) => pipelineController.list(req, res));

  // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
  router.get('/pipelines/:id', (req, res) => pipelineController.getById(req, res));

  // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
  router.get('/pipelines/:id/versions', (req, res) => pipelineController.getVersions(req, res));

  // PUT /api/v1/pipelines/:id - 更新 Pipeline
  router.put('/pipelines/:id', (req, res) => pipelineController.update(req, res));

  // DELETE /api/v1/pipelines/:id - 删除 Pipeline
  router.delete('/pipelines/:id', (req, res) => pipelineController.delete(req, res));

  // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
  router.post('/pipelines/validate', (req, res) => pipelineController.validate(req, res));

  // ==================== PipelineRun 路由 ====================

  // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
  router.post('/pipelines/:id/runs', (req, res) => pipelineRunController.trigger(req, res));

  // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
  router.get('/pipeline-runs', (req, res) => pipelineRunController.list(req, res));

  // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
  router.get('/pipeline-runs/:id', (req, res) => pipelineRunController.getById(req, res));

  // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
  router.post('/pipeline-runs/:id/cancel', (req, res) => pipelineRunController.cancel(req, res));

  // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
  router.get('/pipeline-runs/:id/stages', (req, res) => pipelineRunController.getStages(req, res));

  // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
  router.get('/pipeline-runs/:id/tasks', (req, res) => pipelineRunController.getTasks(req, res));

  // ==================== Stage 路由 ====================

  // GET /api/v1/stages/:id - 获取 Stage 详情
  router.get('/stages/:id', (req, res) => stageController.getById(req, res));

  // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
  router.get('/stages/:id/tasks', (req, res) => stageController.getTasks(req, res));

  // POST /api/v1/stages/:id/retry - 重试 Stage
  router.post('/stages/:id/retry', (req, res) => stageController.retry(req, res));

  // ==================== Task 路由 ====================

  // GET /api/v1/tasks/:id - 获取 Task 详情
  router.get('/tasks/:id', (req, res) => taskController.getById(req, res));

  // GET /api/v1/tasks/:id/log - 获取 Task 日志
  router.get('/tasks/:id/log', (req, res) => taskController.getLog(req, res));

  // POST /api/v1/tasks/:id/retry - 重试 Task
  router.post('/tasks/:id/retry', (req, res) => taskController.retry(req, res));

  return router;
}
