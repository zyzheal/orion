import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

export async function pipelineSSERoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  fastify.get('/pipelines/:id/runs/:rid/logs', async (request, reply) => {
    reply.code(501).send({ error: 'SSE log streaming not yet migrated' });
  });
}
