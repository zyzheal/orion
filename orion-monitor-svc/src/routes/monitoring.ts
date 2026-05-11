import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
export async function monitoringRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  fastify.get('/monitoring', async (request, reply) => { reply.code(501).send({ error: 'Monitoring not yet implemented' }); });
  fastify.get('/monitoring/:id', async (request, reply) => { reply.code(501).send({ error: 'Monitoring not yet implemented' }); });
  fastify.post('/monitoring', async (request, reply) => { reply.code(501).send({ error: 'Monitoring not yet implemented' }); });
}
export async function alertRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  fastify.get('/alert', async (request, reply) => { reply.code(501).send({ error: 'Alerts not yet implemented' }); });
  fastify.post('/alert', async (request, reply) => { reply.code(501).send({ error: 'Alerts not yet implemented' }); });
}
