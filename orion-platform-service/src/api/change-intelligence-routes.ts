/**
 * Change Intelligence API Routes
 *
 * Routes under /api/v1/change-intelligence
 * AI-powered semantic blast radius analysis and risk scoring
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ChangeIntelligenceService } from '../services/change-intelligence/ChangeIntelligenceService';
import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
} from '../repositories/ChangeIntelligenceRepository';
import { ChangeIntelligenceController } from './controllers/ChangeIntelligenceController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface ChangeIntelligenceRoutesOptions {
  database?: DatabasePool;
}

export default async function changeIntelligenceRoutes(
  app: FastifyInstance,
  options: ChangeIntelligenceRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[ChangeIntelligenceRoutes] No database pool provided, routes will not be functional');
    return;
  }

  // Initialize repositories
  const changeIntelligenceRepo = new ChangeIntelligenceRepository(options.database);
  const affectedServiceRepo = new AffectedServiceRepository(options.database);
  const riskFactorRepo = new RiskFactorRepository(options.database);
  const historicalMatchRepo = new HistoricalMatchRepository(options.database);

  // Initialize service with all repositories
  const service = new ChangeIntelligenceService(
    changeIntelligenceRepo,
    affectedServiceRepo,
    riskFactorRepo,
    historicalMatchRepo
  );

  // Initialize controller
  const controller = new ChangeIntelligenceController(service);

  // ==================== Analysis ====================

  app.post('/analyze', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-intelligence', action: 'write' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyze(request, reply);
  });

  // ==================== Reports ====================

  app.get('/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-intelligence', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listReports(request, reply);
  });

  app.get('/reports/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-intelligence', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getReport(request, reply);
  });

  // ==================== Blast Radius ====================

  app.get('/reports/:id/blast-radius', {
    onRequest: [authenticateUser, requirePermission({ resource: 'change-intelligence', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBlastRadius(request, reply);
  });

  console.log('[ChangeIntelligenceRoutes] Registered all change intelligence routes');
}