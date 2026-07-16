/**
 * Service Health API Routes
 *
 * Provides health dashboard and per-service health status.
 * Prefix: /api/v1/service-health
 *
 * Endpoints:
 *   GET /dashboard        - Health dashboard aggregation
 *   GET /services/:id/health - Specific service health detail
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ServiceRegistryRepository } from '../repositories/ServiceRegistryRepository';
import { AlertActiveAlertRepository } from '../repositories/AlertActiveAlertRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../db/tenant-context-storage';

const logger = createLogger('service-health-routes');

// ==================== Types ====================

interface ServiceHealthRow {
  serviceId: string;
  serviceName: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs: number;
  errorRate: number;
  uptimePercent: number;
  lastChecked: string;
}

interface HealthAlert {
  id: string;
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
}

interface TrendPoint {
  timestamp: string;
  healthScore: number;
  errorRate: number;
  latencyMs: number;
}

interface ScoreResult {
  score: number;
  level: 'healthy' | 'warning' | 'critical';
}

interface DashboardResponse {
  score: ScoreResult;
  activeAlerts: number;
  avgLatencyMs: number;
  errorRate: number;
  services: ServiceHealthRow[];
  alerts: HealthAlert[];
  trend: TrendPoint[];
}

// ==================== Helpers ====================

const HEALTH_SCORE_MAP: Record<string, number> = {
  healthy: 100,
  degraded: 60,
  unhealthy: 30,
  unknown: 50,
};

function computeHealthScore(services: ServiceRegistryRepository['findAll'] extends () => Promise<any> ? any[] : any[]): ScoreResult {
  if (!services || services.length === 0) {
    return { score: 0, level: 'critical' };
  }

  const total = services.reduce((sum, s) => sum + (HEALTH_SCORE_MAP[s.healthStatus] ?? 50), 0);
  const avg = Math.round(total / services.length);

  let level: ScoreResult['level'] = 'healthy';
  if (avg < 60) {
    level = 'critical';
  } else if (avg < 80) {
    level = 'warning';
  }

  return { score: avg, level };
}

function mapServiceRegistryToRow(entity: {
  serviceId: string;
  serviceName: string;
  healthStatus: string;
  lastHeartbeatAt: Date | null;
  updatedAt: Date;
}): ServiceHealthRow {
  const now = new Date();
  const lastChecked = entity.lastHeartbeatAt ? new Date(entity.lastHeartbeatAt) : new Date(entity.updatedAt);

  // Latency is approximated from time since last heartbeat (ms).
  // In production this should come from actual probe latency stored in metadata or a dedicated table.
  const latencyMs = entity.lastHeartbeatAt
    ? Math.max(0, now.getTime() - new Date(entity.lastHeartbeatAt).getTime())
    : 0;

  // Uptime percent: if last heartbeat is within 5 minutes, treat as 100%, else degrade.
  const uptimePercent = latencyMs < 5 * 60 * 1000 ? 100 : Math.max(0, 100 - latencyMs / 60000);

  // Error rate derived from health status (placeholder until per-service error metrics exist).
  const errorRate =
    entity.healthStatus === 'healthy' ? 0 : entity.healthStatus === 'degraded' ? 1.5 : 5;

  return {
    serviceId: entity.serviceId,
    serviceName: entity.serviceName,
    status: entity.healthStatus as ServiceHealthRow['status'],
    latencyMs,
    errorRate,
    uptimePercent: Math.min(100, uptimePercent),
    lastChecked: lastChecked.toISOString(),
  };
}

function mapAlertActiveAlertToHealthAlert(entity: {
  id: string;
  sourceName: string;
  severity: string;
  name: string;
  status: string;
  annotations?: Record<string, any>;
  startsAt: Date;
}): HealthAlert {
  return {
    id: entity.id,
    serviceName: entity.sourceName || entity.annotations?.serviceName || 'unknown',
    severity: entity.severity.toLowerCase() as HealthAlert['severity'],
    message: entity.name,
    status: entity.status.toLowerCase() as HealthAlert['status'],
    triggeredAt: new Date(entity.startsAt).toISOString(),
  };
}

/**
 * Build a synthetic trend from the current snapshot.
 *
 * In production this should be backed by a time-series table of health check results.
 * Here we emit a single point so the frontend always has data to render.
 */
