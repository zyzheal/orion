/**
 * Developer Portal API Routes
 *
 * Routes under /api/v1/developer-portal
 * PostgreSQL-backed PortalDocument management + Mock/SDK/Subscription/Playground services.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PortalDocumentRepository } from '../repositories/PortalDocumentRepository';
import { PortalDocumentService } from '../services/developer-portal/PortalDocumentService';
import { PortalDocumentController } from './controllers/PortalDocumentController';
import { MockServiceManager } from '../services/developer-portal/MockServiceManager';
import { SDKGeneratorService } from '../services/developer-portal/SDKGeneratorService';
import { APISubscriptionService } from '../services/developer-portal/APISubscriptionService';
import { APIPlaygroundService } from '../services/developer-portal/APIPlaygroundService';
import { DevPortalMockRuleRepository } from '../repositories/DevPortalMockRuleRepository';
import { DevPortalSDKTaskRepository } from '../repositories/DevPortalSDKTaskRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { tenantContext } from '../services/tenant/TenantContext';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, ErrorCode, handleError } from '../errors';

const logger = createLogger('developer-portal-routes');

interface DeveloperPortalRoutesOptions {
  database?: DatabasePool;
}

export default async function developerPortalRoutes(
  app: FastifyInstance,
  options: DeveloperPortalRoutesOptions
): Promise<void> {
  const db = options.database;
  if (!db) {
    logger.warn('[DeveloperPortalRoutes] No database pool provided, developer portal routes will not be functional');
    return;
  }

  const repository = new PortalDocumentRepository(db);
  const documentService = new PortalDocumentService(repository);
  const controller = new PortalDocumentController(documentService);
  const mockRuleRepo = new DevPortalMockRuleRepository(db);
  const sdkTaskRepo = new DevPortalSDKTaskRepository(db);
  const mockManager = new MockServiceManager(mockRuleRepo);
  const sdkGenerator = new SDKGeneratorService(sdkTaskRepo);
  const subscriptionService = new APISubscriptionService(options.database);
  const playgroundService = new APIPlaygroundService(options.database);

  // Helper to get tenant ID
  const getTenantId = (): string => {
    const tenant = tenantContext.getCurrentTenant();
    return tenant ? String(tenant.tenantId) : 'default';
  };

  // Helper to get user ID
  const getUserId = (request: FastifyRequest): string => {
    const user = (request as any).user;
    return user?.userId || user?.sub || 'system';
  };

  // ==================== Document CRUD ====================

  app.post('/documents', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  app.get('/documents', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  app.get('/documents/search', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.search(request, reply);
  });

  app.get('/documents/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  app.put('/documents/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  app.delete('/documents/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Publishing ====================

  app.post('/documents/:id/publish', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.publish(request, reply);
  });

  app.post('/documents/:id/unpublish', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.unpublish(request, reply);
  });

  // ==================== Version Management ====================

  // POST /api/v1/developer-portal/documents/:id/versions — create new version
  app.post('/documents/:id/versions', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const doc = await documentService.createNewVersion(params.id, body.version as string, getUserId(request));
      await reply.status(201).send({ success: true, data: doc });
    } catch (err: any) {
      const code = err.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // GET /api/v1/developer-portal/documents/:id/versions — get all versions
  app.get('/documents/:id/versions', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const versions = await documentService.getDocumentVersions(params.id);
      await reply.send({ success: true, data: versions, total: versions.length });
    } catch (err: any) {
      const code = err.code === 'DOCUMENT_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // ==================== Review Workflow ====================

  // POST /api/v1/developer-portal/documents/:id/review/submit — submit for review
  app.post('/documents/:id/review/submit', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const doc = await documentService.submitForReview(params.id, getUserId(request));
      await reply.send({ success: true, data: doc, message: 'Document submitted for review' });
    } catch (err: any) {
      const code = err.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/documents/:id/review/approve — approve review
  app.post('/documents/:id/review/approve', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const doc = await documentService.approveReview(params.id, getUserId(request));
      await reply.send({ success: true, data: doc, message: 'Review approved' });
    } catch (err: any) {
      const code = err.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/documents/:id/review/reject — reject review
  app.post('/documents/:id/review/reject', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const doc = await documentService.rejectReview(params.id, getUserId(request), (body.reason as string) || '');
      await reply.send({ success: true, data: doc, message: 'Review rejected' });
    } catch (err: any) {
      const code = err.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // GET /api/v1/developer-portal/documents/stats — document statistics
  app.get('/documents/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await documentService.getDocumentStats(getTenantId());
      await reply.send({ success: true, data: stats });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Categories ====================

  app.get('/categories', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCategories(request, reply);
  });

  // ==================== Popular Documents ====================

  app.get('/popular', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPopular(request, reply);
  });

  // ==================== Helpful Feedback ====================

  app.post('/documents/:id/helpful', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordHelpful(request, reply);
  });

  // ==================== Mock Service ====================

  // POST /api/v1/developer-portal/mock-rules — create mock rule
  app.post('/mock-rules', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const rule = await mockManager.createRule({ tenantId: getTenantId(), ...body } as any);
      await reply.status(201).send({ success: true, data: rule });
    } catch (err: any) {
await handleError(reply, new ValidationError(err.message));
    }
  });

  // GET /api/v1/developer-portal/mock-rules — list mock rules
  app.get('/mock-rules', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const result = await mockManager.listRules(getTenantId(), {
        enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
        method: query.method,
        page: query.page ? parseInt(query.page) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      });
      await reply.send({ success: true, ...result });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/mock-rules/stats — mock stats
  app.get('/mock-rules/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await mockManager.getStats(getTenantId());
      await reply.send({ success: true, data: stats });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/mock-rules/:id — get mock rule
  app.get('/mock-rules/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const rule = await mockManager.getRuleById(params.id);
      await reply.send({ success: true, data: rule });
    } catch (err: any) {
      const code = err.code === 'RULE_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // PUT /api/v1/developer-portal/mock-rules/:id — update mock rule
  app.put('/mock-rules/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const rule = await mockManager.updateRule(params.id, body as any);
      await reply.send({ success: true, data: rule });
    } catch (err: any) {
      const code = err.code === 'RULE_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // DELETE /api/v1/developer-portal/mock-rules/:id — delete mock rule
  app.delete('/mock-rules/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      await mockManager.deleteRule(params.id);
      await reply.send({ success: true, message: 'Mock rule deleted' });
    } catch (err: any) {
      const code = err.code === 'RULE_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/mock-rules/:id/toggle — toggle mock rule
  app.post('/mock-rules/:id/toggle', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const rule = await mockManager.toggleRule(params.id);
      await reply.send({ success: true, data: rule });
    } catch (err: any) {
      const code = err.code === 'RULE_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/mock-simulate — simulate mock request
  app.post('/mock-simulate', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const result = await mockManager.matchRequest(getTenantId(), body.method as string, body.path as string);
      await reply.send({ success: true, data: result });
    } catch (err: any) {
await handleError(reply, new ValidationError(err.message));
    }
  });

  // ==================== SDK Generator ====================

  // GET /api/v1/developer-portal/sdk/languages — list supported languages
  app.get('/sdk/languages', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const languages = sdkGenerator.getSupportedLanguages();
    await reply.send({ success: true, data: languages });
  });

  // POST /api/v1/developer-portal/sdk/generate — create SDK generation task
  app.post('/sdk/generate', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const task = await sdkGenerator.createTask({ tenantId: getTenantId(), ...body } as any);
      await reply.status(201).send({ success: true, data: task });
    } catch (err: any) {
await handleError(reply, new ValidationError(err.message));
    }
  });

  // GET /api/v1/developer-portal/sdk/tasks — list SDK generation tasks
  app.get('/sdk/tasks', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const result = await sdkGenerator.listTasks(getTenantId(), {
        language: query.language as any,
        status: query.status,
        page: query.page ? parseInt(query.page) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      });
      await reply.send({ success: true, ...result });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/sdk/tasks/stats — SDK stats
  app.get('/sdk/tasks/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await sdkGenerator.getStats(getTenantId());
      await reply.send({ success: true, data: stats });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/sdk/tasks/:id — get SDK task
  app.get('/sdk/tasks/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const task = await sdkGenerator.getTaskById(params.id);
      await reply.send({ success: true, data: task });
    } catch (err: any) {
      const code = err.code === 'TASK_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // DELETE /api/v1/developer-portal/sdk/tasks/:id — delete SDK task
  app.delete('/sdk/tasks/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      await sdkGenerator.deleteTask(params.id);
      await reply.send({ success: true, message: 'SDK task deleted' });
    } catch (err: any) {
      const code = err.code === 'TASK_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/sdk/tasks/:id/regenerate — regenerate SDK
  app.post('/sdk/tasks/:id/regenerate', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const task = await sdkGenerator.regenerateTask(params.id);
      await reply.send({ success: true, data: task });
    } catch (err: any) {
      const code = err.code === 'TASK_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // ==================== API Subscription ====================

  // POST /api/v1/developer-portal/subscriptions — create subscription
  app.post('/subscriptions', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const sub = await subscriptionService.createSubscription({
        tenantId: getTenantId(),
        userId: getUserId(request),
        apiName: body.apiName as string,
        planName: body.planName as string | undefined,
        quotaPerDay: body.quotaPerDay as number | undefined,
        quotaPerMonth: body.quotaPerMonth as number | undefined,
        reason: body.reason as string | undefined,
      });
      await reply.status(201).send({ success: true, data: sub });
    } catch (err: any) {
      const code = err.code === 'DUPLICATE_SUBSCRIPTION' ? 409 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // GET /api/v1/developer-portal/subscriptions — list subscriptions
  app.get('/subscriptions', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const result = await subscriptionService.listSubscriptions(getTenantId(), {
        userId: query.userId,
        apiName: query.apiName,
        status: query.status as any,
        page: query.page ? parseInt(query.page) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      });
      await reply.send({ success: true, ...result });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/subscriptions/stats — subscription stats
  app.get('/subscriptions/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await subscriptionService.getUsageStats(getTenantId());
      await reply.send({ success: true, data: stats });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/subscriptions/:id — get subscription
  app.get('/subscriptions/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const sub = await subscriptionService.getSubscriptionById(params.id);
      await reply.send({ success: true, data: sub });
    } catch (err: any) {
      const code = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/subscriptions/:id/approve — approve subscription
  app.post('/subscriptions/:id/approve', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const sub = await subscriptionService.approveSubscription(params.id, { approvedBy: getUserId(request) });
      await reply.send({ success: true, data: sub, message: 'Subscription approved' });
    } catch (err: any) {
      const code = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/subscriptions/:id/reject — reject subscription
  app.post('/subscriptions/:id/reject', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const sub = await subscriptionService.rejectSubscription(params.id, {
        approvedBy: getUserId(request),
        rejectReason: body.reason as string,
      });
      await reply.send({ success: true, data: sub, message: 'Subscription rejected' });
    } catch (err: any) {
      const code = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/subscriptions/:id/suspend — suspend subscription
  app.post('/subscriptions/:id/suspend', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const sub = await subscriptionService.suspendSubscription(params.id);
      await reply.send({ success: true, data: sub, message: 'Subscription suspended' });
    } catch (err: any) {
      const code = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/subscriptions/:id/cancel — cancel subscription
  app.post('/subscriptions/:id/cancel', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const sub = await subscriptionService.cancelSubscription(params.id);
      await reply.send({ success: true, data: sub, message: 'Subscription cancelled' });
    } catch (err: any) {
      const code = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // GET /api/v1/developer-portal/subscriptions/:id/usage — get usage records
  app.get('/subscriptions/:id/usage', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string>;
      const result = await subscriptionService.getUsageRecords(params.id, {
        page: query.page ? parseInt(query.page) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      });
      await reply.send({ success: true, ...result });
    } catch (err: any) {
      const code = err.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // ==================== API Playground ====================

  // POST /api/v1/developer-portal/playground/execute — quick execute
  app.post('/playground/execute', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const result = await playgroundService.quickExecute({
        tenantId: getTenantId(),
        userId: getUserId(request),
        ...body,
      } as any);
      await reply.send({ success: true, data: result });
    } catch (err: any) {
await handleError(reply, new ValidationError(err.message));
    }
  });

  // POST /api/v1/developer-portal/playground/requests — save request
  app.post('/playground/requests', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const req = await playgroundService.saveRequest({
        tenantId: getTenantId(),
        userId: getUserId(request),
        ...body,
      } as any);
      await reply.status(201).send({ success: true, data: req });
    } catch (err: any) {
await handleError(reply, new ValidationError(err.message));
    }
  });

  // GET /api/v1/developer-portal/playground/requests — list saved requests
  app.get('/playground/requests', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const result = await playgroundService.listRequests(getTenantId(), getUserId(request), {
        method: query.method,
        page: query.page ? parseInt(query.page) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      });
      await reply.send({ success: true, ...result });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/playground/stats — playground stats
  app.get('/playground/stats', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await playgroundService.getStats(getTenantId(), getUserId(request));
      await reply.send({ success: true, data: stats });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/developer-portal/playground/requests/:id — get saved request
  app.get('/playground/requests/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const req = await playgroundService.getRequestById(params.id);
      await reply.send({ success: true, data: req });
    } catch (err: any) {
      const code = err.code === 'REQUEST_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // PUT /api/v1/developer-portal/playground/requests/:id — update saved request
  app.put('/playground/requests/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const body = request.body as Record<string, unknown>;
      const req = await playgroundService.updateRequest(params.id, body as any);
      await reply.send({ success: true, data: req });
    } catch (err: any) {
      const code = err.code === 'REQUEST_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // DELETE /api/v1/developer-portal/playground/requests/:id — delete saved request
  app.delete('/playground/requests/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      await playgroundService.deleteRequest(params.id);
      await reply.send({ success: true, message: 'Request deleted' });
    } catch (err: any) {
      const code = err.code === 'REQUEST_NOT_FOUND' ? 404 : 500;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // POST /api/v1/developer-portal/playground/requests/:id/execute — execute saved request
  app.post('/playground/requests/:id/execute', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const result = await playgroundService.executeRequest(params.id);
      await reply.send({ success: true, data: result });
    } catch (err: any) {
      const code = err.code === 'REQUEST_NOT_FOUND' ? 404 : 400;
      await reply.status(code).send({ success: false, error: err.message });
    }
  });

  // GET /api/v1/developer-portal/playground/requests/:id/history — response history
  app.get('/playground/requests/:id/history', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string>;
      const result = await playgroundService.getResponseHistory(params.id, {
        page: query.page ? parseInt(query.page) : undefined,
        pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
      });
      await reply.send({ success: true, ...result });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /api/v1/developer-portal/playground/requests/:id/history — clear history
  app.delete('/playground/requests/:id/history', { onRequest: [authenticateUser, requirePermission({ resource: 'developer_portal', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      await playgroundService.clearHistory(params.id);
      await reply.send({ success: true, message: 'History cleared' });
    } catch (err: any) {
await handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
    }
  });
}
