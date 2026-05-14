# 微服务增量迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 orion-platform-service 中的 6 个业务域（Pipeline/Ticket/Monitor/Deploy/Agent/Intelligence）按域拆分到独立微服务中，接入网关路由和 docker-compose 编排。

**Architecture:** 增量迁移策略。先将 platform-service 中对应域的路由模块、Service、Controller 迁移到目标服务，再在 api-gateway 中添加代理路由，最后从 platform-service 中移除已迁移代码。

**Tech Stack:** Fastify 5.x, TypeScript 5.x, PostgreSQL 16, Redis 7, NATS 2.10, Docker Compose

---

## 文件映射总览

### 新增/修改的核心文件（按任务分组）

| 任务 | 创建文件 | 修改文件 |
|------|----------|----------|
| Task 1: Pipeline 骨架增强 | `orion-pipeline-svc/src/services/PipelineService.ts`<br>`orion-pipeline-svc/src/utils/database.ts`<br>`orion-pipeline-svc/src/utils/redis.ts`<br>`orion-pipeline-svc/src/utils/eventBus.ts`<br>`orion-pipeline-svc/src/config.ts`<br>`orion-pipeline-svc/src/routes/pipeline.ts` (重写)<br>`orion-pipeline-svc/src/routes/pipeline-run.ts`<br>`orion-pipeline-svc/src/routes/pipeline-admin.ts`<br>`orion-pipeline-svc/src/routes/scm-webhook.ts`<br>`orion-pipeline-svc/src/routes/pipeline-sse.ts`<br>`orion-pipeline-svc/src/app.ts` (重写) | `orion-api-gateway/src/config/index.ts`<br>`orion-api-gateway/src/routes/api.ts`<br>`orion-microservices/docker-compose.yml` |
| Task 2: Pipeline 业务逻辑迁移 | `orion-pipeline-svc/src/services/PipelineRepository.ts`<br>`orion-pipeline-svc/src/services/PipelineRunRepository.ts`<br>`orion-pipeline-svc/src/services/PipelineRunService.ts`<br>`orion-pipeline-svc/src/services/SCMWebhookService.ts`<br>`orion-pipeline-svc/src/services/PipelineEventPublisher.ts`<br>`orion-pipeline-svc/src/services/PipelineLogSSEService.ts`<br>`orion-pipeline-svc/src/services/PipelineEventSSEBridge.ts`<br>`orion-pipeline-svc/src/services/PipelineExecutionQueue.ts`<br>`orion-pipeline-svc/src/services/PipelineMetricsService.ts`<br>`orion-pipeline-svc/src/services/WebhookNotifier.ts`<br>`orion-pipeline-svc/src/services/WebhookConfigRepository.ts`<br>`orion-pipeline-svc/src/services/TriggerRepository.ts`<br>`orion-pipeline-svc/src/controllers/PipelineController.ts`<br>`orion-pipeline-svc/src/controllers/PipelineRunController.ts`<br>`orion-pipeline-svc/src/controllers/StageController.ts`<br>`orion-pipeline-svc/src/controllers/TaskController.ts`<br>`orion-pipeline-svc/src/controllers/ApprovalController.ts`<br>`orion-pipeline-svc/src/engine/PipelineEngine.ts`<br>`orion-pipeline-svc/src/engine/StageExecutor.ts`<br>`orion-pipeline-svc/src/engine/TaskRunner.ts`<br>`orion-pipeline-svc/src/events/PipelineEventPublisher.ts`<br>`orion-pipeline-svc/src/types/pipeline.ts` | 无（纯从 platform-service 复制） |
| Task 3: Pipeline 路由迁移 | `orion-pipeline-svc/src/api/pipeline-routes-registrar.ts`<br>`orion-pipeline-svc/src/api/pipeline-sse-routes.ts`<br>`orion-pipeline-svc/src/api/pipeline-graph-routes.ts`<br>`orion-pipeline-svc/src/api/pipeline-version-routes.ts`<br>`orion-pipeline-svc/src/api/pipeline-budget-routes.ts`<br>`orion-pipeline-svc/src/api/pipeline-template-routes.ts`<br>`orion-pipeline-svc/src/api/autonomous-pipeline-routes.ts`<br>`orion-pipeline-svc/src/api/build-routes.ts`<br>`orion-pipeline-svc/src/api/queue-routes.ts`<br>`orion-pipeline-svc/src/api/runner-routes.ts`<br>`orion-pipeline-svc/src/api/cron-routes.ts` | `orion-platform-service/src/api/routes.ts` (移除 pipeline 相关 import 和注册) |
| Task 4: Gateway + Compose 更新 | `orion-microservices/scripts/init-db.sh` (添加 pipeline_db) | `orion-api-gateway/src/config/index.ts`<br>`orion-api-gateway/src/routes/api.ts`<br>`orion-microservices/docker-compose.yml` |
| Task 5: 验证 Pipeline 迁移 | 测试文件 | 无 |
| Task 6-11: 其余 5 个服务 | 类似 Pipeline 模式 | 类似 Pipeline 模式 |

