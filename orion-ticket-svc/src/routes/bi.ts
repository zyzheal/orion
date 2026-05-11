/**
 * BI Routes - BI 分析路由
 * GET    /api/v1/tickets/bi/dashboard/executive  高管看板
 * GET    /api/v1/tickets/bi/dashboard/manager    经理看板
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DashboardType, TimeRange } from '../types/ticket';

// TODO: 引入 BI 服务
// import { biService } from '../services/BIService';

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
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const query = request.query as Record<string, any>;

      // TODO: 调用 BI 服务获取高管看板数据
      // 高管看板关注:
      // - 总体工单量和趋势
      // - SLA 合规率
      // - 客户满意度
      // - 各部门/团队对比
      // - 重大事件和告警
      // const data = await biService.getDashboard(
      //   DashboardType.EXECUTIVE,
      //   tenantId,
      //   { timeRange: query.timeRange }
      // );

      reply.send({
        success: true,
        data: {
          // TODO: 替换为真实数据
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
          alerts: [],
        },
      });
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
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const query = request.query as Record<string, any>;

      // TODO: 调用 BI 服务获取经理看板数据
      // 经理看板关注:
      // - 团队工单分布
      // - 人员负载和利用率
      // - SLA 违规预警
      // - 派单效率
      // - 审批积压
      // const data = await biService.getDashboard(
      //   DashboardType.MANAGER,
      //   tenantId,
      //   {
      //     timeRange: query.timeRange,
      //     groupId: query.groupId,
      //     assigneeId: query.assigneeId,
      //   }
      // );

      reply.send({
        success: true,
        data: {
          // TODO: 替换为真实数据
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
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;

      // TODO: 实现统计查询
      // const stats = await biService.getStats(tenantId, {
      //   timeRange: (request.query as any).timeRange,
      // });

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
  );
}
