import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export function requestLogger(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  request.log.info({ method: request.method, url: request.url }, 'Incoming request');
  done();
}
