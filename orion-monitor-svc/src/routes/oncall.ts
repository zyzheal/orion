import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { OnCallService } from '../services/OnCallService.js';
import type { CreateScheduleInput } from '../types/monitor.js';

export async function oncallRoutes(
  fastify: FastifyInstance,
  opts: { oncallService: OnCallService },
): Promise<void> {
  const { oncallService } = opts;

  // Create on-call schedule
  fastify.post<{ Body: CreateScheduleInput }>(
    '/api/v1/oncall/schedules',
    async (
      request: FastifyRequest<{ Body: CreateScheduleInput }>,
      reply: FastifyReply,
    ) => {
      const tenantId = request.headers['x-tenant-id'] as string;
      const projectId = request.headers['x-project-id'] as string;
      const userId = request.headers['x-user-id'] as string;

      if (!tenantId || !projectId) {
        return reply.code(400).send({
          error: 'Missing x-tenant-id or x-project-id header',
        });
      }

      const schedule = await oncallService.createSchedule(
        tenantId,
        projectId,
        userId ?? 'anonymous',
        request.body,
      );

      return reply.code(201).send(schedule);
    },
  );

  // List schedules
  fastify.get('/api/v1/oncall/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const projectId = (request.query as Record<string, unknown>)['projectId'] as string | undefined;

    if (!tenantId) {
      return reply.code(400).send({ error: 'Missing x-tenant-id header' });
    }

    const schedules = await oncallService.listSchedules(tenantId, projectId);
    return reply.send(schedules);
  });

  // Get current on-call duty
  fastify.get('/api/v1/oncall/current', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const projectId = (request.query as Record<string, unknown>)['projectId'] as string | undefined;

    if (!tenantId) {
      return reply.code(400).send({ error: 'Missing x-tenant-id header' });
    }

    const duties = await oncallService.getCurrentOnCall(tenantId, projectId);
    return reply.send(duties);
  });

  // Update schedule
  fastify.put('/api/v1/oncall/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const { id } = request.params as { id: string };

    const schedule = await oncallService.updateSchedule(
      tenantId,
      id,
      request.body as Partial<CreateScheduleInput>,
    );
    if (!schedule) {
      return reply.code(404).send({ error: 'Schedule not found' });
    }
    return reply.send(schedule);
  });

  // Delete schedule
  fastify.delete('/api/v1/oncall/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const { id } = request.params as { id: string };

    const deleted = await oncallService.deleteSchedule(tenantId, id);
    if (!deleted) {
      return reply.code(404).send({ error: 'Schedule not found' });
    }
    return reply.code(204).send();
  });
}
