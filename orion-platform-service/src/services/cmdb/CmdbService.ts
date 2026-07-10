/**
 * CMDB 核心服务
 *
 * 提供配置项 (CI) 的 CRUD 操作、关联关系管理、版本管理
 * 全部走 PostgreSQL Repository + tenant_id 过滤
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

export class CmdbService {
  private eventPublisher?: CmdbEventPublisher;
  private database?: DatabasePool;
  private ciRepository?: CmdbRepository;
  private relationRepository?: CmdbRelationRepository;
  private relationTypeRepository?: CmdbRelationTypeRepository;
  private versionRepository?: CmdbVersionRepository;
  private ciTypeService?: CITypeService;
  private relationRuleEngine: RelationRuleEngine;

  // 实例追踪（用于测试清理）
  private static instances = new Set<CmdbService>();

  // 内存存储（降级模式：无数据库连接时使用，含租户隔离）
  private memoryCis = new Map<string, CI>();
  private memoryCiversions = new Map<string, CIVersion[]>();
  private memoryRelations = new Map<string, CIRelation>();
  private memoryRelationTypes = new Map<string, RelationTypeDefinition>();
  private memoryTenantCis = new Map<string, Map<string, CI>>(); // tenantId_str -> (id -> CI)
  private memoryVersions = new Map<string, CIVersion[]>(); // ciId -> CIVersion[]

  // 仓库访问器（自动降级到内存模式）
  private get repo(): CmdbRepository {
    if (!this.ciRepository) throw new OrionError('CI Repository not initialized', ErrorCode.INTERNAL_ERROR);
    return this.ciRepository;
  }
  private get relRepo(): CmdbRelationRepository {
    if (!this.relationRepository) throw new OrionError('Relation Repository not initialized', ErrorCode.INTERNAL_ERROR);
    return this.relationRepository;
  }
  private get verRepo(): CmdbVersionRepository {
    if (!this.versionRepository) throw new OrionError('Version Repository not initialized', ErrorCode.INTERNAL_ERROR);
    return this.versionRepository;
  }

  constructor(options?: {
    eventPublisher?: CmdbEventPublisher;
    database?: DatabasePool;
    ciRepository?: CmdbRepository;
    relationRepository?: CmdbRelationRepository;
    relationTypeRepository?: CmdbRelationTypeRepository;
    versionRepository?: CmdbVersionRepository;
    ciTypeService?: CITypeService;
    relationRuleEngine?: RelationRuleEngine;
  }) {
    this.eventPublisher = options?.eventPublisher;
    this.database = options?.database;
    this.ciRepository = options?.ciRepository;
    this.relationRepository = options?.relationRepository;
    this.relationTypeRepository = options?.relationTypeRepository;
    this.versionRepository = options?.versionRepository;
    this.ciTypeService = options?.ciTypeService;
    this.relationRuleEngine = options?.relationRuleEngine || new RelationRuleEngine();

    // 如果未提供 Repository 且提供了数据库连接，初始化 Repository
    if (this.database && !this.ciRepository) {
      this.ciRepository = new CmdbRepository(this.database);
      this.relationRepository = new CmdbRelationRepository(this.database);
      this.relationTypeRepository = new CmdbRelationTypeRepository(this.database);
      this.versionRepository = new CmdbVersionRepository(this.database);
    }

    // 注册实例用于测试清理
    CmdbService.instances.add(this);
  }

  /** 清除所有实例的内存存储（测试用） */
  static clearAll(): void {
    for (const instance of CmdbService.instances) {
      instance.memoryCis.clear();
      instance.memoryCiversions.clear();
      instance.memoryRelations.clear();
      instance.memoryRelationTypes.clear();
      instance.memoryTenantCis.clear();
    }
    CmdbService.instances.clear();
  }

  // =========================================================================
  // 内存模式辅助方法（降级模式：无数据库时使用，含租户隔离）
  // =========================================================================

  private getMemoryTenantStore(tenantId: bigint): Map<string, CI> {
    const key = String(tenantId);
    if (!this.memoryTenantCis.has(key)) {
      this.memoryTenantCis.set(key, new Map());
    }
    return this.memoryTenantCis.get(key)!;
  }

  private memoryCiExists(ciId: string, tenantId: bigint): boolean {
    const store = this.getMemoryTenantStore(tenantId);
    for (const ci of store.values()) {
      if (ci.ciId === ciId && !ci.deletedAt) return true;
    }
    return false;
  }

  private memoryGetCIById(id: string, tenantId: bigint): CI | undefined {
    const store = this.getMemoryTenantStore(tenantId);
    const ci = store.get(id);
    if (!ci || ci.deletedAt) return undefined;
    return ci;
  }

  private memoryGetCIByCiId(ciId: string, tenantId: bigint): CI | undefined {
    const store = this.getMemoryTenantStore(tenantId);
    for (const ci of store.values()) {
      if (ci.ciId === ciId && !ci.deletedAt) return ci;
    }
    return undefined;
  }

  private memoryCreateCI(input: CreateCIInput): CI {
    const now = new Date();
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ci: CI = {
      id,
      ciId: input.ciId,
      tenantId: input.tenantId,
      ciType: input.ciType,
      name: input.name,
      description: input.description,
      status: input.status || 'ACTIVE',
      environment: input.environment,
      tags: input.tags || [],
      attributes: input.attributes || {},
      version: 1,
      relations: [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    const store = this.getMemoryTenantStore(input.tenantId);
    store.set(id, ci);
    this.memoryCis.set(id, ci);

    // 记录初始版本（内存模式）
    const version: CIVersion = {
      id: `mem-ver-${Date.now()}`,
      ciId: ci.ciId,
      version: 1,
      changes: 'Initial creation',
      data: { ...ci },
      createdBy: input.createdBy,
      createdAt: now,
    };
    const versions = this.memoryVersions.get(ci.ciId) || [];
    versions.push(version);
    this.memoryVersions.set(ci.ciId, versions);

    return ci;
  }

  private memoryUpdateCI(id: string, input: UpdateCIInput, tenantId: bigint): CI | null {
    const store = this.getMemoryTenantStore(tenantId);
    const ci = store.get(id);
    if (!ci || ci.deletedAt) return null;

    if (input.description !== undefined) ci.description = input.description;
    if (input.status !== undefined) ci.status = input.status;
    if (input.environment !== undefined) ci.environment = input.environment;
    if (input.tags !== undefined) ci.tags = input.tags;
    if (input.attributes !== undefined) ci.attributes = { ...ci.attributes, ...input.attributes };
    ci.version += 1;
    ci.updatedAt = new Date();
    return ci;
  }

  private memoryDeleteCI(id: string, tenantId: bigint): boolean {
    const store = this.getMemoryTenantStore(tenantId);
    const ci = store.get(id);
    if (!ci || ci.deletedAt) return false;
    ci.deletedAt = new Date();
    ci.status = 'DECOMMISSIONED';
    return true;
  }

  private memoryArchiveCI(id: string, tenantId: bigint): boolean {
    const store = this.getMemoryTenantStore(tenantId);
    const ci = store.get(id);
    if (!ci || ci.deletedAt || ci.archivedAt) return false;
    ci.archivedAt = new Date();
    ci.status = 'ARCHIVED';
    return true;
  }

  private memoryRestoreCI(id: string, tenantId: bigint): boolean {
    const store = this.getMemoryTenantStore(tenantId);
    const ci = store.get(id);
    if (!ci || ci.deletedAt || !ci.archivedAt) return false;
    ci.archivedAt = undefined;
    ci.status = 'ACTIVE';
    ci.updatedAt = new Date();
    return true;
  }

  // ========== 扩展内存模式辅助方法 ==========

  private memoryGetCIById(id: string, tenantId: bigint): CI | undefined {
    const store = this.getMemoryTenantStore(tenantId);
    const ci = store.get(id);
    if (!ci || ci.deletedAt) return undefined;
    return ci;
  }

  private memoryListCIs(filters: CIFilters): CIListResponse {
    const resolvedTenantId = filters.tenantId ?? BigInt(1);
    const store = this.getMemoryTenantStore(resolvedTenantId);
    let results = Array.from(store.values()).filter(ci => !ci.deletedAt);

    if (filters.ciType) {
      results = results.filter(ci => ci.ciType === filters.ciType);
    }
    if (filters.status) {
      results = results.filter(ci => ci.status === filters.status);
    }
    if (filters.environment) {
      results = results.filter(ci => ci.environment === filters.environment);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(ci =>
        ci.name.toLowerCase().includes(q) ||
        ci.ciId.toLowerCase().includes(q) ||
        ci.description?.toLowerCase().includes(q)
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(ci =>
        filters.tags!.some(t => (ci.tags || []).includes(t))
      );
    }

    const total = results.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    const page = results.slice(offset, offset + limit);

    return { data: page, total, limit, offset };
  }

  private memoryGetCIRelations(ciId: string, tenantId: bigint): CIRelation[] {
    return Array.from(this.memoryRelations.values()).filter(
      r => (r.fromCiId === ciId || r.toCiId === ciId) && r.tenantId === tenantId && !r.deletedAt
    );
  }

  private memoryCreateRelation(input: CreateRelationInput, tenantId: bigint, user: string): CIRelation {
    const now = new Date();
    const relation: CIRelation = {
      id: `mem-rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromCiId: input.fromCiId,
      toCiId: input.toCiId,
      relationType: input.relationType,
      description: input.description,
      tenantId,
      createdBy: user,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryRelations.set(relation.id, relation);
    return relation;
  }

  private memoryGetVersions(ciId: string): CIVersion[] {
    const versions = this.memoryVersions.get(ciId) || [];
    return versions.sort((a, b) => b.version - a.version);
  }

  private memoryDeleteRelation(relationId: string, tenantId: bigint): boolean {
    const relation = this.memoryRelations.get(relationId);
    if (!relation || relation.tenantId !== tenantId || relation.deletedAt) return false;
    relation.deletedAt = new Date();
    return true;
  }

  // =========================================================================
  // 内存模式辅助方法（租户隔离）
  // =========================================================================

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

    // 检查是否已存在（PostgreSQL 租户隔离 or 内存模式租户隔离）
    if (this.ciRepository) {
      const exists = await this.ciRepository!.ciExists(input.ciId, input.tenantId);
      if (exists) {
        throw new OrionError(`CI '${input.ciId}' already exists`, ErrorCode.NOT_FOUND);
      }
    } else {
      if (this.memoryCiExists(input.ciId, input.tenantId)) {
        throw new OrionError(`CI '${input.ciId}' already exists`, ErrorCode.NOT_FOUND);
      }
    }

    const now = new Date();
    let savedCI: CI;
    if (this.ciRepository) {
      savedCI = await this.ciRepository.createCI(input);
    } else {
      savedCI = this.memoryCreateCI(input);
    }

    // 创建初始版本记录（仅 PostgreSQL 模式）
    if (this.versionRepository) {
      await this.versionRepository!.createVersion({
        ciId: savedCI.ciId,
        version: 1,
        changes: 'Initial creation',
        data: { ...savedCI },
        createdBy: input.createdBy,
      });
    }

    // 发布事件
    await this.eventPublisher?.publishCICreated(savedCI);

    return savedCI;
  }

  /**
   * 获取配置项详情
   * @param id - 内部 ID
   * @param tenantId - 租户 ID（必须提供以执行租户隔离）
   */
  async getCI(id: string, tenantId?: bigint): Promise<CI | null> {
    const resolvedTenantId = tenantId ?? BigInt(1);
    let ci: CI | null | undefined;
    if (this.ciRepository) {
      ci = await this.ciRepository.getCIById(id, resolvedTenantId);
      if (!ci || ci.deletedAt) return null;
    } else {
      ci = this.memoryGetCIById(id, resolvedTenantId);
      if (!ci) return null;
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
    const resolvedTenantId = tenantId ?? BigInt(1);
    let ci: CI | null | undefined;
    if (this.ciRepository) {
      ci = await this.ciRepository.getCIByCiId(ciId, resolvedTenantId);
    } else {
      ci = this.memoryGetCIByCiId(ciId, resolvedTenantId) || null;
    }
    if (!ci) return null;

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
   * @param tenantId - 租户 ID（必须提供以执行租户隔离）
   */
  async updateCI(id: string, input: UpdateCIInput, user: string, tenantId?: bigint): Promise<CI | null> {
    const resolvedTenantId = tenantId ?? BigInt(1);

    // 先获取旧值用于变更记录
    const oldCI = this.ciRepository
      ? await this.ciRepository.getCIById(id, resolvedTenantId)
      : this.memoryGetCIById(id, resolvedTenantId) || null;
    if (!oldCI) {
      return null;
    }

    // 验证属性是否符合类型 schema
    if (input.attributes) {
      await this.validateCIAttributes(oldCI.ciType, input.attributes);
    }

    // 记录变更描述
    const changes: string[] = [];
    if (input.description !== undefined && input.description !== oldCI.description) {
      changes.push(`description: ${oldCI.description} -> ${input.description}`);
    }
    if (input.status !== undefined && input.status !== oldCI.status) {
      changes.push(`status: ${oldCI.status} -> ${input.status}`);
    }
    if (input.environment !== undefined && input.environment !== oldCI.environment) {
      changes.push(`environment: ${oldCI.environment} -> ${input.environment}`);
    }
    if (input.tags !== undefined) {
      changes.push(`tags: ${JSON.stringify(oldCI.tags)} -> ${JSON.stringify(input.tags)}`);
    }
    if (input.attributes !== undefined) {
      changes.push(`attributes updated`);
    }

    let ci: CI | null;
    if (this.ciRepository) {
      ci = await this.ciRepository.updateCI(id, input, user, resolvedTenantId);
    } else {
      ci = this.memoryUpdateCI(id, input, resolvedTenantId);
    }
    if (!ci) {
      return null;
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
    } else if (!this.ciRepository) {
      // 内存模式版本记录
      const version: CIVersion = {
        id: `mem-ver-${Date.now()}`,
        ciId: ci.ciId,
        version: ci.version,
        changes: changes.join('; '),
        data: { ...ci },
        createdBy: user,
        createdAt: new Date(),
      };
      const versions = this.memoryVersions.get(ci.ciId) || [];
      versions.push(version);
      this.memoryVersions.set(ci.ciId, versions);
    }

    // 发布事件
    await this.eventPublisher?.publishCIUpdated(ci, changes);

    return ci;
  }

  /**
   * 删除配置项（软删除）
   * @param id - 内部 ID
   * @param tenantId - 租户 ID（必须提供以执行租户隔离）
   */
  async deleteCI(id: string, tenantId?: bigint): Promise<boolean> {
    const resolvedTenantId = tenantId ?? BigInt(1);

    const ci = this.ciRepository
      ? await this.ciRepository.getCIById(id, resolvedTenantId)
      : this.memoryGetCIById(id, resolvedTenantId) || null;
    if (!ci) {
      return false;
    }

    let deleted: boolean;
    if (this.ciRepository) {
      deleted = await this.ciRepository.deleteCI(id, resolvedTenantId);
    } else {
      deleted = this.memoryDeleteCI(id, resolvedTenantId);
    }
    if (!deleted) {
      return false;
    }

    // 发布事件
    await this.eventPublisher?.publishCIDeleted(ci);

    return true;
  }

  /**
   * 归档配置项
   * @param id - 内部 ID
   * @param tenantId - 租户 ID（必须提供以执行租户隔离）
   */
  async archiveCI(id: string, tenantId?: bigint): Promise<boolean> {
    const resolvedTenantId = tenantId ?? BigInt(1);

    const ci = await this.ciRepository!.getCIById(id, resolvedTenantId);
    if (!ci || ci.deletedAt) {
      return false;
    }

    const archived = await this.ciRepository!.archiveCI(id, resolvedTenantId);
    if (!archived) {
      return false;
    }

    // 发布事件
    await this.eventPublisher?.publishCIUpdated(ci, ['archived']);

    return true;
  }

  /**
   * 恢复已归档的配置项
   */
  async restoreCI(id: string, tenantId?: bigint): Promise<CI | null> {
    const resolvedTenantId = tenantId ?? BigInt(1);
    const ci = await this.ciRepository!.getCIById(id, resolvedTenantId);
    if (!ci || !ci.archivedAt) {
      return null;
    }

    const restored = await this.ciRepository!.restoreCI(id, resolvedTenantId);
    if (!restored) {
      return null;
    }

    return await this.ciRepository!.getCIById(id, resolvedTenantId);
  }

  /**
   * 获取已归档的配置项列表
   */
  async getArchivedCIs(tenantId: bigint, limit = 100, offset = 0): Promise<CI[]> {
    return await this.ciRepository!.getArchivedCIs(tenantId, limit, offset);
  }

  /**
   * 查询配置项列表
   */
  async listCIs(filters: CIFilters): Promise<CIListResponse> {
    if (this.ciRepository) {
      return await this.ciRepository.listCIs(filters);
    }
    return this.memoryListCIs(filters);
  }

  /**
   * 获取配置项关联关系
   */
  async getCIRelations(ciId: string, tenantId?: bigint): Promise<CIRelation[]> {
    const resolvedTenantId = tenantId ?? BigInt(1);
    if (this.relationRepository) {
      return await this.relationRepository.getCIRelations(ciId, resolvedTenantId);
    }
    return this.memoryGetCIRelations(ciId, resolvedTenantId);
  }

  /**
   * 创建关联关系
   */
  async createRelation(input: CreateRelationInput, user: string, tenantId?: bigint): Promise<CIRelation> {
    const resolvedTenantId = tenantId ?? BigInt(1);

    // 验证 CI 是否存在（含租户隔离）
    const fromCI = this.ciRepository
      ? await this.ciRepository.getCIByCiId(input.fromCiId, resolvedTenantId)
      : this.memoryGetCIByCiId(input.fromCiId, resolvedTenantId) || null;
    const toCI = this.ciRepository
      ? await this.ciRepository.getCIByCiId(input.toCiId, resolvedTenantId)
      : this.memoryGetCIByCiId(input.toCiId, resolvedTenantId) || null;

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

    // 检查是否已存在相同关系（含租户隔离）
    let exists: boolean;
    if (this.relationRepository) {
      exists = await this.relationRepository.relationExists(
        input.fromCiId,
        input.toCiId,
        input.relationType,
        resolvedTenantId
      );
    } else {
      const relations = this.memoryGetCIRelations(input.fromCiId, resolvedTenantId);
      exists = relations.some(
        r => r.toCiId === input.toCiId && r.relationType === input.relationType && !r.deletedAt
      );
    }
    if (exists) {
      throw new OrionError(`Relation already exists between '${input.fromCiId}' and '${input.toCiId}'`, ErrorCode.NOT_FOUND);
    }

    let relation: CIRelation;
    if (this.relationRepository) {
      relation = await this.relationRepository.createRelation(input, user, resolvedTenantId);
    } else {
      relation = this.memoryCreateRelation(input, resolvedTenantId, user);
    }

    // 发布事件
    await this.eventPublisher?.publishRelationCreated(relation);

    return relation;
  }

  /**
   * 删除关联关系
   */
  async deleteRelation(relationId: string, tenantId?: bigint): Promise<boolean> {
    const resolvedTenantId = tenantId ?? BigInt(1);
    let deleted: boolean;
    if (this.relationRepository) {
      deleted = await this.relationRepository.deleteRelation(relationId, resolvedTenantId);
    } else {
      deleted = this.memoryDeleteRelation(relationId, resolvedTenantId);
    }

    if (!deleted) {
      return false;
    }

    // 发布事件
    await this.eventPublisher?.publishRelationDeleted(
      await this.getCIRelationById(relationId, resolvedTenantId) || { id: relationId } as CIRelation
    );

    return true;
  }

  /**
   * 通过 ID 获取关联关系（内部使用，含租户隔离）
   */
  private async getCIRelationById(id: string, tenantId: bigint): Promise<CIRelation | null> {
    if (this.relationRepository) {
      return await this.relationRepository.getRelationById(id, tenantId);
    }
    const relation = this.memoryRelations.get(id);
    if (!relation || relation.tenantId !== tenantId || relation.deletedAt) return null;
    return relation;
  }

  /**
   * 获取配置项版本历史
   */
  async getVersions(ciId: string): Promise<CIVersion[]> {
    if (this.versionRepository) {
      return await this.versionRepository.getVersions(ciId);
    }
    return this.memoryGetVersions(ciId);
  }

  /**
   * 获取配置项当前版本
   */
  async getCurrentVersion(ciId: string): Promise<number> {
    const ci = await this.getCIByCiId(ciId);
    return ci?.version || 0;
  }

  /**
   * 恢复到指定版本（含租户隔离）
   */
  async restoreToVersion(ciId: string, version: number, user: string, tenantId?: bigint): Promise<CI | null> {
    const targetVersion = await this.versionRepository!.getVersion(ciId, version);
    if (!targetVersion) {
      throw new OrionError(`Version ${version} not found for CI '${ciId}'`, ErrorCode.NOT_FOUND);
    }

    const resolvedTenantId = tenantId ?? BigInt(1);
    const ci = await this.getCIByCiId(ciId, resolvedTenantId);
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
    await this.ciRepository!.updateCI(
      ci.id,
      {
        status: ci.status,
        description: ci.description,
        environment: ci.environment,
        tags: ci.tags,
        attributes: ci.attributes,
      },
      user,
      resolvedTenantId
    );

    // 创建新版本记录
    await this.versionRepository!.createVersion({
      ciId,
      version: ci.version,
      changes: `Restored to version ${version}`,
      data: { ...ci },
      createdBy: user,
    });

    return ci;
  }

  // ==================== Relation Type Management ====================

  /**
   * 获取关系类型列表（含租户隔离）
   */
  async getRelationTypes(tenantId: bigint): Promise<RelationTypeDefinition[]> {
    return await this.relationTypeRepository!.getRelationTypes(tenantId);
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

    return await this.relationTypeRepository!.createRelationType(input, tenantId);
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

    return await this.relationTypeRepository!.updateRelationType(id, input, tenantId);
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

    return await this.relationTypeRepository!.deleteRelationType(id, tenantId);
  }

  /**
   * 通过 ID 获取关系类型（内部使用）
   */
  private async getRelationTypeById(id: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    return await this.relationTypeRepository!.getRelationTypeById(id, tenantId);
  }

  /**
   * 通过名称获取关系类型（内部使用）
   */
  private async getRelationTypeByName(name: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    return await this.relationTypeRepository!.getRelationTypeByName(name, tenantId);
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
    results: Array<{ success: boolean; data?: CI; error?: string; ciId?: string }>;
    summary: { total: number; success: number; failed: number };
  }> {
    const results: Array<{ success: boolean; data?: CI; error?: string; ciId?: string }> = [];

    // C4 修复：使用事务包装批量操作，确保原子性
    // 如果部分成功部分失败，不会留下孤立数据
    // 注意：当前实现逐个创建，如果需要真正的事务，需要使用 BEGIN/COMMIT
    // 这里暂时保留逐个创建的方式，但记录所有错误，方便回滚
    const createdCIs: CI[] = [];

    for (const item of items) {
      try {
        const ci = await this.createCI({
          ...item,
          tenantId,
          createdBy: item.createdBy || createdBy,
        });
        results.push({ success: true, data: ci });
        createdCIs.push(ci);
      } catch (error: any) {
        // C4 修复：如果失败，回滚已创建的 CI（补偿机制）
        logger.error({ tenantId, item, error: error.message }, 'Batch create CI failed, rolling back');

        // 回滚已创建的 CI
        for (const createdCI of createdCIs) {
          try {
            await this.deleteCI(createdCI.id, tenantId);
          } catch (rollbackError: any) {
            logger.error({ ciId: createdCI.id, error: rollbackError.message }, 'Rollback failed');
          }
        }

        results.push({ success: false, error: error.message || 'Unknown error', ciId: item.ciId });

        // 抛出错误以通知调用方批量操作失败
        throw new OrionError(
          `Batch create failed at item ${results.length}: ${error.message}. Rolled back ${createdCIs.length} CIs.`,
          ErrorCode.INTERNAL_ERROR
        );
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
    results: Array<{ success: boolean; data?: CI; error?: string; ciId?: string }>;
    summary: { total: number; success: number; failed: number };
  }> {
    const results: Array<{ success: boolean; data?: CI; error?: string; ciId?: string }> = [];

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
        // 检查是否已存在（PostgreSQL 租户隔离）
        const exists = await this.ciRepository!.ciExists(ciData.ciId, tenantId);

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
}

// 导出单例
export const cmdbService = new CmdbService();
