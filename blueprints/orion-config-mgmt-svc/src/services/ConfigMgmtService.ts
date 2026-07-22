/**
 * Orion Configuration Management Service
 * 配置管理核心服务 - 基于 PostgreSQL Repository 实现
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../utils/database';
import { ConfigRepository, ConfigItemEntity, ConfigVersionEntity } from '../repositories/ConfigRepository';
import { NamespaceRepository, NamespaceEntity } from '../repositories/NamespaceRepository';
import {
  ConfigItem,
  ConfigVersion,
  ConfigDiff,
  ConfigDrift,
  FeatureFlag,
  ConfigApproval,
  ConfigStatus,
  ConfigItemType,
  ApprovalStatus,
  FeatureFlagStatus,
  DriftStatus,
} from '../types/config-mgmt';

export class ConfigMgmtService {
  private db: DatabasePool;
  private configRepo: ConfigRepository;
  private namespaceRepo: NamespaceRepository;

  // Fallback in-memory stores for non-config features (feature flags, approvals)
  private featureFlags = new Map<string, FeatureFlag>();
  private approvals = new Map<string, ConfigApproval>();

  constructor(db: DatabasePool) {
    this.db = db;
    this.configRepo = new ConfigRepository(db);
    this.namespaceRepo = new NamespaceRepository(db);
  }

  // ==================== Namespace Management ====================

  /**
   * Create a new config namespace
   */
  async createNamespace(data: {
    name: string;
    description?: string;
    gitRepoUrl?: string;
    branch?: string;
  }): Promise<NamespaceEntity> {
    return this.namespaceRepo.create(data);
  }

  /**
   * List all config namespaces
   */
  async listNamespaces(): Promise<NamespaceEntity[]> {
    return this.namespaceRepo.findAll();
  }

  // ==================== Config Management ====================

  /**
   * Set config value (creates or updates, auto-versioning)
   */
  async setConfig(data: {
    key: string;
    namespace: string;
    value: Record<string, unknown> | string | number | boolean;
    createdBy: string;
    commitMessage?: string;
    environment?: string;
  }): Promise<{ config: ConfigItem; version: ConfigVersion }> {
    const result = await this.configRepo.setConfig({
      ...data,
      tenantId: 'system',
    });
    return {
      config: this.entityToConfigItem(result.config),
      version: this.entityToConfigVersion(result.version),
    };
  }

  /**
   * Get current config by key
   */
  async getConfig(key: string, namespace: string, environment: string = 'production'): Promise<ConfigItem | null> {
    const entity = await this.configRepo.getConfig(key, namespace, environment);
    if (!entity) return null;
    return this.entityToConfigItem(entity);
  }

  /**
   * List configs with optional filters
   */
  async listConfigs(filters?: {
    namespace?: string;
    environment?: string;
    status?: string;
  }): Promise<ConfigItem[]> {
    const entities = await this.configRepo.listConfigs(filters);
    return entities.map((e) => this.entityToConfigItem(e));
  }

  // ==================== Version Management ====================

  /**
   * Get a specific version (or latest)
   */
  async getVersion(configKey: string, namespace: string, version?: number): Promise<ConfigVersion | null> {
    const entity = await this.configRepo.getVersion(configKey, namespace, version);
    if (!entity) return null;
    return this.entityToConfigVersion(entity);
  }

  /**
   * List all versions for a config
   */
  async listVersions(configKey: string, namespace: string): Promise<ConfigVersion[]> {
    const entities = await this.configRepo.listVersions(configKey, namespace);
    return entities.map((e) => this.entityToConfigVersion(e));
  }

  /**
   * Rollback to a specific version
   */
  async rollback(configKey: string, namespace: string, targetVersion: number, createdBy: string): Promise<{ config: ConfigItem; version: ConfigVersion } | null> {
    const result = await this.configRepo.rollback(configKey, namespace, targetVersion, createdBy);
    if (!result) return null;
    return {
      config: this.entityToConfigItem(result.config),
      version: this.entityToConfigVersion(result.version),
    };
  }

  /**
   * Diff between two versions
   */
  async diff(configKey: string, namespace: string, versionA: number, versionB: number): Promise<Record<string, unknown> | null> {
    return this.configRepo.diff(configKey, namespace, versionA, versionB);
  }

  // ==================== Legacy Methods (compatibility) ====================

  /**
   * Archive config by key
   */
  async archiveConfig(key: string, namespace: string, environment: string = 'production'): Promise<ConfigItem | null> {
    const entity = await this.configRepo.getConfig(key, namespace, environment);
    if (!entity) return null;

    const result = await this.db.query(
      `UPDATE config_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      ['archived', entity.id],
    );
    if (result.rows.length === 0) return null;
    return this.entityToConfigRow(result.rows[0]);
  }

  /**
   * Detect config drift (stub - would compare against actual infrastructure)
   */
  async detectDrift(environment: string): Promise<ConfigDrift[]> {
    const items = await this.configRepo.listConfigs({ environment, status: 'active' });
    return items.map((item) => ({
      id: uuidv4(),
      configId: item.id,
      expectedValue: item.value as Record<string, unknown>,
      actualValue: item.value as Record<string, unknown>,
      status: DriftStatus.IN_SYNC,
      driftedFields: [],
      detectedAt: new Date(),
      tenantId: item.tenantId,
    }));
  }

  // ==================== Feature Flags (in-memory for now) ====================

  async createFeatureFlag(data: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const flag: FeatureFlag = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.featureFlags.set(flag.id, flag);
    return flag;
  }

  async listFeatureFlags(environment?: string): Promise<{ items: FeatureFlag[]; total: number }> {
    let items = Array.from(this.featureFlags.values());
    if (environment) items = items.filter((f) => f.environment === environment);
    return { items: items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), total: items.length };
  }

  async toggleFlag(flagId: string, status: FeatureFlagStatus): Promise<FeatureFlag | null> {
    const existing = this.featureFlags.get(flagId);
    if (!existing) return null;
    const updated: FeatureFlag = { ...existing, status, updatedAt: new Date() };
    this.featureFlags.set(flagId, updated);
    return updated;
  }

  // ==================== Approvals (in-memory for now) ====================

  async createApproval(data: Omit<ConfigApproval, 'id' | 'createdAt'>): Promise<ConfigApproval> {
    const approval: ConfigApproval = {
      ...data,
      id: uuidv4(),
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async getApproval(approvalId: string): Promise<ConfigApproval | null> {
    return this.approvals.get(approvalId) || null;
  }

  async decideApproval(approvalId: string, decision: 'approved' | 'rejected', comments: string, decidedBy: string): Promise<ConfigApproval | null> {
    const existing = this.approvals.get(approvalId);
    if (!existing) return null;
    const updated: ConfigApproval = {
      ...existing,
      status: decision === 'approved' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      comments,
      decidedBy,
      decidedAt: new Date(),
    };
    this.approvals.set(approvalId, updated);
    return updated;
  }

  // ==================== GitOps (stub) ====================

  async gitOpsSync(tenantId: string): Promise<{ status: string; syncedCount: number }> {
    return { status: 'not_implemented', syncedCount: 0 };
  }

  // ==================== Entity Mapping ====================

  private entityToConfigItem(entity: ConfigItemEntity): ConfigItem {
    return {
      id: entity.id,
      key: entity.key,
      value: entity.value,
      itemType: ConfigItemType.APPLICATION,
      status: entity.status as ConfigStatus,
      environment: entity.environment,
      currentVersion: entity.currentVersion,
      tenantId: entity.tenantId,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private entityToConfigVersion(entity: ConfigVersionEntity): ConfigVersion {
    return {
      id: entity.id,
      configId: entity.configKey,
      version: entity.version,
      value: entity.value,
      changeReason: entity.commitMessage || undefined,
      changedBy: entity.createdBy,
      createdAt: entity.createdAt,
    };
  }

  private entityToConfigRow(row: any): ConfigItem {
    return {
      id: row.id,
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      itemType: ConfigItemType.APPLICATION,
      status: row.status,
      environment: row.environment,
      currentVersion: row.current_version,
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
