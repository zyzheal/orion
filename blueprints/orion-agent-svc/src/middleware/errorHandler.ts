import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const log = request.log || console;

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request body',
      details: error.errors,
    });
    return;
  }

  if (error.validation) {
    reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request parameters',
      details: error.validation,
    });
    return;
  }

  if (error.statusCode && error.statusCode < 500) {
    reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
    });
    return;
  }

  log.error({ err: error, request }, 'Internal server error');
  reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}
