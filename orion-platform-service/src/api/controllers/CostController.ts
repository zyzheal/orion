/**
 * AI Cost Controller - Fastify HTTP request/response handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BudgetService } from '../../services/cost/BudgetService';
import { CostCalculator } from '../../services/cost/CostCalculator';

export class CostController {
  private budgetService: BudgetService;
  private calculator: CostCalculator;

  constructor(budgetService: BudgetService, calculator: CostCalculator) {
    this.budgetService = budgetService;
    this.calculator = calculator;
  }

  // ==================== Budget CRUD ====================

  async listBudgets(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const { budgets, total } = await this.budgetService.listBudgets({
        type: query.type,
        scope: query.scope,
        status: query.status as any,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: budgets, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const budget = await this.budgetService.getBudgetById(params.id);
      if (!budget) {
        await reply.status(404).send({ success: false, error: 'Budget not found' });
        return;
      }
      await reply.send({ success: true, data: budget });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (!body.name || !body.type || !body.scope || !body.period || body.amount === undefined) {
        await reply.status(400).send({
          success: false,
          error: 'name, type, scope, period, and amount are required',
        });
        return;
      }
      const budget = await this.budgetService.createBudget({
        name: body.name as string,
        type: body.type as any,
        scope: body.scope as string,
        period: body.period as any,
        amount: body.amount as number,
        thresholds: body.thresholds as any,
      });

      await reply.status(201).send({ success: true, data: budget });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create budget',
      });
    }
  }

  async updateBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const budget = await this.budgetService.updateBudget(params.id, {
        name: body.name as string | undefined,
        amount: body.amount as number | undefined,
        thresholds: body.thresholds as any,
        status: body.status as any,
      });
      if (!budget) {
        await reply.status(404).send({ success: false, error: 'Budget not found' });
        return;
      }
      await reply.send({ success: true, data: budget });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update budget',
      });
    }
  }

  async restoreBudget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as Record<string, string>;
      const budget = await this.budgetService.restoreBudget(params.id);
      if (!budget) {
        await reply.status(404).send({ success: false, error: 'Budget not found' });
        return;
      }
      await reply.send({ success: true, data: budget, message: 'Budget restored' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Cost Queries ====================

  async queryCosts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const { records, total } = await this.budgetService.queryCosts({
        tenantId: query.tenantId,
        projectId: query.projectId,
        userId: query.userId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        model: query.model,
        provider: query.provider,
        moduleType: query.moduleType,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: records, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getCostSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string | undefined>;
      const summary = await this.budgetService.getCostSummary({
        tenantId: query.tenantId,
        projectId: query.projectId,
        userId: query.userId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        model: query.model,
        provider: query.provider,
        moduleType: query.moduleType,
      });

      await reply.send({ success: true, data: summary });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async recordCost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      if (
        !body.requestId ||
        !body.model ||
        !body.provider ||
        body.inputTokens === undefined ||
        body.outputTokens === undefined ||
        body.totalCost === undefined
      ) {
        await reply.status(400).send({
          success: false,
          error: 'requestId, model, provider, inputTokens, outputTokens, and totalCost are required',
        });
        return;
      }
      const record = await this.budgetService.recordCost({
        requestId: body.requestId as string,
        model: body.model as string,
        provider: body.provider as string,
        inputTokens: body.inputTokens as number,
        outputTokens: body.outputTokens as number,
        inputCost: (body.inputCost as number) ?? 0,
        outputCost: (body.outputCost as number) ?? 0,
        totalCost: body.totalCost as number,
        tenantId: body.tenantId as string | undefined,
        projectId: body.projectId as string | undefined,
        userId: body.userId as string | undefined,
        moduleType: (body.moduleType as string) ?? 'unknown',
      });

      await reply.status(201).send({ success: true, data: record });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to record cost',
      });
    }
  }

  // ==================== Dashboard ====================

  async getDashboard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const dashboard = await this.budgetService.getDashboardData();
      await reply.send({ success: true, data: dashboard });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Alerts ====================

  async getAlerts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const alerts = await this.budgetService.getActiveAlerts();
      await reply.send({ success: true, data: alerts, total: alerts.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Model Pricing ====================

  async getPricing(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const pricing = await this.budgetService.getModelPricing();
      await reply.send({ success: true, data: pricing, total: pricing.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
