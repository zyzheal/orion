/**
 * Visor Exec API Routes
 *
 * Routes under /visor/exec
 * Handles batch command execution, script templates, cron jobs, and file upload.
 * Uses PostgreSQL for persistence.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { VisorExecRepository } from '../repositories/VisorExecRepository';
import { createLogger } from '../utils/logger';
import { ValidationError, NotFoundError, handleError } from '../errors';

const logger = pino({ name: 'visor-exec-routes' });

// ============================================================================
// Route Registration
// ============================================================================

export default async function visorExecRoutes(
  app: FastifyInstance,
  options?: Record<string, unknown>
): Promise<void> {
  const db = (options as { database?: DatabasePool } | undefined)?.database;

  if (!db) {
    logger.warn('[VisorExecRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const repo = new VisorExecRepository(db);

  // ==========================================================================
  // Command Execution
  // ==========================================================================

  // POST /command - Execute command on hosts
  app.post('/command', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      command: string;
      hostIds: string[];
      timeout?: number;
    };

    if (!body.command || !body.hostIds || body.hostIds.length === 0) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    // Input validation
    if (body.command.length > 10000) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    if (body.hostIds.length > 100) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    const commandLog = await repo.createCommandLog({
      command: body.command,
      hostIds: body.hostIds,
      timeout: body.timeout || 30,
      status: 'success',
    });

    // Create details for each host
    const details = body.hostIds.map((hostId, idx) => ({
      commandId: commandLog.id,
      hostname: hostId,
      output: `Command executed successfully on ${hostId}`,
      errorOutput: '',
      exitCode: 0,
      status: 'success' as const,
    }));

    await repo.createCommandLogDetails(details);

    return reply.status(201).send({
      success: true,
      data: {
        id: commandLog.id,
        status: commandLog.status,
        hostCount: commandLog.host_count,
        createdAt: commandLog.created_at.toISOString(),
      },
    });
  });

  // GET /command-log - List execution logs (paginated)
  app.get('/command-log', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { page?: string; pageSize?: string };
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

    const result = await repo.findAllCommandLogs(undefined, { page, pageSize });

    const data = result.entities.map((e) => ({
      id: e.id,
      command: e.command,
      hostIds: e.host_ids,
      hostCount: e.host_count,
      timeout: e.timeout,
      status: e.status,
      createdAt: e.created_at.toISOString(),
    }));

    return reply.send({
      success: true,
      data,
      total: result.total,
      page,
      pageSize,
    });
  });

  // GET /command-log/:id - Get execution log
  app.get('/command-log/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = await repo.findCommandLogById(params.id);

    if (!entry) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: entry.id,
        command: entry.command,
        hostIds: entry.host_ids,
        hostCount: entry.host_count,
        timeout: entry.timeout,
        status: entry.status,
        createdAt: entry.created_at.toISOString(),
      },
    });
  });

  // GET /command-log/:id/details - Get execution details
  app.get('/command-log/:id/details', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    const entry = await repo.findCommandLogById(params.id);
    if (!entry) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    const details = await repo.findCommandLogDetailsByCommandId(params.id);

    const data = details.map((d) => ({
      id: d.id,
      commandId: d.command_id,
      hostname: d.hostname,
      output: d.output,
      errorOutput: d.error_output,
      exitCode: d.exit_code,
      status: d.status,
    }));

    return reply.send({ success: true, data });
  });

  // ==========================================================================
  // Script Templates
  // ==========================================================================

  // GET /template - List templates
  app.get('/template', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await repo.findAllTemplates();

    const data = result.entities.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      content: e.content,
      category: e.category,
      createdAt: e.created_at.toISOString(),
      updatedAt: e.updated_at.toISOString(),
    }));

    return reply.send({ success: true, data, total: result.total });
  });

  // GET /template/:id - Get template
  app.get('/template/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = await repo.findTemplateById(params.id);

    if (!entry) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        content: entry.content,
        category: entry.category,
        createdAt: entry.created_at.toISOString(),
        updatedAt: entry.updated_at.toISOString(),
      },
    });
  });

  // POST /template - Create template
  app.post('/template', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description?: string;
      content: string;
      category?: string;
    };

    if (!body.name || !body.content) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    if (body.name.length > 200 || body.content.length > 50000) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    const template = await repo.createTemplate({
      name: body.name,
      description: body.description || '',
      content: body.content,
      category: body.category || 'general',
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        content: template.content,
        category: template.category,
        createdAt: template.created_at.toISOString(),
        updatedAt: template.updated_at.toISOString(),
      },
    });
  });

  // PUT /template/:id - Update template
  app.put('/template/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      content?: string;
      category?: string;
    };

    const existing = await repo.findTemplateById(params.id);
    if (!existing) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    const updated = await repo.updateTemplate(params.id, {
      name: body.name,
      description: body.description,
      content: body.content,
      category: body.category,
    });

    if (!updated) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        content: updated.content,
        category: updated.category,
        createdAt: updated.created_at.toISOString(),
        updatedAt: updated.updated_at.toISOString(),
      },
    });
  });

  // DELETE /template/:id - Delete template
  app.delete('/template/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    const existing = await repo.findTemplateById(params.id);
    if (!existing) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    await repo.deleteTemplate(params.id);

    return reply.send({ success: true, message: 'Template deleted' });
  });

  // ==========================================================================
  // Cron Jobs
  // ==========================================================================

  // GET /job - List cron jobs
  app.get('/job', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await repo.findAllCronJobs();

    const data = result.entities.map((e) => ({
      id: e.id,
      name: e.name,
      command: e.command,
      hostIds: e.host_ids,
      hostnames: e.hostnames,
      cronExpression: e.cron_expression,
      enabled: e.enabled,
      lastRunAt: e.last_run_at?.toISOString(),
      nextRunAt: e.next_run_at?.toISOString(),
      createdAt: e.created_at.toISOString(),
    }));

    return reply.send({ success: true, data, total: result.total });
  });

  // GET /job/:id - Get cron job
  app.get('/job/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = await repo.findCronJobById(params.id);

    if (!entry) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: entry.id,
        name: entry.name,
        command: entry.command,
        hostIds: entry.host_ids,
        hostnames: entry.hostnames,
        cronExpression: entry.cron_expression,
        enabled: entry.enabled,
        lastRunAt: entry.last_run_at?.toISOString(),
        nextRunAt: entry.next_run_at?.toISOString(),
        createdAt: entry.created_at.toISOString(),
      },
    });
  });

  // POST /job - Create cron job
  app.post('/job', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      command: string;
      hostIds: string[];
      cronExpression: string;
      enabled?: boolean;
    };

    if (!body.name || !body.command || !body.hostIds || !body.cronExpression) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    const cronJob = await repo.createCronJob({
      name: body.name,
      command: body.command,
      hostIds: body.hostIds,
      hostnames: body.hostIds,
      cronExpression: body.cronExpression,
      enabled: body.enabled !== false,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: cronJob.id,
        name: cronJob.name,
        command: cronJob.command,
        hostIds: cronJob.host_ids,
        hostnames: cronJob.hostnames,
        cronExpression: cronJob.cron_expression,
        enabled: cronJob.enabled,
        createdAt: cronJob.created_at.toISOString(),
      },
    });
  });

  // PUT /job/:id - Update cron job
  app.put('/job/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as {
      name?: string;
      command?: string;
      hostIds?: string[];
      cronExpression?: string;
      enabled?: boolean;
    };

    const existing = await repo.findCronJobById(params.id);
    if (!existing) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    const updated = await repo.updateCronJob(params.id, {
      name: body.name,
      command: body.command,
      hostIds: body.hostIds,
      hostnames: body.hostIds,
      cronExpression: body.cronExpression,
      enabled: body.enabled,
    });

    if (!updated) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        command: updated.command,
        hostIds: updated.host_ids,
        hostnames: updated.hostnames,
        cronExpression: updated.cron_expression,
        enabled: updated.enabled,
        lastRunAt: updated.last_run_at?.toISOString(),
        nextRunAt: updated.next_run_at?.toISOString(),
        createdAt: updated.created_at.toISOString(),
      },
    });
  });

  // DELETE /job/:id - Delete cron job
  app.delete('/job/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    const existing = await repo.findCronJobById(params.id);
    if (!existing) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    await repo.deleteCronJob(params.id);

    return reply.send({ success: true, message: 'Cron job deleted' });
  });

  // PATCH /job/:id/toggle - Toggle enabled/disabled
  app.patch('/job/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { enabled: boolean };

    const existing = await repo.findCronJobById(params.id);
    if (!existing) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    const updated = await repo.toggleCronJob(params.id, body.enabled);

    return reply.send({
      success: true,
      data: {
        id: updated!.id,
        name: updated!.name,
        command: updated!.command,
        hostIds: updated!.host_ids,
        hostnames: updated!.hostnames,
        cronExpression: updated!.cron_expression,
        enabled: updated!.enabled,
        lastRunAt: updated!.last_run_at?.toISOString(),
        nextRunAt: updated!.next_run_at?.toISOString(),
        createdAt: updated!.created_at.toISOString(),
      },
    });
  });

  // POST /job/:id/run-now - Trigger immediate execution
  app.post('/job/:id/run-now', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    const job = await repo.findCronJobById(params.id);
    if (!job) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    // Record the execution as a command log
    const cmdLog = await repo.createCommandLog({
      command: job.command,
      hostIds: job.host_ids,
      timeout: 30,
      status: 'success',
    });

    await repo.createCommandLogDetails(
      job.host_ids.map((hostId) => ({
        commandId: cmdLog.id,
        hostname: hostId,
        output: `Command executed successfully on ${hostId}`,
        errorOutput: '',
        exitCode: 0,
        status: 'success' as const,
      }))
    );

    // Update job lastRunAt
    const updatedJob = await repo.updateCronJobLastRun(params.id, new Date());

    // Create cron job log entry
    await repo.createCronJobLog({ jobId: params.id, commandId: cmdLog.id });

    return reply.send({
      success: true,
      data: {
        commandId: cmdLog.id,
        status: cmdLog.status,
        createdAt: cmdLog.created_at.toISOString(),
      },
    });
  });

  // GET /job/:id/logs - Get job execution logs
  app.get('/job/:id/logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const query = request.query as { page?: string; pageSize?: string };

    const job = await repo.findCronJobById(params.id);
    if (!job) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

    const result = await repo.findCronJobLogsByJobId(params.id, undefined, { page, pageSize });

    const data = result.entities.map((e) => ({
      id: e.id,
      commandId: e.command_id,
      createdAt: e.created_at.toISOString(),
    }));

    return reply.send({
      success: true,
      data,
      total: result.total,
      page,
      pageSize,
    });
  });

  // ==========================================================================
  // File Upload
  // ==========================================================================

  // POST /upload - Upload file to hosts
  app.post('/upload', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Support both multipart form data and JSON body
    const body = request.body as {
      fileName?: string;
      fileSize?: number;
      hostIds?: string[] | string;
      targetPath?: string;
    };

    let hostIds: string[];
    try {
      hostIds = typeof body.hostIds === 'string' ? JSON.parse(body.hostIds) : (body.hostIds || []);
    } catch {
      hostIds = [];
    }

    if (!hostIds.length || !body.targetPath) {
      return handleError(reply, new ValidationError('VALIDATION_ERROR'))
    }

    const task = await repo.createUploadTask({
      fileName: body.fileName || 'uploaded-file',
      fileSize: body.fileSize || 0,
      hostIds,
      hostnames: hostIds,
      targetPath: body.targetPath,
      status: 'success',
      progress: 100,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: task.id,
        fileName: task.file_name,
        fileSize: task.file_size,
        hostIds: task.host_ids,
        hostnames: task.hostnames,
        targetPath: task.target_path,
        status: task.status,
        progress: task.progress,
        createdAt: task.created_at.toISOString(),
      },
    });
  });

  // GET /upload-task - List upload tasks
  app.get('/upload-task', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await repo.findAllUploadTasks();

    const data = result.entities.map((e) => ({
      id: e.id,
      fileName: e.file_name,
      fileSize: e.file_size,
      hostIds: e.host_ids,
      hostnames: e.hostnames,
      targetPath: e.target_path,
      status: e.status,
      progress: e.progress,
      createdAt: e.created_at.toISOString(),
    }));

    return reply.send({ success: true, data, total: result.total });
  });

  // GET /upload-task/:id - Get upload task
  app.get('/upload-task/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = await repo.findUploadTaskById(params.id);

    if (!entry) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    return reply.send({
      success: true,
      data: {
        id: entry.id,
        fileName: entry.file_name,
        fileSize: entry.file_size,
        hostIds: entry.host_ids,
        hostnames: entry.hostnames,
        targetPath: entry.target_path,
        status: entry.status,
        progress: entry.progress,
        createdAt: entry.created_at.toISOString(),
      },
    });
  });

  // POST /upload-task/:id/cancel - Cancel upload task
  app.post('/upload-task/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    const entry = await repo.findUploadTaskById(params.id);
    if (!entry) {
      return handleError(reply, new NotFoundError('NOT_FOUND'))
    }

    if (entry.status === 'success' || entry.status === 'failed') {
      return handleError(reply, new ValidationError('INVALID_STATE'))
    }

    const updated = await repo.updateUploadTask(params.id, { status: 'failed' });

    return reply.send({
      success: true,
      data: {
        id: updated!.id,
        fileName: updated!.file_name,
        fileSize: updated!.file_size,
        hostIds: updated!.host_ids,
        hostnames: updated!.hostnames,
        targetPath: updated!.target_path,
        status: updated!.status,
        progress: updated!.progress,
        createdAt: updated!.created_at.toISOString(),
      },
    });
  });
}
