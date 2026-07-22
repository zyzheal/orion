/**
 * BI Routes - BI 分析路由
 * GET    /api/v1/tickets/bi/dashboard/executive  高管看板
 * GET    /api/v1/tickets/bi/dashboard/manager    经理看板
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TimeRange } from '../types/ticket';
import { ticketBIService } from '../services/TicketBIService';

interface QueryTimeRange {
  timeRange?: TimeRange;
  dateFrom?: string;
  dateTo?: string;
  groupId?: string;
  assigneeId?: string;
}

export async function biRoutes(app: FastifyInstance): Promise<void> {
  // 高管看板
  app.get(
    '/dashboard/executive',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'string',
              enum: Object.values(TimeRange),
              default: TimeRange.LAST_30_DAYS,
            },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
        tags: ['BI'],
        summary: 'Executive dashboard - high-level KPIs and trends',
      },
    },
    async (
      request: FastifyRequest<{ Querystring: QueryTimeRange }>,
      reply: FastifyReply
    ) => {
      const query = request.query;

      const { periodStart, periodEnd } = calculateDateRange(
        query.timeRange ?? TimeRange.LAST_30_DAYS,
        query.dateFrom,
        query.dateTo
      );

      try {
        const dashboard = ticketBIService.getExecutiveDashboard({
          periodStart,
          periodEnd,
        });

        reply.send({
          success: true,
          data: dashboard,
        });
      } catch (error) {
        reply.send({
          success: false,
          data: {
            overview: {
              totalTickets: 0,
              resolvedTickets: 0,
              openTickets: 0,
              overallResolutionRate: 0,
              avgResolutionTimeHours: 0,
              slaComplianceRate: 0,
              totalEngineers: 0,
              activeEngineers: 0,
            },
            trends: [],
            teamRanking: [],
          },
        });
      }
    }
  );

  // 经理看板
  app.get(
    '/dashboard/manager',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'string',
              enum: Object.values(TimeRange),
              default: TimeRange.THIS_WEEK,
            },
            groupId: { type: 'string', format: 'uuid' },
            assigneeId: { type: 'string', format: 'uuid' },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
        tags: ['BI'],
        summary: 'Manager dashboard - team performance and workload',
      },
    },
    async (
      request: FastifyRequest<{ Querystring: QueryTimeRange }>,
      reply: FastifyReply
    ) => {
      const query = request.query;

      const { periodStart, periodEnd } = calculateDateRange(
        query.timeRange ?? TimeRange.THIS_WEEK,
        query.dateFrom,
        query.dateTo
      );

      try {
        const dashboard = ticketBIService.getManagerDashboard({
          periodStart,
          periodEnd,
          groupId: query.groupId,
          assigneeId: query.assigneeId,
        });

        reply.send({
          success: true,
          data: dashboard,
        });
      } catch (error) {
        reply.send({
          success: false,
          data: {
            summary: {
              totalTickets: 0,
              openTickets: 0,
              resolvedTickets: 0,
              slaComplianceRate: 0,
              averageResolutionTime: 0,
              averageCustomerSatisfaction: 0,
              periodOverPeriodChange: 0,
            },
            charts: [],
            tables: [],
            alerts: [],
          },
        });
      }
    }
  );

  // 统计概览
  app.get(
    '/stats',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'string',
              enum: Object.values(TimeRange),
              default: TimeRange.LAST_7_DAYS,
            },
          },
        },
        tags: ['BI'],
        summary: 'Get overall ticket statistics',
      },
    },
    async (
      request: FastifyRequest<{ Querystring: QueryTimeRange }>,
      reply: FastifyReply
    ) => {
      const query = request.query;
      const { periodStart, periodEnd } = calculateDateRange(
        query.timeRange ?? TimeRange.LAST_7_DAYS,
        undefined,
        undefined
      );

      try {
        const dashboard = ticketBIService.getExecutiveDashboard({
          periodStart,
          periodEnd,
        });

        reply.send({
          success: true,
          data: {
            totalTickets: dashboard.overview?.totalTickets ?? 0,
            byType: {},
            byStatus: {},
            byPriority: {},
            bySource: {},
            trends: dashboard.trends?.ticketVolumeTrend ?? [],
          },
        });
      } catch (error) {
        reply.send({
          success: true,
          data: {
            totalTickets: 0,
            byType: {},
            byStatus: {},
            byPriority: {},
            bySource: {},
            trends: [],
          },
        });
      }
    }
  );
}

// Helper function to calculate date range
function calculateDateRange(
  timeRange: TimeRange,
  dateFrom?: string,
  dateTo?: string
): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  let periodEnd = now;

  // If explicit dates provided, use them
  if (dateFrom && dateTo) {
    return {
      periodStart: new Date(dateFrom),
      periodEnd: new Date(dateTo),
    };
  }

  // Calculate based on timeRange
  let periodStart: Date;
  switch (timeRange) {
    case TimeRange.TODAY:
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case TimeRange.YESTERDAY:
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      periodStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      periodEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      break;
    case TimeRange.THIS_WEEK:
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
      break;
    case TimeRange.LAST_WEEK:
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay() - 7);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
      break;
    case TimeRange.THIS_MONTH:
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case TimeRange.LAST_MONTH:
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case TimeRange.LAST_7_DAYS:
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case TimeRange.LAST_30_DAYS:
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case TimeRange.LAST_90_DAYS:
      periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { periodStart, periodEnd };
}