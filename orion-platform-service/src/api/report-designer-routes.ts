/**
 * Report Designer API Routes
 *
 * CRUD operations for report definitions, datasources, schedules, and execution history.
 *
 * Prefix: /api/v1/reports
 *
 * Endpoints:
 *   Reports:       GET /reports, POST /reports, GET /reports/:id, PUT /reports/:id, DELETE /reports/:id
 *   Preview:       POST /reports/:id/preview
 *   Execute:       POST /reports/:id/execute
 *   History:       GET /reports/:id/executions
 *   Datasources:   GET /reports/datasources, POST /reports/datasources, PUT /reports/datasources/:id, DELETE /reports/datasources/:id
 *   Schedules:     GET /reports/:id/schedules, POST /reports/:id/schedules, PUT /reports/schedules/:id, DELETE /reports/schedules/:id
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { handleError } from '../errors';
import { ReportDesignerService } from '../services/report-designer/ReportDesignerService';
import { ReportDefinitionRepository } from '../services/report-designer/ReportDefinitionRepository';
import { ReportDatasourceRepository } from '../services/report-designer/ReportDatasourceRepository';
import { ReportScheduleRepository } from '../services/report-designer/ReportScheduleRepository';
import { ReportExecutionRepository } from '../services/report-designer/ReportExecutionRepository';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'report-designer-routes' });

export default async function reportDesignerRoutes(
  app: FastifyInstance,
  options: { database: any },
): Promise<void> {
  if (!options.database) {
    logger.warn('[ReportDesignerRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const definitionRepo = new ReportDefinitionRepository(options.database);
  const datasourceRepo = new ReportDatasourceRepository(options.database);
  const scheduleRepo = new ReportScheduleRepository(options.database);
  const executionRepo = new ReportExecutionRepository(options.database);
  const service = new ReportDesignerService(definitionRepo, datasourceRepo, scheduleRepo, executionRepo);

  function getUserId(request: FastifyRequest): string {
    const user = (request as any).user;
    return user?.id ?? user?.sub ?? 'anonymous';
  }

  // ==================== Report Definitions ====================

  // GET /reports - List reports
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const result = await service.listReports({
        category: query.category,
        enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
        keyword: query.keyword,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      return reply.send({
        success: true,
        data: result.entities,
        total: result.total,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /reports - Create report
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, any>;
      const userId = getUserId(request);

      if (!body.name) {
        return handleError(reply, new ValidationError('name is required'));
      }

      const report = await service.createReport({
        name: body.name,
        description: body.description,
        category: body.category,
        layout: body.layout,
        components: body.components,
        datasourceBindings: body.datasourceBindings,
        templateId: body.templateId,
        enabled: body.enabled,
        createdBy: userId,
      });

      return reply.status(201).send({ success: true, data: report });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /reports/datasources - List datasources (must be before /:id to avoid conflict)
  app.get('/datasources', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const datasources = await service.listDatasources();
      return reply.send({ success: true, data: datasources });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /reports/datasources - Create datasource
  app.post('/datasources', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, any>;

      if (!body.name || !body.datasourceType || !body.config) {
        return handleError(reply, new ValidationError('name, datasourceType, and config are required'))
      }

      const datasource = await service.createDatasource({
        name: body.name,
        datasourceType: body.datasourceType,
        config: body.config,
        refreshInterval: body.refreshInterval,
      });
      return reply.status(201).send({ success: true, data: datasource });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /reports/datasources/:id - Update datasource
  app.put('/datasources/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;

      const datasource = await service.updateDatasource(id, body);
      return reply.send({ success: true, data: datasource });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /reports/datasources/:id - Delete datasource
  app.delete('/datasources/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteDatasource(id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /reports/schedules/:id - Update schedule (must be before /:id/schedules)
  app.put('/schedules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;

      const schedule = await service.updateSchedule(id, body);
      return reply.send({ success: true, data: schedule });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /reports/schedules/:id - Delete schedule
  app.delete('/schedules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteSchedule(id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /reports/:id - Get report
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const report = await service.getReport(id);
      return reply.send({ success: true, data: report });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /reports/:id - Update report
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;

      const report = await service.updateReport(id, body);
      return reply.send({ success: true, data: report });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /reports/:id - Delete report
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteReport(id);
      return reply.send({ success: true, data: { deleted: true } });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /reports/:id/preview - Preview report
  app.post('/:id/preview', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as Record<string, any>;

      const result = await service.previewReport(id, body);
      return reply.send({ success: true, data: result });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /reports/:id/execute - Execute report
  app.post('/:id/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as Record<string, any>;
      const userId = getUserId(request);

      const execution = await service.executeReport(id, body, userId);
      return reply.status(201).send({ success: true, data: execution });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /reports/:id/executions - Execution history
  app.get('/:id/executions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const executions = await service.getExecutionHistory(id, limit);
      return reply.send({ success: true, data: executions });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /reports/:id/schedules - List schedules for a report
  app.get('/:id/schedules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const schedules = await service.listSchedules(id);
      return reply.send({ success: true, data: schedules });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /reports/:id/schedules - Create schedule for a report
  app.post('/:id/schedules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'report-designer', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, any>;

      if (!body.cronExpression || !body.exportFormat) {
        return handleError(reply, new ValidationError('cronExpression and exportFormat are required'))
      }

      const schedule = await service.createSchedule({
        reportId: id,
        cronExpression: body.cronExpression,
        exportFormat: body.exportFormat,
        recipients: body.recipients,
        enabled: body.enabled,
      });

      return reply.status(201).send({ success: true, data: schedule });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
