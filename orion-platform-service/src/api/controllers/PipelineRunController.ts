/**
 * PipelineRun Controller - PipelineRun 执行 API (Fastify 版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { PipelineEngine } from '../../engine/PipelineEngine';
import { PipelineRunStatus, TriggerType } from '../../models/PipelineRun';

export class PipelineRunController {
  private runService: PipelineRunService;
  private engine: PipelineEngine;

  constructor(runService: PipelineRunService, engine: PipelineEngine) {
    this.runService = runService;
    this.engine = engine;
  }

  /**
   * 触发 Pipeline 执行
   * POST /api/v1/pipelines/:id/runs
   */
  async trigger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { id: pipelineId } = params;
      const { triggerType, triggerBy, context } = body;

      const type = (triggerType as TriggerType) || TriggerType.MANUAL;

      const run = await this.engine.execute(
        pipelineId,
        type,
        triggerBy,
        context
      );

      if (!run) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${pipelineId}' not found`,
        });
        return;
      }

      await reply.status(201).send({
        id: run.id,
        pipelineId: run.pipelineId,
        pipelineVersion: run.pipelineVersion,
        status: run.status,
        triggerType: run.triggerType,
        triggerBy: run.triggerBy,
        createdAt: run.createdAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          await reply.status(404).send({
            error: 'NOT_FOUND',
            code: '30201',
            message: error.message,
          });
          return;
        }
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to trigger pipeline',
      });
    }
  }

  /**
   * 获取 PipelineRun 列表
   * GET /api/v1/pipeline-runs
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { pipelineId, status, triggerType, limit, offset } = query;

      const runs = await this.runService.listRuns({
        pipelineId: pipelineId as string,
        status: status as PipelineRunStatus | PipelineRunStatus[] | undefined,
        triggerType: triggerType as TriggerType | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      await reply.send({
        data: runs.map(r => ({
          id: r.id,
          pipelineId: r.pipelineId,
          pipelineVersion: r.pipelineVersion,
          status: r.status,
          triggerType: r.triggerType,
          triggerBy: r.triggerBy,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          durationMs: r.durationMs,
          createdAt: r.createdAt,
        })),
        total: runs.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list pipeline runs',
      });
    }
  }

  /**
   * 获取 PipelineRun 详情
   * GET /api/v1/pipeline-runs/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const detail = await this.runService.getRunDetail(id);

      if (!detail) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `PipelineRun '${id}' not found`,
        });
        return;
      }

      await reply.send({
        run: {
          id: detail.run!.id,
          pipelineId: detail.run!.pipelineId,
          pipelineVersion: detail.run!.pipelineVersion,
          status: detail.run!.status,
          triggerType: detail.run!.triggerType,
          triggerBy: detail.run!.triggerBy,
          context: detail.run!.context,
          startedAt: detail.run!.startedAt,
          completedAt: detail.run!.completedAt,
          durationMs: detail.run!.durationMs,
          createdAt: detail.run!.createdAt,
          updatedAt: detail.run!.updatedAt,
        },
        stages: detail.stages.map(s => ({
          id: s.id,
          name: s.name,
          sequence: s.sequence,
          status: s.status,
          dependsOn: s.dependsOn,
          condition: s.condition,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          durationMs: s.durationMs,
          error: s.error,
        })),
        tasks: detail.tasks.map(t => ({
          id: t.id,
          stageId: t.stageId,
          name: t.name,
          type: t.type,
          sequence: t.sequence,
          status: t.status,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          durationMs: t.durationMs,
          error: t.error,
        })),
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get pipeline run',
      });
    }
  }

  /**
   * 取消 PipelineRun
   * POST /api/v1/pipeline-runs/:id/cancel
   */
  async cancel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      // Try to cancel via engine (stops running stages)
      const cancelled = await this.engine.cancelExecution(id);

      if (!cancelled) {
        // Fallback: cancel at run service level (status-only for non-running)
        const run = await this.runService.cancelRun(id);
        if (!run) {
          await reply.status(404).send({
            error: 'NOT_FOUND',
            code: '30201',
            message: `PipelineRun '${id}' not found or not running`,
          });
          return;
        }

        await reply.send({
          id: run.id,
          status: run.status,
          cancelledAt: run.completedAt,
        });
        return;
      }

      const run = await this.runService.getRun(id);
      await reply.send({
        id: run!.id,
        status: run!.status,
        cancelledAt: run!.completedAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to cancel pipeline run',
      });
    }
  }

  /**
   * 获取 PipelineRun 的 Stages
   * GET /api/v1/pipeline-runs/:id/stages
   */
  async getStages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const run = await this.runService.getRun(id);
      if (!run) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `PipelineRun '${id}' not found`,
        });
        return;
      }

      const stages = await this.runService.getStages(id);

      await reply.send({
        data: stages.map(s => ({
          id: s.id,
          name: s.name,
          sequence: s.sequence,
          status: s.status,
          dependsOn: s.dependsOn,
          condition: s.condition,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          durationMs: s.durationMs,
          error: s.error,
        })),
        total: stages.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get stages',
      });
    }
  }

  /**
   * 获取 PipelineRun 的 Tasks
   * GET /api/v1/pipeline-runs/:id/tasks
   */
  async getTasks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const run = await this.runService.getRun(id);
      if (!run) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `PipelineRun '${id}' not found`,
        });
        return;
      }

      const stages = await this.runService.getStages(id);
      const allTasks: any[] = [];

      for (const stage of stages) {
        const tasks = await this.runService.getTasks(stage.id);
        allTasks.push(
          ...tasks.map(t => ({
            id: t.id,
            stageId: t.stageId,
            stageName: stage.name,
            name: t.name,
            type: t.type,
            sequence: t.sequence,
            status: t.status,
            startedAt: t.startedAt,
            completedAt: t.completedAt,
            durationMs: t.durationMs,
            error: t.error,
          }))
        );
      }

      await reply.send({
        data: allTasks,
        total: allTasks.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get tasks',
      });
    }
  }
}