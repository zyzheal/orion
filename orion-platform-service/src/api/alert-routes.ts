/**
 * Alert Management API Routes
 *
 * 告警关联、去重、抑制功能
 *
 * Prefix: /api/v1/alert
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AlertCorrelationService } from '../services/alert/AlertCorrelationService';
import { AlertDeduplication } from '../services/alert/AlertDeduplication';
import { AlertSuppressionService } from '../services/alert/AlertSuppressionService';
import { Alert, AlertTopologyGraph, AlertSeverity, AlertStatus, AlertSourceType } from '../services/alert/AlertTypes';

interface AlertCreate {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  sourceType: string;
  sourceId: string;
  sourceName: string;
  value?: number;
  threshold?: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tenantId?: string;
}

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
    const body = request.body as AlertCreate;

    try {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        fingerprint: '',
        name: body.name,
        severity: body.severity as AlertSeverity,
        status: AlertStatus.FIRING,
        sourceType: body.sourceType as AlertSourceType,
        sourceId: body.sourceId,
        sourceName: body.sourceName,
        labels: body.labels || {},
        annotations: body.annotations || {},
        value: body.value || 0,
        threshold: body.threshold || 0,
        tenantId: body.tenantId || 'default',
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
        return reply.send({
          status: 'suppressed',
          reason: suppressionResult.reason,
          alert,
        });
      }

      // Process deduplication
      const processResult = deduplication.processAlert(alert);

      return reply.status(201).send({
        status: processResult.action === 'create' ? 'created' : 'updated',
        alert,
        isDuplicate: processResult.isDuplicate,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'ALERT_INGEST_ERROR',
        message: error.message,
      });
    }
  });

  // ==================== Alert Correlation ====================

  // POST /alert/correlate - 告警关联分析
  app.post('/correlate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { alerts: Alert[] };

    try {
      const { alerts } = body;

      if (!alerts || alerts.length === 0) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'alerts is required',
        });
      }

      // Update topology health
      correlationService.updateNodeHealth(alerts);

      // Perform correlation analysis
      const analysis = correlationService.analyzeRootCause(alerts);

      return reply.send({
        analysis,
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'CORRELATION_ERROR',
        message: error.message,
      });
    }
  });

  // GET /alert/topology - 获取告警拓扑图
  app.get('/topology', async (request: FastifyRequest, reply: FastifyReply) => {
    const topology = correlationService.getTopology();
    return reply.send({ topology });
  });

  // POST /alert/topology - 设置告警拓扑图
  app.post('/topology', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AlertTopologyGraph;

    try {
      correlationService.setTopology(body);
      return reply.send({
        status: 'updated',
        nodeCount: body.nodes?.length || 0,
        edgeCount: body.edges?.length || 0,
      });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'INVALID_TOPOLOGY',
        message: error.message,
      });
    }
  });

  // ==================== Alert Deduplication ====================

  // GET /alert/deduplication/stats - 获取去重统计
  app.get('/deduplication/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = deduplication.getStats();
    return reply.send({ stats });
  });

  // GET /alert/groups - 获取告警分组
  app.get('/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const groups = deduplication.getActiveGroups();
    return reply.send({ groups });
  });

  // ==================== Alert Suppression ====================

  // GET /alert/suppression/stats - 获取抑制统计
  app.get('/suppression/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = suppressionService.getStats();
    return reply.send({ stats });
  });

  // GET /alert/suppression/maintenance-windows - 获取维护窗口
  app.get('/suppression/maintenance-windows', async (request: FastifyRequest, reply: FastifyReply) => {
    const windows = suppressionService.getActiveMaintenanceWindows();
    return reply.send({ windows });
  });

  // POST /alert/suppression/maintenance-windows - 添加维护窗口
  app.post('/suppression/maintenance-windows', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description?: string;
      startTime: string;
      endTime: string;
      tenantId?: string;
      scope?: {
        sourceTypes?: AlertSourceType[];
        sourceIds?: string[];
        labelSelectors?: Record<string, string>;
      };
      createdBy?: string;
    };

    try {
      suppressionService.addMaintenanceWindow({
        name: body.name,
        description: body.description,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        tenantId: body.tenantId || 'default',
        scope: body.scope || {},
        createdBy: body.createdBy || 'system',
      });

      return reply.status(201).send({ status: 'created' });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'INVALID_MAINTENANCE_WINDOW',
        message: error.message,
      });
    }
  });

  // GET /alert/suppression/known-issues - 获取已知问题
  app.get('/suppression/known-issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const issues = suppressionService.getOpenKnownIssues();
    return reply.send({ issues });
  });

  // POST /alert/suppression/known-issues - 添加已知问题
  app.post('/suppression/known-issues', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      title: string;
      description?: string;
      tenantId?: string;
      fingerprintPattern?: string;
      labelSelectors?: Record<string, string>;
      silenceDuration?: number;
      createdBy?: string;
    };

    try {
      suppressionService.addKnownIssue({
        title: body.title,
        description: body.description,
        tenantId: body.tenantId || 'default',
        fingerprintPattern: body.fingerprintPattern,
        labelSelectors: body.labelSelectors,
        silenceDuration: body.silenceDuration || 3600000, // 1 hour default
        status: 'open',
        createdBy: body.createdBy || 'system',
      });

      return reply.status(201).send({ status: 'created' });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'INVALID_KNOWN_ISSUE',
        message: error.message,
      });
    }
  });

  // GET /alert/suppression/alerts - 获取活跃告警
  // P0-6 Fix: Return active alerts instead of stats
  app.get('/suppression/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const groups = deduplication.getActiveGroups();
    const allAlerts: Alert[] = groups.flatMap(g => g.alerts);
    return reply.send({ alerts: allAlerts, total: allAlerts.length });
  });

  // ==================== Alert List ====================

  // GET /alert/list - 获取告警列表
  app.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      severity?: string;
      status?: string;
      limit?: number;
    };

    // Get active groups from deduplication service
    const groups = deduplication.getActiveGroups();
    const allAlerts: Alert[] = groups.flatMap(g => g.alerts);

    // Filter by severity
    let filtered = allAlerts;
    if (query.severity) {
      filtered = allAlerts.filter((a: Alert) => a.severity === query.severity);
    }

    // Filter by status
    if (query.status) {
      filtered = allAlerts.filter((a: Alert) => a.status === query.status);
    }

    // Apply limit
    const limit = query.limit || 100;
    filtered = filtered.slice(0, limit);

    return reply.send({
      alerts: filtered,
      total: filtered.length,
    });
  });

  // GET /alert/:id - 获取告警详情
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const groups = deduplication.getActiveGroups();
    const allAlerts: Alert[] = groups.flatMap(g => g.alerts);
    const alert = allAlerts.find((a: Alert) => a.id === id);

    if (!alert) {
      return reply.status(404).send({
        error: 'ALERT_NOT_FOUND',
        message: `Alert ${id} not found`,
      });
    }

    return reply.send({ alert });
  });
}
