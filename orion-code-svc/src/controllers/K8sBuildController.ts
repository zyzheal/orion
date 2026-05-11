/**
 * K8s Build Controller - K8s 构建执行 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { K8sBuildExecutor } from '../../services/K8sBuildExecutor';
import {
  BuildPodCreateInput,
  BuildPodStatus,
} from '../../../models/BuildPod';

export class K8sBuildController {
  private executor: K8sBuildExecutor;

  constructor(executor: K8sBuildExecutor) {
    this.executor = executor;
  }

  /**
   * POST /api/v1/build-pods - 创建构建 Pod
   */
  async createPod(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = request.body as BuildPodCreateInput;

    // 验证必填字段
    if (!input.containers || input.containers.length === 0) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'containers array is required',
      });
      return;
    }

    try {
      const pod = await this.executor.createBuildPod(input);
      reply.status(201).send(pod);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create build pod',
      });
    }
  }

  /**
   * GET /api/v1/build-pods - 获取构建 Pod 列表
   */
  async listPods(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;

    try {
      const options: {
        runId?: string;
        stageId?: string;
        taskId?: string;
        status?: BuildPodStatus;
        limit?: number;
        offset?: number;
      } = {};

      if (query.runId) options.runId = query.runId;
      if (query.stageId) options.stageId = query.stageId;
      if (query.taskId) options.taskId = query.taskId;
      if (query.status) options.status = query.status as BuildPodStatus;
      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);

      const pods = await this.executor.listPods(options);
      reply.send(pods);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to list build pods',
      });
    }
  }

  /**
   * GET /api/v1/build-pods/:id - 获取 Pod 状态
   */
  async getPodStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const pod = await this.executor.getPodStatus(id);
      if (!pod) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Build pod '${id}' not found`,
        });
        return;
      }
      reply.send(pod);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get pod status',
      });
    }
  }

  /**
   * GET /api/v1/build-pods/:id/logs - 获取 Pod 日志
   */
  async getPodLogs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;
    const containerName = query.container;

    try {
      const logs = await this.executor.getPodLogs(id, containerName);
      reply.send({ podId: id, container: containerName, logs });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: error.message,
        });
      } else {
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to get pod logs',
        });
      }
    }
  }

  /**
   * POST /api/v1/build-pods/:id/cancel - 取消构建
   */
  async cancelBuild(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const cancelled = await this.executor.cancelBuild(id);
      if (!cancelled) {
        reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'Pod not found or already in terminal state',
        });
        return;
      }
      reply.send({ cancelled: true, podId: id });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to cancel build',
      });
    }
  }

  /**
   * POST /api/v1/build-pods/cleanup - 清理完成的 Pod
   */
  async cleanupPods(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as { olderThanMs?: number } | undefined;
    const olderThanMs = body?.olderThanMs || 3600000; // 默认 1 小时

    try {
      const count = await this.executor.cleanupCompletedPods(olderThanMs);
      reply.send({ cleaned: count, olderThanMs });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to cleanup completed pods',
      });
    }
  }
}
