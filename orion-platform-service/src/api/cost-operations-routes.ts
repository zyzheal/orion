/**
 * Cost Operations API Routes
 * Prefix: /api/v1/cost-operations
 *
 * Phase 2: 成本运营 API - 预算门禁、异常检测、优化建议
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { CostBudgetGuardService } from '../services/cost/CostBudgetGuardService';
import { CostAnomalyDetectionService } from '../services/cost/CostAnomalyDetectionService';
import { CostOptimizationService } from '../services/cost/CostOptimizationService';
import { CostOperationsController } from './controllers/CostOperationsController';

interface CostOperationsRoutesOptions {
  database: DatabasePool;
}

export default async function costOperationsRoutes(
  app: FastifyInstance,
  options: CostOperationsRoutesOptions,
): Promise<void> {
  if (!options.database) {
    console.warn('[CostOperationsRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const budgetGuardService = new CostBudgetGuardService(options.database);
  const anomalyDetectionService = new CostAnomalyDetectionService(options.database);
  const optimizationService = new CostOptimizationService(options.database);
  const controller = new CostOperationsController(
    budgetGuardService,
    anomalyDetectionService,
    optimizationService,
  );

  // ==================== Budget Guard ====================

  // POST /budget-guards - Create budget guard
  app.post('/budget-guards', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createBudgetGuard(request, reply);
  });

  // GET /budget-guards - Get budget guard list
  app.get('/budget-guards', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBudgetGuards(request, reply);
  });

  // POST /evaluate - Evaluate cost against budget
  app.post('/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateCost(request, reply);
  });

  // ==================== Cost Anomaly Detection ====================

  // POST /anomalies - Detect cost anomalies
  app.post('/anomalies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectAnomalies(request, reply);
  });

  // GET /trend - Get cost trend
  app.get('/trend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCostTrend(request, reply);
  });

  // GET /forecast - Cost forecast (predict end-of-month)
  app.get('/forecast', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.forecastCost(request, reply);
  });

  // ==================== Cost Optimization ====================

  // GET /suggestions - Get optimization suggestions
  app.get('/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getOptimizationSuggestions(request, reply);
  });
}
