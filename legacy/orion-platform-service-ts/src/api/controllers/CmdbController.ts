/**
 * CMDB 控制器 (Fastify 版本)
 *
 * 处理 CMDB 相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CmdbService } from '../../services/cmdb/CmdbService';
import { CIFilters, CiType, CiStatus, RelationType } from '../../services/cmdb/CmdbTypes';

export class CmdbController {
  private cmdbService: CmdbService;

  constructor(cmdbService: CmdbService) {
    this.cmdbService = cmdbService;
  }

  /**
   * 创建配置项
   * POST /api/v1/cmdb/cis
   */
  async createCI(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { ciId, ciType, name, description, status, environment, tags, attributes } = body;

      // 验证必填字段
      if (!ciId || !ciType || !name) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required fields: ciId, ciType, name',
        });
        return;
      }

      // 验证 ciType
      const validCiTypes = ['APPLICATION', 'SERVICE', 'DATABASE', 'SERVER', 'CONTAINER',
        'K8S_CLUSTER', 'K8S_DEPLOYMENT', 'K8S_POD', 'NETWORK', 'LOAD_BALANCER',
        'MIDDLEWARE', 'PIPELINE', 'ENVIRONMENT'];
      if (!validCiTypes.includes(ciType)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: `Invalid ciType. Must be one of: ${validCiTypes.join(', ')}`,
        });
        return;
      }

      // 从请求头获取租户和用户信息
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const createdBy = request.headers['x-user-id'] as string || 'system';

      const ci = await this.cmdbService.createCI({
        ciId,
        ciType: ciType as CiType,
        name,
        description,
        status: status as CiStatus || 'ACTIVE',
        environment,
        tags,
        attributes,
        createdBy,
        tenantId,
      });

      await reply.status(201).send({
        id: ci.id,
        ciId: ci.ciId,
        ciType: ci.ciType,
        name: ci.name,
        description: ci.description,
        status: ci.status,
        environment: ci.environment,
        tags: ci.tags,
        createdAt: ci.createdAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        await reply.status(409).send({
          error: 'CONFLICT',
          code: '30202',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to create CI',
      });
    }
  }

  /**
   * 获取配置项详情
   * GET /api/v1/cmdb/cis/:id
   */
  async getCI(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const ci = await this.cmdbService.getCI(id);

      if (!ci) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `CI '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: ci.id,
        ciId: ci.ciId,
        ciType: ci.ciType,
        name: ci.name,
        description: ci.description,
        status: ci.status,
        environment: ci.environment,
        tags: ci.tags,
        attributes: ci.attributes,
        version: ci.version,
        relations: ci.relations,
        createdAt: ci.createdAt,
        updatedAt: ci.updatedAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get CI',
      });
    }
  }

  /**
   * 更新配置项
   * PUT /api/v1/cmdb/cis/:id
   */
  async updateCI(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { id } = params;
      const { description, status, environment, tags, attributes } = body;
      const user = request.headers['x-user-id'] as string || 'system';

      const ci = await this.cmdbService.updateCI(id, {
        description,
        status: status as CiStatus | undefined,
        environment,
        tags,
        attributes,
      }, user);

      if (!ci) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `CI '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: ci.id,
        ciId: ci.ciId,
        ciType: ci.ciType,
        name: ci.name,
        description: ci.description,
        status: ci.status,
        environment: ci.environment,
        tags: ci.tags,
        attributes: ci.attributes,
        version: ci.version,
        updatedAt: ci.updatedAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update CI',
      });
    }
  }

  /**
   * 删除配置项
   * DELETE /api/v1/cmdb/cis/:id
   */
  async deleteCI(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const deleted = await this.cmdbService.deleteCI(id);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `CI '${id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to delete CI',
      });
    }
  }

  /**
   * 获取配置项列表
   * GET /api/v1/cmdb/cis
   */
  async listCIs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { ciType, status, environment, tags, search, limit, offset, orderBy, order } = query;
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');

      const filters: CIFilters = {
        tenantId,
        ciType: ciType as CiType | undefined,
        status: status as CiStatus | undefined,
        environment: environment as string | undefined,
        tags: tags
          ? (Array.isArray(tags) ? tags.map(t => String(t)) : [String(tags)])
          : undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
        orderBy: orderBy as string | undefined,
        order: (order as 'ASC' | 'DESC') || 'DESC',
      };

      const result = await this.cmdbService.listCIs(filters);

      await reply.send({
        data: result.data.map(ci => ({
          id: ci.id,
          ciId: ci.ciId,
          ciType: ci.ciType,
          name: ci.name,
          description: ci.description,
          status: ci.status,
          environment: ci.environment,
          tags: ci.tags,
          version: ci.version,
          createdAt: ci.createdAt,
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list CIs',
      });
    }
  }

  /**
   * 获取配置项关联关系
   * GET /api/v1/cmdb/cis/:id/relations
   */
  async getCIRelations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const ci = await this.cmdbService.getCI(id);

      if (!ci) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `CI '${id}' not found`,
        });
        return;
      }

      const relations = await this.cmdbService.getCIRelations(ci.ciId);

      await reply.send({
        data: relations.map(r => ({
          id: r.id,
          fromCiId: r.fromCiId,
          toCiId: r.toCiId,
          relationType: r.relationType,
          description: r.description,
          createdAt: r.createdAt,
        })),
        total: relations.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get CI relations',
      });
    }
  }

  /**
   * 创建关联关系
   * POST /api/v1/cmdb/relations
   */
  async createRelation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { fromCiId, toCiId, relationType, description } = body;

      // 验证必填字段
      if (!fromCiId || !toCiId || !relationType) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required fields: fromCiId, toCiId, relationType',
        });
        return;
      }

      // 验证 relationType
      const validRelationTypes = ['DEPENDS_ON', 'HOSTED_ON', 'CONNECTS_TO', 'BELONGS_TO',
        'USES', 'CONTAINS', 'VERSION_OF', 'DEPLOYED_TO', 'MONITORED_BY'];
      if (!validRelationTypes.includes(relationType)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: `Invalid relationType. Must be one of: ${validRelationTypes.join(', ')}`,
        });
        return;
      }

      const user = request.headers['x-user-id'] as string || 'system';
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');

      const relation = await this.cmdbService.createRelation({
        fromCiId,
        toCiId,
        relationType: relationType as RelationType,
        description,
      }, user, tenantId);

      await reply.status(201).send({
        id: relation.id,
        fromCiId: relation.fromCiId,
        toCiId: relation.toCiId,
        relationType: relation.relationType,
        description: relation.description,
        createdAt: relation.createdAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: error.message,
        });
        return;
      }
      if (error instanceof Error && error.message.includes('already exists')) {
        await reply.status(409).send({
          error: 'CONFLICT',
          code: '30202',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to create relation',
      });
    }
  }

  /**
   * 删除关联关系
   * DELETE /api/v1/cmdb/relations/:id
   */
  async deleteRelation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = BigInt(request.headers['x-tenant-id'] as string || '1');
      const deleted = await this.cmdbService.deleteRelation(id, tenantId);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Relation '${id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to delete relation',
      });
    }
  }

  /**
   * 获取配置项版本历史
   * GET /api/v1/cmdb/cis/:id/versions
   */
  async getVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const ci = await this.cmdbService.getCI(id);

      if (!ci) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `CI '${id}' not found`,
        });
        return;
      }

      const versions = await this.cmdbService.getVersions(ci.ciId);

      await reply.send({
        data: versions.map(v => ({
          id: v.id,
          ciId: v.ciId,
          version: v.version,
          changes: v.changes,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
        })),
        total: versions.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get CI versions',
      });
    }
  }
}

// 导出单例工厂
export function createCmdbController(cmdbService: CmdbService): CmdbController {
  return new CmdbController(cmdbService);
}