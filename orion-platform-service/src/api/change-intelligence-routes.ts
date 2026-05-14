/**
 * AI Change Intelligence API Routes
 *
 * Routes under /api/v1/change-intelligence
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChangeIntelligenceService } from '../services/change-intelligence/ChangeIntelligenceService';
import { ChangeIntelligenceController } from './controllers/ChangeIntelligenceController';
import { EventBusService } from '../services/event-bus-service';
import { DatabasePool } from '../services/database';
import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
} from '../repositories/ChangeIntelligenceRepository';

export default async function changeIntelligenceRoutes(
  app: FastifyInstance,
  options?: { database?: DatabasePool; eventBus?: EventBusService }
): Promise<void> {
  const db = options?.database;
  const changeIntelligenceRepo = db ? new ChangeIntelligenceRepository(db) : null;
  const affectedServiceRepo = db ? new AffectedServiceRepository(db) : null;
  const riskFactorRepo = db ? new RiskFactorRepository(db) : null;
  const historicalMatchRepo = db ? new HistoricalMatchRepository(db) : null;

  const service = new ChangeIntelligenceService(
    changeIntelligenceRepo!,
    affectedServiceRepo!,
    riskFactorRepo!,
    historicalMatchRepo!,
  );
  const controller = new ChangeIntelligenceController(service);

  // POST /analyze - 触发分析
  app.post('/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyze(request, reply);
  });

  // GET /reports - 报告列表
  app.get('/reports', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listReports(request, reply);
  });

  // GET /reports/:id - 报告详情
  app.get('/reports/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReport(request, reply);
  });

  // GET /reports/:id/blast-radius - 影响面图数据
  app.get('/reports/:id/blast-radius', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBlastRadius(request, reply);
  });
}
