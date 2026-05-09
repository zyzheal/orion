/**
 * Pipeline 路由注册器
 *
 * 将 Pipeline / PipelineRun / Stage / Task 相关的路由从主 routes.ts 中提取出来，
 * 保持注册顺序和 handler 逻辑不变。
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { ApprovalController } from './controllers/ApprovalController';
import { SCMWebhookService } from '../services/pipeline/SCMWebhookService';

export interface PipelineRouteDeps {
  pipelineController: PipelineController;
  pipelineRunController: PipelineRunController;
  stageController: StageController;
  taskController: TaskController;
  approvalController?: ApprovalController;
  scmWebhookService?: SCMWebhookService;
}

/**
 * 注册所有 Pipeline 相关路由（Pipeline / PipelineRun / Stage / Task）。
 * 每个路由块自带 authenticateUser 中间件，与原 routes.ts 行为一致。
 */
export async function registerPipelineRoutes(
  app: FastifyInstance,
  deps: PipelineRouteDeps
): Promise<void> {
  const { pipelineController, pipelineRunController, stageController, taskController } = deps;

  // ==================== Pipeline 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/pipelines - 创建 Pipeline
    instance.post('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.create(request, reply);
    });

    // GET /api/v1/pipelines - 获取 Pipeline 列表
    instance.get('/v1/pipelines', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.list(request, reply);
    });

    // GET /api/v1/pipelines/:id - 获取 Pipeline 详情
    instance.get('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.getById(request, reply);
    });

    // GET /api/v1/pipelines/:id/versions - 获取 Pipeline 所有版本
    instance.get('/v1/pipelines/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.getVersions(request, reply);
    });

    // PUT /api/v1/pipelines/:id - 更新 Pipeline
    instance.put('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.update(request, reply);
    });

    // DELETE /api/v1/pipelines/:id - 删除 Pipeline
    instance.delete('/v1/pipelines/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.delete(request, reply);
    });

    // POST /api/v1/pipelines/validate - 验证 Pipeline YAML
    instance.post('/v1/pipelines/validate', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineController.validate(request, reply);
    });
  });

  // ==================== PipelineRun 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /api/v1/pipelines/:id/runs - 触发 Pipeline 执行
    instance.post('/v1/pipelines/:id/runs', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.trigger(request, reply);
    });

    // GET /api/v1/pipeline-runs - 获取 PipelineRun 列表
    instance.get('/v1/pipeline-runs', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.list(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id - 获取 PipelineRun 详情
    instance.get('/v1/pipeline-runs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getById(request, reply);
    });

    // POST /api/v1/pipeline-runs/:id/cancel - 取消 PipelineRun
    instance.post('/v1/pipeline-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.cancel(request, reply);
    });

    // POST /api/v1/pipeline-runs/:id/retry - 重跑 PipelineRun (支持 fromStage / onlyFailed)
    instance.post('/v1/pipeline-runs/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.retry(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id/stages - 获取 PipelineRun 的 Stages
    instance.get('/v1/pipeline-runs/:id/stages', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getStages(request, reply);
    });

    // GET /api/v1/pipeline-runs/:id/tasks - 获取 PipelineRun 的 Tasks
    instance.get('/v1/pipeline-runs/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
      return pipelineRunController.getTasks(request, reply);
    });
  });

  // ==================== Stage 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // GET /api/v1/stages/:id - 获取 Stage 详情
    instance.get('/v1/stages/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.getById(request, reply);
    });

    // GET /api/v1/stages/:id/tasks - 获取 Stage 下的 Tasks
    instance.get('/v1/stages/:id/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.getTasks(request, reply);
    });

    // POST /api/v1/stages/:id/retry - 重试 Stage
    instance.post('/v1/stages/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return stageController.retry(request, reply);
    });
  });

  // ==================== Task 路由 (auth protected) ====================
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // GET /api/v1/tasks/:id - 获取 Task 详情
    instance.get('/v1/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.getById(request, reply);
    });

    // GET /api/v1/tasks/:id/log - 获取 Task 日志
    instance.get('/v1/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.getLog(request, reply);
    });

    // POST /api/v1/tasks/:id/retry - 重试 Task
    instance.post('/v1/tasks/:id/retry', async (request: FastifyRequest, reply: FastifyReply) => {
      return taskController.retry(request, reply);
    });
  });

  // ==================== Approval Gate 路由 (auth protected) ====================
  if (deps.approvalController) {
    await app.register(async (instance: FastifyInstance) => {
      instance.addHook('onRequest', authenticateUser);

      // GET /api/v1/pipeline-runs/:runId/approvals - 获取 run 的所有审批请求
      instance.get(
        '/v1/pipeline-runs/:runId/approvals',
        async (request: FastifyRequest, reply: FastifyReply) => {
          return deps.approvalController!.listByRun(request, reply);
        }
      );

      // GET /api/v1/pipeline-runs/:runId/stages/:stageId/approval - 获取特定 stage 的审批状态
      instance.get(
        '/v1/pipeline-runs/:runId/stages/:stageId/approval',
        async (request: FastifyRequest, reply: FastifyReply) => {
          return deps.approvalController!.getStatus(request, reply);
        }
      );

      // POST /api/v1/pipeline-runs/:runId/stages/:stageId/approve - 审批通过
      instance.post(
        '/v1/pipeline-runs/:runId/stages/:stageId/approve',
        async (request: FastifyRequest, reply: FastifyReply) => {
          return deps.approvalController!.approve(request, reply);
        }
      );

      // POST /api/v1/pipeline-runs/:runId/stages/:stageId/reject - 审批拒绝
      instance.post(
        '/v1/pipeline-runs/:runId/stages/:stageId/reject',
        async (request: FastifyRequest, reply: FastifyReply) => {
          return deps.approvalController!.reject(request, reply);
        }
      );
    });
  }

  // ==================== SCM Webhook 路由 (public - signature validated) ====================
  if (deps.scmWebhookService) {
    await app.register(async (instance: FastifyInstance) => {
      // POST /api/v1/webhooks/scm - Receive SCM webhook events (public, validates signature)
      instance.post(
        '/v1/webhooks/scm',
        async (request: FastifyRequest, reply: FastifyReply) => {
          try {
            const body = request.body as any;
            const headers = request.headers as Record<string, string | undefined>;

            // Determine provider and handle accordingly
            const githubSignature = headers['x-hub-signature-256'];
            const gitlabToken = headers['x-gitlab-token'];
            const githubEvent = headers['x-github-event'];

            let event;

            if (githubSignature || githubEvent) {
              // GitHub webhook
              event = await deps.scmWebhookService!.handleGitHubPush(body, githubSignature);
            } else if (gitlabToken) {
              // GitLab webhook
              event = await deps.scmWebhookService!.handleGitLabPush(body, gitlabToken);
            } else {
              // Unknown provider - try GitHub (signature validation will fail if secret is set)
              event = await deps.scmWebhookService!.handleGitHubPush(body);
            }

            await reply.status(200).send({
              received: true,
              eventId: event.id,
              provider: event.provider,
              matchedPipelines: event.matchedPipelines,
            });
          } catch (error: any) {
            await reply.status(401).send({
              error: 'WEBHOOK_VALIDATION_FAILED',
              message: error.message,
            });
          }
        }
      );

      // GET /api/v1/webhooks/scm/events - Get webhook event history (auth protected)
      instance.addHook('onRequest', authenticateUser);

      instance.get(
        '/v1/webhooks/scm/events',
        async (request: FastifyRequest, reply: FastifyReply) => {
          const query = request.query as any;
          const limit = query.limit ? parseInt(query.limit, 10) : 20;
          const events = deps.scmWebhookService!.getEvents(limit);

          await reply.send({
            data: events.map(e => ({
              id: e.id,
              provider: e.provider,
              eventType: e.eventType,
              repository: e.repository,
              branch: e.branch,
              commitSha: e.commitSha,
              pusher: e.pusher,
              timestamp: e.timestamp,
              matchedPipelines: e.matchedPipelines,
            })),
            total: events.length,
          });
        }
      );
    });
  }
}
