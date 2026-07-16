/**
 * PipelineBudgetController - Pipeline budget management API
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineBudgetService } from '../../services/pipeline/PipelineBudgetService';
import { PipelineService } from '../../services/pipeline/PipelineService';

export class PipelineBudgetController {
  private budgetService: PipelineBudgetService;
  private pipelineService: PipelineService;

  constructor(budgetService: PipelineBudgetService, pipelineService: PipelineService) {
    this.budgetService = budgetService;
    this.pipelineService = pipelineService;
  }

  /**
   * Get budget configuration
   * GET /api/v1/pipelines/:pipelineId/budget
   */
  async getBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pipelineId } = params;

      const pipeline = await this.pipelineService.getById(pipelineId);
      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${pipelineId}' not found`,
        });
        return;
      }

      const budget = await this.budgetService.getBudget(pipelineId);
      if (!budget) {
        await reply.send({
          timeBudget: null,
          resourceBudget: null,
          costBudget: null,
          message: 'No budget configured for this pipeline',
        });
        return;
      }

      await reply.send({
        timeBudget: budget.timeBudget || null,
        resourceBudget: budget.resourceBudget || null,
        costBudget: budget.costBudget || null,
        updatedAt: budget.updatedAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get budget',
      });
    }
  }

  /**
   * Update budget configuration
   * PUT /api/v1/pipelines/:pipelineId/budget
   */
  async updateBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pipelineId } = params;

      const pipeline = await this.pipelineService.getById(pipelineId);
      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${pipelineId}' not found`,
        });
        return;
      }

      const updated = await this.budgetService.updateBudget(pipelineId, {
        pipelineId,
        maxDurationMs: body.timeBudget?.maxDurationMs,
        timeWarningPct: body.timeBudget?.warningPercent,
        timePolicy: body.timeBudget?.policy,
        maxCpuCoreHours: body.resourceBudget?.maxCpuCoreHours,
        maxMemoryGBHours: body.resourceBudget?.maxMemoryGBHours,
        resourceWarningPct: body.resourceBudget?.warningPercent,
        resourcePolicy: body.resourceBudget?.policy,
        maxCostCents: body.costBudget?.maxCostCents,
        costWarningPct: body.costBudget?.warningPercent,
        costPolicy: body.costBudget?.policy,
      });

      await reply.send({
        timeBudget: updated.timeBudget || null,
        resourceBudget: updated.resourceBudget || null,
        costBudget: updated.costBudget || null,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update budget',
      });
    }
  }

  /**
   * Estimate budget for a pipeline run
   * GET /api/v1/pipelines/:pipelineId/budget/estimate
   */
  async estimateBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const { pipelineId } = params;
      const { triggerType } = query;

      const pipeline = await this.pipelineService.getById(pipelineId);
      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${pipelineId}' not found`,
        });
        return;
      }

      const estimate = await this.budgetService.estimateBudget(pipelineId, {
        triggerType,
      });

      await reply.send({
        estimatedTimeMs: estimate.estimatedTimeMs,
        estimatedCpuCores: estimate.estimatedCpuCores,
        estimatedMemoryGB: estimate.estimatedMemoryGB,
        estimatedCost: estimate.estimatedCost,
        confidence: estimate.confidence,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to estimate budget',
      });
    }
  }

  /**
   * Get real-time budget usage for a run
   * GET /api/v1/pipelines/:pipelineId/runs/:runId/budget-usage
   */
  async getBudgetUsage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pipelineId, runId } = params;

      const pipeline = await this.pipelineService.getById(pipelineId);
      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${pipelineId}' not found`,
        });
        return;
      }

      const usage = await this.budgetService.getBudgetUsage(pipelineId, runId);

      await reply.send({
        timeUsed: usage.timeUsed,
        timePercent: usage.timePercent,
        cpuUsed: usage.cpuUsed,
        cpuPercent: usage.cpuPercent,
        memoryUsed: usage.memoryUsed,
        memoryPercent: usage.memoryPercent,
        costUsed: usage.costUsed,
        costPercent: usage.costPercent,
        alerts: usage.alerts,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get budget usage',
      });
    }
  }
}
