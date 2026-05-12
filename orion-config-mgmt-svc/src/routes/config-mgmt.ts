/**
 * Orion Configuration Management Service - Routes
 * 配置管理路由
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { ConfigMgmtService } from '../services/ConfigMgmtService';
import { FeatureFlagStatus, ApprovalStatus, type ConfigDiff } from '../types/config-mgmt';

export async function configMgmtRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const configService = new ConfigMgmtService();

  // ========== 配置管理 ==========

  /**
   * 获取配置
   * GET /api/v1/config/:key
   */
  fastify.get('/config/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const query = request.query as { environment?: string };
    const config = await configService.getConfig(key, query.environment || 'production');
    if (!config) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } });
    }
    reply.send({ success: true, data: config });
  });

  /**
   * 更新配置
   * PUT /api/v1/config/:key
   */
  fastify.put('/config/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const body = request.body as { value: Record<string, unknown>; changeReason: string; changedBy: string };
    const updated = await configService.updateConfig(key, body.value, body.changeReason, body.changedBy);
    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } });
    }
    reply.send({ success: true, data: updated });
  });

  // ========== 版本管理 ==========

  /**
   * 获取版本
   * GET /api/v1/config/:key/versions/:version
   */
  fastify.get('/config/:key/versions/:version', async (request, reply) => {
    const params = request.params as { key: string; version: string };
    const query = request.query as { environment?: string };
    const environment = query.environment || 'production';
    const config = await configService.getConfig(params.key, environment);
    if (!config) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Config not found' } });
    }
    const versionNum = params.version === 'latest' ? undefined : parseInt(params.version, 10);
    const version = await configService.getVersion(config.id, versionNum);
    if (!version) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Version not found' } });
    }
    reply.send({ success: true, data: version });
  });

  // ========== 版本对比 ==========

  /**
   * 版本差异对比
   * POST /api/v1/config/diff
   */
  fastify.post('/config/diff', async (request, reply) => {
    const body = request.body as { configId: string; versionA: number; versionB: number };
    const diff = await configService.diffVersions(body.configId, body.versionA, body.versionB);
    reply.send({ success: true, data: diff });
  });

  // ========== 漂移检测 ==========

  /**
   * 检测配置漂移
   * GET /api/v1/config/drift/detect
   */
  fastify.get('/config/drift/detect', async (request, reply) => {
    const query = request.query as { environment?: string };
    const drifts = await configService.detectDrift(query.environment || 'production');
    reply.send({ success: true, data: drifts });
  });

  // ========== 特性开关 ==========

  /**
   * 创建特性开关
   * POST /api/v1/config/feature-flags
   */
  fastify.post('/config/feature-flags', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const flag = await configService.createFeatureFlag({
      key: String(body.key || ''),
      name: String(body.name || ''),
      description: body.description ? String(body.description) : undefined,
      status: (body.status as FeatureFlagStatus) || 'disabled',
      rolloutPercentage: body.rolloutPercentage ? Number(body.rolloutPercentage) : undefined,
      targetUserIds: body.targetUserIds as string[] | undefined,
      appId: body.appId ? String(body.appId) : undefined,
      environment: String(body.environment || 'production'),
      createdBy: String(body.createdBy || ''),
    });
    reply.code(201).send({ success: true, data: flag });
  });

  /**
   * 切换特性开关
   * PUT /api/v1/config/feature-flags/:id/toggle
   */
  fastify.put('/config/feature-flags/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: FeatureFlagStatus };
    const updated = await configService.toggleFlag(id, body.status);
    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Feature flag not found' } });
    }
    reply.send({ success: true, data: updated });
  });

  /**
   * 列表特性开关
   * GET /api/v1/config/feature-flags
   */
  fastify.get('/config/feature-flags', async (request, reply) => {
    const query = request.query as { environment?: string };
    const result = await configService.listFeatureFlags(query.environment);
    reply.send({ success: true, data: result });
  });

  // ========== 审批管理 ==========

  /**
   * 创建审批
   * POST /api/v1/config/approvals
   */
  fastify.post('/config/approvals', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const approval = await configService.createApproval({
      title: String(body.title || ''),
      description: body.description ? String(body.description) : undefined,
      status: ApprovalStatus.PENDING,
      changes: (body.changes as ConfigDiff[]) || [],
      requesterId: String(body.requesterId || ''),
      approverIds: (body.approverIds as string[]) || [],
      tenantId: String(body.tenantId || ''),
    });
    reply.code(201).send({ success: true, data: approval });
  });

  /**
   * 获取审批详情
   * GET /api/v1/config/approvals/:id
   */
  fastify.get('/config/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const approval = await configService.getApproval(id);
    if (!approval) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } });
    }
    reply.send({ success: true, data: approval });
  });

  // ========== GitOps ==========

  /**
   * GitOps 同步
   * POST /api/v1/config/gitops/sync
   */
  fastify.post('/config/gitops/sync', async (request, reply) => {
    const body = request.body as { tenantId: string };
    const result = await configService.gitOpsSync(body.tenantId);
    reply.send({ success: true, data: result });
  });
}
