/**
 * Message Queue API Routes
 *
 * F008: Queue management endpoints.
 *
 * Prefix: /v1/message-queue
 *
 * Endpoints:
 * - POST   /v1/message-queue/enqueue              - Enqueue a message
 * - POST   /v1/message-queue/dequeue              - Dequeue a message
 * - POST   /v1/message-queue/schedule             - Schedule delayed message
 * - POST   /v1/message-queue/:messageId/ack       - Acknowledge completion
 * - POST   /v1/message-queue/:messageId/nack      - Negative acknowledge
 * - POST   /v1/message-queue/:messageId/retry     - Retry a failed message
 * - GET    /v1/message-queue/dead-letter          - List dead letter messages
 * - POST   /v1/message-queue/dead-letter/:id/replay - Replay a dead letter
 * - GET    /v1/message-queue/stats                - Queue statistics
 * - GET    /v1/message-queue/messages             - List messages
 * - POST   /v1/message-queue/consumer/register    - Register consumer
 * - POST   /v1/message-queue/consumer/:id/heartbeat - Consumer heartbeat
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { MessageQueueService } from '../services/message-queue/message-queue-service';
import { ValidationError, ServiceUnavailableError, handleError } from '../errors';

interface MessageQueueRoutesOptions {
  messageQueueService?: MessageQueueService;
}

export default async function messageQueueRoutes(
  app: FastifyInstance,
  options: MessageQueueRoutesOptions,
): Promise<void> {
  const mq = options.messageQueueService;

  // ─── Enqueue ────────────────────────────────────────────────────────────

  app.post(
    '/enqueue',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const body = request.body as any;
      if (!body.payload || !body.payload.type) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const messageId = await mq.enqueue(body.payload, {
        queueName: body.queueName,
        priority: body.priority ?? 0,
        maxRetries: body.maxRetries ?? 3,
        taskId: body.taskId,
      });

      return reply.code(201).send({
        success: true,
        data: { messageId },
      });
    },
  );

  // ─── Dequeue ────────────────────────────────────────────────────────────

  app.post(
    '/dequeue',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const body = request.body as any;
      const message = await mq.dequeue({
        queueName: body?.queueName,
        consumerId: body?.consumerId,
      });

      if (!message) {
        return reply.send({ success: true, data: null, message: 'Queue empty' });
      }

      return reply.send({ success: true, data: message });
    },
  );

  // ─── Schedule (Delayed) ─────────────────────────────────────────────────

  app.post(
    '/schedule',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const body = request.body as any;
      if (!body.payload || !body.executeAt) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const executeAt = new Date(body.executeAt);
      const messageId = await mq.schedule(body.payload, executeAt, {
        queueName: body.queueName,
        maxRetries: body.maxRetries ?? 3,
        taskId: body.taskId,
      });

      return reply.code(201).send({
        success: true,
        data: { messageId, executeAt: executeAt.toISOString() },
      });
    },
  );

  // ─── Ack ────────────────────────────────────────────────────────────────

  app.post(
    '/:messageId/ack',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const { messageId } = request.params as { messageId: string };
      await mq.ack(messageId);

      return reply.send({ success: true, message: 'Message acknowledged' });
    },
  );

  // ─── Nack ───────────────────────────────────────────────────────────────

  app.post(
    '/:messageId/nack',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const { messageId } = request.params as { messageId: string };
      const body = request.body as any;
      await mq.nack(messageId, body?.error);

      return reply.send({ success: true, message: 'Message nacknowledged (retried or dead-lettered)' });
    },
  );

  // ─── Retry ──────────────────────────────────────────────────────────────

  app.post(
    '/:messageId/retry',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const { messageId } = request.params as { messageId: string };
      await mq.retry(messageId);

      return reply.send({ success: true, message: 'Message retried' });
    },
  );

  // ─── Dead Letter List ───────────────────────────────────────────────────

  app.get(
    '/dead-letter',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const query = request.query as any;
      const deadLetters = mq.listDeadLetters(query?.queueName);

      return reply.send({ success: true, data: deadLetters, total: deadLetters.length });
    },
  );

  // ─── Dead Letter Replay ─────────────────────────────────────────────────

  app.post(
    '/dead-letter/:id/replay',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const { id } = request.params as { id: string };
      const body = request.body as any;
      const newMessageId = await mq.replayDeadLetter(id, {
        maxRetries: body?.maxRetries,
      });

      return reply.send({
        success: true,
        data: { newMessageId },
        message: 'Dead letter replayed',
      });
    },
  );

  // ─── Stats ──────────────────────────────────────────────────────────────

  app.get(
    '/stats',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const query = request.query as any;
      const stats = mq.getStats(query?.queueName);

      return reply.send({ success: true, data: stats });
    },
  );

  // ─── List Messages ──────────────────────────────────────────────────────

  app.get(
    '/messages',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'read' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const query = request.query as any;
      const messages = mq.listMessages({
        queueName: query?.queueName,
        status: query?.status,
        limit: parseInt(query?.limit || '100', 10),
      });

      return reply.send({ success: true, data: messages, total: messages.length });
    },
  );

  // ─── Register Consumer ──────────────────────────────────────────────────

  app.post(
    '/consumer/register',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const body = request.body as any;
      if (!body.queueName || !body.groupName) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'))
      }

      const consumer = mq.registerConsumer(body.queueName, body.groupName, body.consumerId);

      return reply.code(201).send({ success: true, data: consumer });
    },
  );

  // ─── Consumer Heartbeat ─────────────────────────────────────────────────

  app.post(
    '/consumer/:id/heartbeat',
    { preHandler: [authenticateUser, requirePermission({ resource: 'message-queue', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!mq) {
        return handleError(reply, new ServiceUnavailableError('Message queue service not initialized'));
      }

      const { id } = request.params as { id: string };
      mq.heartbeat(id);

      return reply.send({ success: true, message: 'Heartbeat updated' });
    },
  );
}
