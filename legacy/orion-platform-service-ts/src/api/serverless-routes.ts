/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/serverless/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Serverless API Routes (Phase 4 P0 - Serverless Module)
 * Function lifecycle, triggers, deployment, invocation, logs, metrics, auto-scaling
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ServerlessService } from '../services/serverless/ServerlessService';
import type { FunctionStatus, FunctionRuntime, TriggerType } from '../services/serverless/ServerlessService';
import { DatabasePool } from '../services/database';
import { NotFoundError, handleError } from '../errors';

interface ServerlessRoutesOptions {
  database?: DatabasePool;
}

export default async function serverlessRoutes(
  app: FastifyInstance,
  options: ServerlessRoutesOptions = {}
): Promise<void> {
  const serverlessService = options.database ? new ServerlessService(options.database) : new ServerlessService();

  // ============================================================================
  // Functions CRUD
  // ============================================================================

  app.post('/serverless/functions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const body = request.body as any;
    const fn = await serverlessService.createFunction({
      name: body.name,
      description: body.description,
      runtime: body.runtime,
      handler: body.handler,
      memory: body.memory,
      timeout: body.timeout,
      environment: body.environment,
      code: body.code,
      replicas: body.replicas,
    }, tenantId);
    return reply.status(201).send({ success: true, data: fn });
  });

  app.get('/serverless/functions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const query = request.query as { status?: FunctionStatus; runtime?: FunctionRuntime };
    const list = await serverlessService.listFunctions(tenantId, query);
    return reply.send({ success: true, data: list });
  });

  app.get('/serverless/functions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const fn = await serverlessService.getFunction(params.id, tenantId);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: fn });
  });

  app.put('/serverless/functions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const body = request.body as any;
    const fn = await serverlessService.updateFunction(params.id, tenantId, {
      name: body.name,
      description: body.description,
      runtime: body.runtime,
      handler: body.handler,
      memory: body.memory,
      timeout: body.timeout,
      environment: body.environment,
      code: body.code,
      replicas: body.replicas,
    });
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: fn });
  });

  app.delete('/serverless/functions/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const deleted = await serverlessService.deleteFunction(params.id, tenantId);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, message: 'Function deleted' });
  });

  // ============================================================================
  // Deployment
  // ============================================================================

  app.post('/serverless/functions/:id/deploy', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    try {
      const deployment = await serverlessService.deployFunction(params.id, tenantId);
      return reply.send({ success: true, data: deployment });
    } catch (err) {
      return handleError(reply, new NotFoundError('DEPLOY_FAILED'));
    }
  });

  app.get('/serverless/functions/:id/deployments', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const list = await serverlessService.listDeployments(params.id, tenantId);
    return reply.send({ success: true, data: list });
  });

  // ============================================================================
  // Invocation
  // ============================================================================

  app.post('/serverless/functions/:id/invoke', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const body = request.body as Record<string, unknown> | undefined;
    try {
      const result = await serverlessService.invokeFunction(params.id, tenantId, body);
      return reply.send({ success: true, data: result });
    } catch (err) {
      const code = err instanceof Error && err.message === 'FUNCTION_NOT_DEPLOYED' ? 400 : 404;
      return reply.status(code).send({ error: err instanceof Error ? err.message : 'INVOKE_FAILED', message: err instanceof Error ? err.message : 'Invoke failed' });
    }
  });

  // ============================================================================
  // Logs
  // ============================================================================

  app.get('/serverless/functions/:id/logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const query = request.query as { level?: string; limit?: number };
    const logsList = await serverlessService.getFunctionLogs(params.id, tenantId, {
      level: query.level,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return reply.send({ success: true, data: logsList });
  });

  // ============================================================================
  // Metrics
  // ============================================================================

  app.get('/serverless/functions/:id/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const metricsList = await serverlessService.getFunctionMetrics(params.id, tenantId);
    return reply.send({ success: true, data: metricsList });
  });

  app.get('/serverless/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const agg = await serverlessService.getAggregateMetrics(tenantId);
    return reply.send({ success: true, data: agg });
  });

  // ============================================================================
  // Triggers
  // ============================================================================

  app.post('/serverless/triggers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const body = request.body as any;
    try {
      const trigger = await serverlessService.createTrigger({
        functionId: body.functionId,
        type: body.type,
        name: body.name,
        config: body.config,
      }, tenantId);
      return reply.status(201).send({ success: true, data: trigger });
    } catch (err) {
      return handleError(reply, new NotFoundError('FUNCTION_NOT_FOUND'));
    }
  });

  app.get('/serverless/triggers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const query = request.query as { functionId?: string; type?: TriggerType };
    const list = await serverlessService.listTriggers(tenantId, query);
    return reply.send({ success: true, data: list });
  });

  app.get('/serverless/triggers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const trigger = await serverlessService.getTrigger(params.id, tenantId);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: trigger });
  });

  app.delete('/serverless/triggers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const params = request.params as { id: string };
    const deleted = await serverlessService.deleteTrigger(params.id, tenantId);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, message: 'Trigger deleted' });
  });

  // ============================================================================
  // Auto-scaling
  // ============================================================================

  app.get('/serverless/autoscaling', {
    onRequest: [authenticateUser, requirePermission({ resource: 'serverless', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const recommendations = await serverlessService.evaluateAutoScaling(tenantId);
    return reply.send({ success: true, data: recommendations });
  });
}