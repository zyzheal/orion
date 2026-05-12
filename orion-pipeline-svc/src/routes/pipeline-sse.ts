import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { EventEmitter } from 'events';
import { PipelineLogSSEService } from '../services/PipelineLogSSEService';

export async function pipelineSSERoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Use a shared event bus for SSE event forwarding
  const localBus = new EventEmitter();
  const sseService = new PipelineLogSSEService(localBus);

  fastify.get('/pipelines/:id/runs/:rid/logs', async (request, reply) => {
    const pipelineId = (request.params as any).id;
    const runId = (request.params as any).rid;
    const userId = (request.headers as any)['x-user-id'] || 'anonymous';

    // Set SSE headers
    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no');

    // Get filter options from query
    const query = request.query as any;
    const options = {
      includeLogs: query.includeLogs !== 'false',
      includeStatus: query.includeStatus !== 'false',
      logLevel: query.logLevel ? query.logLevel.split(',') : undefined,
    };

    // Create SSE connection
    const connId = sseService.createConnection(pipelineId, runId, userId, reply, options);

    // Handle client disconnect
    const onClose = () => {
      sseService.removeConnection(connId);
      reply.raw.removeListener('close', onClose);
    };
    reply.raw.on('close', onClose);

    // Return the raw response for streaming
    return reply;
  });

  // SSE stats endpoint
  fastify.get('/pipelines/sse/stats', async (request, reply) => {
    return reply.send(sseService.getStats());
  });

  // Publish log event (internal API for pipeline engine)
  fastify.post('/pipelines/sse/publish/log', async (request, reply) => {
    const log = request.body as any;
    sseService.publishLogEvent(log);
    return reply.send({ published: true });
  });

  // Publish status event (internal API for pipeline engine)
  fastify.post('/pipelines/sse/publish/status', async (request, reply) => {
    const status = request.body as any;
    sseService.publishStatusEvent(status);
    return reply.send({ published: true });
  });
}
