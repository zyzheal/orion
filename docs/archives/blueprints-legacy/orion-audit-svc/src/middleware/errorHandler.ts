import type { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
}

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = reply.statusCode !== undefined && reply.statusCode >= 400 ? reply.statusCode : 500;

  const response: ErrorResponse = {
    error: statusCode === 500 ? 'Internal Server Error' : statusCode >= 400 ? 'Client Error' : 'Error',
    message: error.message || 'An unexpected error occurred',
    statusCode,
    timestamp: new Date().toISOString(),
    path: request.url,
  };

  request.log.error(
    { err: error, url: request.url, method: request.method },
    'Request error'
  );

  return reply.status(statusCode).send(response);
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: request.url,
  } as ErrorResponse);
}