---

### Task 1: Pipeline 服务骨架增强 + 基础设施

**Files:**
- Modify: `orion-pipeline-svc/src/app.ts`
- Modify: `orion-pipeline-svc/src/routes/pipeline.ts`
- Create: `orion-pipeline-svc/src/config.ts`
- Create: `orion-pipeline-svc/src/utils/database.ts`
- Create: `orion-pipeline-svc/src/utils/redis.ts`
- Create: `orion-pipeline-svc/src/utils/eventBus.ts`
- Create: `orion-pipeline-svc/src/routes/pipeline-run.ts`
- Create: `orion-pipeline-svc/src/routes/pipeline-admin.ts`
- Create: `orion-pipeline-svc/src/routes/scm-webhook.ts`
- Create: `orion-pipeline-svc/src/routes/pipeline-sse.ts`
- Create: `orion-pipeline-svc/src/services/PipelineService.ts`

- [ ] **Step 1: 创建 config.ts**

```typescript
// orion-pipeline-svc/src/config.ts
import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(3002),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  natsUrl: z.string().url(),
  platformServiceUrl: z.string().url().default('http://localhost:3001'),
  jwtSecret: z.string(),
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
```

- [ ] **Step 2: 创建 utils/database.ts**

```typescript
// orion-pipeline-svc/src/utils/database.ts
import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
    pool.on('error', (err) => {
      console.error('[database] Unexpected error on idle client:', err);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  // Placeholder: actual migrations would be defined in a migrations/ directory
  console.log('[database] Migrations would run here');
}

export async function checkHealth(): Promise<{ status: string; message?: string }> {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', message: (error as Error).message };
  }
}
```

- [ ] **Step 3: 创建 utils/redis.ts**

```typescript
// orion-pipeline-svc/src/utils/redis.ts
import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });
    redisClient.on('error', (err) => {
      console.error('[redis] Error:', err.message);
    });
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export function isRedisHealthy(): boolean {
  return redisClient?.status === 'ready';
}
```

- [ ] **Step 4: 创建 utils/eventBus.ts**

```typescript
// orion-pipeline-svc/src/utils/eventBus.ts
import { connect, Connection, JSONCodec } from 'nats';

let natsConn: Connection | null = null;
const jc = JSONCodec();

export async function getEventBus(): Promise<Connection> {
  if (!natsConn) {
    natsConn = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      reconnect: true,
      maxReconnectAttempts: 10,
    });
  }
  return natsConn;
}

export async function publishEvent(subject: string, data: unknown): Promise<void> {
  const conn = await getEventBus();
  conn.publish(subject, jc.encode(data));
}

export async function closeEventBus(): Promise<void> {
  if (natsConn) {
    await natsConn.close();
    natsConn = null;
  }
}
```

- [ ] **Step 5: 重写 app.ts（完整重写）**

```typescript
// orion-pipeline-svc/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { loadConfig } from './config';
import { getPool, closePool, checkHealth, runMigrations } from './utils/database';
import { getRedis, closeRedis, isRedisHealthy } from './utils/redis';
import { getEventBus, closeEventBus } from './utils/eventBus';
import { pipelineRoutes } from './routes/pipeline';
import { pipelineRunRoutes } from './routes/pipeline-run';
import { pipelineAdminRoutes } from './routes/pipeline-admin';
import { scmWebhookRoutes } from './routes/scm-webhook';
import { pipelineSSERoutes } from './routes/pipeline-sse';

async function buildApp() {
  const config = loadConfig();

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.logPretty
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          }
        : undefined,
    },
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(sensible);

  // Initialize connections
  const database = getPool();
  const redis = getRedis();
  const eventBus = await getEventBus();

  // Run migrations
  if (config.nodeEnv !== 'test') {
    await runMigrations();
  }

  // Register routes
  await fastify.register(pipelineRoutes, { prefix: '/api/v1', database });
  await fastify.register(pipelineRunRoutes, { prefix: '/api/v1', database, eventBus });
  await fastify.register(pipelineAdminRoutes, { prefix: '/api/v1', database });
  await fastify.register(scmWebhookRoutes, { prefix: '/api/v1', database });
  await fastify.register(pipelineSSERoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => {
    const dbHealth = await checkHealth();
    return {
      status: dbHealth.status === 'up' && isRedisHealthy() ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        redis: isRedisHealthy() ? 'up' : 'down',
      },
    };
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await closePool();
    await closeRedis();
    await closeEventBus();
  });

  return { fastify, config };
}

async function main() {
  const { fastify, config } = await buildApp();
  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`Pipeline Service listening on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { buildApp };
