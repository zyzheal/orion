import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { getPool, closePool, runMigrations } from "./utils/database";
import { SkillService } from "./services/SkillService";
import { skillRoutes } from "./routes/skill";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";

let skillService: SkillService | null = null;

export function getSkillService(): SkillService {
  if (!skillService) skillService = new SkillService();
  return skillService;
}

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

  // Initialize database
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      await runMigrations();
      fastify.log.info("[skill] Database migrations completed");
    } else {
      fastify.log.warn("[skill] DATABASE_URL not set, skipping database initialization");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fastify.log.warn(`[skill] Database initialization failed: ${msg}`);
  }

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

  // Decorate fastify with service
  fastify.decorate("skillService", getSkillService());

  // Register routes
  await fastify.register(skillRoutes, { prefix: "/api/v1/skills" });

  // Health endpoint at root
  fastify.get("/health", async () => {
    try {
      const pool = getPool();
      await pool.query("SELECT 1");
      return {
        success: true,
        data: { status: "ok", service: "orion-skill-svc" },
        meta: { timestamp: new Date().toISOString(), checks: { database: "up" } },
      };
    } catch {
      return {
        success: true,
        data: { status: "degraded", service: "orion-skill-svc" },
        meta: { timestamp: new Date().toISOString(), checks: { database: "down" } },
      };
    }
  });

  fastify.addHook("onClose", async () => { await closePool(); });

  // Register error handler
  fastify.setErrorHandler(errorHandler);

  return fastify;
}
