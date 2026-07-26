import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";
import { config } from "../config";

export function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const start = Date.now();

  reply.raw.on("finish", () => {
    const duration = Date.now() - start;
    const logEntry = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      remoteAddress: request.ip,
      timestamp: new Date().toISOString(),
    };

    if (config.log.level === "debug") {
      console.log(JSON.stringify(logEntry));
    } else if (reply.statusCode >= 500) {
      console.error(JSON.stringify({ ...logEntry, level: "error" }));
    } else if (reply.statusCode >= 400) {
      console.warn(JSON.stringify({ ...logEntry, level: "warn" }));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });

  done();
}
