import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { skillRoutes } from "./routes/skill";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.log.level,
      transport:
        config.server.nodeEnv === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.cors.origin === "*" ? true : config.cors.origin,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID", "X-Total-Count"],
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
    errorResponseBuilder: (_req: any, context: { after: string | number }) => ({
      success: false,
      error: `Rate limit exceeded. Try again in ${Math.ceil(Number(context.after) / 1000)} seconds.`,
      statusCode: 429,
    }),
  });

  // Register middleware
  fastify.addHook("onRequest", requestLogger);

  // Register routes
  await fastify.register(skillRoutes, { prefix: "/api/v1/skills" });

  // Health endpoint at root
  fastify.get("/health", async () => ({
    success: true,
    data: { status: "ok", service: "orion-skill-svc" },
    meta: { timestamp: new Date().toISOString() },
  }));

  // Register error handler
  fastify.setErrorHandler(errorHandler);

  return fastify;
}
