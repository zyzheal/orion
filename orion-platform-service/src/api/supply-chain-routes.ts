/**
 * Supply Chain Security API Routes
 *
 * Provides endpoints for SBOM generation, dependency analysis,
 * and artifact signing backed by PostgreSQL.
 *
 * Routes:
 *   POST   /api/v1/supply-chain/sbom                      - Generate SBOM
 *   GET    /api/v1/supply-chain/sbom/:sbomId              - Get SBOM
 *   GET    /api/v1/supply-chain/dependencies/:package/:version/analyze - Analyze dependencies
 *   POST   /api/v1/supply-chain/dependencies/graph        - Get dependency graph
 *   POST   /api/v1/supply-chain/artifacts/:id/sign        - Sign artifact
 *   POST   /api/v1/supply-chain/artifacts/:id/verify      - Verify signature
 *   GET    /api/v1/supply-chain/reports/:pipelineId       - Get supply chain report
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SupplyChainController } from './controllers/SupplyChainController';

interface SupplyChainRoutesOptions {
  database?: DatabasePool;
}

export default async function supplyChainRoutes(
  app: FastifyInstance,
  options: SupplyChainRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[SupplyChainRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const controller = new SupplyChainController(options.database);

  // POST /api/v1/supply-chain/sbom - Generate SBOM
  app.post('/supply-chain/sbom', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.generateSBOM(request, reply);
  });

  // GET /api/v1/supply-chain/sbom/:sbomId - Get SBOM
  app.get('/supply-chain/sbom/:sbomId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSBOM(request, reply);
  });

  // GET /api/v1/supply-chain/dependencies/:package/:version/analyze - Analyze dependencies
  app.get('/supply-chain/dependencies/:package/:version/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyzeDependencies(request, reply);
  });

  // POST /api/v1/supply-chain/dependencies/graph - Get dependency graph
  app.post('/supply-chain/dependencies/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDependencyGraph(request, reply);
  });

  // POST /api/v1/supply-chain/artifacts/:id/sign - Sign artifact
  app.post('/supply-chain/artifacts/:id/sign', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.signArtifact(request, reply);
  });

  // POST /api/v1/supply-chain/artifacts/:id/verify - Verify signature
  app.post('/supply-chain/artifacts/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.verifySignature(request, reply);
  });

  // GET /api/v1/supply-chain/reports/:pipelineId - Get supply chain report
  app.get('/supply-chain/reports/:pipelineId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSupplyChainReport(request, reply);
  });
}
