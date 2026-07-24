import { FastifyInstance, FastifyError, FastifyReply } from 'fastify';

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode?: number;
}

export async function errorHandler(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(async (error: FastifyError, _request, reply: FastifyReply) => {
    fastify.log.error(error, 'Unhandled error');

    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_ERROR';

    const response: ErrorResponse = {
      success: false,
      error: code,
      message: error.message || 'Internal server error',
      statusCode,
    };

    await reply.status(statusCode).send(response);
  });
}
