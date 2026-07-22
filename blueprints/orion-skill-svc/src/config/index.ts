import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3021),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("orion_skills"),
  DB_USER: z.string().default("orion"),
  DB_PASSWORD: z.string().default("orion_password"),
  DB_SSL: z.coerce.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(20),

  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const config = parsed.data;

  return {
    server: {
      port: config.PORT,
      host: config.HOST,
      nodeEnv: config.NODE_ENV,
    },
    database: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      name: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      ssl: config.DB_SSL,
      poolMin: config.DB_POOL_MIN,
      poolMax: config.DB_POOL_MAX,
    },
    cors: {
      origin: config.CORS_ORIGIN,
    },
    rateLimit: {
      max: config.RATE_LIMIT_MAX,
      window: config.RATE_LIMIT_WINDOW,
    },
    log: {
      level: config.LOG_LEVEL,
    },
  };
}

export const config = loadConfig();
