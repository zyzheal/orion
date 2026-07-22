import type { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export function requestLogger(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const start = Date.now();
    (request as FastifyRequest & { startTime: number }).startTime = start;
    fastify.log.info(
      {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
      'Incoming request'
    );
    done();
  });

  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const startTime = (request as FastifyRequest & { startTime: number }).startTime || Date.now();
    const duration = Date.now() - startTime;
    fastify.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: duration,
      },
      'Response sent'
    );
    done();
  });
}
