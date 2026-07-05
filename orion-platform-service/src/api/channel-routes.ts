/**
 * Omnichannel Ingress API Routes (Migration 321)
 *
 * Channel configuration CRUD + message log queries + webhook ingress
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ChannelConfigRepository, ChannelMessageRepository, ChannelIngressService } from '../services/channel';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { handleError, ServiceUnavailableError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('channel-routes');

interface ChannelRoutesOptions {
  database?: DatabasePool;
}

export default async function channelRoutes(app: FastifyInstance, options: ChannelRoutesOptions): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[ChannelRoutes] Database not available, routes will return 503');
    return;
  }

  const channelRepo = new ChannelConfigRepository(pool);
  const messageRepo = new ChannelMessageRepository(pool);
  const ingressService = new ChannelIngressService(channelRepo, messageRepo);

  // GET /channels - List channel configurations
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const query = request.query as Record<string, string>;
      const result = await ingressService.listChannels({
        channelType: query.channelType,
        enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return reply.send({ success: true, data: result.rows, total: result.total });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /channels - Create channel configuration
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const body = request.body as Record<string, unknown>;
      const userId = (request as any).user?.userId;
      const channel = await ingressService.createChannel(body as any, userId);
      return reply.status(201).send({ success: true, data: channel });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /channels/:id - Get channel by ID
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const channel = await ingressService.getChannel(request.params.id);
      return reply.send({ success: true, data: channel });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /channels/:id - Update channel
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const channel = await ingressService.updateChannel(request.params.id, request.body as any);
      return reply.send({ success: true, data: channel });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /channels/:id - Delete channel
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      await ingressService.deleteChannel(request.params.id);
      return reply.send({ success: true, message: 'Channel deleted' });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /channels/:id/test - Test channel
  app.post<{ Params: { id: string } }>('/:id/test', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const result = await ingressService.testChannel(request.params.id);
      return reply.send({ success: true, data: result });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /webhook/:channelId - External webhook ingress (no auth required)
  app.post<{ Params: { channelId: string } }>('/webhook/:channelId', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const message = await ingressService.processInbound(request.params.channelId, request.body as Record<string, unknown>);
      return reply.status(201).send({ success: true, data: { messageId: message.id, status: message.status } });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /logs - Message logs
  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const query = request.query as Record<string, string>;
      const result = await ingressService.listMessages({
        channelId: query.channelId,
        direction: query.direction,
        status: query.status,
        ticketId: query.ticketId,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return reply.send({ success: true, data: result.rows, total: result.total });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
