import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';
import aiGatewayRoutes from './routes/ai-gateway';
import aiDecisionRoutes from './routes/ai-decision';
import aiReviewRoutes from './routes/ai-review';
import aiSecurityRoutes from './routes/ai-security';
import vectorStoreRoutes from './routes/vector-store';
import { vectorRoutes } from './routes/vector';
import llmTraceRoutes from './routes/llm-trace';
import degradationRoutes from './routes/degradation';

// 新增：Agent 路由
import { agentRoutes } from './routes/agent';
import { taskRoutes } from './routes/task';
import { orchestrationRoutes } from './routes/orchestration-routes';

import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);
  const database = getPool();
  await fastify.register(aiGatewayRoutes, { prefix: '/api/v1/ai-gateway', database });
  await fastify.register(aiDecisionRoutes, { prefix: '/api/v1/ai-decision', database });
  await fastify.register(aiReviewRoutes, { prefix: '/api/v1/ai-review', database });
  await fastify.register(aiSecurityRoutes, { prefix: '/api/v1/ai-security', database });
  await fastify.register(vectorStoreRoutes, { prefix: '/api/v1/vector-store', database });
  await fastify.register(vectorRoutes, { prefix: '/api/v1/vector', database });
  await fastify.register(llmTraceRoutes, { prefix: '/api/v1/llm', database });
  await fastify.register(degradationRoutes, { prefix: '/api/v1/degradation', database });

  // 新增：Agent 路由
  await fastify.register(agentRoutes, { prefix: '/api/v1', database });
  await fastify.register(taskRoutes, { prefix: '/api/v1', database });
  await fastify.register(orchestrationRoutes, { prefix: '/api/v1', database });

  fastify.get('/health', async () => { const db = await checkHealth(); return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } }; });
  fastify.addHook('onClose', async () => { await closePool(); });
  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3012', 10);
  try { await fastify.listen({ port, host: '0.0.0.0' }); fastify.log.info(`AI Service listening on http://0.0.0.0:${port}`); } catch (err) { fastify.log.error(err, 'Failed to start server'); process.exit(1); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
