/**
 * Dispatch Routes - 智能派单路由
 * POST   /api/v1/tickets/dispatch/auto/:id          自动派单
 * GET    /api/v1/tickets/dispatch/best-match/:id    最佳匹配
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dispatchEngine } from '../services/DispatchEngine';
import { DispatchStrategy } from '../types/ticket';

export async function dispatchRoutes(app: FastifyInstance): Promise<void> {
  // 自动派单
  app.post(
    '/auto/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            strategy: {
              type: 'string',
              enum: Object.values(DispatchStrategy),
            },
            forceDispatch: { type: 'boolean', default: false },
            excludeAssignees: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        tags: ['Dispatch'],
        summary: 'Auto-dispatch a ticket to the best match',
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const { id } = (request as any).params;
      const body = request.body as Record<string, any>;

      const result = await dispatchEngine.autoDispatch(
        {
          ticketId: id,
          strategy: body?.strategy,
          forceDispatch: body?.forceDispatch,
          excludeAssignees: body?.excludeAssignees,
        },
        tenantId
      );

      reply.send({ success: true, data: result });
    }
  );

  // 最佳匹配查询
  app.get(
    '/best-match/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
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
        tags: ['Dispatch'],
        summary: 'Get best match candidates for a ticket without assigning',
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = (request as any).tenantId;
      const { id } = (request as any).params;

      const result = await dispatchEngine.findBestMatch(id, tenantId);

      reply.send({ success: true, data: result });
    }
  );
}
