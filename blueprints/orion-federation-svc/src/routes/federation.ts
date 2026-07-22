/**
 * Federation API Routes
 *
 * Routes under /v1/federation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FederationController } from './controllers/FederationController';

const controller = new FederationController();

export default async function federationRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/federation/clusters - Register cluster
  app.post('/clusters', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerCluster(request, reply);
  });

  // GET /v1/federation/clusters - List clusters
  app.get('/clusters', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listClusters(request, reply);
  });

  // GET /v1/federation/clusters/:id/health - Get cluster health
  app.get('/clusters/:id/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getClusterHealth(request, reply);
  });

  // POST /v1/federation/jobs - Submit cross-cluster job
  app.post('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.submitCrossClusterJob(request, reply);
  });

  // GET /v1/federation/jobs/:id - Get job status
  app.get('/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getJobStatus(request, reply);
  });
}
