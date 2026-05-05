/**
 * Chaos Enhanced Routes - 混沌工程路由
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ChaosEngineeringController } from './controllers/ChaosEngineeringController';

const chaosEnhancedRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const db = (app as any).database || (app as any).db;
  const controller = new ChaosEngineeringController();

  app.post('/chaos-experiments', controller.createExperiment.bind(controller));
  app.get('/chaos-experiments', controller.listExperiments.bind(controller));
  app.get('/chaos-experiments/:id', controller.getExperiment.bind(controller));
  app.post('/chaos-experiments/:id/start', controller.startExperiment.bind(controller));
  app.post('/chaos-experiments/:id/inject', controller.injectFault.bind(controller));
  app.post('/chaos-experiments/:id/stop', controller.stopExperiment.bind(controller));
  app.get('/chaos-experiments/:id/status', controller.getExperimentStatus.bind(controller));
  app.get('/chaos-experiments/:id/recovery', controller.getRecoveryStatus.bind(controller));
  app.get('/chaos-faults', controller.getFaultTypes.bind(controller));
  app.post('/chaos-faults/:type/config-template', controller.getFaultConfigTemplate.bind(controller));
};

export default chaosEnhancedRoutes;
