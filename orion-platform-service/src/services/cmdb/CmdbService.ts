/**
 * CMDB 核心服务
 *
 * 提供配置项 (CI) 的 CRUD 操作、关联关系管理、版本管理
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';

import { CmdbEventPublisher } from './CmdbEventPublisher';
import { CmdbRepository } from '../../api/repositories/CmdbRepository';
import { CmdbRelationRepository } from '../../api/repositories/CmdbRelationRepository';
import { CmdbRelationTypeRepository } from '../../api/repositories/CmdbRelationTypeRepository';
import { CmdbVersionRepository } from '../../api/repositories/CmdbVersionRepository';
import { CITypeService } from './ci-type/CITypeService';
import { RelationRuleEngine } from './RelationRuleEngine';
import { createLogger } from '../../utils/logger';

const logger = createLogger('cmdb');
import {
  CI,
  CreateCIInput,
  UpdateCIInput,
  CIRelation,
  CreateRelationInput,
  CIVersion,
  CIFilters,
  CIListResponse,
  CiStatus,
  CiType,
  RelationTypeDefinition,
  CreateRelationTypeInput,
  UpdateRelationTypeInput,
} from './CmdbTypes';
import { OrionError, ErrorCode } from '../../errors';

/**
 * 内存存储（开发环境使用，生产环境应使用数据库）
 */
const cis = new Map<string, CI>();
const ciVersions = new Map<string, CIVersion[]>(); // ciId -> [versions]
const relations = new Map<string, CIRelation>();
const relationTypes = new Map<string, RelationTypeDefinition>();

export class CmdbService {
  private eventPublisher?: CmdbEventPublisher;
  private database?: DatabasePool;
  private ciRepository?: CmdbRepository;
  private relationRepository?: CmdbRelationRepository;
  private relationTypeRepository?: CmdbRelationTypeRepository;
  private versionRepository?: CmdbVersionRepository;
  private ciTypeService?: CITypeService;
  private relationRuleEngine: RelationRuleEngine;

  constructor(options?: {
    eventPublisher?: CmdbEventPublisher;
    database?: DatabasePool;
    ciTypeService?: CITypeService;
    relationRuleEngine?: RelationRuleEngine;
  }) {
    this.eventPublisher = options?.eventPublisher;
    this.database = options?.database;
    this.ciTypeService = options?.ciTypeService;
    this.relationRuleEngine = options?.relationRuleEngine || new RelationRuleEngine();

    // 如果提供了数据库连接，初始化 Repository
    if (this.database) {
      this.ciRepository = new CmdbRepository(this.database);
      this.relationRepository = new CmdbRelationRepository(this.database);
      this.relationTypeRepository = new CmdbRelationTypeRepository(this.database);
      this.versionRepository = new CmdbVersionRepository(this.database);
    }
  }

