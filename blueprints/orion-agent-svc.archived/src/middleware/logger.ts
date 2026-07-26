import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';

export function createLogger(env: string): pino.Logger {
  return pino({
    level: env === 'production' ? 'info' : 'debug',
    transport:
      env === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}

/**
 * Request logging hook
 */
export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  request.log.info(
    { method: request.method, url: request.url },
    'incoming request',
  );
}