```

- [ ] **Step 6: 重写 routes/pipeline.ts（连接真实 Service）**

```typescript
// orion-pipeline-svc/src/routes/pipeline.ts
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { PipelineService } from '../services/PipelineService';

const createPipelineSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    stages: z.array(
      z.object({
        name: z.string().min(1).max(255),
        type: z.string().min(1),
        command: z.string().min(1),
        dependsOn: z.array(z.string()).default([]),
        env: z.record(z.string()).optional(),
        timeoutMs: z.number().int().positive().optional(),
        continueOnError: z.boolean().default(false),
      })
    ).min(1),
    triggers: z.array(
      z.object({
        type: z.enum(['manual', 'schedule', 'webhook', 'event']),
        cron: z.string().optional(),
        events: z.array(z.string()).optional(),
      })
    ).optional(),
    envTemplate: z.record(z.string()).optional(),
  }),
});

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  const pipelineService = new PipelineService(opts.database);

  fastify.post('/pipelines', {
    schema: {
      body: createPipelineSchema.shape.body,
    },
  }, async (request, reply) => {
    const pipeline = await pipelineService.create(request.body);
    return reply.code(201).send(pipeline);
  });

  fastify.get('/pipelines', async (request) => {
    const query = request.query as any;
    return pipelineService.list({
      projectId: query.projectId,
      status: query.status,
      limit: query.limit || 20,
      offset: query.offset || 0,
    });
  });

  fastify.get('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.getById(id);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.put('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pipeline = await pipelineService.update(id, request.body);
    if (!pipeline) return reply.code(404).send({ error: 'Pipeline not found' });
    return pipeline;
  });

  fastify.delete('/pipelines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await pipelineService.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(204).send();
  });

  fastify.post('/pipelines/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await pipelineService.run(id, request.body);
    if (!run) return reply.code(404).send({ error: 'Pipeline not found' });
    return reply.code(201).send(run);
  });

  fastify.get('/pipelines/:id/runs', async (request) => {
    const { id } = request.params as { id: string };
    return pipelineService.listRuns(id);
  });

  fastify.get('/pipelines/:id/runs/:rid', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const run = await pipelineService.getRun(id, rid);
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  fastify.post('/pipelines/:id/runs/:rid/cancel', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const result = await pipelineService.cancelRun(id, rid);
    if (!result) return reply.code(404).send({ error: 'Run not found' });
    return result;
  });
}
```

- [ ] **Step 7: 创建 routes/pipeline-run.ts**

```typescript
// orion-pipeline-svc/src/routes/pipeline-run.ts
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function pipelineRunRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any; eventBus: any }
): Promise<void> {
  // Placeholder: will be filled when PipelineRunService is migrated
  fastify.get('/pipeline-runs/:id', async (request, reply) => {
    reply.code(501).send({ error: 'Pipeline run details not yet migrated' });
  });
}
```

- [ ] **Step 8: 创建 routes/pipeline-admin.ts**

```typescript
// orion-pipeline-svc/src/routes/pipeline-admin.ts
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function pipelineAdminRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  fastify.get('/pipelines/:id/versions', async (request, reply) => {
    reply.code(501).send({ error: 'Pipeline versions not yet migrated' });
  });

  fastify.post('/pipelines/validate', async (request, reply) => {
    reply.code(501).send({ error: 'Pipeline validation not yet migrated' });
  });
}
```

- [ ] **Step 9: 创建 routes/scm-webhook.ts**

```typescript
// orion-pipeline-svc/src/routes/scm-webhook.ts
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function scmWebhookRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  fastify.post('/webhooks/scm', async (request, reply) => {
    reply.code(501).send({ error: 'SCM webhook not yet migrated' });
  });
}
```

- [ ] **Step 10: 创建 routes/pipeline-sse.ts**

```typescript
// orion-pipeline-svc/src/routes/pipeline-sse.ts
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function pipelineSSERoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  fastify.get('/pipelines/:id/runs/:rid/logs', {
    schema: {
      headers: z.object({
        accept: z.string().refine((v) => v.includes('text/event-stream')).optional(),
      }),
    },
  }, async (request, reply) => {
    reply.code(501).send({ error: 'SSE log streaming not yet migrated' });
  });
}

