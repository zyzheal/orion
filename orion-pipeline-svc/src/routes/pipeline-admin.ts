import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function pipelineAdminRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  fastify.get('/pipelines/:id/versions', async (request, reply) => {
    reply.code(501).send({ error: 'Pipeline versions not yet migrated' });
  });

  fastify.post('/pipelines/validate', async (request, reply) => {
    reply.code(501).send({ error: 'Pipeline validation not yet migrated' });
  });
}
