/**
 * AI Change Intelligence API Routes
 *
 * Routes under /api/v1/change-intelligence
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ChangeIntelligenceService } from '../services/change-intelligence/ChangeIntelligenceService';
import { ChangeIntelligenceController } from './controllers/ChangeIntelligenceController';
import { EventBusService } from '../services/event-bus-service';

export default async function changeIntelligenceRoutes(
  app: FastifyInstance,
  options?: { eventBus?: EventBusService }
): Promise<void> {
  const service = new ChangeIntelligenceService({ eventBus: options?.eventBus });
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
