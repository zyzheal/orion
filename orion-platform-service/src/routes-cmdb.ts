/**
 * CMDB API 路由 - Fastify 版本（不使用 fp 以支持 prefix）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CmdbController } from './api/controllers/CmdbController';
import { CmdbIntegrationController } from './api/controllers/CmdbIntegrationController';
import { CmdbService } from './services/cmdb/CmdbService';
import { CmdbIntegrationService } from './services/cmdb-integration-service';
import { CmdbEventPublisher } from './services/cmdb/CmdbEventPublisher';
import { EventBusService } from './services/event-bus-service';

export interface CmdbRoutesOptions {
  eventBus?: EventBusService;
}

export default async function cmdbRoutes(app: FastifyInstance, options: CmdbRoutesOptions): Promise<void> {
  // 初始化服务
  const eventPublisher = options?.eventBus
    ? new CmdbEventPublisher(options.eventBus)
    : undefined;
  const cmdbService = new CmdbService({ eventPublisher });
  const cmdbController = new CmdbController(cmdbService);

  // 初始化集成服务
  const integrationService = new CmdbIntegrationService({
    cmdbService,
    eventBus: options?.eventBus,
  });
  const integrationController = new CmdbIntegrationController(integrationService);

  // ==================== CI 配置项路由 ====================

  // POST /api/v1/cmdb/cis - 创建配置项
  app.post('/cis', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.createCI(request, reply);
  });

  // GET /api/v1/cmdb/cis - 获取配置项列表
  app.get('/cis', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.listCIs(request, reply);
  });

  // GET /api/v1/cmdb/cis/:id - 获取配置项详情
  app.get('/cis/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.getCI(request, reply);
  });

  // PUT /api/v1/cmdb/cis/:id - 更新配置项
  app.put('/cis/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.updateCI(request, reply);
  });

  // DELETE /api/v1/cmdb/cis/:id - 删除配置项
  app.delete('/cis/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.deleteCI(request, reply);
  });

  // GET /api/v1/cmdb/cis/:id/relations - 获取配置项关联关系
  app.get('/cis/:id/relations', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.getCIRelations(request, reply);
  });

  // GET /api/v1/cmdb/cis/:id/versions - 获取配置项版本历史
  app.get('/cis/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.getVersions(request, reply);
  });

  // ==================== 关联关系路由 ====================

  // POST /api/v1/cmdb/relations - 创建关联关系
  app.post('/relations', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.createRelation(request, reply);
  });

  // DELETE /api/v1/cmdb/relations/:id - 删除关联关系
  app.delete('/relations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return cmdbController.deleteRelation(request, reply);
  });

  // ==================== 集成 Read API ====================

  // GET /api/v1/cmdb/hosts - 获取主机列表
  app.get('/hosts', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.listHosts(request, reply);
  });

  // GET /api/v1/cmdb/hosts/:ciId - 获取主机详情
  app.get('/hosts/:ciId', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.getHost(request, reply);
  });

  // GET /api/v1/cmdb/k8s - 获取 K8s 资源列表
  app.get('/k8s', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.listK8sResources(request, reply);
  });

  // GET /api/v1/cmdb/cicd - 获取 CI/CD 资源列表
  app.get('/cicd', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.listCICDResources(request, reply);
  });

  // GET /api/v1/cmdb/topology - 获取拓扑图
  app.get('/topology', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.getTopology(request, reply);
  });

  // ==================== K8s 同步 API ====================

  // POST /api/v1/cmdb/k8s/sync/start - 启动 K8s 同步
  app.post('/k8s/sync/start', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.startK8sSync(request, reply);
  });

  // POST /api/v1/cmdb/k8s/sync/stop - 停止 K8s 同步
  app.post('/k8s/sync/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.stopK8sSync(request, reply);
  });

  // ==================== 脚本执行 API ====================

  // POST /api/v1/cmdb/execute - 执行脚本
  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return integrationController.executeScript(request, reply);
  });
}