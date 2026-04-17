/**
 * AI Cost Optimization API Routes
 *
 * Routes under /api/v1/ai-cost
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BudgetService } from '../services/cost/BudgetService';
import { CostCalculator } from '../services/cost/CostCalculator';
import { CostController } from './controllers/CostController';

export default async function aiCostRoutes(app: FastifyInstance): Promise<void> {
  const budgetService = new BudgetService();
  const calculator = new CostCalculator(budgetService);
  const controller = new CostController(budgetService, calculator);

  // ==================== Budgets ====================

  // GET /api/v1/ai-cost/budgets — list budgets
  app.get('/budgets', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listBudgets(request, reply);
  });

  // GET /api/v1/ai-cost/budgets/:id — budget detail
  app.get('/budgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBudget(request, reply);
  });

  // POST /api/v1/ai-cost/budgets — create budget
  app.post('/budgets', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createBudget(request, reply);
  });

  // PUT /api/v1/ai-cost/budgets/:id — update budget
  app.put('/budgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateBudget(request, reply);
  });

  // POST /api/v1/ai-cost/budgets/:id/restore — emergency restore
  app.post('/budgets/:id/restore', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.restoreBudget(request, reply);
  });

  // ==================== Costs ====================

  // GET /api/v1/ai-cost/costs — query costs
  app.get('/costs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.queryCosts(request, reply);
  });

  // GET /api/v1/ai-cost/costs/summary — aggregated summary
  app.get('/costs/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCostSummary(request, reply);
  });

  // POST /api/v1/ai-cost/costs/record — record a cost entry
  app.post('/costs/record', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordCost(request, reply);
  });

  // ==================== Dashboard ====================

  // GET /api/v1/ai-cost/dashboard — real-time dashboard data
  app.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDashboard(request, reply);
  });

  // ==================== Alerts ====================

  // GET /api/v1/ai-cost/alerts — active alerts
  app.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlerts(request, reply);
  });

  // ==================== Model Pricing ====================

  // GET /api/v1/ai-cost/models/pricing — pricing table
  app.get('/models/pricing', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPricing(request, reply);
  });
}
