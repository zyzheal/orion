/**
 * Multi-Cloud API Routes
 *
 * Routes under /v1/multi-cloud
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MultiCloudController } from './controllers/MultiCloudController';

const controller = new MultiCloudController();

export default async function multiCloudRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/multi-cloud/accounts - Register cloud account
  app.post('/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerCloudAccount(request, reply);
  });

  // GET /v1/multi-cloud/accounts - List cloud accounts
  app.get('/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCloudAccounts(request, reply);
  });

  // GET /v1/multi-cloud/resources - List cloud resources
  app.get('/resources', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCloudResources(request, reply);
  });

  // GET /v1/multi-cloud/providers/:provider - Get cloud provider info
  app.get('/providers/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCloudProviderInfo(request, reply);
  });

  // POST /v1/multi-cloud/providers/:provider/deploy - Deploy to provider
  app.post('/providers/:provider/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deployToProvider(request, reply);
  });
}
