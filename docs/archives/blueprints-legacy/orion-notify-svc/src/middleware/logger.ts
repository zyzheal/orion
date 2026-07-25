import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function requestLogger(request: FastifyRequest, _reply: FastifyReply) {
  request.log.info({ method: request.method, url: request.url }, 'Incoming request');
}

export async function loggerMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    fastify.log.info({ method: request.method, url: request.url }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode, responseTime: reply.elapsedTime },
      'Request completed'
    );
  });
}
