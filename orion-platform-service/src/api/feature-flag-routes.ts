/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/feature-flag/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Feature Flag API Routes
 *
 * Routes under /api/v1/feature-flags
 * Handles feature flag CRUD, evaluation, rollout management, and toggle history.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { FeatureFlagService } from '../services/config-mgmt/FeatureFlagService';
import { OrionError, ValidationError, NotFoundError, ConflictError, ErrorCode, handleError } from '../errors';

const logger = require('pino')({ name: 'feature-flag-routes' });

export default async function featureFlagRoutes(
  app: FastifyInstance,
  options: { database?: any }
): Promise<void> {
  const service = new FeatureFlagService(options.database);

  // ==================== Feature Flags CRUD ====================

  // GET /api/v1/feature-flags - List flags
  app.get('/', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const tenantId = (request as any).user?.tenantId;
      const flags = await service.listFlags(tenantId, {
        status: query.status,
        environment: query.environment,
      });
      return reply.status(200).send({ success: true, data: flags });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list feature flags');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/feature-flags/:id - Get flag by ID
  app.get('/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const flag = await service.getFlag(id);
      if (!flag) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return reply.status(200).send({ success: true, data: flag });
    } catch (error: any) {
      logger.error({ error }, 'Failed to get feature flag');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /api/v1/feature-flags - Create flag
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature-flag', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const user = request as any;
      const flag = await service.createFlag(user.user?.tenantId, body, user.user?.userId || 'system');
      return reply.status(201).send({ success: true, data: flag });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create feature flag');
      if (error.code === 'NOT_FOUND') {
        return handleError(reply, new ConflictError('CONFLICT'));
      }
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /api/v1/feature-flags/:id - Update flag
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature-flag', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const user = request as any;
      const flag = await service.updateFlag(id, body, user.user?.userId || 'system');
      return reply.status(200).send({ success: true, data: flag });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to update feature flag');
      if (error.code === 'NOT_FOUND') {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /api/v1/feature-flags/:id - Delete flag
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature-flag', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const deleted = await service.deleteFlag(id);
      if (!deleted) {
        return handleError(reply, new NotFoundError('NOT_FOUND'));
      }
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to delete feature flag');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Rollout Management ====================

  // PATCH /api/v1/feature-flags/:id/rollout - Set rollout percentage
  app.patch('/:id/rollout', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature-flag', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { percentage } = request.body as any;
      const user = request as any;
      if (typeof percentage !== 'number') {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      const flag = await service.setRolloutPercentage(id, percentage, user.user?.userId || 'system');
      return reply.status(200).send({ success: true, data: flag });
    } catch (error: any) {
      logger.error({ error }, 'Failed to set rollout percentage');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Flag Evaluation ====================

  // POST /api/v1/feature-flags/evaluate - Evaluate flag for context
  app.post('/evaluate', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId, flagKey, context } = request.body as any;
      if (!tenantId || !flagKey) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      const result = await service.evaluateFlag(tenantId, flagKey, context);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      logger.error({ error }, 'Failed to evaluate feature flag');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Toggle History ====================

  // POST /api/v1/feature-flags/:id/toggle - Record flag toggle
  app.post('/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature-flag', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { oldValue, newValue, reason } = request.body as any;
      const user = request as any;
      if (oldValue === undefined || newValue === undefined) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      await service.recordToggle(id, oldValue, newValue, user.user?.userId || 'system', reason);
      return reply.status(201).send({ success: true });
    } catch (error: any) {
      logger.error({ error }, 'Failed to record toggle');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/feature-flags/:id/history - Get toggle history
  app.get('/:id/history', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const history = await service.getToggleHistory(id);
      return reply.status(200).send({ success: true, data: history });
    } catch (error: any) {
      logger.error({ error }, 'Failed to get toggle history');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Search & Count ====================

  // GET /api/v1/feature-flags/search - Search feature flags
  app.get('/search', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature_flag', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const tenantId = (request as any).user?.tenantId;
      const flags = await service.listFlags(tenantId, {
        status: query.status,
        environment: query.environment,
        q: query.q,
      });
      return reply.status(200).send({ success: true, data: flags });
    } catch (error: any) {
      logger.error({ error }, 'Failed to search feature flags');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/feature-flags/count - Count feature flags
  app.get('/count', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature_flag', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).user?.tenantId;
      const flags = await service.listFlags(tenantId);
      return reply.status(200).send({ success: true, data: { count: flags.length } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to count feature flags');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Batch Evaluation ====================

  // POST /api/v1/feature-flags/evaluate/batch - Batch evaluate flags
  app.post('/evaluate/batch', {
    onRequest: [authenticateUser, requirePermission({ resource: 'feature_flag', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantId, flagKeys, context } = request.body as any;
      if (!tenantId || !flagKeys || !Array.isArray(flagKeys)) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }
      const results = await Promise.all(
        flagKeys.map((flagKey: string) => service.evaluateFlag(tenantId, flagKey, context))
      );
      return reply.status(200).send({ success: true, data: results });
    } catch (error: any) {
      logger.error({ error }, 'Failed to batch evaluate feature flags');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}