  /**
   * 验证 CI 属性是否符合类型 schema 约束
   * 如果 CITypeService 不可用或类型未定义 schema，则跳过验证
   */
  private async validateCIAttributes(ciType: string, attributes: Record<string, any>): Promise<void> {
    if (!this.ciTypeService || !attributes || Object.keys(attributes).length === 0) {
      return;
    }

    try {
      const typeEntity = await this.ciTypeService.getTypeByName(ciType);
      if (!typeEntity) return;

      const result = await this.ciTypeService.validateInstance(typeEntity.id, attributes);
      if (!result.valid) {
        throw new OrionError(
          `CI attributes validation failed: ${result.errors.join('; ')}`,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    } catch (error) {
      if (error instanceof OrionError) throw error;
      // 验证服务异常不应阻塞 CI 创建
      logger.warn({ err: error, ciType }, 'CI type schema validation skipped due to error');
    }
  }

  /**
   * 创建配置项 (CI)
   */
  async createCI(input: CreateCIInput): Promise<CI> {
    // 验证必填字段
    if (!input.ciId || !input.name || !input.ciType) {
      throw new OrionError('Missing required fields: ciId, name, ciType', ErrorCode.VALIDATION_ERROR);
    }

    // 验证属性是否符合类型 schema
    await this.validateCIAttributes(input.ciType, input.attributes || {});

    // 检查是否已存在（使用数据库或内存）
    if (this.ciRepository) {
      const exists = await this.ciRepository.ciExists(input.ciId, input.tenantId);
      if (exists) {
        throw new OrionError(`CI '${input.ciId}' already exists`, ErrorCode.NOT_FOUND);
      }
    } else {
      // 内存存储检查（含租户隔离）
      const existing = Array.from(cis.values()).find(
        ci => ci.ciId === input.ciId && !ci.deletedAt && ci.tenantId === input.tenantId
      );
      if (existing) {
        throw new OrionError(`CI '${input.ciId}' already exists`, ErrorCode.NOT_FOUND);
      }
    }

    const now = new Date();
    const ci: CI = {
      id: uuidv4(),
      ciId: input.ciId,
      tenantId: input.tenantId,
      ciType: input.ciType,
      name: input.name,
      description: input.description,
      status: input.status || 'ACTIVE',
      environment: input.environment,
      tags: input.tags || [],
      attributes: input.attributes || {},
      createdBy: input.createdBy,
      version: 1,
      relations: [],
      createdAt: now,
      updatedAt: now,
    };

    // 保存到数据库或内存
    if (this.ciRepository) {
      const savedCI = await this.ciRepository.createCI(input);
      Object.assign(ci, savedCI);
    } else {
      cis.set(ci.id, ci);
    }

    // 创建初始版本记录
    const version: CIVersion = {
      id: uuidv4(),
      ciId: ci.ciId,
      version: 1,
      changes: 'Initial creation',
      data: { ...ci },
      createdBy: input.createdBy,
      createdAt: now,
    };

    if (this.versionRepository) {
      await this.versionRepository.createVersion({
        ciId: ci.ciId,
        version: 1,
        changes: 'Initial creation',
        data: { ...ci },
        createdBy: input.createdBy,
      });
    } else {
      const versions = ciVersions.get(ci.ciId) || [];
      versions.push(version);
      ciVersions.set(ci.ciId, versions);
    }

    // 发布事件
    await this.eventPublisher?.publishCICreated(ci);

    return ci;
  }

  /**
   * 获取配置项详情
   * @param id - 内部 ID
   * @param tenantId - 租户 ID（PostgreSQL 模式下必须提供以执行租户隔离）
   */
  async getCI(id: string, tenantId?: bigint): Promise<CI | null> {
    let ci: CI | null = null;

    if (this.ciRepository) {
      const resolvedTenantId = tenantId ?? BigInt(1);
      ci = await this.ciRepository.getCIById(id, resolvedTenantId);
    } else {
      // 内存存储实现（含租户隔离）
      ci = Array.from(cis.values()).find(
        c => c.id === id && !c.deletedAt && c.tenantId === (tenantId ?? BigInt(1))
      ) || null;
    }

    if (!ci || ci.deletedAt) {
      return null;
    }

    // 加载关联关系
    const ciRelations = await this.getCIRelations(ci.ciId);
    ci.relations = ciRelations;

    return ci;
  }

  /**
   * 通过 ciId 获取配置项
   * @param ciId - 配置项 ID
   * @param tenantId - 租户 ID（默认 BigInt(1)，避免使用硬编码的 0）
   */
  async getCIByCiId(ciId: string, tenantId?: bigint): Promise<CI | null> {
    let ci: CI | null = null;
    const resolvedTenantId = tenantId ?? BigInt(1);

    if (this.ciRepository) {
      ci = await this.ciRepository.getCIByCiId(ciId, resolvedTenantId);
    } else {
      // 内存存储实现（含租户隔离）
      ci = Array.from(cis.values()).find(
        c => c.ciId === ciId && !c.deletedAt && c.tenantId === resolvedTenantId
      ) || null;
    }

    if (!ci) {
      return null;
    }

    // 加载关联关系
    const ciRelations = await this.getCIRelations(ciId);
    ci.relations = ciRelations;

    return ci;
  }

  /**
   * 更新配置项
   * @param id - 内部 ID
   * @param input - 更新数据
   * @param user - 操作用户
   * @param tenantId - 租户 ID（PostgreSQL 模式下必须提供以执行租户隔离）
   */
  async updateCI(id: string, input: UpdateCIInput, user: string, tenantId?: bigint): Promise<CI | null> {
    let ci: CI | null = null;
    let oldCI: CI | null = null;
    const resolvedTenantId = tenantId ?? BigInt(1);

    if (this.ciRepository) {
      oldCI = await this.ciRepository.getCIById(id, resolvedTenantId);
      if (!oldCI) {
        return null;
      }
      // 验证属性是否符合类型 schema
      if (input.attributes) {
        await this.validateCIAttributes(oldCI.ciType, input.attributes);
      }
      ci = await this.ciRepository.updateCI(id, input, user, resolvedTenantId);
    } else {
      // 内存存储实现（含租户隔离）
      ci = Array.from(cis.values()).find(
        c => c.id === id && !c.deletedAt && c.tenantId === resolvedTenantId
      ) || null;
      if (!ci || ci.deletedAt) {
        return null;
      }
      // 验证属性是否符合类型 schema
      if (input.attributes) {
        await this.validateCIAttributes(ci.ciType, input.attributes);
      }
      oldCI = { ...ci };

      // 在内存中执行更新
      const changes: string[] = [];
      const now = new Date();

      if (input.description !== undefined && input.description !== oldCI.description) {
        changes.push(`description: ${oldCI.description} -> ${input.description}`);
        ci.description = input.description;
      }
      if (input.status !== undefined && input.status !== oldCI.status) {
        changes.push(`status: ${oldCI.status} -> ${input.status}`);
        ci.status = input.status;
      }
      if (input.environment !== undefined && input.environment !== oldCI.environment) {
        changes.push(`environment: ${oldCI.environment} -> ${input.environment}`);
        ci.environment = input.environment;
      }
      if (input.tags !== undefined) {
        changes.push(`tags: ${JSON.stringify(oldCI.tags)} -> ${JSON.stringify(input.tags)}`);
        ci.tags = input.tags;
      }
      if (input.attributes !== undefined) {
        changes.push(`attributes updated`);
        ci.attributes = { ...ci.attributes, ...input.attributes };
      }

      ci.version += 1;
      ci.updatedAt = now;
      cis.set(id, ci);

      // 创建版本记录
      const versions = ciVersions.get(ci.ciId) || [];
      versions.push({
        id: uuidv4(),
        ciId: ci.ciId,
        version: ci.version,
        changes: changes.join('; '),
        data: { ...ci },
        createdBy: user,
        createdAt: now,
      });
      ciVersions.set(ci.ciId, versions);

      // 发布事件
      await this.eventPublisher?.publishCIUpdated(ci, changes);

      return ci;
    }

    if (!ci) {
      return null;
    }

    const changes: string[] = [];
    const now = new Date();

    // 记录变更
    if (input.description !== undefined && input.description !== oldCI?.description) {
      changes.push(`description: ${oldCI?.description} -> ${input.description}`);
    }
    if (input.status !== undefined && input.status !== oldCI?.status) {
      changes.push(`status: ${oldCI?.status} -> ${input.status}`);
    }
    if (input.environment !== undefined && input.environment !== oldCI?.environment) {
      changes.push(`environment: ${oldCI?.environment} -> ${input.environment}`);
    }
    if (input.tags !== undefined) {
      changes.push(`tags: ${JSON.stringify(oldCI?.tags)} -> ${JSON.stringify(input.tags)}`);
    }
    if (input.attributes !== undefined) {
      changes.push(`attributes updated`);
    }

    ci.version = oldCI.version + 1;
    ci.updatedAt = now;

    // 保存变更到数据库或内存
    if (!this.ciRepository) {
      cis.set(id, ci);
    }

    // 创建版本记录
    if (this.versionRepository) {
      await this.versionRepository.createVersion({
        ciId: ci.ciId,
        version: ci.version,
        changes: changes.join('; '),
        data: { ...ci },
        createdBy: user,
      });
    } else {
      const versions = ciVersions.get(ci.ciId) || [];
      versions.push({
        id: uuidv4(),
        ciId: ci.ciId,
        version: ci.version,
        changes: changes.join('; '),
        data: { ...ci },
        createdBy: user,
        createdAt: now,
      });
      ciVersions.set(ci.ciId, versions);
    }

    // 发布事件
    await this.eventPublisher?.publishCIUpdated(ci, changes);

    return ci;
  }

  /**
   * 删除配置项（软删除）
   * @param id - 内部 ID
   * @param tenantId - 租户 ID（PostgreSQL 模式下必须提供以执行租户隔离）
   */
  async deleteCI(id: string, tenantId?: bigint): Promise<boolean> {
    let ci: CI | null = null;
    const resolvedTenantId = tenantId ?? BigInt(1);

    if (this.ciRepository) {
      ci = await this.ciRepository.getCIById(id, resolvedTenantId);
      if (!ci) {
        return false;
      }
      const deleted = await this.ciRepository.deleteCI(id, resolvedTenantId);
      if (!deleted) {
        return false;
      }
      ci.deletedAt = new Date();
      ci.status = 'DECOMMISSIONED';
    } else {
      // 内存存储实现（含租户隔离）
      ci = Array.from(cis.values()).find(
        c => c.id === id && !c.deletedAt && c.tenantId === resolvedTenantId
      ) || null;
      if (!ci || ci.deletedAt) {
        return false;
      }
      ci.deletedAt = new Date();
      ci.status = 'DECOMMISSIONED';
      cis.set(id, ci);
    }

    // 发布事件
    await this.eventPublisher?.publishCIDeleted(ci);

    return true;
  }

  /**
   * 归档配置项
   * @param id - 内部 ID
   * @param tenantId - 租户 ID（PostgreSQL 模式下必须提供以执行租户隔离）
   */
  async archiveCI(id: string, tenantId?: bigint): Promise<boolean> {
    let ci: CI | null = null;
    const resolvedTenantId = tenantId ?? BigInt(1);

    if (this.ciRepository) {
      ci = await this.ciRepository.getCIById(id, resolvedTenantId);
      if (!ci || ci.deletedAt) {
        return false;
      }
      return await this.ciRepository.archiveCI(id, resolvedTenantId);
    }

    // 内存存储实现（含租户隔离）
    ci = Array.from(cis.values()).find(
      c => c.id === id && !c.deletedAt && !c.archivedAt && c.tenantId === resolvedTenantId
    ) || null;
    if (!ci || ci.deletedAt || ci.archivedAt) {
      return false;
    }

    ci.archivedAt = new Date();
    ci.status = 'ARCHIVED';
    ci.updatedAt = new Date();
    cis.set(id, ci);

    // 发布事件
    await this.eventPublisher?.publishCIUpdated(ci, ['archived']);

    return true;
  }

  /**
   * 恢复已归档的配置项
   */
  async restoreCI(id: string): Promise<CI | null> {
    let ci: CI | null = null;

    if (this.ciRepository) {
      ci = await this.ciRepository.getCIById(id);
      if (!ci || !ci.archivedAt) {
        return null;
      }
      const restored = await this.ciRepository.restoreCI(id);
      if (!restored) {
        return null;
      }
      return await this.ciRepository.getCIById(id);
    }

    // 内存存储实现
    ci = cis.get(id) ?? null;
    if (!ci || !ci.archivedAt) {
      return null;
    }

    ci.archivedAt = undefined;
    ci.status = 'ACTIVE';
    ci.updatedAt = new Date();
    cis.set(id, ci);

    // 发布事件
    await this.eventPublisher?.publishCIUpdated(ci, ['restored from archive']);

    return ci;
  }

  /**
   * 获取已归档的配置项列表
   */
  async getArchivedCIs(tenantId: bigint, limit = 100, offset = 0): Promise<CI[]> {
    if (this.ciRepository) {
      return await this.ciRepository.getArchivedCIs(tenantId, limit, offset);
    }

    // 内存存储实现（含租户隔离）
    return Array.from(cis.values())
      .filter(ci => ci.tenantId === tenantId && ci.archivedAt && !ci.deletedAt)
      .sort((a, b) => (b.archivedAt!.getTime() - a.archivedAt!.getTime()))
      .slice(offset, offset + limit);
  }

  /**
   * 查询配置项列表
   */
  async listCIs(filters: CIFilters): Promise<CIListResponse> {
    if (this.ciRepository) {
      return await this.ciRepository.listCIs(filters);
    }

    // 内存存储实现（向后兼容，含租户隔离）
    let result = Array.from(cis.values()).filter(ci => !ci.deletedAt);

    // 按租户过滤
    result = result.filter(ci => ci.tenantId === filters.tenantId);

    // 按归档状态过滤（默认排除已归档）
    if (!filters.includeArchived) {
      result = result.filter(ci => !ci.archivedAt);
    }

    // 按类型过滤
    if (filters.ciType) {
      result = result.filter(ci => ci.ciType === filters.ciType);
    }

    // 按状态过滤
    if (filters.status) {
      result = result.filter(ci => ci.status === filters.status);
    }

    // 按环境过滤
    if (filters.environment) {
      result = result.filter(ci => ci.environment === filters.environment);
    }

    // 按标签过滤
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(ci =>
        ci.tags && ci.tags.some(tag => filters.tags!.includes(tag))
      );
    }

    // 按名称搜索
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(ci =>
        ci.name.toLowerCase().includes(searchLower) ||
        ci.description?.toLowerCase().includes(searchLower)
      );
    }

    // 排序
    const orderBy = filters.orderBy || 'createdAt';
    const order = filters.order || 'DESC';
    result.sort((a, b) => {
      const aVal = a[orderBy as keyof CI] || '';
      const bVal = b[orderBy as keyof CI] || '';
      if (aVal < bVal) return order === 'ASC' ? -1 : 1;
      if (aVal > bVal) return order === 'ASC' ? 1 : -1;
      return 0;
    });

    // 分页
    const total = result.length;
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const data = result.slice(offset, offset + limit);

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * 获取配置项关联关系
   */
  async getCIRelations(ciId: string): Promise<CIRelation[]> {
    if (this.relationRepository) {
      return await this.relationRepository.getCIRelations(ciId);
    }

    return Array.from(relations.values()).filter(
      r => (r.fromCiId === ciId || r.toCiId === ciId) && !r.deletedAt
    );
  }

  /**
   * 创建关联关系
   */
  async createRelation(input: CreateRelationInput, user: string, tenantId?: bigint): Promise<CIRelation> {
    // 验证 CI 是否存在
    let fromCI: CI | null = null;
    let toCI: CI | null = null;
    const resolvedTenantId = tenantId ?? BigInt(1);

    if (this.ciRepository) {
      fromCI = await this.ciRepository.getCIByCiId(input.fromCiId, resolvedTenantId);
      toCI = await this.ciRepository.getCIByCiId(input.toCiId, resolvedTenantId);
    } else {
      // 内存存储实现（含租户隔离）
      fromCI = Array.from(cis.values()).find(
        c => c.ciId === input.fromCiId && !c.deletedAt && c.tenantId === resolvedTenantId
      ) || null;
      toCI = Array.from(cis.values()).find(
        c => c.ciId === input.toCiId && !c.deletedAt && c.tenantId === resolvedTenantId
      ) || null;
    }

    if (!fromCI) {
      throw new OrionError(`Source CI '${input.fromCiId}' not found`, ErrorCode.NOT_FOUND);
    }
    if (!toCI) {
      throw new OrionError(`Target CI '${input.toCiId}' not found`, ErrorCode.NOT_FOUND);
    }

    // 验证关系规则
    const ruleResult = this.relationRuleEngine.validate(fromCI.ciType, toCI.ciType, input.relationType);
    if (!ruleResult.valid) {
      throw new OrionError(
        `Relation rule violation: ${ruleResult.reason}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 检查是否已存在相同关系
    if (this.relationRepository) {
      const exists = await this.relationRepository.relationExists(
        input.fromCiId,
        input.toCiId,
        input.relationType
      );
      if (exists) {
        throw new OrionError(`Relation already exists between '${input.fromCiId}' and '${input.toCiId}'`, ErrorCode.NOT_FOUND);
      }
    } else {
      const existing = Array.from(relations.values()).find(
        r =>
          r.fromCiId === input.fromCiId &&
          r.toCiId === input.toCiId &&
          r.relationType === input.relationType &&
          !r.deletedAt
      );
      if (existing) {
        throw new OrionError(`Relation already exists between '${input.fromCiId}' and '${input.toCiId}'`, ErrorCode.NOT_FOUND);
      }
    }

    const now = new Date();
    const relation: CIRelation = {
      id: uuidv4(),
      fromCiId: input.fromCiId,
      toCiId: input.toCiId,
      relationType: input.relationType,
      description: input.description,
      createdBy: user,
      createdAt: now,
    };

    if (this.relationRepository) {
      return await this.relationRepository.createRelation(input, user);
    } else {
      relations.set(relation.id, relation);
    }

    // 发布事件
    await this.eventPublisher?.publishRelationCreated(relation);

    return relation;
  }

  /**
   * 删除关联关系
   */
  async deleteRelation(relationId: string): Promise<boolean> {
    let deleted = false;

    if (this.relationRepository) {
      deleted = await this.relationRepository.deleteRelation(relationId);
    } else {
      const relation = relations.get(relationId);
      if (!relation || relation.deletedAt) {
        return false;
      }
      relation.deletedAt = new Date();
      relations.set(relationId, relation);
      deleted = true;
    }

    if (!deleted) {
      return false;
    }

    // 发布事件
    await this.eventPublisher?.publishRelationDeleted(
      await this.getCIRelationById(relationId) || { id: relationId } as CIRelation
    );

    return true;
  }

  /**
   * 通过 ID 获取关联关系（内部使用）
   */
  private async getCIRelationById(id: string): Promise<CIRelation | null> {
    if (this.relationRepository) {
      return await this.relationRepository.getRelationById(id);
    }
    return relations.get(id) || null;
  }

  /**
   * 获取配置项版本历史
   */
  async getVersions(ciId: string): Promise<CIVersion[]> {
    if (this.versionRepository) {
      return await this.versionRepository.getVersions(ciId);
    }

    const versions = ciVersions.get(ciId) || [];
    return versions.sort((a, b) => b.version - a.version);
  }

  /**
   * 获取配置项当前版本
   */
  async getCurrentVersion(ciId: string): Promise<number> {
    if (this.versionRepository) {
      return await this.versionRepository.getCurrentVersion(ciId);
    }

    const ci = await this.getCIByCiId(ciId);
    return ci?.version || 0;
  }

  /**
   * 恢复到指定版本
   */
  async restoreToVersion(ciId: string, version: number, user: string): Promise<CI | null> {
    let targetVersion: CIVersion | null = null;
    let versions: CIVersion[] = [];

    if (this.versionRepository) {
      targetVersion = await this.versionRepository.getVersion(ciId, version);
      versions = await this.versionRepository.getVersions(ciId);
    } else {
      const allVersions = ciVersions.get(ciId) || [];
      versions = allVersions.sort((a, b) => b.version - a.version);
      targetVersion = versions.find(v => v.version === version) || null;
    }

    if (!targetVersion) {
      throw new OrionError(`Version ${version} not found for CI '${ciId}'`, ErrorCode.NOT_FOUND);
    }

    const ci = await this.getCIByCiId(ciId);
    if (!ci) {
      throw new OrionError(`CI '${ciId}' not found`, ErrorCode.NOT_FOUND);
    }

    // 恢复数据
    const now = new Date();
    ci.status = targetVersion.data.status;
    ci.description = targetVersion.data.description;
    ci.environment = targetVersion.data.environment;
    ci.tags = targetVersion.data.tags;
    ci.attributes = targetVersion.data.attributes;
    ci.updatedAt = now;
    ci.version += 1;

    // 保存恢复后的数据
    if (this.ciRepository) {
      await this.ciRepository.updateCI(
        ci.id,
        {
          status: ci.status,
          description: ci.description,
          environment: ci.environment,
          tags: ci.tags,
          attributes: ci.attributes,
        },
        user
      );
    } else {
      const ciIdMap = new Map(cis.entries());
      for (const [id, c] of ciIdMap) {
        if (c.ciId === ciId) {
          cis.set(id, ci);
          break;
        }
      }
    }

    // 创建新版本记录
    if (this.versionRepository) {
      await this.versionRepository.createVersion({
        ciId,
        version: ci.version,
        changes: `Restored to version ${version}`,
        data: { ...ci },
        createdBy: user,
      });
    } else {
      versions.push({
        id: uuidv4(),
        ciId,
        version: ci.version,
        changes: `Restored to version ${version}`,
        data: { ...ci },
        createdBy: user,
        createdAt: now,
      });
      ciVersions.set(ciId, versions);
    }

    return ci;
  }

  // ==================== Relation Type Management ====================

  /**
   * 获取关系类型列表
   */
  async getRelationTypes(tenantId: bigint): Promise<RelationTypeDefinition[]> {
    if (this.relationTypeRepository) {
      return await this.relationTypeRepository.getRelationTypes(tenantId);
    }

    // 内存存储实现
    return Array.from(relationTypes.values()).filter(rt => rt.createdAt instanceof Date);
  }

  /**
   * 创建关系类型
   */
  async createRelationType(input: CreateRelationTypeInput, tenantId: bigint): Promise<RelationTypeDefinition> {
    // 验证名称是否唯一
    const existing = await this.getRelationTypeByName(input.name, tenantId);
    if (existing) {
      throw new OrionError(`Relation type '${input.name}' already exists`, ErrorCode.VALIDATION_ERROR);
    }

    const now = new Date();
    const relationType: RelationTypeDefinition = {
      id: uuidv4(),
      name: input.name,
      description: input.description,
      category: input.category,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };

    if (this.relationTypeRepository) {
      return await this.relationTypeRepository.createRelationType(input, tenantId);
    }

    relationTypes.set(relationType.id, relationType);
    return relationType;
  }

  /**
   * 更新关系类型
   */
  async updateRelationType(id: string, input: UpdateRelationTypeInput, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    // 不允许修改系统关系类型
    const existing = await this.getRelationTypeById(id, tenantId);
    if (!existing) {
      return null;
    }
    if (existing.isSystem) {
      throw new OrionError('Cannot modify system relation type', ErrorCode.VALIDATION_ERROR);
    }

    if (this.relationTypeRepository) {
      return await this.relationTypeRepository.updateRelationType(id, input, tenantId);
    }

    // 内存存储实现
    const relationType = relationTypes.get(id);
    if (!relationType || relationType.isSystem) {
      return null;
    }

    if (input.name !== undefined) relationType.name = input.name;
    if (input.description !== undefined) relationType.description = input.description;
    if (input.category !== undefined) relationType.category = input.category;
    relationType.updatedAt = new Date();

    relationTypes.set(id, relationType);
    return relationType;
  }

  /**
   * 删除关系类型
   */
  async deleteRelationType(id: string, tenantId: bigint): Promise<boolean> {
    // 不允许删除系统关系类型
    const existing = await this.getRelationTypeById(id, tenantId);
    if (!existing) {
      return false;
    }
    if (existing.isSystem) {
      throw new OrionError('Cannot delete system relation type', ErrorCode.VALIDATION_ERROR);
    }

    if (this.relationTypeRepository) {
      return await this.relationTypeRepository.deleteRelationType(id, tenantId);
    }

    // 内存存储实现
    const relationType = relationTypes.get(id);
    if (!relationType || relationType.isSystem) {
      return false;
    }

    relationTypes.delete(id);
    return true;
  }

  /**
   * 通过 ID 获取关系类型（内部使用）
   */
  private async getRelationTypeById(id: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    if (this.relationTypeRepository) {
      return await this.relationTypeRepository.getRelationTypeById(id, tenantId);
    }
    return relationTypes.get(id) || null;
  }

  /**
   * 通过名称获取关系类型（内部使用）
   */
  private async getRelationTypeByName(name: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    if (this.relationTypeRepository) {
      return await this.relationTypeRepository.getRelationTypeByName(name, tenantId);
    }
    return Array.from(relationTypes.values()).find(rt => rt.name === name) || null;
  }

  // ==================== Batch Operations (Task 4.15) ====================

  /**
   * 批量创建配置项
   * @param items - 创建配置项列表
   * @param tenantId - 租户 ID
   * @param createdBy - 创建人
   * @returns 批量创建结果
   */
  async batchCreateCIs(
    items: CreateCIInput[],
    tenantId: bigint,
    createdBy: string = 'system'
  ): Promise<{
    results: Array<{ success: boolean; data?: CI; error?: string }>;
    summary: { total: number; success: number; failed: number };
  }> {
    const results: Array<{ success: boolean; data?: CI; error?: string }> = [];

    for (const item of items) {
      try {
        const ci = await this.createCI({
          ...item,
          tenantId,
          createdBy: item.createdBy || createdBy,
        });
        results.push({ success: true, data: ci });
      } catch (error: any) {
        results.push({ success: false, error: error.message || 'Unknown error', ciId: item.ciId });
      }
    }

    const summary = {
      total: items.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    logger.info({ tenantId, summary }, 'Batch create CIs completed');
    return { results, summary };
  }

  /**
   * 批量更新配置项
   * @param updates - 更新列表，每项包含 id 或 ciId 及更新字段
   * @param tenantId - 租户 ID
   * @param user - 操作用户
   * @returns 批量更新结果
   */
  async batchUpdateCIs(
    updates: Array<{ id?: string; ciId?: string; data: UpdateCIInput }>,
    tenantId: bigint,
    user: string = 'system'
  ): Promise<{
    results: Array<{ success: boolean; data?: CI; error?: string }>;
    summary: { total: number; success: number; failed: number };
  }> {
    const results: Array<{ success: boolean; data?: CI; error?: string }> = [];

    for (const update of updates) {
      try {
        // 解析目标 ID
        let targetId: string | undefined;
        if (update.id) {
          targetId = update.id;
        } else if (update.ciId) {
          const ci = await this.getCIByCiId(update.ciId, tenantId);
          targetId = ci?.id;
        }

        if (!targetId) {
          results.push({
            success: false,
            error: `CI not found: ${update.ciId || update.id}`,
            ciId: update.ciId,
          });
          continue;
        }

        const ci = await this.updateCI(targetId, update.data, user, tenantId);
        if (!ci) {
          results.push({
            success: false,
            error: `CI not found: ${targetId}`,
            ciId: update.ciId,
          });
          continue;
        }

        results.push({ success: true, data: ci });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Unknown error',
          ciId: update.ciId,
        });
      }
    }

    const summary = {
      total: updates.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    logger.info({ tenantId, summary }, 'Batch update CIs completed');
    return { results, summary };
  }

  /**
   * 批量删除配置项（软删除）
   * @param ids - 内部 ID 列表或 ciId 列表
   * @param tenantId - 租户 ID
   * @returns 批量删除结果
   */
  async batchDeleteCIs(
    ids: Array<{ id?: string; ciId?: string }>,
    tenantId: bigint
  ): Promise<{
    results: Array<{ success: boolean; error?: string; ciId?: string }>;
    summary: { total: number; success: number; failed: number };
  }> {
    const results: Array<{ success: boolean; error?: string; ciId?: string }> = [];

    for (const item of ids) {
      try {
        // 解析目标 ID
        let targetId: string | undefined;
        let targetCiId: string | undefined;

        if (item.id) {
          targetId = item.id;
          // 先获取 ciId
          const ci = await this.getCI(item.id, tenantId);
          targetCiId = ci?.ciId;
        } else if (item.ciId) {
          targetCiId = item.ciId;
          const ci = await this.getCIByCiId(item.ciId, tenantId);
          targetId = ci?.id;
        }

        if (!targetId) {
          results.push({
            success: false,
            error: `CI not found: ${item.ciId || item.id}`,
            ciId: item.ciId,
          });
          continue;
        }

        const deleted = await this.deleteCI(targetId, tenantId);
        if (!deleted) {
          results.push({
            success: false,
            error: `CI not found: ${targetId}`,
            ciId: targetCiId,
          });
          continue;
        }

        results.push({ success: true, ciId: targetCiId });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Unknown error',
          ciId: item.ciId,
        });
      }
    }

    const summary = {
      total: ids.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    logger.info({ tenantId, summary }, 'Batch delete CIs completed');
    return { results, summary };
  }

  // ==================== Batch Query (Task 4.15) ====================

  /**
   * 批量查询配置项（支持复杂过滤）
   * @param filters - 查询过滤条件
   * @returns 配置项列表及分页信息
   */
  async batchQueryCIs(filters: CIFilters): Promise<CIListResponse> {
    // 复用现有的 listCIs 方法，它已经支持复杂的过滤条件
    return await this.listCIs(filters);
  }

  // ==================== Import / Export (Task 4.16) ====================

  /**
   * 导出单个配置项
   * @param ciIdOrId - 配置项 ID（支持 ciId 或内部 id）
   * @param tenantId - 租户 ID
   * @returns 配置项对象
   */
  async exportCI(ciIdOrId: string, tenantId: bigint): Promise<CI | null> {
    // 先尝试通过 ciId 查找
    let ci = await this.getCIByCiId(ciIdOrId, tenantId);
    if (!ci) {
      // 再尝试通过内部 id 查找
      ci = await this.getCI(ciIdOrId, tenantId);
    }
    return ci;
  }

  /**
   * 导入配置项列表（JSON 格式）
   * @param ciItems - 导入的 CI 数据列表
   * @param tenantId - 租户 ID
   * @param skipDuplicates - 是否跳过已存在的 CI
   * @param createdBy - 创建人
   * @returns 导入结果汇总
   */
  async importCIs(
    ciItems: Array<{
      ciId: string;
      ciType: CiType;
      name: string;
      description?: string;
      status?: CiStatus;
      environment?: string;
      tags?: string[];
      attributes?: Record<string, any>;
      createdBy?: string;
    }>,
    tenantId: bigint,
    skipDuplicates: boolean = false,
    createdBy: string = 'system'
  ): Promise<{
    imported: number;
    skipped: number;
    errors: Array<{ ciId: string; error: string }>;
  }> {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ ciId: string; error: string }> = [];

    for (const ciData of ciItems) {
      try {
        // 检查是否已存在（含租户隔离）
        const exists = this.ciRepository
          ? await this.ciRepository.ciExists(ciData.ciId, tenantId)
          : Array.from(cis.values()).some(
              ci => ci.ciId === ciData.ciId && !ci.deletedAt && ci.tenantId === tenantId
            );

        if (exists) {
          if (skipDuplicates) {
            skipped++;
            continue;
          }
          throw new OrionError(`CI '${ciData.ciId}' already exists`, ErrorCode.VALIDATION_ERROR);
        }

        await this.createCI({
          ...ciData,
          tenantId,
          createdBy: ciData.createdBy || createdBy,
        });
        imported++;
      } catch (error: any) {
        errors.push({ ciId: ciData.ciId, error: error.message || 'Unknown error' });
      }
    }

    logger.info({ tenantId, imported, skipped, errors: errors.length }, 'CI import completed');
    return { imported, skipped, errors };
  }

  /**
   * 导出配置项列表（JSON 格式）
   * @param filters - 导出过滤条件
   * @returns 配置项列表
   */
  async exportCIs(filters: {
    ciType?: CiType;
    status?: CiStatus;
    environment?: string;
    tenantId: bigint;
    search?: string;
    includeArchived?: boolean;
  }): Promise<CI[]> {
    const result = await this.listCIs({
      tenantId: filters.tenantId,
      ciType: filters.ciType,
      status: filters.status,
      environment: filters.environment,
      search: filters.search,
      includeArchived: filters.includeArchived,
      limit: 10000,
      offset: 0,
    });

    return result.data;
  }

  /**
   * 通过 ciId 解析内部 ID（用于批量操作中的引用）
   */
  private async resolveCiId(ciId: string): Promise<string | undefined> {
    const ci = await this.getCIByCiId(ciId);
    return ci?.id;
  }

  /**
   * 清空所有数据（仅用于测试）
   */
  static clearAll(): void {
    cis.clear();
    ciVersions.clear();
    relations.clear();
    relationTypes.clear();
  }
}

// 导出单例
export const cmdbService = new CmdbService();
