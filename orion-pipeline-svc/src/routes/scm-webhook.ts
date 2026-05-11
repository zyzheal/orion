import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function scmWebhookRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  fastify.post('/webhooks/scm', async (request, reply) => {
    reply.code(501).send({ error: 'SCM webhook not yet migrated' });
  });
}
