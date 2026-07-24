import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path?: string;
  details?: unknown;
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const response: ErrorResponse = {
    statusCode: error.statusCode || 500,
    error: error.name || 'InternalServerError',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: request.url,
  };

  if (error instanceof ZodError) {
    response.statusCode = 400;
    response.error = 'ValidationError';
    response.details = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  if (error.code === 'FST_ERR_VALIDATION') {
    response.statusCode = 400;
    response.error = 'BadRequestError';
    response.details = (error as FastifyError & { validation?: unknown[] }).validation;
  }

  if (error.code === 'PGRST_NOT_FOUND' || error.message?.includes('not found')) {
    response.statusCode = 404;
    response.error = 'NotFoundError';
  }

  if (error.code === '23505' || error.message?.includes('duplicate')) {
    response.statusCode = 409;
    response.error = 'ConflictError';
    response.message = 'A resource with the same unique identifier already exists';
  }

  if (error.code === '23503') {
    response.statusCode = 400;
    response.error = 'ForeignKeyViolationError';
    response.message = 'Referenced resource does not exist';
  }

  request.log.error(
    {
      err: error,
      path: request.url,
      method: request.method,
      statusCode: response.statusCode,
    },
    'Request error',
  );

  reply.status(response.statusCode).send(response);
}
