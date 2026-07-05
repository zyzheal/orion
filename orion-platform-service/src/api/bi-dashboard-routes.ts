/**
 * BI Dashboard API Routes
 *
 * Provides dashboard data for executive, manager, and engineer views.
 * Data sourced from TicketBIService and EfficiencyDashboardService.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { TicketService } from '../services/ticketing/TicketService';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { EfficiencyDashboardService } from '../services/efficiency/EfficiencyDashboardService';

interface BiDashboardRoutesOptions {
  database?: DatabasePool;
}

export default async function biDashboardRoutes(app: FastifyInstance, options: BiDashboardRoutesOptions = {}): Promise<void> {
  const pool = options.database;

  // Initialize services
  const ticketingRepo = pool ? new TicketingRepository(pool) : undefined;
  const ticketService = new TicketService(undefined, ticketingRepo);
  const efficiencyService = pool ? new EfficiencyDashboardService(pool) : new EfficiencyDashboardService();

  // GET /api/v1/tickets/bi/dashboard/executive
  app.get('/tickets/bi/dashboard/executive', {
    onRequest: [authenticateUser, requirePermission({ resource: 'bi-dashboard', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = ticketService.getExecutiveDashboard();
      return reply.send({ success: true, data: dashboard });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: 'Failed to load executive dashboard', error: error.message });
    }
  });

  // GET /api/v1/tickets/bi/dashboard/manager
  app.get('/tickets/bi/dashboard/manager', {
    onRequest: [authenticateUser, requirePermission({ resource: 'bi-dashboard', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboard = ticketService.getManagerDashboard();
      return reply.send({ success: true, data: dashboard });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: 'Failed to load manager dashboard', error: error.message });
    }
  });

  // GET /api/v1/tickets/bi/dashboard/engineer/:engineerId
  app.get('/tickets/bi/dashboard/engineer/:engineerId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'bi-dashboard', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { engineerId } = request.params as { engineerId: string };
    try {
      const dashboard = ticketService.getEngineerDashboard(engineerId);
      if (!dashboard) {
        return reply.status(404).send({ success: false, message: 'Engineer ' + engineerId + ' not found' });
      }
      return reply.send({ success: true, data: dashboard });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: 'Failed to load engineer dashboard', error: error.message });
    }
  });

  // GET /api/v1/efficiency/score
  app.get('/efficiency/score', {
    onRequest: [authenticateUser, requirePermission({ resource: 'bi-dashboard', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const scenario = await efficiencyService.getScenario('overview', {
        start: thirtyDaysAgo,
        end: now,
      });
      return reply.send({
        success: true,
        data: {
          score: scenario.summary.score,
          grade: scenario.summary.trend === 'up' ? 'A' : scenario.summary.trend === 'down' ? 'C' : 'B',
          period: 'Last 30 days',
          highlights: scenario.summary.highlights,
          issues: scenario.summary.issues,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: 'Failed to load efficiency score', error: error.message });
    }
  });
}
