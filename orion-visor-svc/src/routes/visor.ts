import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VisorService } from '../services/VisorService';

const visorService = new VisorService();

export async function visorRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== Host Management ====================

  // Create host
  fastify.post('/hosts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const host = await visorService.createHost(tenantId, body);
    return reply.code(201).send(host);
  });

  // List hosts
  fastify.get('/hosts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const query = request.query as any;
    return visorService.listHosts({ ...query, tenantId });
  });

  // Get host
  fastify.get('/hosts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const host = await visorService.getHost(id);
    if (!host) return reply.code(404).send({ error: 'Host not found' });
    return host;
  });

  // Update host
  fastify.put('/hosts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return visorService.updateHost(id, body);
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
  fastify.post('/scripts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const body = request.body as any;
    const script = await visorService.createScript(tenantId, userId, body);
    return reply.code(201).send(script);
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
    if (!script) return reply.code(404).send({ error: 'Script not found' });
    return script;
  });

  // Update script
  fastify.put('/scripts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return visorService.updateScript(id, body);
  });

  // Delete script
  fastify.delete('/scripts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await visorService.deleteScript(id);
    return reply.code(204).send();
  });

  // ==================== Task Execution ====================

  // Execute task
  fastify.post('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const body = request.body as any;
    const task = await visorService.executeTask(tenantId, userId, body);
    return reply.code(201).send(task);
  });

  // List tasks
  fastify.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const query = request.query as any;
    return visorService.listTasks({ ...query, tenantId });
  });

  // Get task
  fastify.get('/tasks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const task = await visorService.getTask(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return task;
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
