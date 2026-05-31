/**
 * Alert Management API Routes
 *
 * 告警关联、去重、抑制功能
 *
 * Prefix: /api/v1/alert
 *
 * Migrated to replyHelper (2026-05-21)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AlertCorrelationService } from '../services/alert/AlertCorrelationService';
import { AlertDeduplication } from '../services/alert/AlertDeduplication';
import { AlertSuppressionService } from '../services/alert/AlertSuppressionService';
import { AlertStatus, Alert, AlertSeverity } from '../services/alert/AlertTypes';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';

export default async function alertRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services
  const correlationService = new AlertCorrelationService();
  const deduplication = new AlertDeduplication();
  const suppressionService = new AlertSuppressionService();

  // Start deduplication service
  deduplication.start();

  // ==================== Alert Ingestion ====================
  // POST /alert/ingest - 接收告警
  app.post('/ingest', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        fingerprint: '',
        name: body.name as string,
        severity: body.severity as AlertSeverity,
        status: AlertStatus.FIRING,
        sourceType: body.sourceType as any,
        sourceId: body.sourceId as string,
        sourceName: body.sourceName as string,
        labels: (body.labels as Record<string, string>) || {},
        annotations: (body.annotations as Record<string, string>) || {},
        value: (body.value as number) || 0,
        threshold: (body.threshold as number) || 0,
        tenantId: (body.tenantId as string) || 'default',
        startsAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generate fingerprint
      const fingerprint = deduplication.generateFingerprint(alert);
      alert.fingerprint = fingerprint.fingerprint;

      // Check suppression
      const suppressionResult = await suppressionService.processAlert(alert);
      if (suppressionResult.suppressed) {
        return success(reply, request, {
          status: 'suppressed',
          reason: suppressionResult.reason,
          alert,
        });
      }

      // Process deduplication
      const processResult = await deduplication.processAlert(alert);
      return created(reply, request, {
        status: processResult.action === 'create' ? 'created' : 'updated',
        alert,
        isDuplicate: processResult.isDuplicate,
      });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Alert ingest failed');
    }
  });

  // ==================== Alert Correlation ====================
  // POST /alert/correlate - 告警关联分析
  app.post('/correlate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const alerts = body.alerts as Alert[];
      if (!alerts || alerts.length === 0) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'alerts is required');
      }

      // Update topology health
      correlationService.updateNodeHealth(alerts);

      // Perform correlation analysis
      const analysis = correlationService.analyzeRootCause(alerts);
      return success(reply, request, { analysis });
    } catch (error) {
      return internalError(reply, request, error instanceof Error ? error.message : 'Correlation analysis failed');
    }
  });

  // GET /alert/topology - 获取告警拓扑图
  app.get('/topology', async (request: FastifyRequest, reply: FastifyReply) => {
    const topology = await correlationService.getTopology();
    return success(reply, request, { topology });
  });

  // POST /alert/topology - 设置告警拓扑图
  app.post('/topology', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      await correlationService.setTopology(body as any);
      return success(reply, request, {
        status: 'updated',
        nodeCount: (body.nodes as any[])?.length || 0,
        edgeCount: (body.edges as any[])?.length || 0,
      });
    } catch (error) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, error instanceof Error ? error.message : 'Invalid topology');
    }
  });

  // ==================== Alert Deduplication ====================
  // GET /alert/deduplication/stats - 获取去重统计
  app.get('/deduplication/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await deduplication.getStats();
    return success(reply, request, { stats });
  });

  // GET /alert/groups - 获取告警分组
  app.get('/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const groups = await deduplication.getActiveGroups();
    return success(reply, request, { groups });
  });

  // ==================== Alert Suppression ====================
  // GET /alert/suppression/stats - 获取抑制统计
  app.get('/suppression/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await suppressionService.getStats();
    return success(reply, request, { stats });
  });

  // GET /alert/suppression/maintenance-windows - 获取维护窗口
  app.get('/suppression/maintenance-windows', async (request: FastifyRequest, reply: FastifyReply) => {
    const windows = suppressionService.getActiveMaintenanceWindows();
    return success(reply, request, { windows });
  });

  // POST /alert/suppression/maintenance-windows - 添加维护窗口
  app.post('/suppression/maintenance-windows', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      suppressionService.addMaintenanceWindow({
        name: body.name as string,
        description: body.description as string,
        startTime: new Date(body.startTime as string),
        endTime: new Date(body.endTime as string),
        tenantId: (body.tenantId as string) || 'default',
        scope: (body.scope as any) || {},
        createdBy: (body.createdBy as string) || 'system',
      });
      return created(reply, request, { status: 'created' });
    } catch (error) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, error instanceof Error ? error.message : 'Invalid maintenance window');
    }
  });

  // GET /alert/suppression/known-issues - 获取已知问题
  app.get('/suppression/known-issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const issues = suppressionService.getOpenKnownIssues();
    return success(reply, request, { issues });
  });

  // POST /alert/suppression/known-issues - 添加已知问题
  app.post('/suppression/known-issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      suppressionService.addKnownIssue({
        title: body.title as string,
        description: body.description as string,
        tenantId: (body.tenantId as string) || 'default',
        fingerprintPattern: body.fingerprintPattern as string,
        labelSelectors: body.labelSelectors as Record<string, string>,
        silenceDuration: (body.silenceDuration as number) || 3600000, // 1 hour default
        status: 'open',
        createdBy: (body.createdBy as string) || 'system',
      });
      return created(reply, request, { status: 'created' });
    } catch (error) {
      return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, error instanceof Error ? error.message : 'Invalid known issue');
    }
  });

  // GET /alert/suppression/alerts - 获取活跃告警
  // P0-6 Fix: Return active alerts instead of stats
  app.get('/suppression/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const groups = await deduplication.getActiveGroups();
    const allAlerts = groups.flatMap(g => g.alerts);
    return success(reply, request, { alerts: allAlerts, total: allAlerts.length });
  });

  // ==================== Alert List ====================
  // GET /alert/list - 获取告警列表
  app.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, unknown>;

    // Get active groups from deduplication service
    const groups = await deduplication.getActiveGroups();
    const allAlerts = groups.flatMap(g => g.alerts);

    // Filter by severity
    let filtered = allAlerts;
    if (query.severity) {
      filtered = allAlerts.filter((a) => a.severity === query.severity);
    }

    // Filter by status
    if (query.status) {
      filtered = allAlerts.filter((a) => a.status === query.status);
    }

    // Apply limit
    const limit = (query.limit as number) || 100;
    filtered = filtered.slice(0, limit);

    return success(reply, request, {
      alerts: filtered,
      total: filtered.length,
    });
  });

  // GET /alert/:id - 获取告警详情
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const groups = await deduplication.getActiveGroups();
    const allAlerts = groups.flatMap(g => g.alerts);
    const alert = allAlerts.find((a) => a.id === id);

    if (!alert) {
      return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, `Alert ${id} not found`);
    }

    return success(reply, request, { alert });
  });
}