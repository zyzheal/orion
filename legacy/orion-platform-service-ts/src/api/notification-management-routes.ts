/**
 * Notification Management API Routes
 *
 * Provides enhanced notification functionality:
 * - Template variable engine ({{variable}} syntax)
 * - Template inheritance (base template + override)
 * - Template preview
 * - Cron expression validation
 * - Schedule activation toggling
 *
 * Prefix: /api/v1/notification (mounted under /notifications in routes.ts)
 *
 * Permissions:
 *   - notification:read   → preview, render variables, validate-cron
 *   - notification:write  → toggle schedule
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';
import {
  NotificationTemplateService,
  RenderResult,
  PreviewInput,
  TemplateInheritanceOverride,
} from '../services/notification/NotificationTemplateService';
import { ScheduledNotificationService, ParsedCronSchedule } from '../services/notification/ScheduledNotificationService';
import { NotificationTemplateRepository } from '../repositories/NotificationTemplateRepository';
import { ScheduledNotificationRepository } from '../repositories/ScheduledNotificationRepository';
import { DatabasePool } from '../services/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('notification-management-routes');

interface NotificationManagementRoutesOptions {
  database: DatabasePool;
}

// ================================================================
// Type definitions for route params/body
// ================================================================

interface TemplatePreviewParams {
  id: string;
}

interface TemplateRenderParams {
  id: string;
}

interface TemplateInheritanceBody {
  baseTemplateId: string;
  overrides: TemplateInheritanceOverride;
  name: string;
}

interface TemplateRenderBody {
  variables: Record<string, string>;
}

interface ValidateCronBody {
  cron_expression: string;
  timezone?: string;
}

interface ToggleScheduleParams {
  id: string;
}

interface ToggleScheduleBody {
  active: boolean;
}

// ================================================================
// Route handler
// ================================================================

export default async function notificationManagementRoutes(
  app: FastifyInstance,
  options: NotificationManagementRoutesOptions,
): Promise<void> {
  const pool = options.database;
  const templateRepo = new NotificationTemplateRepository(pool);
  const scheduleRepo = new ScheduledNotificationRepository(pool);
  const templateService = new NotificationTemplateService(templateRepo);
  const scheduleService = new ScheduledNotificationService(scheduleRepo);

  // ===========================================================
  // POST /templates/:id/preview
  // Render a template with sample variables and return the result.
  // ===========================================================
  app.post<{ Params: TemplatePreviewParams; Body: PreviewInput }>(
    '/templates/:id/preview',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification-template', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Params: TemplatePreviewParams; Body: PreviewInput }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = request.body as PreviewInput;

        if (!body.variables || Object.keys(body.variables).length === 0) {
          return handleError(reply, new ValidationError('variables map is required'));
        }

        const result = await templateService.previewTemplate(id, body);
        return reply.send({ success: true, data: result });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof ValidationError || err instanceof OrionError) {
          return handleError(reply, err);
        }
        logger.error({ err }, '[NotificationManagementRoutes] Error previewing template');
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    },
  );

  // ===========================================================
  // POST /templates/:id/variables/render
  // Render variable placeholders in a template body and return the result.
  // ===========================================================
  app.post<{ Params: TemplateRenderParams; Body: TemplateRenderBody }>(
    '/templates/:id/variables/render',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification-template', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Params: TemplateRenderParams; Body: TemplateRenderBody }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = request.body as TemplateRenderBody;

        const template = await templateRepo.findById(id);
        if (!template) {
          return handleError(reply, new NotFoundError('Template not found'));
        }

        // Extract variables from both subject and body
        const subjectVars = template.subject_template
          ? templateService.extractVariables(template.subject_template)
          : [];
        const bodyVars = templateService.extractVariables(template.body_template);
        const allVarKeys = [...new Set([...subjectVars, ...bodyVars])];

        // Render with provided variables
        const renderResult = templateService.renderTemplateFull(template, body.variables);

        return reply.send({
          success: true,
          data: {
            ...renderResult,
            allVariableKeys: allVarKeys,
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof ValidationError || err instanceof OrionError) {
          return handleError(reply, err);
        }
        logger.error({ err }, '[NotificationManagementRoutes] Error rendering variables');
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    },
  );

  // ===========================================================
  // POST /schedules/validate-cron
  // Validate a cron expression and return next fire time + description.
  // ===========================================================
  app.post<{ Body: ValidateCronBody }>(
    '/schedules/validate-cron',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification-schedule', action: 'read' }),
      ],
    },
    async (request: FastifyRequest<{ Body: ValidateCronBody }>, reply: FastifyReply) => {
      try {
        const body = request.body as ValidateCronBody;

        if (!body.cron_expression || typeof body.cron_expression !== 'string') {
          return handleError(reply, new ValidationError('cron_expression is required'));
        }

        const result: ParsedCronSchedule = scheduleService.validateCronExpression(
          body.cron_expression,
          body.timezone || 'UTC',
        );

        return reply.send({ success: true, data: result });
      } catch (err: any) {
        if (err instanceof ValidationError || err instanceof OrionError) {
          return handleError(reply, err);
        }
        logger.error({ err }, '[NotificationManagementRoutes] Error validating cron expression');
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    },
  );

  // ===========================================================
  // PUT /schedules/:id/toggle
  // Activate or deactivate a scheduled notification.
  // ===========================================================
  app.put<{ Params: ToggleScheduleParams; Body: ToggleScheduleBody }>(
    '/schedules/:id/toggle',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'notification-schedule', action: 'write' }),
      ],
    },
    async (request: FastifyRequest<{ Params: ToggleScheduleParams; Body: ToggleScheduleBody }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = request.body as ToggleScheduleBody;

        if (typeof body.active !== 'boolean') {
          return handleError(reply, new ValidationError('active (boolean) is required'));
        }

        const updated = await scheduleService.toggleSchedule(id, body.active);
        return reply.send({ success: true, data: updated });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof ValidationError || err instanceof OrionError) {
          return handleError(reply, err);
        }
        logger.error({ err }, '[NotificationManagementRoutes] Error toggling schedule');
        return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
      }
    },
  );
}
