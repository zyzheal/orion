/**
 * Disaster Recovery Advanced API Routes - Phase 3
 *
 * Routes under /v1/disaster-recovery/advanced
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DisasterRecoveryService } from '../services/disaster-recovery/DisasterRecoveryService';
import { DisasterRecoveryAdvancedController } from './controllers/DisasterRecoveryAdvancedController';

const drService = new DisasterRecoveryService();
const controller = new DisasterRecoveryAdvancedController(drService);

export default async function disasterRecoveryAdvancedRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/disaster-recovery/advanced/rto-status - 获取 RTO 状态
  app.get('/rto-status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRTOStatus(request, reply);
  });

  // GET /v1/disaster-recovery/advanced/rpo-status - 获取 RPO 状态
  app.get('/rpo-status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRPOStatus(request, reply);
  });

  // POST /v1/disaster-recovery/advanced/drills - 创建演练计划
  app.post('/drills', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.scheduleDrill(request, reply);
  });

  // GET /v1/disaster-recovery/advanced/drills - 获取演练列表
  app.get('/drills', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listDrills(request, reply);
  });

  // POST /v1/disaster-recovery/advanced/drills/:drillId/execute - 执行演练
  app.post('/drills/:drillId/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeDrill(request, reply);
  });

  // GET /v1/disaster-recovery/advanced/drills/:drillId/report - 获取演练报告
  app.get('/drills/:drillId/report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDrillReport(request, reply);
  });

  // POST /v1/disaster-recovery/advanced/failover-test/:componentType/automated - 自动故障切换测试
  app.post('/failover-test/:componentType/automated', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.runAutomatedFailoverTest(request, reply);
  });
}
