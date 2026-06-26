/**
 * Visor Exec API Routes
 *
 * Routes under /visor/exec
 * Handles batch command execution, script templates, cron jobs, and file upload.
 * Uses in-memory storage (Map) for operational features that don't need DB persistence yet.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

// ============================================================================
// In-Memory Storage
// ============================================================================

interface CommandLogEntry {
  id: string;
  command: string;
  hostIds: string[];
  hostCount: number;
  timeout: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  createdAt: string;
}

interface CommandLogDetailEntry {
  id: string;
  commandId: string;
  hostname: string;
  output: string;
  errorOutput: string;
  exitCode: number;
  status: 'success' | 'failed' | 'running';
}

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface CronJobEntry {
  id: string;
  name: string;
  command: string;
  hostIds: string[];
  hostnames: string[];
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

interface UploadTaskEntry {
  id: string;
  fileName: string;
  fileSize: number;
  hostIds: string[];
  hostnames: string[];
  targetPath: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  progress: number;
  createdAt: string;
}

const commandLogs = new Map<string, CommandLogEntry>();
const commandLogDetails = new Map<string, CommandLogDetailEntry[]>();
const templates = new Map<string, TemplateEntry>();
const cronJobs = new Map<string, CronJobEntry>();
const cronJobLogs = new Map<string, CommandLogEntry[]>();
const uploadTasks = new Map<string, UploadTaskEntry>();

// ID counters for auto-incrementing IDs
let commandIdCounter = 1;
let templateIdCounter = 1;
let jobIdCounter = 1;
let uploadTaskIdCounter = 1;

// Helper to generate IDs
function nextCommandId(): string {
  return `cmd-${String(commandIdCounter++).padStart(6, '0')}`;
}

function nextTemplateId(): string {
  return `tpl-${String(templateIdCounter++).padStart(6, '0')}`;
}

function nextJobId(): string {
  return `job-${String(jobIdCounter++).padStart(6, '0')}`;
}

function nextUploadTaskId(): string {
  return `upl-${String(uploadTaskIdCounter++).padStart(6, '0')}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ============================================================================
// Route Registration
// ============================================================================

export default async function visorExecRoutes(
  app: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

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
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'command and hostIds are required',
      });
    }

    // Input validation
    if (body.command.length > 10000) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'command exceeds maximum length of 10000 characters',
      });
    }

    if (body.hostIds.length > 100) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'cannot execute on more than 100 hosts at once',
      });
    }

    const id = nextCommandId();
    const entry: CommandLogEntry = {
      id,
      command: body.command,
      hostIds: body.hostIds,
      hostCount: body.hostIds.length,
      timeout: body.timeout || 30,
      status: 'success',
      createdAt: nowISO(),
    };

    commandLogs.set(id, entry);

    // Generate mock details for each host
    const details: CommandLogDetailEntry[] = body.hostIds.map((hostId, idx) => ({
      id: `detail-${id}-${idx}`,
      commandId: id,
      hostname: hostId,
      output: `Command executed successfully on ${hostId}`,
      errorOutput: '',
      exitCode: 0,
      status: 'success' as const,
    }));

    commandLogDetails.set(id, details);

    return reply.status(201).send({
      success: true,
      data: {
        id: entry.id,
        status: entry.status,
        hostCount: entry.hostCount,
        createdAt: entry.createdAt,
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

    const allLogs = Array.from(commandLogs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allLogs.length;
    const start = (page - 1) * pageSize;
    const data = allLogs.slice(start, start + pageSize);

    return reply.send({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  });

  // GET /command-log/:id - Get execution log
  app.get('/command-log/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = commandLogs.get(params.id);

    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Command log ${params.id} not found`,
      });
    }

    return reply.send({ success: true, data: entry });
  });

  // GET /command-log/:id/details - Get execution details
  app.get('/command-log/:id/details', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = commandLogs.get(params.id);

    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Command log ${params.id} not found`,
      });
    }

    const details = commandLogDetails.get(params.id) || [];
    return reply.send({ success: true, data: details });
  });

  // ==========================================================================
  // Script Templates
  // ==========================================================================

  // GET /template - List templates
  app.get('/template', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = Array.from(templates.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return reply.send({ success: true, data, total: data.length });
  });

  // GET /template/:id - Get template
  app.get('/template/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = templates.get(params.id);

    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Template ${params.id} not found`,
      });
    }

    return reply.send({ success: true, data: entry });
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
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'name and content are required',
      });
    }

    if (body.name.length > 200 || body.content.length > 50000) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'name max 200 chars, content max 50000 chars',
      });
    }

    const id = nextTemplateId();
    const timestamp = nowISO();
    const entry: TemplateEntry = {
      id,
      name: body.name,
      description: body.description || '',
      content: body.content,
      category: body.category || 'general',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    templates.set(id, entry);

    return reply.status(201).send({ success: true, data: entry });
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

    const entry = templates.get(params.id);
    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Template ${params.id} not found`,
      });
    }

    const updated: TemplateEntry = {
      ...entry,
      name: body.name ?? entry.name,
      description: body.description ?? entry.description,
      content: body.content ?? entry.content,
      category: body.category ?? entry.category,
      updatedAt: nowISO(),
    };

    templates.set(params.id, updated);

    return reply.send({ success: true, data: updated });
  });

  // DELETE /template/:id - Delete template
  app.delete('/template/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    if (!templates.has(params.id)) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Template ${params.id} not found`,
      });
    }

    templates.delete(params.id);

    return reply.send({ success: true, message: 'Template deleted' });
  });

  // ==========================================================================
  // Cron Jobs
  // ==========================================================================

  // GET /job - List cron jobs
  app.get('/job', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = Array.from(cronJobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return reply.send({ success: true, data, total: data.length });
  });

  // GET /job/:id - Get cron job
  app.get('/job/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = cronJobs.get(params.id);

    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Cron job ${params.id} not found`,
      });
    }

    return reply.send({ success: true, data: entry });
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
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'name, command, hostIds, and cronExpression are required',
      });
    }

    const id = nextJobId();
    const entry: CronJobEntry = {
      id,
      name: body.name,
      command: body.command,
      hostIds: body.hostIds,
      hostnames: body.hostIds,
      cronExpression: body.cronExpression,
      enabled: body.enabled !== false,
      createdAt: nowISO(),
    };

    cronJobs.set(id, entry);

    return reply.status(201).send({ success: true, data: entry });
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

    const entry = cronJobs.get(params.id);
    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Cron job ${params.id} not found`,
      });
    }

    const updated: CronJobEntry = {
      ...entry,
      name: body.name ?? entry.name,
      command: body.command ?? entry.command,
      hostIds: body.hostIds ?? entry.hostIds,
      hostnames: body.hostIds ?? entry.hostnames,
      cronExpression: body.cronExpression ?? entry.cronExpression,
      enabled: body.enabled ?? entry.enabled,
    };

    cronJobs.set(params.id, updated);

    return reply.send({ success: true, data: updated });
  });

  // DELETE /job/:id - Delete cron job
  app.delete('/job/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    if (!cronJobs.has(params.id)) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Cron job ${params.id} not found`,
      });
    }

    cronJobs.delete(params.id);

    return reply.send({ success: true, message: 'Cron job deleted' });
  });

  // PATCH /job/:id/toggle - Toggle enabled/disabled
  app.patch('/job/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { enabled: boolean };

    const entry = cronJobs.get(params.id);
    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Cron job ${params.id} not found`,
      });
    }

    entry.enabled = body.enabled;
    cronJobs.set(params.id, entry);

    return reply.send({ success: true, data: entry });
  });

  // POST /job/:id/run-now - Trigger immediate execution
  app.post('/job/:id/run-now', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    const entry = cronJobs.get(params.id);
    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Cron job ${params.id} not found`,
      });
    }

    // Record the execution as a command log
    const cmdId = nextCommandId();
    const timestamp = nowISO();
    const cmdLog: CommandLogEntry = {
      id: cmdId,
      command: entry.command,
      hostIds: entry.hostIds,
      hostCount: entry.hostIds.length,
      timeout: 30,
      status: 'success',
      createdAt: timestamp,
    };

    commandLogs.set(cmdId, cmdLog);

    // Update job lastRunAt
    entry.lastRunAt = timestamp;
    cronJobs.set(params.id, entry);

    // Append to job logs
    const logs = cronJobLogs.get(params.id) || [];
    logs.push(cmdLog);
    cronJobLogs.set(params.id, logs);

    return reply.send({
      success: true,
      data: {
        commandId: cmdId,
        status: cmdLog.status,
        createdAt: timestamp,
      },
    });
  });

  // GET /job/:id/logs - Get job execution logs
  app.get('/job/:id/logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const query = request.query as { page?: string; pageSize?: string };

    const entry = cronJobs.get(params.id);
    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Cron job ${params.id} not found`,
      });
    }

    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

    const allLogs = (cronJobLogs.get(params.id) || [])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allLogs.length;
    const start = (page - 1) * pageSize;
    const data = allLogs.slice(start, start + pageSize);

    return reply.send({
      success: true,
      data,
      total,
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
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'hostIds and targetPath are required',
      });
    }

    const id = nextUploadTaskId();
    const entry: UploadTaskEntry = {
      id,
      fileName: body.fileName || 'uploaded-file',
      fileSize: body.fileSize || 0,
      hostIds,
      hostnames: hostIds,
      targetPath: body.targetPath,
      status: 'success',
      progress: 100,
      createdAt: nowISO(),
    };

    uploadTasks.set(id, entry);

    return reply.status(201).send({ success: true, data: entry });
  });

  // GET /upload-task - List upload tasks
  app.get('/upload-task', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = Array.from(uploadTasks.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return reply.send({ success: true, data, total: data.length });
  });

  // GET /upload-task/:id - Get upload task
  app.get('/upload-task/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = uploadTasks.get(params.id);

    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Upload task ${params.id} not found`,
      });
    }

    return reply.send({ success: true, data: entry });
  });

  // POST /upload-task/:id/cancel - Cancel upload task
  app.post('/upload-task/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'visor-exec', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const entry = uploadTasks.get(params.id);

    if (!entry) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Upload task ${params.id} not found`,
      });
    }

    if (entry.status === 'success' || entry.status === 'failed') {
      return reply.status(400).send({
        error: 'INVALID_STATE',
        message: `Cannot cancel task in ${entry.status} status`,
      });
    }

    entry.status = 'failed';
    uploadTasks.set(params.id, entry);

    return reply.send({ success: true, data: entry });
  });
}
