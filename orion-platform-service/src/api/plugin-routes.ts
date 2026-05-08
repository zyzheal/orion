// orion-platform-service/src/api/plugin-routes.ts
// Plugin Management API Routes (enhanced plugin system)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginManagerService } from '../services/plugin-manager-service';
import { PluginExecutorService, registerExecutorForShutdown } from '../services/plugin-executor-service';
import { ExecutionTimelineService } from '../services/observability/ExecutionTimelineService';
import { AIDiagnosisService } from '../services/ai/AIDiagnosisService';
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
  const aiDiagnosis = new AIDiagnosisService();

  // GET / - List all installed plugins
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request as any).tenantId;
    const plugins = await pluginManager.listAvailablePlugins();
    return { plugins, tenantId };
  });

  // GET /:pluginId - Get plugin details
  app.get('/:pluginId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      const plugin = await pluginManager.getPluginDetails(pluginId);
      return { plugin };
    } catch (error) {
      return reply.code(404).send({ error: `Plugin ${pluginId} not found` });
    }
  });

  // POST /:pluginId/install - Install a plugin
  app.post('/:pluginId/install', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    const body = request.body as any;
    const userId = (request as any).userId;
    try {
      const version = body?.version || 'latest';
      const config = body?.config;
      const result = await pluginManager.installPlugin(pluginId, version, config);
      return { pluginId, action: 'install', version, userId };
    } catch (error) {
      return reply.code(400).send({ error: `Failed to install plugin: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // POST /:pluginId/enable - Enable a plugin
  app.post('/:pluginId/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    // TODO: implement when PluginManagerService supports enable/disable
    return { pluginId, action: 'enable', status: 'not_implemented' };
  });

  // POST /:pluginId/disable - Disable a plugin
  app.post('/:pluginId/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    // TODO: implement when PluginManagerService supports enable/disable
    return { pluginId, action: 'disable', status: 'not_implemented' };
  });

  // DELETE /:pluginId - Uninstall a plugin
  app.delete('/:pluginId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginId } = request.params as { pluginId: string };
    try {
      await pluginManager.uninstallPlugin(pluginId);
      return { pluginId, action: 'uninstall', status: 'uninstalled' };
    } catch (error) {
      return reply.code(400).send({ error: `Failed to uninstall plugin: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // GET /audit - Get audit logs
  app.get('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = (request as any).tenantId;
    const limit = query?.limit || 50;

    // TODO: wire to PluginAuditLogRepository when DB is connected
    return { logs: [], tenantId, limit, status: 'not_implemented' };
  });

  // GET /audit/:taskId/trail - Get task audit trail
  app.get('/audit/:taskId/trail', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    // TODO: wire to PluginAuditLogRepository
    return { taskId, logs: [], status: 'not_implemented' };
  });

  // GET /:runId/timeline - Get execution timeline
  app.get('/:runId/timeline', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    const replayData = timelineService.getReplayData(runId);
    return replayData;
  });

  // POST /:runId/debug/pause - Pause for debug
  app.post('/:runId/debug/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    // TODO: wire to debug controller
    return { runId, status: 'paused' };
  });

  // POST /:runId/debug/resume - Resume execution
  app.post('/:runId/debug/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    // TODO: wire to debug controller
    return { runId, status: 'resumed' };
  });

  // POST /:runId/debug/step - Single step execution
  app.post('/:runId/debug/step', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.params as { runId: string };
    // TODO: wire to debug controller
    return { runId, status: 'stepped' };
  });

  // POST /ai-diagnose - AI error diagnosis
  app.post('/ai-diagnose', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body?.context?.taskId || !body?.context?.pluginId || !body?.context?.errorMessage) {
      return reply.code(400).send({ error: 'Missing required context fields: taskId, pluginId, errorMessage' });
    }
    const result = await aiDiagnosis.diagnose(body.context);
    return result;
  });

  logger.info('Plugin enhanced routes registered');
}
