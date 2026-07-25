import { type FastifyInstance } from 'fastify';
import { AlertSilenceService } from '../services/AlertSilenceService.js';

export function registerAlertSilenceRoutes(
  fastify: FastifyInstance,
  service: AlertSilenceService,
): void {
  // POST /api/v1/alerts/silences — Create a silence rule
  fastify.post('/api/v1/alerts/silences', async (request, reply) => {
    const createdBy = (request.headers['x-user-id'] as string) || 'system';
    const body = request.body as Record<string, unknown>;

    const input = {
      createdBy,
      matchers: (body.matchers as Array<{ name: string; pattern: string; isRegex: boolean }>) ?? [],
      startsAt: body.startsAt ? new Date(body.startsAt as string) : new Date(),
      endsAt: body.endsAt ? new Date(body.endsAt as string) : null,
      comment: (body.comment as string) ?? '',
    };

    const silence = await service.create(input);
    return reply.code(201).send(silence);
  });

  // GET /api/v1/alerts/silences — List all silence rules
  fastify.get('/api/v1/alerts/silences', async (_request, reply) => {
    const silences = await service.listAll();
    return reply.send(silences);
  });

  // GET /api/v1/alerts/silences/active — List active silence rules
  fastify.get('/api/v1/alerts/silences/active', async (_request, reply) => {
    const silences = await service.listActive();
    return reply.send(silences);
  });

  // DELETE /api/v1/alerts/silences/:id — Deactivate a silence rule
  fastify.delete('/api/v1/alerts/silences/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await service.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Silence not found' });
    return reply.code(204).send();
  });
}
