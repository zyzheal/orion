import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../utils/database';
import { ApiGovernanceController } from '../controllers/ApiGovernanceController';

export async function governanceRoutes(app: FastifyInstance) {
  const pool = getPool();
  const controller = new ApiGovernanceController(pool);

  // Contracts
  app.post('/contracts', async (request: FastifyRequest, reply: FastifyReply) => controller.createContract(request, reply));
  app.get('/contracts', async (request: FastifyRequest, reply: FastifyReply) => controller.listContracts(request, reply));
  app.get('/contracts/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.getContract(request, reply));
  app.put('/contracts/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.updateContract(request, reply));
  app.delete('/contracts/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.deleteContract(request, reply));

  // Versions
  app.post('/versions', async (request: FastifyRequest, reply: FastifyReply) => controller.createVersion(request, reply));
  app.get('/versions', async (request: FastifyRequest, reply: FastifyReply) => controller.listVersions(request, reply));

  // Deprecations
  app.post('/deprecations', async (request: FastifyRequest, reply: FastifyReply) => controller.createDeprecation(request, reply));
  app.get('/deprecations', async (request: FastifyRequest, reply: FastifyReply) => controller.listDeprecations(request, reply));

  // Compatibility
  app.post('/compatibility/check', async (request: FastifyRequest, reply: FastifyReply) => controller.checkCompatibility(request, reply));

  // Validate contract
  app.post('/contracts/:id/validate', async (request: FastifyRequest, reply: FastifyReply) => controller.validateContract(request, reply));
}