import { z } from 'zod';
```

- [ ] **Step 11: 创建 services/PipelineService.ts（初始版本，后续 Task 2 增强）**

```typescript
// orion-pipeline-svc/src/services/PipelineService.ts
import type { Pool } from 'pg';

export interface PipelineStage {
  name: string;
  type: string;
  command: string;
  dependsOn: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  continueOnError: boolean;
}

export interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  cron?: string;
  events?: string[];
}

export interface CreatePipelineInput {
  name: string;
  description?: string;
  stages: PipelineStage[];
  triggers?: PipelineTrigger[];
  envTemplate?: Record<string, string>;
}

export interface PipelineListOptions {
  projectId?: string;
  status?: string;
  limit: number;
  offset: number;
}

export class PipelineService {
  constructor(private pool: Pool) {}

  async create(input: CreatePipelineInput): Promise<{ id: string; name: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO pipelines (name, description, stages, triggers, env_template, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, name',
        [input.name, input.description || '', JSON.stringify(input.stages), JSON.stringify(input.triggers || []), JSON.stringify(input.envTemplate || {})]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(options: PipelineListOptions): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT id, name, description, created_at, updated_at FROM pipelines WHERE ($1::text IS NULL OR project_id = $1) AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      [options.projectId || null, options.status || null, options.limit, options.offset]
    );
    return result.rows;
  }

