import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function pipelineRunRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any; eventBus: any }
): Promise<void> {
  // Placeholder: will be filled when PipelineRunService is migrated
  fastify.get('/pipeline-runs/:id', async (request, reply) => {
    reply.code(501).send({ error: 'Pipeline run details not yet migrated' });
  });
}
