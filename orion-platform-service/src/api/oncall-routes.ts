/**
 * OnCall Scheduling API Routes
 * Prefix: /api/v1/oncall
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OnCallService } from '../services/scheduler/OnCallService';

export default async function oncallRoutes(app: FastifyInstance): Promise<void> {
  const oncallService = new OnCallService();

  // POST /oncall/schedules - Create schedule
  app.post('/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, timezone, rotationType, teamMembers, rotationStartHour, escalations } = request.body as any;

    // Input validation
    if (!name || typeof name !== 'string') return reply.status(400).send({ error: 'NAME_REQUIRED' });
    if (!timezone || typeof timezone !== 'string') return reply.status(400).send({ error: 'TIMEZONE_REQUIRED' });
    if (!rotationType || !['daily', 'weekly', 'monthly'].includes(rotationType)) return reply.status(400).send({ error: 'INVALID_ROTATION_TYPE' });
    if (!teamMembers || !Array.isArray(teamMembers) || teamMembers.length === 0) return reply.status(400).send({ error: 'TEAM_MEMBERS_REQUIRED' });
    if (rotationStartHour !== undefined && (rotationStartHour < 0 || rotationStartHour > 23)) return reply.status(400).send({ error: 'INVALID_ROTATION_START_HOUR' });

    try {
      const schedule = await oncallService.createSchedule(name, timezone, rotationType, teamMembers, rotationStartHour, escalations);
      return reply.send(schedule);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /oncall/schedules - List schedules
  app.get('/schedules', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ schedules: oncallService.listSchedules() });
  });

  // GET /oncall/schedules/:id - Get schedule detail
  app.get('/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const schedule = oncallService.getSchedule(id);
    if (!schedule) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(schedule);
  });

  // GET /oncall/schedules/:id/current - Get current on-call
  app.get('/schedules/:id/current', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = oncallService.getCurrentOnCall(id);
    return reply.send(result);
  });

  // POST /oncall/overrides - Create override
  app.post('/overrides', async (request: FastifyRequest, reply: FastifyReply) => {
    const { scheduleId, originalUserId, overrideUserId, startTime, endTime, reason } = request.body as any;
    const override = await oncallService.createOverride(scheduleId, originalUserId, overrideUserId, new Date(startTime), new Date(endTime), reason);
    return reply.send(override);
  });

  // DELETE /oncall/schedules/:id - Delete schedule
  app.delete('/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await oncallService.deleteSchedule(id);
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send({ success: true });
  });
}
