/**
 * Orion CMDB Service - Routes
 * CMDB 路由
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { CmdbService } from '../services/CmdbService';
import { CmdbNodeType, CmdbNodeStatus } from '../types/cmdb';

export async function cmdbRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const cmdbService = new CmdbService();

  // ========== 配置节点 ==========

  /**
   * 创建配置节点
   * POST /api/v1/cmdb/nodes
   */
  fastify.post('/cmdb/nodes', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const node = await cmdbService.createNode({
      name: String(body.name || ''),
      type: body.type as CmdbNodeType,
      status: (body.status as CmdbNodeStatus) || 'active',
      applicationId: body.applicationId ? String(body.applicationId) : undefined,
      parentId: body.parentId ? String(body.parentId) : undefined,
      attributes: (body.attributes as Record<string, unknown>) || {},
      tags: (body.tags as string[]) || [],
      description: body.description ? String(body.description) : undefined,
      ownerId: body.ownerId ? String(body.ownerId) : undefined,
      environment: String(body.environment || 'production'),
      tenantId: String(body.tenantId || ''),
      k8sResourceName: body.k8sResourceName ? String(body.k8sResourceName) : undefined,
      k8sNamespace: body.k8sNamespace ? String(body.k8sNamespace) : undefined,
    });
    reply.code(201).send({ success: true, data: node });
  });

  /**
   * 列表配置节点
   * GET /api/v1/cmdb/nodes
   */
  fastify.get('/cmdb/nodes', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await cmdbService.listNodes({
      type: query.type as CmdbNodeType,
      status: query.status as CmdbNodeStatus,
      applicationId: query.applicationId,
      environment: query.environment,
    });
    reply.send({ success: true, data: result });
  });

  /**
   * 获取节点详情
   * GET /api/v1/cmdb/nodes/:id
   */
  fastify.get('/cmdb/nodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const node = await cmdbService.getNode(id);
    if (!node) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }
    reply.send({ success: true, data: node });
  });

  /**
   * 更新节点
   * PUT /api/v1/cmdb/nodes/:id
   */
  fastify.put('/cmdb/nodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const node = await cmdbService.updateNode(id, {
      name: body.name ? String(body.name) : undefined,
      type: body.type as CmdbNodeType,
      status: body.status as CmdbNodeStatus,
      attributes: body.attributes as Record<string, unknown>,
      tags: body.tags as string[],
      description: body.description ? String(body.description) : undefined,
      ownerId: body.ownerId ? String(body.ownerId) : undefined,
      environment: body.environment ? String(body.environment) : undefined,
    });
    if (!node) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }
    reply.send({ success: true, data: node });
  });

  /**
   * 删除节点
   * DELETE /api/v1/cmdb/nodes/:id
   */
  fastify.delete('/cmdb/nodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await cmdbService.deleteNode(id);
    if (!deleted) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Node not found' } });
    }
    reply.send({ success: true, message: 'Node deleted' });
  });

  // ========== 应用管理 ==========

  /**
   * 列表应用
   * GET /api/v1/cmdb/applications
   */
  fastify.get('/cmdb/applications', async (request, reply) => {
    const result = await cmdbService.listApplications();
    reply.send({ success: true, data: result });
  });

  /**
   * 获取应用详情
   * GET /api/v1/cmdb/applications/:id
   */
  fastify.get('/cmdb/applications/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const app = await cmdbService.getApplication(id);
    if (!app) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    reply.send({ success: true, data: app });
  });

  // ========== 拓扑管理 ==========

  /**
   * 获取全局拓扑
   * GET /api/v1/cmdb/topology
   */
  fastify.get('/cmdb/topology', async (request, reply) => {
    const topology = await cmdbService.getTopology();
    reply.send({ success: true, data: topology });
  });

  /**
   * 获取节点拓扑
   * GET /api/v1/cmdb/topology/:nodeId
   */
  fastify.get('/cmdb/topology/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const topology = await cmdbService.getTopology(nodeId);
    reply.send({ success: true, data: topology });
  });

  // ========== 对账管理 ==========

  /**
   * 执行对账
   * POST /api/v1/cmdb/reconciliation
   */
  fastify.post('/cmdb/reconciliation', async (request, reply) => {
    const body = request.body as { name: string; type: 'k8s' | 'cloud' | 'manual' };
    const result = await cmdbService.reconcile(body.name, body.type);
    reply.code(201).send({ success: true, data: result });
  });

  /**
   * 获取对账结果
   * GET /api/v1/cmdb/reconciliation/:id
   */
  fastify.get('/cmdb/reconciliation/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await cmdbService.getReconciliation(id);
    if (!result) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Reconciliation result not found' } });
    }
    reply.send({ success: true, data: result });
  });

  // ========== 事件 ==========

  /**
   * 发布配置变更事件
   * POST /api/v1/cmdb/events
   */
  fastify.post('/cmdb/events', async (request, reply) => {
    const body = request.body as { nodeId: string; eventType: string; data: Record<string, unknown> };
    await cmdbService.publishEvent(body.nodeId, body.eventType, body.data);
    reply.code(201).send({ success: true, message: 'Event published' });
  });
}
