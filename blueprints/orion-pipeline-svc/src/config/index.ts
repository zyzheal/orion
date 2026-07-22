// src/config/index.ts
// 应用配置

import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3100),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  logPretty: z.coerce.boolean().default(true),
  redisUrl: z.string().default('redis://localhost:6379'),
  platformCoreUrl: z.string().default('http://localhost:3000'),
  platformCoreApiKey: z.string().optional(),
  agentSvcUrl: z.string().default('http://localhost:3200'),
  agentSvcApiKey: z.string().optional(),
  gatewayUrl: z.string().default('http://localhost:8080'),
  pipelineMaxConcurrentRuns: z.coerce.number().default(10),
  pipelineRunTimeoutMs: z.coerce.number().default(3600000),
  pipelineLogRetentionDays: z.coerce.number().default(30),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    logLevel: process.env.LOG_LEVEL,
    logPretty: process.env.LOG_PRETTY,
    redisUrl: process.env.REDIS_URL,
    platformCoreUrl: process.env.PLATFORM_CORE_URL,
    platformCoreApiKey: process.env.PLATFORM_CORE_API_KEY,
    agentSvcUrl: process.env.AGENT_SVC_URL,
    agentSvcApiKey: process.env.AGENT_SVC_API_KEY,
    gatewayUrl: process.env.GATEWAY_URL,
    pipelineMaxConcurrentRuns: process.env.PIPELINE_MAX_CONCURRENT_RUNS,
    pipelineRunTimeoutMs: process.env.PIPELINE_RUN_TIMEOUT_MS,
    pipelineLogRetentionDays: process.env.PIPELINE_LOG_RETENTION_DAYS,
  });

  if (!result.success) {
    throw new Error(
      `Invalid configuration: ${result.error.errors.map((e) => e.message).join(', ')}`
    );
  }

  return result.data;
}

// TODO: 支持从 .env 文件加载 (dotenv)
// TODO: 支持从远程配置中心加载配置
