import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { errorHandler } from './middleware/errorHandler';
import { DatabasePool } from './db/database.js';
import { MonitoringRuleRepository } from './repositories/MonitoringRuleRepository.js';
import { AlertRepository } from './repositories/AlertRepository.js';
import { OnCallRepository } from './repositories/OnCallRepository.js';
import { SelfHealingRepository } from './repositories/SelfHealingRepository.js';
import { MonitoringService } from './services/MonitoringService';
import { AlertService } from './services/AlertService';
import { SelfHealingService } from './services/SelfHealingService';
import { OnCallService } from './services/OnCallService';
import { monitoringRoutes, alertRoutes, metricsRoutes, targetsRoutes } from './routes/monitoring';
import { registerMonitoringRoutes } from './routes/monitoring-routes';
import { registerAlertRoutes } from './routes/alert-routes';
import { registerSelfHealingRoutes } from './routes/selfhealing-routes';
import { registerOnCallRoutes } from './routes/oncall-routes';
import { registerAlertSilenceRoutes } from './routes/alert-silence-routes';
import { AlertSilenceService } from './services/AlertSilenceService';
import { AlertRuleService } from './services/AlertRuleService.js';
import { registerAlertRuleRoutes } from './routes/alert-rule-routes.js';
import { RootCauseAnalysisService } from './services/RootCauseAnalysisService';
import { registerRCARoutes } from './routes/rca-routes';

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize PostgreSQL
  let db: DatabasePool | undefined;
  if (process.env.DATABASE_URL) {
    db = new DatabasePool({ connectionString: process.env.DATABASE_URL });
    await db.connect();
  }

  // Initialize services (PostgreSQL-backed if db available, in-memory otherwise)
  let monitoringService: MonitoringService;
  let alertService: AlertService;
  let selfHealingService: SelfHealingService;
  let oncallService: OnCallService;

  if (db) {
    const ruleRepo = new MonitoringRuleRepository(db);
    const alertRepo = new AlertRepository(db);
    const oncallRepo = new OnCallRepository(db);
    const healingRepo = new SelfHealingRepository(db);
    monitoringService = new MonitoringService(ruleRepo);
    alertService = new AlertService(alertRepo);
    selfHealingService = new SelfHealingService(healingRepo);
    oncallService = new OnCallService(oncallRepo);
  } else {
    monitoringService = new MonitoringService(new MonitoringRuleRepository(new NoopPool()));
    alertService = new AlertService(new AlertRepository(new NoopPool()));
    selfHealingService = new SelfHealingService(new SelfHealingRepository(new NoopPool()));
    oncallService = new OnCallService(new OnCallRepository(new NoopPool()));
  }

  const alertSilenceService = new AlertSilenceService();
  const alertRuleService = new AlertRuleService();
  const rcaService = new RootCauseAnalysisService();

  // Register Prometheus routes
  await fastify.register(monitoringRoutes, { prefix: '/api/v1' });
  await fastify.register(alertRoutes, { prefix: '/api/v1' });
  await fastify.register(metricsRoutes, { prefix: '/api/v1' });
  await fastify.register(targetsRoutes, { prefix: '/api/v1' });

  // Register domain routes
  registerMonitoringRoutes(fastify, monitoringService);
  registerAlertRoutes(fastify, alertService);
  registerSelfHealingRoutes(fastify, selfHealingService);
  registerOnCallRoutes(fastify, oncallService);
  registerAlertSilenceRoutes(fastify, alertSilenceService);
  registerAlertRuleRoutes(fastify, alertRuleService);
  registerRCARoutes(fastify, rcaService);

  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected',
  }));
  return { fastify };
}

/** Noop pool for fallback (in-memory mode, same API shape) */
class NoopPool {
  async query(): Promise<{ rows: any[]; rowCount: null }> { return { rows: [], rowCount: null }; }
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3005', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Monitor Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL('', import.meta.url).pathname) { main(); }
export { buildApp };
