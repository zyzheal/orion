import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { MonitoringService } from './services/MonitoringService';
import { AlertService } from './services/AlertService';
import { SelfHealingService } from './services/SelfHealingService';
import { OnCallService } from './services/OnCallService';
import { monitoringRoutes, alertRoutes, metricsRoutes, targetsRoutes } from './routes/monitoring';
import { monitoringRulesRoutes } from './routes/monitoring-rules';
import { alertsRoutes } from './routes/alerts';
import { selfHealingRoutes } from './routes/selfhealing';
import { oncallRoutes } from './routes/oncall';

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize services
  const monitoringService = new MonitoringService();
  const alertService = new AlertService();
  const selfHealingService = new SelfHealingService();
  const oncallService = new OnCallService();

  // Register Prometheus routes
  await fastify.register(monitoringRoutes, { prefix: '/api/v1' });
  await fastify.register(alertRoutes, { prefix: '/api/v1' });
  await fastify.register(metricsRoutes, { prefix: '/api/v1' });
  await fastify.register(targetsRoutes, { prefix: '/api/v1' });

  // Register monitoring rules routes
  await fastify.register(monitoringRulesRoutes, { monitoringService });

  // Register alert routes
  await fastify.register(alertsRoutes, { alertService });

  // Register self-healing routes
  await fastify.register(selfHealingRoutes, { selfHealingService });

  // Register on-call routes
  await fastify.register(oncallRoutes, { oncallService });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3005', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Monitor Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL('', import.meta.url).pathname) { main(); }
export { buildApp };
