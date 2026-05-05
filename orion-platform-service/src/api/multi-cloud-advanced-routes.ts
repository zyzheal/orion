/**
 * Multi-Cloud Advanced API Routes - Phase 4
 *
 * Routes under /v1/multi-cloud-advanced
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MultiCloudAdvancedService } from '../services/multi-cloud/MultiCloudAdvancedService';
import { MultiCloudManagerService } from '../services/multi-cloud/MultiCloudManagerService';
import { MultiCloudAdvancedController } from './controllers/MultiCloudAdvancedController';

// MultiCloudManagerService needs a database pool; pass null for in-memory mode
const managerService = new MultiCloudManagerService(null as any);
const service = new MultiCloudAdvancedService();
const controller = new MultiCloudAdvancedController(service, managerService);

export default async function multiCloudAdvancedRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/multi-cloud-advanced/dr - 设置跨区容灾
  app.post('/dr', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.setupCrossZoneDR(request, reply);
  });

  // POST /v1/multi-cloud-advanced/dr/:drId/test - 测试跨区容灾
  app.post('/dr/:drId/test', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.testCrossZoneDR(request, reply);
  });

  // GET /v1/multi-cloud-advanced/cost - 计算多云成本
  app.get('/cost', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.calculateMultiCloudCost(request, reply);
  });

  // GET /v1/multi-cloud-advanced/cost/optimize - 优化多云成本
  app.get('/cost/optimize', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.optimizeCloudCost(request, reply);
  });

  // POST /v1/multi-cloud-advanced/networks - 设置云网络
  app.post('/networks', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.setupCloudNetwork(request, reply);
  });

  // ==================== Cloud Account Management ====================

  // POST /v1/multi-cloud-advanced/accounts - 添加云账号
  app.post('/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addCloudAccount(request, reply);
  });

  // DELETE /v1/multi-cloud-advanced/accounts/:accountId - 移除云账号
  app.delete('/accounts/:accountId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.removeCloudAccount(request, reply);
  });

  // GET /v1/multi-cloud-advanced/accounts - 获取云账号列表
  app.get('/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCloudAccounts(request, reply);
  });

  // ==================== Resource Inventory ====================

  // GET /v1/multi-cloud-advanced/inventory - 查询资源清单
  app.get('/inventory', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getResourceInventory(request, reply);
  });

  // GET /v1/multi-cloud-advanced/inventory/summary - 资源清单汇总
  app.get('/inventory/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getResourceInventorySummary(request, reply);
  });

  // ==================== Cloud Cost Comparison ====================

  // POST /v1/multi-cloud-advanced/cost/compare - 跨云成本对比
  app.post('/cost/compare', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.compareCloudCosts(request, reply);
  });
}
