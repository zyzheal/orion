import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';

export async function ticketRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions & { database: any }
): Promise<void> {
  fastify.get('/tickets', async (request, reply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.get('/tickets/:id', async (request, reply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.post('/tickets', async (request, reply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.put('/tickets/:id', async (request, reply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
  fastify.delete('/tickets/:id', async (request, reply) => {
    reply.code(501).send({ error: 'Ticket service not yet implemented' });
  });
}
