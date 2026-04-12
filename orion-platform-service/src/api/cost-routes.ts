/**
 * FinOps 成本管理 API 路由注册
 *
 * 提供云资源成本采集、K8s 成本分摊、SaaS 工具成本、预算告警等 API 端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FinOpsController } from './controllers/finops/FinOpsController';

export default async function costRoutes(app: FastifyInstance): Promise<void> {
  const controller = new FinOpsController();

  // ==================== 云资源成本采集 ====================

  // GET /providers - 获取已注册的云厂商
  app.get('/providers', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getProviders(request, reply);
  });

  // POST /collect/cloud - 采集云资源成本
  app.post('/collect/cloud', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.collectCloudCosts(request, reply);
  });

  // ==================== K8s 成本分摊 ====================

  // POST /k8s/allocate - 分配 K8s 集群成本
  app.post('/k8s/allocate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.allocateK8sCosts(request, reply);
  });

  // GET /k8s/namespaces - 获取命名空间成本
  app.get('/k8s/namespaces', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getNamespaceCosts(request, reply);
  });

  // GET /k8s/pods - 获取 Pod 成本
  app.get('/k8s/pods', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPodCosts(request, reply);
  });

  // GET /k8s/tenants - 获取租户成本
  app.get('/k8s/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getTenantCosts(request, reply);
  });

  // ==================== SaaS 工具成本 ====================

  // POST /saas - 添加 SaaS 订阅
  app.post('/saas', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addSaaSSubscription(request, reply);
  });

  // GET /saas - 获取 SaaS 订阅列表
  app.get('/saas', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSaaSSubscriptions(request, reply);
  });

  // PUT /saas/:id - 更新 SaaS 订阅
  app.put('/saas/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateSaaSSubscription(request, reply);
  });

  // GET /saas/monthly-cost - 获取 SaaS 月度成本
  app.get('/saas/monthly-cost', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSaaSMonthlyCost(request, reply);
  });

  // GET /saas/annual-projection - 获取 SaaS 年度预测
  app.get('/saas/annual-projection', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSaaSAnnualProjection(request, reply);
  });

  // GET /saas/license-utilization - 获取许可证使用率
  app.get('/saas/license-utilization', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLicenseUtilization(request, reply);
  });

  // ==================== 成本汇总与分析 ====================

  // GET /summary - 获取成本汇总
  app.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCostSummary(request, reply);
  });

  // GET /breakdown - 获取成本分解
  app.get('/breakdown', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCostBreakdown(request, reply);
  });

  // POST /trend - 获取成本趋势
  app.post('/trend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCostTrend(request, reply);
  });

  // ==================== 预算告警 ====================

  // POST /budget-alerts - 创建预算告警
  app.post('/budget-alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createBudgetAlert(request, reply);
  });

  // GET /budget-alerts - 获取预算告警
  app.get('/budget-alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBudgetAlerts(request, reply);
  });

  // DELETE /budget-alerts/:id - 删除预算告警
  app.delete('/budget-alerts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteBudgetAlert(request, reply);
  });

  // POST /budget-alerts/check - 检查预算告警
  app.post('/budget-alerts/check', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkBudgetAlerts(request, reply);
  });

  // ==================== 事件发布 ====================

  // POST /events/publish-collected - 发布成本采集事件
  app.post('/events/publish-collected', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.publishCostCollectedEvent(request, reply);
  });

  // POST /events/publish-anomaly - 发布成本异常事件
  app.post('/events/publish-anomaly', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.publishCostAnomalyEvent(request, reply);
  });

  // GET /events/stats - 获取事件发布统计
  app.get('/events/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEventStats(request, reply);
  });

  // ==================== 健康检查 ====================

  // GET /health - 健康检查
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });
}
