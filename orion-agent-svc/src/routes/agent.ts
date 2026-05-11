import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
export async function agentRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  fastify.get('/agents', async (request, reply) => { reply.code(501).send({ error: 'Agent service not yet implemented' }); });
  fastify.post('/agents', async (request, reply) => { reply.code(501).send({ error: 'Agent service not yet implemented' }); });
  fastify.get('/agents/:id', async (request, reply) => { reply.code(501).send({ error: 'Agent service not yet implemented' }); });
}
