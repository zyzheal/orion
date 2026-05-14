import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
}

export function errorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: error.errors,
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: request.url,
      } as ErrorResponse);
      return;
    }

    const statusCode = reply.statusCode !== undefined && reply.statusCode >= 400 ? reply.statusCode : 500;

    const response: ErrorResponse = {
      error: statusCode === 500 ? 'Internal Server Error' : statusCode >= 400 ? 'Client Error' : 'Error',
      message: error.message || 'An unexpected error occurred',
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    fastify.log.error(
      { err: error, url: request.url, method: request.method },
      'Request error'
    );

    void reply.status(statusCode).send(response);
  });

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    void reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: request.url,
    } as ErrorResponse);
  });
}
