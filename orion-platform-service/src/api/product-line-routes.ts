/**
 * ProductLine Routes - 多分支产品线 API 路由
 *
 * 基于 ADR-008 ProductLine-CRD 设计
 * P0-2 Fix: Changed all hardcoded `/api/product-lines/` paths to relative paths
 * P2-6 Fix: Accept database pool via options for service injection
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ProductLineService } from '../services/product-line/ProductLineService';
import {
  ProductLine,
  ProductLineCreateInput,
  ProductLineUpdateInput,
  ProductLinePhase,
} from '../models/ProductLine';

interface ProductLineRoutesOptions {
  database?: DatabasePool;
}

export async function productLineRoutes(app: FastifyInstance, options: ProductLineRoutesOptions = {}) {
  const productLineService = new ProductLineService(options.database);

  // ==================== ProductLine CRUD ====================

  /**
   * 创建产品线
   * POST /product-lines
   */
  app.post('/', async (request: FastifyRequest<{ Body: ProductLineCreateInput }>, reply: FastifyReply) => {
    try {
      const input = request.body;
      const productLine = await productLineService.create(input);
      reply.status(201).send(productLine);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 列出产品线
   * GET /product-lines
   * Query params: tenantId, phase
   */
  app.get('/', async (request: FastifyRequest<{ Querystring: { tenantId?: string; phase?: ProductLinePhase } }>, reply: FastifyReply) => {
    const { tenantId, phase } = request.query;
    const productLines = await productLineService.list(tenantId, phase);
    reply.send(productLines);
  });

  /**
   * 获取产品线详情
   * GET /product-lines/:id
   */
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const productLine = await productLineService.getById(id);
    if (!productLine) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.send(productLine);
  });

  /**
   * 按名称获取产品线
   * GET /product-lines/name/:name
   */
  app.get('/name/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    const { name } = request.params;
    const productLine = await productLineService.getByName(name);
    if (!productLine) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.send(productLine);
  });

  /**
   * 更新产品线
   * PUT /product-lines/:id
   */
  app.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ProductLineUpdateInput }>, reply: FastifyReply) => {
    const { id } = request.params;
    const input = request.body;
    const productLine = await productLineService.update(id, input);
    if (!productLine) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.send(productLine);
  });

  /**
   * 删除产品线
   * DELETE /product-lines/:id
   */
  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const deleted = await productLineService.delete(id);
    if (!deleted) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.status(204).send();
  });

  /**
   * 激活产品线
   * POST /product-lines/:id/activate
   */
  app.post('/:id/activate', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const productLine = await productLineService.activate(id);
    if (!productLine) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.send(productLine);
  });

  /**
   * 暂停产品线
   * POST /product-lines/:id/suspend
   */
  app.post('/:id/suspend', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const productLine = await productLineService.suspend(id);
    if (!productLine) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.send(productLine);
  });

  // ==================== Branch-Environment Mapping ====================

  /**
   * 解析分支对应的环境
   * GET /product-lines/:id/resolve-environment
   * Query params: branch
   */
  app.get('/:id/resolve-environment', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { branch: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { branch } = request.query;
    const environment = await productLineService.resolveEnvironment(id, branch);
    if (!environment) {
      reply.status(404).send({ error: 'ProductLine not found' });
      return;
    }
    reply.send({ environment });
  });

  /**
   * 检查分支是否需要审批
   * GET /product-lines/:id/requires-approval
   * Query params: branch
   */
  app.get('/:id/requires-approval', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { branch: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { branch } = request.query;
    const requiresApproval = await productLineService.requiresApproval(id, branch);
    reply.send({ requiresApproval });
  });

  // ==================== ReleaseTrain ====================

  /**
   * 创建发布列车
   * POST /product-lines/:id/release-trains
   */
  app.post('/:id/release-trains', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = request.body as any;
    try {
      const releaseTrain = await productLineService.createReleaseTrain(id, input);
      reply.status(201).send(releaseTrain);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 获取产品线的发布列车列表
   * GET /product-lines/:id/release-trains
   */
  app.get('/:id/release-trains', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const releaseTrains = await productLineService.getReleaseTrains(id);
    reply.send(releaseTrains);
  });

  // ==================== HotfixChannel ====================

  /**
   * 创建紧急修复通道
   * POST /product-lines/:id/hotfix-channels
   */
  app.post('/:id/hotfix-channels', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = request.body as any;
    try {
      const hotfixChannel = await productLineService.createHotfixChannel(id, input);
      reply.status(201).send(hotfixChannel);
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });

  /**
   * 获取产品线的紧急修复通道列表
   * GET /product-lines/:id/hotfix-channels
   */
  app.get('/:id/hotfix-channels', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const hotfixChannels = await productLineService.getHotfixChannels(id);
    reply.send(hotfixChannels);
  });

  /**
   * 检查是否为 Hotfix 分支
   * GET /product-lines/:id/is-hotfix
   * Query params: branch
   */
  app.get('/:id/is-hotfix', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { branch: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { branch } = request.query;
    const isHotfix = await productLineService.isHotfixBranch(id, branch);
    reply.send({ isHotfix });
  });
}
