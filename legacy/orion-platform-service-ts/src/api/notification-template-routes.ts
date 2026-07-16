/**
 * Notification Template API Routes
 *
 * CRUD for notification templates with multi-tenant isolation.
 * Mounted under /api/v1/notifications/templates
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { NotificationTemplateService } from '../services/notification/NotificationTemplateService';
import { NotificationTemplateRepository } from '../repositories/NotificationTemplateRepository';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = createLogger('notification-template-routes');

interface NotificationTemplateRoutesOptions {
  database?: DatabasePool;
}

export default async function notificationTemplateRoutes(
  app: FastifyInstance,
  options: NotificationTemplateRoutesOptions
): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[NotificationTemplateRoutes] No database pool provided');
    return;
  }

  const repository = new NotificationTemplateRepository(pool);
  const service = new NotificationTemplateService(repository);

  const getContextTenantId = (request: FastifyRequest): string => {
    const tid = (request as any).user?.tenantId;
    if (!tid) {
      throw new OrionError('租户ID缺失：用户认证信息中必须包含 tenantId', 'VALIDATION_ERROR');
    }
    return tid;
  };

  // =========================================================================
  // POST / - Create notification template
  // =========================================================================
  app.post(
    '/',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'admin' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getContextTenantId(request);
        const body = request.body as {
          name: string;
          event_type: string;
          subject?: string;
          body_template: string;
          channel_ids?: string[];
        };

        if (!body.name || !body.event_type || !body.body_template) {
          return handleError(reply, new ValidationError('name, event_type, and body_template are required'));
        }

        const template = await (service as any).createTemplate({
          ...body,
          tenant_id: tenantId,
        });

        return reply.status(201).send({ success: true, data: template });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[NotificationTemplateRoutes] Error creating template'
        );
        return handleError(reply as FastifyReply, error);
      }
    }
  );

  // =========================================================================
  // GET / - List notification templates
  // =========================================================================
  app.get(
    '/',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = getContextTenantId(request);
        const query = request.query as { event_type?: string; limit?: string; offset?: string };

        const templates = await (service as any).listTemplates({
          event_type: query.event_type,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
          offset: query.offset ? parseInt(query.offset, 10) : undefined,
        });

        return reply.send({ success: true, data: templates });
      } catch (error) {
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[NotificationTemplateRoutes] Error listing templates'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // GET /:id - Get single notification template
  // =========================================================================
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const template = await (service as any).getTemplate(id);
        return reply.send({ success: true, data: template });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[NotificationTemplateRoutes] Error fetching template'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // PUT /:id - Update notification template
  // =========================================================================
  app.put<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'admin' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = request.body as {
          name?: string;
          event_type?: string;
          subject?: string;
          body_template?: string;
          channel_ids?: string[];
        };

        const template = await (service as any).updateTemplate(id, body);
        return reply.send({ success: true, data: template });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[NotificationTemplateRoutes] Error updating template'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // =========================================================================
  // DELETE /:id - Delete notification template
  // =========================================================================
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification', action: 'admin' }),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        await (service as any).deleteTemplate(id);
        return reply.send({ success: true, message: 'Template deleted' });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'));
        }
        logger.error(
          {
            traceId: (request as any).traceId || 'unknown-trace',
            tenantId: getContextTenantId(request),
            error: error instanceof Error ? error.message : error,
          },
          '[NotificationTemplateRoutes] Error deleting template'
        );
        return handleError(reply as FastifyReply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
