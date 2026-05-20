/**
 * BI Dashboard API Routes
 *
 * Provides dashboard data for executive, manager, and engineer views.
 * Currently returns empty/default data structure to prevent frontend crashes.
 * Future implementation should aggregate real ticket/efficiency data.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { DatabasePool } from '../services/database';

interface BiDashboardRoutesOptions {
  database?: DatabasePool;
}

export default async function biDashboardRoutes(app: FastifyInstance, options: BiDashboardRoutesOptions): Promise<void> {
  const pool = options.database;

  const emptyResponse = {
    success: true,
    data: {},
    message: 'BI dashboard data not yet implemented',
  };

  // GET /api/v1/tickets/bi/dashboard/executive
  app.get('/tickets/bi/dashboard/executive', {
    onRequest: [authenticateUser],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: {
        overview: {
          totalTickets: 0, resolvedTickets: 0, openTickets: 0,
          overallResolutionRate: 0, avgResolutionTimeHours: 0,
          slaComplianceRate: 0, totalEngineers: 0, activeEngineers: 0,
        },
        trends: {
          ticketVolumeTrend: [], resolutionTimeTrend: [], slaComplianceTrend: [],
        },
        teamRanking: { topPerformers: [], bottomPerformers: [] },
        alerts: { slaBreachedCount: 0, overdueTicketsCount: 0, overloadedEngineers: 0, unassignedOlderThan24h: 0 },
        distribution: { byCategory: {}, byPriority: {} },
      },
    });
  });

  // GET /api/v1/tickets/bi/dashboard/manager
  app.get('/tickets/bi/dashboard/manager', {
    onRequest: [authenticateUser],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: {
        teamOverview: {
          totalTickets: 0, resolvedCount: 0, avgResolutionTimeHours: 0,
          slaComplianceRate: 0, teamLoadPercentage: 0,
        },
        memberMetrics: [],
        weekOverWeek: {
          ticketsCreatedChange: 0, resolvedChange: 0,
          avgResolutionTimeChange: 0, slaComplianceChange: 0,
        },
        transferAnalysis: {
          totalTransfers: 0, avgTransfersPerTicket: 0, topTransferReasons: [],
        },
      },
    });
  });

  // GET /api/v1/tickets/bi/dashboard/engineer/:engineerId
  app.get('/tickets/bi/dashboard/engineer/:engineerId', {
    onRequest: [authenticateUser],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: {
        personalOverview: {
          engineerId: 'unknown', engineerName: 'Unknown', currentLoad: 0,
          totalResolved: 0, avgResolutionTimeHours: 0, slaComplianceRate: 0,
          performanceGrade: 'N/A', rank: 0, totalInTeam: 0,
        },
        personalTrend: [],
        strengths: [],
        weaknesses: [],
        activeTickets: [],
        resolvedTickets: [],
        efficiencyScore: 0,
        teamAvgResolutionTime: 0,
      },
    });
  });

  // GET /api/v1/efficiency/score
  app.get('/efficiency/score', {
    onRequest: [authenticateUser],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: { score: 0, grade: 'N/A', period: 'N/A' },
    });
  });
}
