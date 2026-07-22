import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;
  const message = error.message ?? "Internal Server Error";

  let userMessage = message;
  let details: Record<string, unknown> | undefined;

  if (statusCode === 404) {
    userMessage = message || "Resource not found";
  } else if (statusCode === 400) {
    userMessage = message || "Bad request";
  } else if (message.includes("not found")) {
    userMessage = message;
  } else if (message.includes("already exists")) {
    userMessage = message;
  } else if (message.includes("must be between")) {
    userMessage = message;
  } else if (statusCode >= 500) {
    userMessage = "An internal server error occurred";
    details = { requestId: request.id };
  }

  reply.code(statusCode).send({
    success: false,
    error: userMessage,
    statusCode,
    ...(details ? { details } : {}),
    meta: { timestamp: new Date().toISOString() },
  });
}
