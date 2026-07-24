/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/plugin/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

// orion-platform-service/src/api/plugin-routes.ts
// Plugin Management API Routes (enhanced plugin system)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginManagerService } from '../services/plugin-manager-service';
import { PluginExecutorService, registerExecutorForShutdown } from '../services/plugin-executor-service';
import { ExecutionTimelineService, registerTimelineForShutdown } from '../services/observability/ExecutionTimelineService';
import { ExecutionTimelineRepository } from '../repositories/ExecutionTimelineRepository';
import { AIDiagnosisService } from '../services/ai/AIDiagnosisService';
import { DebugController } from '../services/pipeline';
import { PostgresPluginAuditLogRepository } from '../repositories/PluginAuditLogRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

const logger = createLogger('plugin-routes');

export interface PluginEnhancedRoutesOptions {
  database?: any;
  /** Shared PluginManagerService instance (created once, shared across routes) */
  pluginManager?: PluginManagerService;
}

export default async function pluginEnhancedRoutes(app: FastifyInstance, options?: PluginEnhancedRoutesOptions): Promise<void> {
  // Use shared instance or create one
  const pluginManager = options?.pluginManager || new PluginManagerService();
  const pluginExecutor = new PluginExecutorService({
    pluginManager,
    database: options?.database,
  });

  // Register for graceful shutdown
  registerExecutorForShutdown(pluginExecutor);
  const timelineRepo = options?.database ? new ExecutionTimelineRepository(options.database) : undefined;
  const timelineService = timelineRepo
    ? new ExecutionTimelineService({ repository: timelineRepo })
    : undefined;
  if (timelineService) {
    registerTimelineForShutdown(timelineService);
  }
  const aiDiagnosis = new AIDiagnosisService();
  const auditLogRepo = options?.database ? new PostgresPluginAuditLogRepository(options.database) : undefined;
  const debugController = DebugController.getInstance();

  // ==================== Plugin Quotas ====================

  // PUT /api/v1/plugin/quotas/:pluginId - Upsert plugin quota
  app.put('/quotas/:pluginId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    const body = request.body as any;
    try {
      // @ts-expect-error - legacy: upsertPluginQuota not on service interface
      const quota = await pluginManager.upsertPluginQuota(pluginId, body);
      return { message: 'quota upserted', pluginId, quota };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // GET /api/v1/plugin/quotas/:pluginId - Get plugin quota
  app.get('/quotas/:pluginId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      // @ts-expect-error - legacy: getPluginQuota not on service interface
      const quota = await pluginManager.getPluginQuota(pluginId);
      return { pluginId, quota };
    } catch (error) {
      return handleError(reply, new NotFoundError('Unknown error'));
    }
  });

  // DELETE /api/v1/plugin/quotas/:pluginId - Delete plugin quota
  app.delete('/quotas/:pluginId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      // @ts-expect-error - legacy: deletePluginQuota not on service interface
      await pluginManager.deletePluginQuota(pluginId);
      return { message: 'quota deleted', pluginId };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // ==================== Security Events ====================

  // POST /api/v1/plugin/security-events - Create security event
  app.post('/security-events', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = (request as any).tenantId;
    try {
      // @ts-expect-error - legacy: createSecurityEvent not on service interface
      const event = await pluginManager.createSecurityEvent(tenantId, body);
      return reply.status(201).send({ message: 'security event created', event });
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // GET /api/v1/plugin/security-events - List security events
  app.get('/security-events', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = (request as any).tenantId;
    const filter: any = {
      tenantId,
      pluginId: query?.pluginId,
      severity: query?.severity,
      limit: query?.limit || 50,
      offset: query?.offset || 0,
    };
    try {
      // @ts-expect-error - legacy: listSecurityEvents not on service interface
      const events = await pluginManager.listSecurityEvents(filter);
      return { events, ...filter };
    } catch (error) {
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /healthz - Health check for plugin subsystem
  app.get('/healthz', async (request: FastifyRequest, reply: FastifyReply) => {
    const activeCount = pluginExecutor.getActiveExecutionCount();
    const isHealthy = activeCount < 50; // Below max concurrent threshold
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      activeExecutions: activeCount,
    };
  });

  // GET / - List all installed plugins
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request as any).tenantId;
    const plugins = await pluginManager.listAvailablePlugins();
    return { plugins, tenantId };
  });

  // GET /:pluginId - Get plugin details
  app.get('/:pluginId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      const plugin = await pluginManager.getPluginDetails(pluginId);
      return { plugin };
    } catch (error) {
      return handleError(reply, new NotFoundError('Unknown error'));
    }
  });

  // POST /:pluginId/install - Install a plugin
  app.post('/:pluginId/install', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    const body = request.body as any;
    const userId = (request as any).userId;
    try {
      const version = body?.version || 'latest';
      const config = body?.config;
      const result = await pluginManager.installPlugin(pluginId, version, config);
      return { pluginId, action: 'install', version, userId };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // POST /:pluginId/enable - Enable a plugin
  app.post('/:pluginId/enable', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      const plugin = await pluginManager.activatePlugin(pluginId);
      return { pluginId, action: 'enable', status: plugin.state };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // POST /:pluginId/disable - Disable a plugin
  app.post('/:pluginId/disable', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      const plugin = await pluginManager.deactivatePlugin(pluginId);
      return { pluginId, action: 'disable', status: plugin.state };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // DELETE /:pluginId - Uninstall a plugin
  app.delete('/:pluginId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      await pluginManager.uninstallPlugin(pluginId);
      return { pluginId, action: 'uninstall', status: 'uninstalled' };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // GET /audit - Get audit logs
  app.get('/audit', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = (request as any).tenantId;
    const limit = query?.limit || 50;

    if (auditLogRepo && tenantId) {
      const logs = await auditLogRepo.findByTenantId(tenantId, limit);
      return { logs: logs.map((l) => ({ id: l.id, taskId: l.taskId, pluginId: l.pluginId, action: l.action, outcome: l.outcome, createdAt: l.createdAt })), tenantId, limit };
    }

    return { logs: [], tenantId, limit, status: 'not_implemented' };
  });

  // GET /audit/:taskId/trail - Get task audit trail
  app.get('/audit/:taskId/trail', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };

    if (auditLogRepo) {
      const logs = await auditLogRepo.findByTaskId(taskId);
      return { taskId, logs: logs.map((l) => ({ id: l.id, action: l.action, outcome: l.outcome, durationMs: l.durationMs, createdAt: l.createdAt })) };
    }

    return { taskId, logs: [], status: 'not_implemented' };
  });

  // GET /:runId/timeline - Get execution timeline
  app.get('/:runId/timeline', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    if (!timelineService) {
      return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    }
    const replayData = await timelineService.getReplayData(runId);
    return replayData;
  });

  // POST /:runId/debug/pause - Pause for debug
  app.post('/:runId/debug/pause', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    try {
      const state = await debugController.pause(runId);
      return { runId, status: 'paused', debugState: state };
    } catch (error) {
      return handleError(reply, new OrionError('Unknown error', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /:runId/debug/resume - Resume execution
  app.post('/:runId/debug/resume', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    try {
      await debugController.resume(runId);
      return { runId, status: 'resumed' };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // POST /:runId/debug/step - Single step execution
  app.post('/:runId/debug/step', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'manage' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    try {
      const state = await debugController.step(runId);
      return { runId, status: 'stepping', debugState: state };
    } catch (error) {
      return handleError(reply, new ValidationError('Unknown error'));
    }
  });

  // GET /:runId/debug/state - Get debug state
  app.get('/:runId/debug/state', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    const state = debugController.getState(runId);
    if (!state) {
      return handleError(reply, new NotFoundError('Unknown error'));
    }
    return state;
  });

  // POST /ai-diagnose - AI error diagnosis
  app.post('/ai-diagnose', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body?.context?.taskId || !body?.context?.pluginId || !body?.context?.errorMessage) {
      return handleError(reply, new ValidationError('Missing required context fields: taskId, pluginId, errorMessage'));
    }
    const result = await aiDiagnosis.diagnose(body.context);
    return result;
  });

  logger.info('Plugin enhanced routes registered');
}