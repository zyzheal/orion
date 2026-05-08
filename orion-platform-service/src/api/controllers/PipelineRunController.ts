/**
 * PipelineRun Controller - PipelineRun 执行 API (Fastify 版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { PipelineEngine } from '../../engine/PipelineEngine';
import { PipelineRunStatus, TriggerType } from '../../models/PipelineRun';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { DynamicParamsResolver, TriggerContext } from '../../services/pipeline/DynamicParamsResolver';
import { PipelineBudgetService } from '../../services/pipeline/PipelineBudgetService';
import { PipelineTenantIsolationService } from '../../services/pipeline/PipelineTenantIsolationService';
import { PipelineRBACService } from '../../services/pipeline/PipelineRBACService';

export class PipelineRunController {
  private runService: PipelineRunService;
  private engine: PipelineEngine;
  private pipelineService: PipelineService | null;
  private budgetService: PipelineBudgetService | null;
  private paramsResolver: DynamicParamsResolver;
  private tenantIsolation: PipelineTenantIsolationService;
  private rbacService: PipelineRBACService;

  constructor(
    runService: PipelineRunService,
    engine: PipelineEngine,
    pipelineService?: PipelineService | null,
    budgetService?: PipelineBudgetService | null,
    rbacService?: PipelineRBACService
  ) {
    this.runService = runService;
    this.engine = engine;
    this.pipelineService = pipelineService || null;
    this.budgetService = budgetService || null;
    this.paramsResolver = new DynamicParamsResolver();
    this.tenantIsolation = new PipelineTenantIsolationService(pipelineService);
    this.rbacService = rbacService || new PipelineRBACService();
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
      const { triggerType, triggerBy, context, params: runtimeParams, branch, commitSha } = body;

      // P4 Security: Extract and validate tenant isolation
      const tenantId = PipelineTenantIsolationService.extractTenantId(request.headers as Record<string, string | undefined>);
      const tenantCheck = await this.tenantIsolation.validatePipelineTenant(pipelineId, tenantId);
      if (!tenantCheck.valid) {
        await reply.status(403).send({
          error: 'TENANT_ISOLATION_VIOLATION',
          code: '40301',
          message: tenantCheck.error,
        });
        return;
      }

      // P4 Security: Check RBAC - can user trigger this pipeline?
      const userId = (request as any).user?.userId || triggerBy || 'anonymous';
      const rbacCheck = await this.rbacService.canTrigger(pipelineId, userId);
      if (!rbacCheck.allowed) {
        await reply.status(403).send({
          error: 'RBAC_DENIED',
          code: '40302',
          message: rbacCheck.reason,
        });
        return;
      }

      const type = (triggerType as TriggerType) || TriggerType.MANUAL;

      // Dynamic parameter resolution (Phase 1 P0)
      let injectedParams: Record<string, unknown> = {};
      let dynamicStages: string[] = [];
      let estimatedBudget: { timeMs: number; costCents: number } | undefined;

      if (this.pipelineService) {
        const pipeline = tenantCheck.pipeline;
        if (!pipeline) {
          await reply.status(404).send({
            error: 'NOT_FOUND',
            code: '30201',
            message: `Pipeline '${pipelineId}' not found`,
          });
          return;
        }

        const triggerCtx: TriggerContext = {
          triggerType: type,
          triggerBy,
          branch: branch || (context as any)?.branch,
          commitSha: commitSha || (context as any)?.commitSha,
        };

        const yamlDefinition = pipeline.yamlDefinition || (pipeline.config as any)?.yamlDefinition || '';
        const defaultParams = (pipeline.config as any)?.defaultParams || {};

        try {
          const resolved = await this.paramsResolver.resolve(
            pipelineId,
            runtimeParams || {},
            defaultParams,
            yamlDefinition,
            triggerCtx
          );
          injectedParams = resolved.injectedParams;
          dynamicStages = resolved.dynamicStages;
        } catch (resolveError) {
          // Log but don't fail - params resolution is optional
          console.warn('[PipelineRun] Dynamic param resolution failed:', resolveError);
        }

        // Budget estimation
        if (this.budgetService) {
          try {
            const estimate = await this.budgetService.estimateBudget(pipelineId, { triggerType: type });
            estimatedBudget = {
              timeMs: estimate.estimatedTimeMs,
              costCents: estimate.estimatedCost,
            };
          } catch {
            // Budget estimation is optional
          }
        }
      }

      // Build enhanced context with injected params and tenantId
      const enhancedContext = {
        ...(context as any || {}),
        injectedParams,
        branch,
        commitSha,
        tenantId, // P4 Security: include tenantId in context
      };

      const run = await this.engine.execute(
        pipelineId,
        type,
        triggerBy,
        enhancedContext
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
        // Phase 1 P0: Dynamic parameters response
        injectedParams,
        dynamicStages,
        estimatedBudget,
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

      // P4 Security: Filter by tenant
      const tenantId = PipelineTenantIsolationService.extractTenantId(request.headers as Record<string, string | undefined>);

      const runs = await this.runService.listRuns({
        pipelineId: pipelineId as string,
        status: status as PipelineRunStatus | PipelineRunStatus[] | undefined,
        triggerType: triggerType as TriggerType | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      // P4 Security: Filter runs to only include those belonging to the user's tenant
      const tenantScopedRuns = runs.filter(run => {
        const runTenantId = (run as any).context?.tenantId || (run as any).tenant_id;
        return !runTenantId || runTenantId === tenantId;
      });

      await reply.send({
        data: tenantScopedRuns.map(r => ({
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
        total: tenantScopedRuns.length,
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

      // P4 Security: Validate tenant isolation
      const tenantId = PipelineTenantIsolationService.extractTenantId(request.headers as Record<string, string | undefined>);
      const run = await this.runService.getRun(id);
      if (run) {
        const tenantCheck = await this.tenantIsolation.validateRunTenant(run, tenantId);
        if (!tenantCheck.valid) {
          await reply.status(403).send({
            error: 'TENANT_ISOLATION_VIOLATION',
            code: '40301',
            message: tenantCheck.error,
          });
          return;
        }
      }

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

      // P4 Security: Validate tenant isolation
      const tenantId = PipelineTenantIsolationService.extractTenantId(request.headers as Record<string, string | undefined>);
      const run = await this.runService.getRun(id);
      if (run) {
        const tenantCheck = await this.tenantIsolation.validateRunTenant(run, tenantId);
        if (!tenantCheck.valid) {
          await reply.status(403).send({
            error: 'TENANT_ISOLATION_VIOLATION',
            code: '40301',
            message: tenantCheck.error,
          });
          return;
        }

        // P4 Security: Check RBAC - can user cancel this run?
        const userId = (request as any).user?.userId || 'anonymous';
        const rbacCheck = await this.rbacService.canCancel(id, userId, tenantId, run.pipelineId);
        if (!rbacCheck.allowed) {
          await reply.status(403).send({
            error: 'RBAC_DENIED',
            code: '40302',
            message: rbacCheck.reason,
          });
          return;
        }
      }

      // Try to cancel via engine (stops running stages)
      const cancelled = await this.engine.cancelExecution(id);

      if (!cancelled) {
        // Fallback: cancel at run service level (status-only for non-running)
        const cancelledRun = await this.runService.cancelRun(id);
        if (!cancelledRun) {
          await reply.status(404).send({
            error: 'NOT_FOUND',
            code: '30201',
            message: `PipelineRun '${id}' not found or not running`,
          });
          return;
        }

        await reply.send({
          id: cancelledRun.id,
          status: cancelledRun.status,
          cancelledAt: cancelledRun.completedAt,
        });
        return;
      }

      const updatedRun = await this.runService.getRun(id);
      await reply.send({
        id: updatedRun!.id,
        status: updatedRun!.status,
        cancelledAt: updatedRun!.completedAt,
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

      // P4 Security: Validate tenant isolation
      const tenantId = PipelineTenantIsolationService.extractTenantId(request.headers as Record<string, string | undefined>);
      const run = await this.runService.getRun(id);
      if (run) {
        const tenantCheck = await this.tenantIsolation.validateRunTenant(run, tenantId);
        if (!tenantCheck.valid) {
          await reply.status(403).send({
            error: 'TENANT_ISOLATION_VIOLATION',
            code: '40301',
            message: tenantCheck.error,
          });
          return;
        }
      }

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

      // P4 Security: Validate tenant isolation
      const tenantId = PipelineTenantIsolationService.extractTenantId(request.headers as Record<string, string | undefined>);
      const run = await this.runService.getRun(id);
      if (run) {
        const tenantCheck = await this.tenantIsolation.validateRunTenant(run, tenantId);
        if (!tenantCheck.valid) {
          await reply.status(403).send({
            error: 'TENANT_ISOLATION_VIOLATION',
            code: '40301',
            message: tenantCheck.error,
          });
          return;
        }
      }

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