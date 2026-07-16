import { FastifyInstance } from 'fastify';

/**
 * 请求日志中间件
 */
export function registerLogger(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    request.log.info({
      method: request.method,
      url: request.url,
      ip: request.ip,
    }, 'Incoming request');
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: reply.elapsedTime,
    }, 'Response sent');
  });
}

export default registerLogger;