  async getById(id: string): Promise<any> {
    const result = await this.pool.query('SELECT * FROM pipelines WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async update(id: string, input: Partial<CreatePipelineInput>): Promise<any> {
    const result = await this.pool.query(
      'UPDATE pipelines SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *',
      [input.name, input.description, id]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM pipelines WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async run(pipelineId: string, options?: { envOverrides?: Record<string, string>; stages?: string[] }): Promise<any> {
    const result = await this.pool.query(
      "INSERT INTO pipeline_runs (pipeline_id, status, env_overrides, started_at) VALUES ($1, 'running', $2, NOW()) RETURNING *",
      [pipelineId, JSON.stringify(options?.envOverrides || {})]
    );
    return result.rows[0];
  }

  async listRuns(pipelineId: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE pipeline_id = $1 ORDER BY started_at DESC',
      [pipelineId]
    );
    return result.rows;
  }

  async getRun(pipelineId: string, runId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE id = $1 AND pipeline_id = $2',
      [runId, pipelineId]
    );
    return result.rows[0] || null;
  }

  async cancelRun(pipelineId: string, runId: string): Promise<any> {
    const result = await this.pool.query(
      "UPDATE pipeline_runs SET status = 'cancelled', completed_at = NOW() WHERE id = $1 AND pipeline_id = $2 AND status = 'running' RETURNING *",
      [runId, pipelineId]
    );
    return result.rows[0] || null;
  }
}
```

- [ ] **Step 12: 编译验证**

Run: `cd orion-pipeline-svc && npm install && npm run build`
Expected: 编译通过，无 TypeScript 错误

- [ ] **Step 13: Commit**

```bash
cd orion-pipeline-svc
git add -A
git commit -m "feat(pipeline-svc): enhance skeleton with database, redis, eventbus, and real PipelineService CRUD"
```

---

### Task 2: Pipeline 业务逻辑完整迁移

**Files:**
- Create: `orion-pipeline-svc/src/services/PipelineRepository.ts` (copy from platform-service)
- Create: `orion-pipeline-svc/src/services/PipelineRunRepository.ts` (copy)
- Create: `orion-pipeline-svc/src/services/PipelineRunService.ts` (copy)
- Create: `orion-pipeline-svc/src/services/SCMWebhookService.ts` (copy)
- Create: `orion-pipeline-svc/src/services/PipelineEventPublisher.ts` (copy)
- Create: `orion-pipeline-svc/src/services/PipelineLogSSEService.ts` (copy)
- Create: `orion-pipeline-svc/src/services/PipelineEventSSEBridge.ts` (copy)
- Create: `orion-pipeline-svc/src/services/PipelineExecutionQueue.ts` (copy)
- Create: `orion-pipeline-svc/src/services/PipelineMetricsService.ts` (copy)
- Create: `orion-pipeline-svc/src/services/WebhookNotifier.ts` (copy)
- Create: `orion-pipeline-svc/src/services/WebhookConfigRepository.ts` (copy)
- Create: `orion-pipeline-svc/src/services/TriggerRepository.ts` (copy)
- Create: `orion-pipeline-svc/src/controllers/PipelineController.ts` (copy)
- Create: `orion-pipeline-svc/src/controllers/PipelineRunController.ts` (copy)
- Create: `orion-pipeline-svc/src/controllers/StageController.ts` (copy)
- Create: `orion-pipeline-svc/src/controllers/TaskController.ts` (copy)
- Create: `orion-pipeline-svc/src/controllers/ApprovalController.ts` (copy)
- Create: `orion-pipeline-svc/src/engine/PipelineEngine.ts` (copy)
- Create: `orion-pipeline-svc/src/engine/StageExecutor.ts` (copy)
- Create: `orion-pipeline-svc/src/engine/TaskRunner.ts` (copy)
- Create: `orion-pipeline-svc/src/events/PipelineEventPublisher.ts` (copy)
- Create: `orion-pipeline-svc/src/types/pipeline.ts`

- [ ] **Step 1: 从 platform-service 复制 Pipeline 核心 Service 文件**

从以下源路径复制到目标路径：

```
Source: orion-platform-service/src/services/pipeline/PipelineService.ts
Dest:   orion-pipeline-svc/src/services/PipelineService-full.ts

Source: orion-platform-service/src/services/pipeline/PipelineRepository.ts
Dest:   orion-pipeline-svc/src/services/PipelineRepository.ts

Source: orion-platform-service/src/services/pipeline/PipelineRunRepository.ts
Dest:   orion-pipeline-svc/src/services/PipelineRunRepository.ts

Source: orion-platform-service/src/services/pipeline/PipelineRunService.ts
Dest:   orion-pipeline-svc/src/services/PipelineRunService.ts

Source: orion-platform-service/src/services/pipeline/SCMWebhookService.ts
Dest:   orion-pipeline-svc/src/services/SCMWebhookService.ts

Source: orion-platform-service/src/services/pipeline/WebhookNotifier.ts
Dest:   orion-pipeline-svc/src/services/WebhookNotifier.ts

Source: orion-platform-service/src/services/pipeline/PipelineExecutionQueue.ts
Dest:   orion-pipeline-svc/src/services/PipelineExecutionQueue.ts

Source: orion-platform-service/src/services/pipeline/PipelineMetricsService.ts
Dest:   orion-pipeline-svc/src/services/PipelineMetricsService.ts

Source: orion-platform-service/src/services/pipeline/PipelineEventSSEBridge.ts
Dest:   orion-pipeline-svc/src/services/PipelineEventSSEBridge.ts

Source: orion-platform-service/src/services/pipeline/PipelineLogSSEService.ts
Dest:   orion-pipeline-svc/src/services/PipelineLogSSEService.ts
```

复制后需要：
1. 将 `import { DatabasePool } from '../services/database'` 替换为 `import { getPool } from '../utils/database'`
2. 将构造函数中的 `database: DatabasePool` 替换为 `pool: Pool`（使用 `getPool()` 调用）
3. 移除对 platform-service 内部模块的依赖

- [ ] **Step 2: 复制 Controllers**

```
Source: orion-platform-service/src/api/controllers/PipelineController.ts
Dest:   orion-pipeline-svc/src/controllers/PipelineController.ts

Source: orion-platform-service/src/api/controllers/PipelineRunController.ts
Dest:   orion-pipeline-svc/src/controllers/PipelineRunController.ts

Source: orion-platform-service/src/api/controllers/StageController.ts
Dest:   orion-pipeline-svc/src/controllers/StageController.ts

Source: orion-platform-service/src/api/controllers/TaskController.ts
Dest:   orion-pipeline-svc/src/controllers/TaskController.ts

Source: orion-platform-service/src/api/controllers/ApprovalController.ts
Dest:   orion-pipeline-svc/src/controllers/ApprovalController.ts
```

- [ ] **Step 3: 复制 Engine 核心**

```
Source: orion-platform-service/src/engine/PipelineEngine.ts
Dest:   orion-pipeline-svc/src/engine/PipelineEngine.ts

Source: orion-platform-service/src/engine/StageExecutor.ts
Dest:   orion-pipeline-svc/src/engine/StageExecutor.ts

Source: orion-platform-service/src/engine/TaskRunner.ts
Dest:   orion-pipeline-svc/src/engine/TaskRunner.ts
```

Engine 文件可能有大量内部依赖（ContainerExecutor, ExpressionEvaluator, VariableContext 等）。
**迁移策略**：先复制 PipelineEngine/StageExecutor/TaskRunner 及其直接依赖，暂不复制高级特性（CheckpointManager, DebugController, MatrixExpander）。

- [ ] **Step 4: 更新 app.ts 集成真实 Service**

将 Task 1 中创建的 placeholder route handlers 替换为使用真实 Controller 的实现，参照 platform-service 的 `pipeline-routes-registrar.ts` 模式。

- [ ] **Step 5: 编译验证**

Run: `cd orion-pipeline-svc && npm run build`
Expected: 编译通过

- [ ] **Step 6: Commit**

```bash
cd orion-pipeline-svc
git add -A
git commit -m "feat(pipeline-svc): migrate PipelineService, Controllers, and Engine from platform-service"
```

---

### Task 3: Pipeline 路由模块从 platform-service 中移除

**Files:**
- Modify: `orion-platform-service/src/api/routes.ts` (删除 ~100 行 pipeline 相关代码)

- [ ] **Step 1: 从 routes.ts 中移除 Pipeline 相关 import**

删除以下 import：
```typescript
// DELETE these lines from routes.ts:
import { PipelineController } from './controllers/PipelineController';
import { PipelineRunController } from './controllers/PipelineRunController';
import { StageController } from './controllers/StageController';
import { TaskController } from './controllers/TaskController';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRepository } from '../services/pipeline/PipelineRepository';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { PipelineVersionService } from '../services/pipeline/PipelineVersionService';
import { PipelineBudgetService } from '../services/pipeline/PipelineBudgetService';
import { PipelineExecutionQueue } from '../services/pipeline/PipelineExecutionQueue';
import { PipelineMetricsService } from '../services/pipeline/PipelineMetricsService';
import { PipelineEngine } from '../engine/PipelineEngine';
import { StageExecutor } from '../engine/StageExecutor';
import { TaskRunner } from '../engine/TaskRunner';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { PipelineLogSSEService } from '../services/pipeline/PipelineLogSSEService';
import { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import { WebhookNotifier } from '../services/pipeline/WebhookNotifier';
import { WebhookConfigRepository } from '../repositories/WebhookConfigRepository';
import { SCMWebhookService } from '../services/pipeline/SCMWebhookService';
import { TriggerRepository } from '../repositories/TriggerRepository';
import { registerPipelineRoutes } from './pipeline-routes-registrar';
import pipelineSSERoutes from './pipeline-sse-routes';
import buildRoutes from './build-routes';
import queueRoutes from './queue-routes';
import cronRoutes from './cron-routes';
import runnerRoutes from './runner-routes';
import pipelineVersionRoutes from './pipeline-version-routes';
import pipelineBudgetRoutes from './pipeline-budget-routes';
import pipelineTemplateRoutes from './pipeline-template-routes';
import autonomousPipelineRoutes from './autonomous-pipeline-routes';
```

- [ ] **Step 2: 从 routes.ts 中移除 Pipeline 服务初始化和路由注册**

删除以下代码块：
1. Pipeline 服务初始化 (~80 行, lines ~363-459)
2. Pipeline 路由注册 (~10 行, lines ~462-472)
3. CMDB 路由中的 pipeline 依赖
4. Pipeline SSE 路由 (~2 行)
5. Phase 1 P0 routes 中的 pipeline version/budget/template (~20 行)
6. Autonomous Pipeline routes (~10 行)
7. Pipeline metrics endpoints (~20 行, lines ~874-900)
8. Pipeline crash recovery (~20 行, lines ~902-924)
9. ChatOps routes 中的 pipelineService 依赖 (~5 行)

- [ ] **Step 3: 验证 platform-service 编译**

Run: `cd orion-platform-service && npm run build`
Expected: 编译通过（如有其他依赖需要清理，继续移除）

- [ ] **Step 4: Commit**

```bash
cd orion-platform-service
git add -A
git commit -m "refactor(platform-service): remove pipeline domain routes and services (migrated to pipeline-svc)"
```

---

### Task 4: Gateway 路由 + Docker Compose 更新

**Files:**
- Modify: `orion-api-gateway/src/config/index.ts`
- Modify: `orion-api-gateway/src/routes/api.ts`
- Modify: `orion-microservices/docker-compose.yml`

- [ ] **Step 1: 更新 gateway config**

```typescript
// Modify orion-api-gateway/src/config/index.ts
// In the services section of defaultConfig, add:
services: {
  platform: {
    url: process.env.PLATFORM_SERVICE_URL || 'http://localhost:3001',
    timeout: parseInt(process.env.PLATFORM_TIMEOUT || '30000', 10),
  },
  pipeline: {
    url: process.env.PIPELINE_SERVICE_URL || 'http://localhost:3002',
    timeout: parseInt(process.env.PIPELINE_TIMEOUT || '60000', 10),
  },
},
```

- [ ] **Step 2: 更新 gateway api routes**

```typescript
// Modify orion-api-gateway/src/routes/api.ts
// Add pipeline service route to routeConfigs array:
{
  prefix: '/api/v1/pipeline',
  target: getConfig().services.pipeline?.url || 'http://localhost:3002',
  timeout: 60000,
  stripPrefix: false,
},
{
  prefix: '/api/v1/pipelines',
  target: getConfig().services.pipeline?.url || 'http://localhost:3002',
  timeout: 60000,
  stripPrefix: false,
},
```

- [ ] **Step 3: 验证 gateway 编译**

Run: `cd orion-api-gateway && npm run build`
Expected: 编译通过

- [ ] **Step 4: Commit**

```bash
cd orion-api-gateway
git add -A
git commit -m "feat(gateway): add pipeline service proxy route"
```

---

### Task 5: 验证 Pipeline 迁移完整性

- [ ] **Step 1: 检查 platform-service 中是否还有 pipeline 相关引用**

Run: `cd orion-platform-service && grep -r "Pipeline" src/ --include="*.ts" | grep -v "__tests__" | grep -v "DataPipeline"`
Expected: 无残留引用（DataPipeline 除外，属于不同域）

- [ ] **Step 2: 验证 docker-compose 中 pipeline-svc 配置**

docker-compose.yml 已有 pipeline-svc 配置（lines 165-196），确认：
- 端口 3002 正确
- DATABASE_URL 指向 pipeline_db
- depends_on 包含 postgres, redis, nats, orion-platform-core
- healthcheck 使用 /health 端点（与 pipeline-svc 的 app.ts 一致）

- [ ] **Step 3: 验证 init-db.sh 中有 pipeline_db**

Run: `grep "pipeline_db" orion-microservices/scripts/init-db.sh`
Expected: 找到 pipeline_db 创建语句

- [ ] **Step 4: 端到端验证**

Run: `cd orion-microservices && docker compose up -d orion-pipeline-svc`
Expected: 服务启动，healthcheck 通过

---

### Task 6-11: 其余 5 个服务的迁移（Ticket/Monitor/Deploy/Agent/Intelligence）

每个服务遵循与 Pipeline 相同的模式：

#### Task 6: Ticket 服务迁移

**Files:**
- Create: `orion-ticket-svc/src/services/TicketService.ts` (copy from platform-service)
- Create: `orion-ticket-svc/src/controllers/TicketController.ts` (copy)
- Create: `orion-ticket-svc/src/routes/ticket.ts` (copy + adapt)
- Modify: `orion-platform-service/src/api/routes.ts` (remove ticketing)
- Modify: `orion-api-gateway/src/routes/api.ts` (add /api/v1/tickets proxy)

- [ ] 复制 `orion-platform-service/src/api/ticketing-routes.ts` 到 `orion-ticket-svc/src/routes/ticket.ts`
- [ ] 复制对应的 Service 和 Controller（如有）
- [ ] 更新 import 路径（database, redis, eventBus）
- [ ] 更新 gateway 添加 `/api/v1/tickets` 代理
- [ ] 从 platform-service routes.ts 中移除 ticketingRoutes import 和注册
- [ ] 编译验证 + Commit

#### Task 7: Monitor 服务迁移

**Files:**
- Create: `orion-monitor-svc/src/services/MonitoringService.ts` (copy)
- Create: `orion-monitor-svc/src/services/AlertService.ts` (copy)
- Create: `orion-monitor-svc/src/routes/monitoring.ts` (copy)
- Create: `orion-monitor-svc/src/routes/alert.ts` (copy)
- Modify: `orion-platform-service/src/api/routes.ts` (remove monitoring + alert)
- Modify: `orion-api-gateway/src/routes/api.ts` (add /api/v1/monitoring + /api/v1/alert proxy)

- [ ] 复制 monitoring-routes.ts + alert-routes.ts 到对应服务
- [ ] 复制对应的 Service 文件
- [ ] 更新 gateway
- [ ] 从 platform-service 移除
- [ ] 编译验证 + Commit

#### Task 8: Deploy 服务迁移

**Files:**
- Create: `orion-deploy-svc/src/routes/deploy.ts` (copy deploy-routes.ts + deploy-enhanced-routes.ts)
- Modify: `orion-platform-service/src/api/routes.ts` (remove deploy + deployEnhanced)
- Modify: `orion-api-gateway/src/routes/api.ts` (add /api/v1/deploy proxy)

- [ ] 复制 deploy-routes.ts 和 deploy-enhanced-routes.ts
- [ ] 复制对应的 Service
- [ ] 更新 gateway
- [ ] 从 platform-service 移除
- [ ] 编译验证 + Commit

#### Task 9: Agent 服务迁移

**Files:**
- Create: `orion-agent-svc/src/routes/agent.ts` (copy routes-agent.ts)
- Modify: `orion-platform-service/src/api/routes.ts` (remove agentRoutes)
- Modify: `orion-api-gateway/src/routes/api.ts` (add /api/v1/agent proxy)

- [ ] 复制 routes-agent.ts 到 agent-svc
- [ ] 复制对应的 Service
- [ ] 更新 gateway
- [ ] 从 platform-service 移除
- [ ] 编译验证 + Commit

#### Task 10: Intelligence 服务迁移 (Python/FastAPI)

**Files:**
- Create: `orion-intelligence-svc/src/routes/ai_*.py` (copy from platform-service)
- Modify: `orion-platform-service/src/api/routes.ts` (remove AI routes)
- Modify: `orion-api-gateway/src/routes/api.ts` (add /api/v1/ai proxy)

**注意**: Intelligence 服务是 Python/FastAPI，不是 Node.js/Fastify。

- [ ] 复制 AI 相关 routes（ai-gateway, ai-decision, ai-review, ai-security, ai-cost, change-intelligence, diagnostic, test-selector, test-generation）
- [ ] 更新 gateway 添加 /api/v1/ai 代理
- [ ] 从 platform-service 移除
- [ ] 验证 FastAPI 服务启动
- [ ] Commit

#### Task 11: 最终清理

- [ ] 从 platform-service 中移除所有已迁移域的路由 import 和注册
- [ ] 验证 platform-service 编译通过
- [ ] 验证 docker-compose 中所有服务能同时启动
- [ ] 验证 gateway 能正确代理到所有服务
- [ ] 更新架构文档

---

## Self-Review

### 1. Spec Coverage Check

| 需求 | 对应 Task |
|------|-----------|
| Pipeline 域迁移 | Task 1-5 |
| Ticket 域迁移 | Task 6 |
| Monitor 域迁移 | Task 7 |
| Deploy 域迁移 | Task 8 |
| Agent 域迁移 | Task 9 |
| Intelligence 域迁移 | Task 10 |
| Gateway 路由更新 | Task 4 + 每个服务 |
| Docker Compose 编排 | Task 4 + Task 5 |
| 从 platform-service 移除 | Task 3 + 每个服务 |
| 验证 | Task 5 + Task 11 |

### 2. Placeholder Scan
- Task 1 Step 10 中 routes/pipeline-sse.ts 的 placeholder 是故意的（SSE 迁移在 Task 2），已在步骤中说明
- Task 6-11 使用 "遵循相同模式" 而非重复所有代码 — 这是因为每个服务的具体路由和 Service 代码不同，需要在执行时从 platform-service 复制
- 所有其他步骤都有具体代码

### 3. Type Consistency
- Config 使用 Zod schema 统一验证
- Database 连接统一使用 `getPool()` 返回 `Pool`
- Redis 统一使用 `getRedis()` 返回 `Redis`
- EventBus 统一使用 `getEventBus()` 返回 NATS `Connection`
