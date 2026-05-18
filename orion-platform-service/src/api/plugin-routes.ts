// orion-platform-service/src/api/plugin-routes.ts
// Plugin Management API Routes (enhanced plugin system)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginManagerService } from '../services/plugin-manager-service';
import { PluginExecutorService, registerExecutorForShutdown } from '../services/plugin-executor-service';
import { ExecutionTimelineService, registerTimelineForShutdown } from '../services/observability/ExecutionTimelineService';
import { AIDiagnosisService } from '../services/ai/AIDiagnosisService';
import { DebugController } from '../engine/DebugController';
import { PostgresPluginAuditLogRepository } from '../repositories/PluginAuditLogRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
  });

  // Register for graceful shutdown
  registerExecutorForShutdown(pluginExecutor);
  const timelineService = new ExecutionTimelineService();
  registerTimelineForShutdown(timelineService);
  const aiDiagnosis = new AIDiagnosisService();
  const auditLogRepo = options?.database ? new PostgresPluginAuditLogRepository(options.database) : undefined;
  const debugController = DebugController.getInstance();

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
      return reply.code(404).send({ error: `Plugin ${pluginId} not found` });
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
      return reply.code(400).send({ error: `Failed to install plugin ${pluginId}: ${error instanceof Error ? error.message : String(error)}` });
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
      return reply.code(400).send({ error: `Failed to enable plugin ${pluginId}: ${error instanceof Error ? error.message : String(error)}` });
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
      return reply.code(400).send({ error: `Failed to disable plugin ${pluginId}: ${error instanceof Error ? error.message : String(error)}` });
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
      return reply.code(400).send({ error: `Failed to uninstall plugin ${pluginId}: ${error instanceof Error ? error.message : String(error)}` });
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
      return reply.code(500).send({ error: `Failed to pause: ${error instanceof Error ? error.message : String(error)}` });
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
      return reply.code(400).send({ error: `Failed to resume: ${error instanceof Error ? error.message : String(error)}` });
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
      return reply.code(400).send({ error: `Failed to step: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // GET /:runId/debug/state - Get debug state
  app.get('/:runId/debug/state', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    const state = debugController.getState(runId);
    if (!state) {
      return reply.code(404).send({ error: `No debug state found for run ${runId}` });
    }
    return state;
  });

  // POST /ai-diagnose - AI error diagnosis
  app.post('/ai-diagnose', {
    onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body?.context?.taskId || !body?.context?.pluginId || !body?.context?.errorMessage) {
      return reply.code(400).send({ error: 'Missing required context fields: taskId, pluginId, errorMessage' });
    }
    const result = await aiDiagnosis.diagnose(body.context);
    return result;
  });

  logger.info('Plugin enhanced routes registered');
}
