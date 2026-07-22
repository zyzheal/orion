/**
 * Supply Chain Routes - 供应链安全路由
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SupplyChainController } from './controllers/SupplyChainController';

const supplyChainRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const db = (app as any).database || (app as any).db;
  const controller = new SupplyChainController(db);

  app.post('/supply-chain/sbom', controller.generateSBOM.bind(controller));
  app.get('/supply-chain/sbom/:sbomId', controller.getSBOM.bind(controller));
  app.get('/supply-chain/dependencies/:package/:version/analyze', controller.analyzeDependencies.bind(controller));
  app.post('/supply-chain/dependencies/graph', controller.getDependencyGraph.bind(controller));
  app.post('/supply-chain/artifacts/:id/sign', controller.signArtifact.bind(controller));
  app.post('/supply-chain/artifacts/:id/verify', controller.verifySignature.bind(controller));
  app.get('/supply-chain/reports/:pipelineId', controller.getSupplyChainReport.bind(controller));
};

export default supplyChainRoutes;
