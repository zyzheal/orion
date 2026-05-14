/**
 * Secrets Controller - Secret 管理 API
 *
 * API 约定：与前端 /v1/tenants/{tenantId}/secrets 路径一致
 * - POST   /v1/tenants/:tenantId/secrets          - 创建 secret
 * - GET    /v1/tenants/:tenantId/secrets          - 列出 secret（值被遮蔽）
 * - GET    /v1/tenants/:tenantId/secrets/:id      - 获取 secret 详情（值被遮蔽）
 * - PUT    /v1/tenants/:tenantId/secrets/:id      - 更新 secret
 * - DELETE /v1/tenants/:tenantId/secrets/:id      - 删除 secret
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SecretsService } from '../../services/pipeline/SecretsService';
import { SecretScope } from '../../repositories/SecretRepository';

/** 前端期望的 Secret 响应格式 */
interface SecretResponse {
  id: string;
  name: string;
  scope: SecretScope;
  description?: string;
  value?: string;  // 仅 getByName 返回，list 中遮蔽
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export class SecretsController {
  private secretsService: SecretsService;

  constructor(secretsService: SecretsService) {
    this.secretsService = secretsService;
  }

  /**
   * 检查用户是否有管理 secret 的权限
   */
  private checkPermission(request: FastifyRequest): { hasPermission: boolean; userRole?: string } {
    const user = (request as any).user;
    if (!user) return { hasPermission: false };

    // Admin and platform_admin can manage secrets
    const allowedRoles = ['admin', 'platform_admin', 'owner'];
    const hasPermission = allowedRoles.includes(user.role);
    return { hasPermission, userRole: user.role };
  }

  /**
   * 检查用户是否有权访问指定 tenant 的 secret（只读权限）
   */
  private checkTenantAccess(request: FastifyRequest, tenantId: string): { hasAccess: boolean } {
    const user = (request as any).user;
    if (!user) return { hasAccess: false };
    // Users can only access secrets for their own tenant
    const userTenantId = user.tenantId || user.defaultTenantId;
    return { hasAccess: userTenantId === tenantId };
  }

  /**
   * 创建 Secret
   * POST /v1/tenants/:tenantId/secrets
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const permission = this.checkPermission(request);
      if (!permission.hasPermission) {
        await reply.status(403).send({
          error: 'FORBIDDEN',
          code: '40301',
          message: `Insufficient permissions. Required: admin/platform_admin/owner, got: ${permission.userRole || 'none'}`,
        });
        return;
      }

      const params = request.params as any;
      const body = request.body as any;
      const tenantId = params.tenantId || this.getTenantId(request);

      if (!body.name || !body.value) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'name and value are required',
        });
        return;
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(body.name)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40002',
          message: 'name must be alphanumeric with underscores (e.g., MY_SECRET_KEY)',
        });
        return;
      }

      const scope: SecretScope = body.scope || 'project';
      const userId = this.getUserId(request);

      await this.secretsService.createSecret(
        tenantId, body.name, body.value, scope, body.description, userId
      );

      // 返回创建后的 secret（值被遮蔽）
      const entity = await this.secretsService.getSecretEntity(tenantId, body.name, scope);
      if (!entity) {
        await reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve created secret' });
        return;
      }

      await reply.status(201).send(this.toResponse(entity, false));
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to create secret',
      });
    }
  }

  /**
   * 列出 Secret（值始终被遮蔽）
   * GET /v1/tenants/:tenantId/secrets
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const tenantId = params.tenantId || this.getTenantId(request);

      const access = this.checkTenantAccess(request, tenantId);
      if (!access.hasAccess) {
        await reply.status(403).send({
          error: 'FORBIDDEN',
          code: '40301',
          message: 'You do not have access to secrets for this tenant',
        });
        return;
      }

      const query = request.query as any;
      const scope = query.scope as SecretScope | undefined;

      const entities = await this.secretsService.listSecretEntities(tenantId, scope);

      await reply.send({
        data: entities.map((e: any) => this.toResponse(e, false)),
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list secrets',
      });
    }
  }

  /**
   * 获取 Secret 详情（按 ID）
   * GET /v1/tenants/:tenantId/secrets/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const tenantId = params.tenantId || this.getTenantId(request);

      // Verify tenant access BEFORE querying to prevent timing-based enumeration
      const access = this.checkTenantAccess(request, tenantId);
      if (!access.hasAccess) {
        await reply.status(403).send({
          error: 'FORBIDDEN',
          code: '40301',
          message: 'You do not have access to secrets for this tenant',
        });
        return;
      }

      const entity = await this.secretsService.getSecretEntityById(params.id);
      if (!entity) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      // Double-check: secret must belong to the requested tenant
      if (entity.tenantId !== tenantId) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      await reply.send({
        data: this.toResponse(entity, false),
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get secret',
      });
    }
  }

  /**
   * 更新 Secret（按 ID）
   * PUT /v1/tenants/:tenantId/secrets/:id
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const permission = this.checkPermission(request);
      if (!permission.hasPermission) {
        await reply.status(403).send({
          error: 'FORBIDDEN',
          code: '40301',
          message: `Insufficient permissions. Required: admin/platform_admin/owner, got: ${permission.userRole || 'none'}`,
        });
        return;
      }

      const params = request.params as any;
      const body = request.body as any;
      const tenantId = params.tenantId || this.getTenantId(request);

      const entity = await this.secretsService.getSecretEntityById(params.id);
      if (!entity) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      // Verify secret belongs to the requested tenant (prevent cross-tenant access)
      if (entity.tenantId !== tenantId) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      const userId = this.getUserId(request);

      // 如果提供了新值，重新加密存储
      if (body.value) {
        await this.secretsService.updateSecretValue(params.id, body.value);
      }

      // 如果提供了新描述，更新描述
      if (body.description !== undefined) {
        await this.secretsService.updateSecretDescription(params.id, body.description);
      }

      const updated = await this.secretsService.getSecretEntityById(params.id);
      if (!updated) {
        await reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve updated secret' });
        return;
      }

      await reply.send({
        data: this.toResponse(updated, false),
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update secret',
      });
    }
  }

  /**
   * 删除 Secret（按 ID）
   * DELETE /v1/tenants/:tenantId/secrets/:id
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const permission = this.checkPermission(request);
      if (!permission.hasPermission) {
        await reply.status(403).send({
          error: 'FORBIDDEN',
          code: '40301',
          message: `Insufficient permissions. Required: admin/platform_admin/owner, got: ${permission.userRole || 'none'}`,
        });
        return;
      }

      const params = request.params as any;
      const tenantId = params.tenantId || this.getTenantId(request);

      const entity = await this.secretsService.getSecretEntityById(params.id);
      if (!entity) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      // Verify secret belongs to the requested tenant
      if (entity.tenantId !== tenantId) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      const deleted = await this.secretsService.deleteSecretById(params.id);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      await reply.send({ message: 'Secret deleted successfully' });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to delete secret',
      });
    }
  }

  /**
   * 解析 Secret 引用（用于测试/调试）
   * POST /v1/tenants/:tenantId/secrets/resolve
   */
  async resolve(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Resolve requires admin-level permission as it can reveal secret values
      const permission = this.checkPermission(request);
      if (!permission.hasPermission) {
        await reply.status(403).send({
          error: 'FORBIDDEN',
          code: '40301',
          message: `Insufficient permissions. Required: admin/platform_admin/owner, got: ${permission.userRole || 'none'}`,
        });
        return;
      }

      const params = request.params as any;
      const body = request.body as any;
      const tenantId = params.tenantId || this.getTenantId(request);

      if (!body.parameters) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '40001',
          message: 'parameters is required',
        });
        return;
      }

      const result = await this.secretsService.resolveAndReplaceSecrets(tenantId, body.parameters);

      await reply.send({
        parameters: result.parameters,
        resolved: result.secretValues.length,
        unresolved: result.unresolved,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to resolve secrets',
      });
    }
  }

  /**
   * 查看 Secret 引用预览（显示哪些 Pipeline 正在引用此 Secret）
   * GET /v1/tenants/:tenantId/secrets/:id/references
   */
  async getReferences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const entity = await this.secretsService.getSecretEntityById(params.id);

      if (!entity) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '40401',
          message: `Secret '${params.id}' not found`,
        });
        return;
      }

      // 构建引用模式用于 Pipeline YAML 搜索
      const refPattern = `\${secrets.${entity.name}}`;

      await reply.send({
        data: {
          secretName: entity.name,
          referencePattern: refPattern,
          // Future: scan pipeline definitions to find references
          pipelines: [],
          hint: `在 Pipeline YAML 中搜索 "${refPattern}" 查找引用`,
        },
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get secret references',
      });
    }
  }

  /**
   * 将 SecretEntity 转换为前端期望的响应格式
   */
  private toResponse(entity: any, includeValue: boolean): SecretResponse {
    return {
      id: entity.id,
      name: entity.name,
      scope: entity.scope,
      description: entity.description,
      value: includeValue ? undefined : '***',
      createdAt: entity.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: entity.updatedAt?.toISOString() || new Date().toISOString(),
      createdBy: entity.createdBy,
    };
  }

  private getTenantId(request: FastifyRequest): string {
    const user = (request as any).user;
    if (user?.tenantId) return user.tenantId;
    const headerTenant = request.headers['x-tenant-id'] as string;
    if (headerTenant) return headerTenant;
    return 'default';
  }

  private getUserId(request: FastifyRequest): string | undefined {
    const user = (request as any).user;
    return user?.id || user?.userId;
  }
}
