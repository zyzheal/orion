/**
 * OCI/Docker Registry API Routes
 * 提供 Registry 配置管理、镜像仓库/标签查询、镜像删除等能力
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OCIRegistryService, RegistryConfigInput } from '../services/artifact/oci/OCIRegistryService';
import { RegistryType, AuthType } from '../services/artifact/oci/DockerRegistryClient';
import { OrionError, ValidationError, NotFoundError, handleError } from '../errors';

interface OCIRegistryRoutesOptions {
  database?: any;
}

export default async function ociRegistryRoutes(
  app: FastifyInstance,
  _options: OCIRegistryRoutesOptions
): Promise<void> {
  const ociService = new OCIRegistryService({ ttlMs: 300_000, maxSize: 500 });
  ociService.start();

  // ==================== Registry Configuration ====================

  // GET /oci/registries - 列出所有 Registry
  app.get('/oci/registries', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const environment = (request.query as any)?.environment as string | undefined;
      const registries = await ociService.listRegistries(environment);
      return reply.send({ success: true, data: registries });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // POST /oci/registries - 注册新 Registry
  app.post('/oci/registries', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        name: string;
        url: string;
        type: string;
        authType: string;
        username?: string;
        password?: string;
        bearerToken?: string;
        insecure?: boolean;
        environment?: string;
        description?: string;
        awsRegion?: string;
        awsAccessKeyId?: string;
        awsSecretAccessKey?: string;
        gcpProjectId?: string;
        gcpServiceAccountKey?: string;
        azureTenantId?: string;
        azureClientId?: string;
        azureClientSecret?: string;
      };

      if (!body.name || !body.url || !body.type || !body.authType) {
        return handleError(reply, new ValidationError('name, url, type, and authType are required'));
      }

      const input: RegistryConfigInput = {
        ...body,
        type: body.type as RegistryType,
        authType: body.authType as AuthType,
      };

      const registry = await ociService.registerRegistry(input);
      return reply.send({ success: true, data: registry });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // GET /oci/registries/:registryId - 获取单个 Registry
  app.get('/oci/registries/:registryId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId } = request.params as { registryId: string };
      const registry = await ociService.getRegistry(registryId);
      return reply.send({ success: true, data: registry });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // DELETE /oci/registries/:registryId - 删除 Registry
  app.delete('/oci/registries/:registryId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId } = request.params as { registryId: string };
      await ociService.deleteRegistry(registryId);
      return reply.send({ success: true });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // PATCH /oci/registries/:registryId/enable - 启用/禁用 Registry
  app.patch('/oci/registries/:registryId/enable', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId } = request.params as { registryId: string };
      const { enabled } = request.body as { enabled: boolean };
      await ociService.setRegistryEnabled(registryId, enabled);
      return reply.send({ success: true });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // ==================== Repository Operations ====================

  // GET /oci/repositories/:registryId - 列出 Registry 中的镜像仓库
  app.get('/oci/repositories/:registryId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId } = request.params as { registryId: string };
      const repositories = await ociService.listRepositories(registryId);
      return reply.send({ success: true, data: repositories });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // GET /oci/repositories/:registryId/:name/tags - 列出镜像标签
  app.get('/oci/repositories/:registryId/:name/tags', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId, name } = request.params as { registryId: string; name: string };
      const result = await ociService.listTags(registryId, name);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // GET /oci/images/:registryId/:name/manifest - 获取镜像 manifest
  app.get('/oci/images/:registryId/:name/manifest', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId, name } = request.params as { registryId: string; name: string };
      const reference = (request.query as any)?.reference as string | undefined;
      const manifest = await ociService.getManifest(registryId, name, reference || 'latest');
      return reply.send({ success: true, data: manifest });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // DELETE /oci/images/:registryId/:name/:digest - 删除镜像
  app.delete('/oci/images/:registryId/:name/:digest', {
    onRequest: [authenticateUser, requirePermission({ resource: 'artifact', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { registryId, name, digest } = request.params as { registryId: string; name: string; digest: string };
      const result = await ociService.deleteImage(registryId, name, digest);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return handleError(reply, error);
    }
  });

  // ==================== Health Check ====================

  // GET /oci/health - 健康检查（公开端点）
  app.get('/oci/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await ociService.healthCheckAll();
      return reply.send({ success: true, data: health });
    } catch (error: any) {
      return reply.code(503).send({ success: false, error: 'Health check failed' });
    }
  });
}