function buildTrendFromSnapshot(score: number, errorRate: number, latencyMs: number): TrendPoint[] {
  return [
    {
      timestamp: new Date().toISOString(),
      healthScore: score,
      errorRate,
      latencyMs,
    },
  ];
}

// ==================== Routes ====================

export default async function serviceHealthRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db as DatabasePool | undefined;

  if (!db) {
    logger.warn('Service health routes disabled: no database pool provided');
    return;
  }

  const registryRepository = new ServiceRegistryRepository(db);
  const alertRepository = new AlertActiveAlertRepository(db);

  // ==================== Dashboard ====================

  app.get('/dashboard', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const traceId = getCurrentTraceId();
    logger.info({ traceId }, '[Dashboard] Fetching health dashboard data');

    try {
      const [allServices, activeAlertsRaw] = await Promise.all([
        registryRepository.findAll(),
        alertRepository.findByTenantId(String((app as any).currentTenantId ?? '')),
      ]);

      const serviceRows = allServices.entities.map(mapServiceRegistryToRow);
      const score = computeHealthScore(allServices.entities);

      const avgLatencyMs =
        serviceRows.length > 0
          ? Math.round(serviceRows.reduce((sum, s) => sum + s.latencyMs, 0) / serviceRows.length)
          : 0;

      const avgErrorRate =
        serviceRows.length > 0
          ? serviceRows.reduce((sum, s) => sum + s.errorRate, 0) / serviceRows.length
          : 0;

      const activeAlerts = activeAlertsRaw.filter((a) => a.status === 'firing').length;
      const alerts = activeAlertsRaw.map(mapAlertActiveAlertToHealthAlert);
      const trend = buildTrendFromSnapshot(score.score, avgErrorRate, avgLatencyMs);

      const dashboard: DashboardResponse = {
        score,
        activeAlerts,
        avgLatencyMs,
        errorRate: Math.round(avgErrorRate * 100) / 100,
        services: serviceRows,
        alerts,
        trend,
      };

      logger.info({ traceId, score: dashboard.score, activeAlerts: dashboard.activeAlerts }, '[Dashboard] Data ready');

      return reply.status(200).send({
        success: true,
        data: dashboard,
      });
    } catch (error: any) {
      logger.error({ traceId, err: error?.message || error }, '[Dashboard] Failed to load data');
      return handleError(reply, new OrionError('HEALTH_DASHBOARD_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Service Detail ====================

  app.get('/services/:id/health', {
    onRequest: [authenticateUser, requirePermission({ resource: 'health', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const traceId = getCurrentTraceId();
    const params = request.params as { id: string };

    logger.info({ traceId, serviceId: params.id }, '[ServiceHealth] Fetching service health detail');

    try {
      const service = await registryRepository.findByServiceId(params.id);

      if (!service) {
        return handleError(reply, new OrionError('SERVICE_NOT_FOUND', ErrorCode.NOT_FOUND));
      }

      const row = mapServiceRegistryToRow(service);
      const score = computeHealthScore([service]);

      return reply.status(200).send({
        success: true,
        data: {
          serviceId: row.serviceId,
          serviceName: row.serviceName,
          status: row.status,
          latencyMs: row.latencyMs,
          errorRate: row.errorRate,
          uptimePercent: row.uptimePercent,
          lastChecked: row.lastChecked,
          score,
        },
      });
    } catch (error: any) {
      logger.error({ traceId, serviceId: params.id, err: error?.message || error }, '[ServiceHealth] Failed to load');
      return handleError(reply, new OrionError('SERVICE_HEALTH_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
