import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VisorService } from '../services/VisorService';

// Request/Response type definitions
interface CreateHostRequest {
  name: string;
  ip: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
}

interface UpdateHostRequest {
  name?: string;
  ip?: string;
  port?: number;
  username?: string;
  os?: string;
}

interface VisorQuery {
  page?: string;
  limit?: string;
}

interface CreateScriptRequest {
  name: string;
  description?: string;
  content: string;
  type: 'shell' | 'python' | 'powershell';
}

interface UpdateScriptRequest {
  name?: string;
  content?: string;
  description?: string;
  type?: 'shell' | 'python' | 'powershell';
}

interface CreateTaskRequest {
  hostIds: string[];
  scriptId?: string;
  content?: string;
  type?: 'shell' | 'python' | 'powershell';
  timeout?: number;
}

interface TaskQuery {
  page?: string;
  limit?: string;
}

interface CreateTerminalSessionRequest {
  hostId: string;
  userId: string;
}

interface VisorRoutesOptions {
  visorService?: VisorService;
}

export async function visorRoutes(
  fastify: FastifyInstance,
  options: VisorRoutesOptions = {}
): Promise<void> {
  // Dependency injection: use provided service or create new instance
  const visorService = options.visorService ?? new VisorService();

  // ==================== Host Management ====================

  // Create host
  fastify.post<{ Body: CreateHostRequest }>('/hosts', async (request: FastifyRequest<{ Body: CreateHostRequest }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { name, ip, port, username, password, privateKey } = request.body;
    const host = await visorService.createHost(tenantId, { name, ip, port, username, password, privateKey });
    return reply.code(201).send({ success: true, data: host });
  });

  // List hosts
  fastify.get<{ Querystring: VisorQuery }>('/hosts', async (request: FastifyRequest<{ Querystring: VisorQuery }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { page, limit } = request.query;
    return visorService.listHosts({ tenantId, page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined });
  });

  // Get host
  fastify.get('/hosts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const host = await visorService.getHost(id);
    if (!host) return reply.code(404).send({ success: false, error: 'Host not found' });
    return { success: true, data: host };
  });

  // Update host
  fastify.put<{ Params: { id: string }; Body: UpdateHostRequest }>('/hosts/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateHostRequest }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { name, ip, port, username, os } = request.body;
    const result = await visorService.updateHost(id, { name, ip, port, username, os });
    return { success: true, data: result };
  });

  // Delete host
  fastify.delete('/hosts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await visorService.deleteHost(id);
    return reply.code(204).send();
  });

  // Ping host
  fastify.post('/hosts/:id/ping', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return visorService.pingHost(id);
  });

  // ==================== Script Management ====================

  // Create script
  fastify.post<{ Body: CreateScriptRequest }>('/scripts', async (request: FastifyRequest<{ Body: CreateScriptRequest }>, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const { name, description, content, type } = request.body;
    const script = await visorService.createScript(tenantId, userId, { name, description, content, type });
    return reply.code(201).send({ success: true, data: script });
  });

  // List scripts
  fastify.get('/scripts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    return visorService.listScripts(tenantId);
  });

  // Get script
  fastify.get('/scripts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const script = await visorService.getScript(id);
    if (!script) return reply.code(404).send({ success: false, error: 'Script not found' });
    return { success: true, data: script };
  });

  // Update script
  fastify.put<{ Params: { id: string }; Body: UpdateScriptRequest }>('/scripts/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateScriptRequest }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { name, content, description, type } = request.body;
    const result = await visorService.updateScript(id, { name, content, description, type });
    return { success: true, data: result };
  });

  // Delete script
  fastify.delete('/scripts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await visorService.deleteScript(id);
    return reply.code(204).send();
  });

  // ==================== Task Execution ====================

  // Execute task
  fastify.post<{ Body: CreateTaskRequest }>('/tasks', async (request: FastifyRequest<{ Body: CreateTaskRequest }>, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const { hostIds, scriptId, content, type, timeout } = request.body;
    const task = await visorService.executeTask(tenantId, userId, { hostIds, scriptId, content, type, timeout });
    return reply.code(201).send({ success: true, data: task });
  });

  // List tasks
  fastify.get<{ Querystring: TaskQuery }>('/tasks', async (request: FastifyRequest<{ Querystring: TaskQuery }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { page, limit } = request.query;
    return visorService.listTasks({ tenantId, page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined });
  });

  // Get task
  fastify.get('/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const task = await visorService.getTask(id);
    if (!task) return reply.code(404).send({ success: false, error: 'Task not found' });
    return { success: true, data: task };
  });

  // Cancel task
  fastify.post('/tasks/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return visorService.cancelTask(id);
  });

  // Get task log
  fastify.get('/tasks/:id/log', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return visorService.getTaskLog(id);
  });

  // ==================== Terminal ====================

  // Create terminal session
  fastify.post('/terminal', async (request: FastifyRequest, reply: FastifyReply) => {
    const { hostId, userId } = request.headers as { hostId: string; userId: string };
    return visorService.createTerminalSession(hostId, userId);
  });

  // Close terminal session
  fastify.delete('/terminal/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await visorService.closeTerminalSession(id);
    return reply.code(204).send();
  });

  // List active sessions
  fastify.get('/terminal', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.headers as { userId: string };
    return visorService.listActiveSessions(userId);
  });
}
