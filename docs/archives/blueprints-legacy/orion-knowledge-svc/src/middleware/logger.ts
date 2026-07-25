import { FastifyInstance, FastifyRequest } from 'fastify';

// Extend FastifyRequest to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

export async function logger(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request, _reply) => {
    (request as FastifyRequest & { startTime: number }).startTime = Date.now();
    request.log.info({ method: request.method, url: request.url }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const req = request as FastifyRequest & { startTime?: number };
    const duration = Date.now() - (req.startTime || Date.now());
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${duration}ms`,
      },
      'Request completed'
    );
  });
}
