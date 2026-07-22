import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(3002),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string().url().default('postgresql://localhost:5432/orion'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  natsUrl: z.string().url().default('nats://localhost:4222'),
  platformServiceUrl: z.string().url().default('http://localhost:3001'),
  jwtSecret: z.string().default('orion-dev-secret'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  logPretty: z.coerce.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    port: process.env.PORT,
    host: process.env.HOST,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    natsUrl: process.env.NATS_URL,
    platformServiceUrl: process.env.PLATFORM_SERVICE_URL,
    jwtSecret: process.env.JWT_SECRET,
    logLevel: process.env.LOG_LEVEL,
    logPretty: process.env.LOG_PRETTY,
  });

  if (!result.success) {
    console.error('[config] Invalid configuration:', result.error.flatten());
    process.exit(1);
  }

  return result.data;
}
