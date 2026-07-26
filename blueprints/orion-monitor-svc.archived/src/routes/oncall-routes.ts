import { type FastifyInstance } from 'fastify';
import { OnCallService } from '../services/OnCallService';

export function registerOnCallRoutes(fastify: FastifyInstance, oncallService: OnCallService): void {
  fastify.post('/api/v1/oncall/schedules', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const schedule = await oncallService.createSchedule(tenantId, projectId, userId, request.body as any);
    return reply.code(201).send(schedule);
  });

  fastify.get('/api/v1/oncall/schedules', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const schedules = await oncallService.listSchedules(tenantId, projectId);
    return reply.send(schedules);
  });

  fastify.get('/api/v1/oncall/current', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const duties = await oncallService.getCurrentOnCall(tenantId, projectId);
    return reply.send(duties);
  });

  fastify.put('/api/v1/oncall/schedules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const schedule = await oncallService.updateSchedule(tenantId, id, request.body as any);
    if (!schedule) return reply.code(404).send({ error: 'Schedule not found' });
    return reply.send(schedule);
  });

  fastify.delete('/api/v1/oncall/schedules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const deleted = await oncallService.deleteSchedule(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Schedule not found' });
    return reply.code(204).send();
  });
}
