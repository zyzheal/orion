/**
 * SLA Routes - SLA 管理路由
 * POST   /api/v1/ticketing/sla         设置 SLA
 * GET    /api/v1/tickets/reports/sla   SLA 合规报告
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { slaService } from '../services/SLAService';

export async function slaRoutes(app: FastifyInstance): Promise<void> {
  // 设置 SLA 策略
  app.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string' },
            ticketType: { type: 'string' },
            priority: { type: 'string' },
            enabled: { type: 'boolean', default: true },
            metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  targetSeconds: { type: 'number' },
                  warningThreshold: { type: 'number' },
                  enabled: { type: 'boolean' },
                },
              },
            },
            escalationRules: {
              type: 'array',
              items: { type: 'object' },
            },
          },
          required: ['name', 'ticketType', 'priority', 'metrics'],
        },
        summary: 'Create or configure an SLA policy',
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const body = request.body as Record<string, any>;

      const policy = await slaService.createSLAPolicy({
        ...body,
        tenantId,
        conditions: body.conditions ?? [],
        scheduleId: body.scheduleId ?? null,
      } as any);

      reply.code(201).send({ success: true, data: policy });
    }
  );

  // SLA 合规报告
  app.get(
    '/reports/sla',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
            categoryId: { type: 'string', format: 'uuid' },
            priority: { type: 'string' },
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
        summary: 'Get SLA compliance report',
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const query = request.query as Record<string, any>;

      const dateFrom = query.dateFrom
        ? new Date(query.dateFrom as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = query.dateTo
        ? new Date(query.dateTo as string)
        : new Date();

      const report = await slaService.generateSLAReport(
        tenantId,
        dateFrom,
        dateTo
      );

      reply.send({ success: true, data: report });
    }
  );

  // 获取 SLA 策略列表
  app.get(
    '/policies',
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const policies = await slaService.listSLAPolicies(tenantId);
      reply.send({ success: true, data: policies });
    }
  );
}
