import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
export async function deployRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  fastify.get('/deploy', async (request, reply) => { reply.code(501).send({ error: 'Deploy not yet implemented' }); });
  fastify.post('/deploy', async (request, reply) => { reply.code(501).send({ error: 'Deploy not yet implemented' }); });
  fastify.get('/deploy/:id', async (request, reply) => { reply.code(501).send({ error: 'Deploy not yet implemented' }); });
}
