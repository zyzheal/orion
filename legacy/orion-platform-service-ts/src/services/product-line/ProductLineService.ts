/**
 * ProductLine Service - 多分支产品线服务
 *
 * 基于 ADR-008 ProductLine-CRD 设计
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import {
  ProductLine,
  ProductLineCreateInput,
  ProductLineUpdateInput,
  ProductLinePhase,
  BranchEnvironmentMapping,
  EnvironmentName,
  ReleaseTrain,
  HotfixChannel,
} from '../../models/ProductLine';
import {
  ProductLineRepository,
  ReleaseTrainRepository,
  HotfixChannelRepository,
} from '../../repositories/ProductLineRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('ProductLineService');

export class ProductLineService {
  private productLineRepo?: ProductLineRepository;
  private releaseTrainRepo?: ReleaseTrainRepository;
  private hotfixChannelRepo?: HotfixChannelRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.productLineRepo = new ProductLineRepository(db);
      this.releaseTrainRepo = new ReleaseTrainRepository(db);
      this.hotfixChannelRepo = new HotfixChannelRepository(db);
    }
  }

  // ==================== ProductLine CRUD ====================

  /**
   * 创建产品线
   */
  async create(input: ProductLineCreateInput): Promise<ProductLine> {
    const id = uuidv4();
    const now = new Date();

    if (this.productLineRepo) {
      const entity = await this.productLineRepo.create({
        tenantId: input.tenantId ?? null,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        gitUrl: input.gitRepo.url,
        gitProvider: input.gitRepo.provider ?? 'github',
        gitDefaultBranch: input.gitRepo.defaultBranch ?? 'main',
        gitCredentialRef: input.gitRepo.credentialRef ?? null,
        branchMode: input.branchPolicies.mode,
        protectedBranches: input.branchPolicies.protectedBranches ?? [],
        codeOwnership: input.branchPolicies.codeOwnership ?? {},
        namingConvention: input.branchPolicies.namingConvention ?? {},
        mergeStrategy: input.branchPolicies.mergeStrategy ?? {},
        defaultEnvironment: input.environmentMappings.defaultEnvironment ?? 'dev',
        environmentMappings: input.environmentMappings.mappings,
        promotionConfig: input.environmentMappings.promotion ?? {},
        environments: input.environments ?? [],
        defaultPipelineTemplate: input.pipelineTemplates?.defaultTemplate ?? null,
        pipelineTemplates: input.pipelineTemplates?.templates ?? [],
        teamBindings: input.teamBindings ?? [],
        resourceQuotas: input.resourceQuotas ?? {},
        notifications: input.notifications ?? {},
        labels: input.labels ?? {},
        annotations: input.annotations ?? {},
        phase: 'Pending',
        conditions: [],
        statistics: {},
        gitStatus: {},
        environmentStatuses: [],
        createdAt: now,
        updatedAt: now,
      });

      logger.info({ productLineId: entity.id, name: entity.name }, 'ProductLine created');
      return this.mapEntityToProductLine(entity);
    }

    // Fallback - 不应该到达这里
    throw new OrionError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE);
  }

  /**
   * 获取产品线
   */
  async getById(id: string): Promise<ProductLine | undefined> {
    if (this.productLineRepo) {
      const entity = await this.productLineRepo.findById(id);
      return entity ? this.mapEntityToProductLine(entity) : undefined;
    }
    return undefined;
  }

  /**
   * 按名称获取产品线
   */
  async getByName(name: string): Promise<ProductLine | undefined> {
    if (this.productLineRepo) {
      const entity = await this.productLineRepo.findByName(name);
      return entity ? this.mapEntityToProductLine(entity) : undefined;
    }
    return undefined;
  }

  /**
   * 列出产品线
   */
  async list(tenantId?: string, phase?: ProductLinePhase): Promise<ProductLine[]> {
    if (this.productLineRepo) {
      let entities;
      if (tenantId) {
        entities = await this.productLineRepo.findByTenant(tenantId);
      } else if (phase) {
        entities = await this.productLineRepo.findByPhase(phase);
      } else {
        const result = await this.productLineRepo.findAll({ limit: 100 });
        entities = result.entities;
      }
      return entities.map(e => this.mapEntityToProductLine(e));
    }
    return [];
  }

  /**
   * 更新产品线
   */
  async update(id: string, input: ProductLineUpdateInput): Promise<ProductLine | null> {
    if (!this.productLineRepo) return null;

    const existing = await this.productLineRepo.findById(id);
    if (!existing) return null;

    // 构建更新对象
    const updates: Partial<any> = { updatedAt: new Date() };
    if (input.displayName) updates.displayName = input.displayName;
    if (input.description) updates.description = input.description;
    if (input.branchPolicies) {
      updates.branchMode = input.branchPolicies.mode;
      updates.protectedBranches = input.branchPolicies.protectedBranches ?? existing.protectedBranches;
      updates.codeOwnership = input.branchPolicies.codeOwnership ?? existing.codeOwnership;
      updates.namingConvention = input.branchPolicies.namingConvention ?? existing.namingConvention;
      updates.mergeStrategy = input.branchPolicies.mergeStrategy ?? existing.mergeStrategy;
    }
    if (input.environmentMappings) {
      updates.defaultEnvironment = input.environmentMappings.defaultEnvironment ?? existing.defaultEnvironment;
      updates.environmentMappings = input.environmentMappings.mappings;
      updates.promotionConfig = input.environmentMappings.promotion ?? existing.promotionConfig;
    }
    if (input.environments) updates.environments = input.environments;
    if (input.pipelineTemplates) {
      updates.defaultPipelineTemplate = input.pipelineTemplates.defaultTemplate ?? existing.defaultPipelineTemplate;
      updates.pipelineTemplates = input.pipelineTemplates.templates ?? existing.pipelineTemplates;
    }
    if (input.teamBindings) updates.teamBindings = input.teamBindings;
    if (input.resourceQuotas) updates.resourceQuotas = input.resourceQuotas;
    if (input.notifications) updates.notifications = input.notifications;
    if (input.labels) updates.labels = input.labels;
    if (input.annotations) updates.annotations = input.annotations;

    const entity = await this.productLineRepo.update(id, updates);
    return entity ? this.mapEntityToProductLine(entity) : null;
  }

  /**
   * 删除产品线
   */
  async delete(id: string): Promise<boolean> {
    if (this.productLineRepo) {
      return this.productLineRepo.delete(id);
    }
    return false;
  }

  /**
   * 激活产品线
   */
  async activate(id: string): Promise<ProductLine | null> {
    if (!this.productLineRepo) return null;
    return this.productLineRepo.updatePhase(id, 'Active', [
      { type: 'Activated', status: 'True', reason: 'ManualActivation', message: 'Product line activated manually' }
    ]).then(e => e ? this.mapEntityToProductLine(e) : null);
  }

  /**
   * 暂停产品线
   */
  async suspend(id: string): Promise<ProductLine | null> {
    if (!this.productLineRepo) return null;
    return this.productLineRepo.updatePhase(id, 'Suspended', [
      { type: 'Suspended', status: 'True', reason: 'ManualSuspension', message: 'Product line suspended manually' }
    ]).then(e => e ? this.mapEntityToProductLine(e) : null);
  }

  // ==================== Branch-Environment Mapping ====================

  /**
   * 根据分支名称找到对应的环境
   */
  async resolveEnvironment(productLineId: string, branchName: string): Promise<EnvironmentName | undefined> {
    const productLine = await this.getById(productLineId);
    if (!productLine) return undefined;

    const mappings = productLine.environmentMappings.mappings;
    // 按优先级排序（priority越小优先级越高）
    const sortedMappings = mappings.sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));

    for (const mapping of sortedMappings) {
      if (this.matchesBranch(branchName, mapping.branch, mapping.patternType)) {
        return mapping.environment;
      }
    }

    // 返回默认环境
    return productLine.environmentMappings.defaultEnvironment ?? 'dev';
  }

  /**
   * 检查是否需要审批
   */
  async requiresApproval(productLineId: string, branchName: string): Promise<boolean> {
    const productLine = await this.getById(productLineId);
    if (!productLine) return true;

    const mappings = productLine.environmentMappings.mappings;
    for (const mapping of mappings) {
      if (this.matchesBranch(branchName, mapping.branch, mapping.patternType)) {
        return mapping.requireApproval ?? true;
      }
    }
    return true;
  }

  /**
   * 分支匹配逻辑
   */
  private matchesBranch(branchName: string, pattern: string, patternType: string): boolean {
    switch (patternType) {
      case 'exact':
        return branchName === pattern;
      case 'glob': {
        // 简化的 glob 匹配：只支持 * 通配符
        const globRegex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${globRegex}$`).test(branchName);
      }
      case 'regex':
        return new RegExp(pattern).test(branchName);
      default:
        return branchName === pattern;
    }
  }

  // ==================== ReleaseTrain ====================

  /**
   * 创建发布列车
   */
  async createReleaseTrain(productLineId: string, input: {
    name: string;
    schedule: string;
    targetBranch?: string;
    sourceBranch?: string;
    autoPromote?: boolean;
    approvalRequired?: boolean;
    approvers?: string[];
    preChecks?: any[];
    postActions?: any[];
  }): Promise<ReleaseTrain> {
    if (!this.releaseTrainRepo) throw new OrionError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE);

    const entity = await this.releaseTrainRepo.create({
      productLineId,
      name: input.name,
      schedule: input.schedule,
      targetBranch: input.targetBranch ?? 'production',
      sourceBranch: input.sourceBranch ?? 'main',
      autoPromote: input.autoPromote ?? false,
      approvalRequired: input.approvalRequired ?? true,
      approvers: input.approvers ?? [],
      preChecks: input.preChecks ?? [],
      postActions: input.postActions ?? [],
      lastRun: null,
      nextRun: null,
      state: 'Idle',
      lastRelease: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info({ releaseTrainId: entity.id, productLineId }, 'ReleaseTrain created');
    return {
      id: entity.id,
      productLineId: entity.productLineId,
      name: entity.name,
      schedule: entity.schedule,
      targetBranch: entity.targetBranch,
      sourceBranch: entity.sourceBranch,
      autoPromote: entity.autoPromote,
      approvalRequired: entity.approvalRequired,
      approvers: entity.approvers,
      preChecks: entity.preChecks,
      postActions: entity.postActions,
      status: {
        state: entity.state as 'Idle' | 'Running' | 'Completed' | 'Failed' | 'Skipped',
        lastRun: entity.lastRun ?? undefined,
        nextRun: entity.nextRun ?? undefined,
        lastRelease: entity.lastRelease ?? undefined,
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * 获取产品线的发布列车
   */
  async getReleaseTrains(productLineId: string): Promise<ReleaseTrain[]> {
    if (!this.releaseTrainRepo) return [];
    const entities = await this.releaseTrainRepo.findByProductLine(productLineId);
    return entities.map(e => ({
      id: e.id, productLineId: e.productLineId, name: e.name, schedule: e.schedule,
      targetBranch: e.targetBranch, sourceBranch: e.sourceBranch, autoPromote: e.autoPromote,
      approvalRequired: e.approvalRequired, approvers: e.approvers, preChecks: e.preChecks,
      postActions: e.postActions,
      status: {
        state: e.state as 'Idle' | 'Running' | 'Completed' | 'Failed' | 'Skipped',
        lastRun: e.lastRun ?? undefined,
        nextRun: e.nextRun ?? undefined,
        lastRelease: e.lastRelease ?? undefined,
      },
      createdAt: e.createdAt, updatedAt: e.updatedAt,
    }));
  }

  // ==================== HotfixChannel ====================

  /**
   * 创建紧急修复通道
   */
  async createHotfixChannel(productLineId: string, input: {
    name: string;
    enabled?: boolean;
    branchPattern?: string;
    skipStages?: string[];
    requiredStages?: string[];
    approvalRequired?: boolean;
    approvalTimeout?: number;
    autoMerge?: boolean;
    notifyOnCall?: boolean;
    maxDuration?: number;
  }): Promise<HotfixChannel> {
    if (!this.hotfixChannelRepo) throw new OrionError('Database not configured', ErrorCode.SERVICE_UNAVAILABLE);

    const entity = await this.hotfixChannelRepo.create({
      productLineId,
      name: input.name,
      enabled: input.enabled ?? true,
      branchPattern: input.branchPattern ?? '^hotfix/.*$',
      skipStages: input.skipStages ?? [],
      requiredStages: input.requiredStages ?? [],
      approvalRequired: input.approvalRequired ?? true,
      approvalTimeout: input.approvalTimeout ?? 30,
      autoMerge: input.autoMerge ?? false,
      notifyOnCall: input.notifyOnCall ?? true,
      maxDuration: input.maxDuration ?? 60,
      activeHotfixes: 0,
      lastHotfix: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info({ hotfixChannelId: entity.id, productLineId }, 'HotfixChannel created');
    return {
      id: entity.id, productLineId: entity.productLineId, name: entity.name,
      enabled: entity.enabled, branchPattern: entity.branchPattern, skipStages: entity.skipStages,
      requiredStages: entity.requiredStages, approvalRequired: entity.approvalRequired,
      approvalTimeout: entity.approvalTimeout, autoMerge: entity.autoMerge, notifyOnCall: entity.notifyOnCall,
      maxDuration: entity.maxDuration, status: { activeHotfixes: entity.activeHotfixes, lastHotfix: entity.lastHotfix ?? undefined },
      createdAt: entity.createdAt, updatedAt: entity.updatedAt,
    };
  }

  /**
   * 获取产品线的紧急修复通道
   */
  async getHotfixChannels(productLineId: string): Promise<HotfixChannel[]> {
    if (!this.hotfixChannelRepo) return [];
    const entities = await this.hotfixChannelRepo.findByProductLine(productLineId);
    return entities.map(e => ({
      id: e.id, productLineId: e.productLineId, name: e.name,
      enabled: e.enabled, branchPattern: e.branchPattern, skipStages: e.skipStages,
      requiredStages: e.requiredStages, approvalRequired: e.approvalRequired,
      approvalTimeout: e.approvalTimeout, autoMerge: e.autoMerge, notifyOnCall: e.notifyOnCall,
      maxDuration: e.maxDuration, status: { activeHotfixes: e.activeHotfixes, lastHotfix: e.lastHotfix ?? undefined },
      createdAt: e.createdAt, updatedAt: e.updatedAt,
    }));
  }

  /**
   * 检查是否为 Hotfix 分支
   */
  async isHotfixBranch(productLineId: string, branchName: string): Promise<boolean> {
    if (!this.hotfixChannelRepo) return false;
    const channel = await this.hotfixChannelRepo.findEnabled(productLineId);
    if (!channel || !channel.enabled) return false;
    return new RegExp(channel.branchPattern).test(branchName);
  }

  // ==================== 映射函数 ====================

  private mapEntityToProductLine(entity: any): ProductLine {
    return {
      id: entity.id,
      name: entity.name,
      displayName: entity.displayName,
      description: entity.description,
      gitRepo: {
        url: entity.gitUrl,
        provider: entity.gitProvider,
        defaultBranch: entity.gitDefaultBranch,
        credentialRef: entity.gitCredentialRef,
      },
      branchPolicies: {
        mode: entity.branchMode,
        protectedBranches: entity.protectedBranches,
        codeOwnership: entity.codeOwnership,
        namingConvention: entity.namingConvention,
        mergeStrategy: entity.mergeStrategy,
      },
      environmentMappings: {
        defaultEnvironment: entity.defaultEnvironment,
        mappings: entity.environmentMappings,
        promotion: entity.promotionConfig,
      },
      environments: entity.environments,
      pipelineTemplates: {
        defaultTemplate: entity.defaultPipelineTemplate,
        templates: entity.pipelineTemplates,
      },
      teamBindings: entity.teamBindings,
      resourceQuotas: entity.resourceQuotas,
      notifications: entity.notifications,
      labels: entity.labels,
      annotations: entity.annotations,
      status: {
        phase: entity.phase,
        conditions: entity.conditions,
        statistics: entity.statistics,
        gitStatus: entity.gitStatus,
        environments: entity.environmentStatuses,
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      tenantId: entity.tenantId,
    };
  }
}