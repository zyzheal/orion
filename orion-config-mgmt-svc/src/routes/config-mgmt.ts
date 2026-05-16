/**
 * Orion Configuration Management Service - Routes
 * 配置管理路由 - 基于 PostgreSQL Repository 实现
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { ConfigMgmtService } from '../services/ConfigMgmtService';
import { FeatureFlagStatus, type ConfigDiff } from '../types/config-mgmt';

export async function configMgmtRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database?: any },
): Promise<void> {
  const configService = new ConfigMgmtService(opts.database);

  // ========== Namespace Management ==========

  /**
   * Create namespace
   * POST /api/v1/config/namespaces
   */
  fastify.post('/config/namespaces', async (request, reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      gitRepoUrl?: string;
      branch?: string;
    };
    const ns = await configService.createNamespace(body);
    reply.code(201).send({ success: true, data: ns });
  });

  /**
   * List namespaces
   * GET /api/v1/config/namespaces
   */
  fastify.get('/config/namespaces', async (_request, reply) => {
    const namespaces = await configService.listNamespaces();
    reply.send({ success: true, data: namespaces });
  });

  // ========== Config Management ==========

  /**
   * Get config
   * GET /api/v1/config/:namespace/:key
   */
  fastify.get('/config/:namespace/:key', async (request, reply) => {
    const params = request.params as { namespace: string; key: string };
    const query = request.query as { environment?: string };
    const config = await configService.getConfig(
      params.key,
      params.namespace,
      query.environment || 'production',
    );
    if (!config) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Config not found' },
      });
    }
    reply.send({ success: true, data: config });
  });

  /**
   * Set config (create or update with versioning)
   * PUT /api/v1/config/:namespace/:key
   */
  fastify.put('/config/:namespace/:key', async (request, reply) => {
    const params = request.params as { namespace: string; key: string };
    const body = request.body as {
      value: Record<string, unknown>;
      commitMessage?: string;
      changedBy: string;
      environment?: string;
    };
    const result = await configService.setConfig({
      key: params.key,
      namespace: params.namespace,
      value: body.value,
      createdBy: body.changedBy,
      commitMessage: body.commitMessage,
      environment: body.environment || 'production',
    });
    reply.send({ success: true, data: result });
  });

  /**
   * List configs
   * GET /api/v1/configs
   */
  fastify.get('/configs', async (request, reply) => {
    const query = request.query as { namespace?: string; environment?: string; status?: string };
    const configs = await configService.listConfigs(query);
    reply.send({ success: true, data: configs });
  });

  // ========== Version Management ==========

  /**
   * Get specific version
   * GET /api/v1/config/:namespace/:key/versions/:version
   */
  fastify.get('/config/:namespace/:key/versions/:version', async (request, reply) => {
    const params = request.params as { namespace: string; key: string; version: string };
    const versionNum = params.version === 'latest' ? undefined : parseInt(params.version, 10);
    const version = await configService.getVersion(params.key, params.namespace, versionNum);
    if (!version) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Version not found' },
      });
    }
    reply.send({ success: true, data: version });
  });

  /**
   * List all versions
   * GET /api/v1/config/:namespace/:key/versions
   */
  fastify.get('/config/:namespace/:key/versions', async (request, reply) => {
    const params = request.params as { namespace: string; key: string };
    const versions = await configService.listVersions(params.key, params.namespace);
    reply.send({ success: true, data: versions });
  });

  /**
   * Rollback to version
   * POST /api/v1/config/:namespace/:key/rollback
   */
  fastify.post('/config/:namespace/:key/rollback', async (request, reply) => {
    const params = request.params as { namespace: string; key: string };
    const body = request.body as { version: number; changedBy: string };
    const result = await configService.rollback(
      params.key,
      params.namespace,
      body.version,
      body.changedBy,
    );
    if (!result) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Version not found' },
      });
    }
    reply.send({ success: true, data: result });
  });

  // ========== Version Diff ==========

  /**
   * Diff between two versions
   * GET /api/v1/config/:namespace/:key/diff/:versionA/:versionB
   */
  fastify.get('/config/:namespace/:key/diff/:versionA/:versionB', async (request, reply) => {
    const params = request.params as { namespace: string; key: string; versionA: string; versionB: string };
    const diff = await configService.diff(
      params.key,
      params.namespace,
      parseInt(params.versionA, 10),
      parseInt(params.versionB, 10),
    );
    if (!diff) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'One or both versions not found' },
      });
    }
    reply.send({ success: true, data: diff });
  });

  // ========== Drift Detection ==========

  /**
   * Detect config drift
   * GET /api/v1/config/drift/detect
   */
  fastify.get('/config/drift/detect', async (request, reply) => {
    const query = request.query as { environment?: string };
    const drifts = await configService.detectDrift(query.environment || 'production');
    reply.send({ success: true, data: drifts });
  });

  // ========== Feature Flags ==========

  /**
   * Create feature flag
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
   * Toggle feature flag
   * PUT /api/v1/config/feature-flags/:id/toggle
   */
  fastify.put('/config/feature-flags/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: FeatureFlagStatus };
    const updated = await configService.toggleFlag(id, body.status);
    if (!updated) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Feature flag not found' },
      });
    }
    reply.send({ success: true, data: updated });
  });

  /**
   * List feature flags
   * GET /api/v1/config/feature-flags
   */
  fastify.get('/config/feature-flags', async (request, reply) => {
    const query = request.query as { environment?: string };
    const result = await configService.listFeatureFlags(query.environment);
    reply.send({ success: true, data: result });
  });

  // ========== Approvals ==========

  /**
   * Create approval
   * POST /api/v1/config/approvals
   */
  fastify.post('/config/approvals', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const approval = await configService.createApproval({
      title: String(body.title || ''),
      description: body.description ? String(body.description) : undefined,
      status: 'pending' as any,
      changes: (body.changes as ConfigDiff[]) || [],
      requesterId: String(body.requesterId || ''),
      approverIds: (body.approverIds as string[]) || [],
      tenantId: String(body.tenantId || ''),
    });
    reply.code(201).send({ success: true, data: approval });
  });

  /**
   * Get approval
   * GET /api/v1/config/approvals/:id
   */
  fastify.get('/config/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const approval = await configService.getApproval(id);
    if (!approval) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Approval not found' },
      });
    }
    reply.send({ success: true, data: approval });
  });

  // ========== GitOps ==========

  /**
   * GitOps sync
   * POST /api/v1/config/gitops/sync
   */
  fastify.post('/config/gitops/sync', async (request, reply) => {
    const body = request.body as { tenantId: string };
    const result = await configService.gitOpsSync(body.tenantId);
    reply.send({ success: true, data: result });
  });
}
