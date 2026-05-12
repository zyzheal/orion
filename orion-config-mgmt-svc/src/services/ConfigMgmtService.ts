/**
 * Orion Configuration Management Service
 * 配置管理核心服务 - 基于内存的实现
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ConfigItem,
  ConfigVersion,
  ConfigDiff,
  ConfigDrift,
  FeatureFlag,
  ConfigApproval,
  GitOpsConfig,
  ConfigStatus,
  ApprovalStatus,
  FeatureFlagStatus,
  DriftStatus,
} from '../types/config-mgmt';

export class ConfigMgmtService {
  private configs = new Map<string, ConfigItem>();
  private versions = new Map<string, ConfigVersion[]>(); // configId -> versions
  private featureFlags = new Map<string, FeatureFlag>();
  private approvals = new Map<string, ConfigApproval>();

  async getConfig(key: string, environment: string): Promise<ConfigItem | null> {
    const configId = `${key}:${environment}`;
    const config = this.configs.get(configId);
    if (!config || config.status !== 'active') return null;
    return config;
  }

  async updateConfig(key: string, value: Record<string, unknown> | string | number | boolean, changeReason: string, changedBy: string): Promise<ConfigItem | null> {
    const configId = `${key}:production`; // Default env
    const existing = this.configs.get(configId);

    if (!existing) {
      // Create new config
      const newConfig: ConfigItem = {
        id: uuidv4(),
        key,
        value,
        status: ConfigStatus.ACTIVE,
        environment: 'production',
        currentVersion: 1,
        createdBy: changedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.configs.set(configId, newConfig);

      // Create version
      const version: ConfigVersion = {
        id: uuidv4(),
        configId: newConfig.id,
        version: 1,
        value,
        changeReason,
        changedBy,
        createdAt: new Date(),
      };
      this.versions.set(newConfig.id, [version]);
      return newConfig;
    }

    // Update existing
    const currentVersions = this.versions.get(existing.id) || [];
    const newVersion = currentVersions.length + 1;

    const version: ConfigVersion = {
      id: uuidv4(),
      configId: existing.id,
      version: newVersion,
      value,
      changeReason,
      changedBy,
      createdAt: new Date(),
    };
    currentVersions.push(version);
    this.versions.set(existing.id, currentVersions);

    const updated: ConfigItem = {
      ...existing,
      value,
      currentVersion: newVersion,
      updatedAt: new Date(),
    };
    this.configs.set(configId, updated);
    return updated;
  }

  async getVersion(configId: string, version?: number): Promise<ConfigVersion | null> {
    const versions = this.versions.get(configId);
    if (!versions || versions.length === 0) return null;
    if (version) {
      return versions.find(v => v.version === version) || null;
    }
    return versions[versions.length - 1];
  }

  async diffVersions(configId: string, versionA: number, versionB: number): Promise<ConfigDiff[]> {
    const versions = this.versions.get(configId);
    if (!versions) return [];

    const vA = versions.find(v => v.version === versionA);
    const vB = versions.find(v => v.version === versionB);
    if (!vA || !vB) return [];

    const diffs: ConfigDiff[] = [];
    const valA = typeof vA.value === 'object' ? vA.value as Record<string, unknown> : { value: vA.value };
    const valB = typeof vB.value === 'object' ? vB.value as Record<string, unknown> : { value: vB.value };

    const allKeys = new Set([...Object.keys(valA), ...Object.keys(valB)]);
    for (const key of allKeys) {
      if (!(key in valA)) {
        diffs.push({ key, action: 'added', oldValue: undefined, newValue: valB[key] });
      } else if (!(key in valB)) {
        diffs.push({ key, action: 'deleted', oldValue: valA[key], newValue: undefined });
      } else if (JSON.stringify(valA[key]) !== JSON.stringify(valB[key])) {
        diffs.push({ key, action: 'modified', oldValue: valA[key], newValue: valB[key] });
      }
    }
    return diffs;
  }

  async detectDrift(environment: string): Promise<ConfigDrift[]> {
    const drifts: ConfigDrift[] = [];
    for (const config of this.configs.values()) {
      if (config.environment === environment && config.status === 'active') {
        // In production, compare actual runtime config vs expected
        // For now, mark all as in-sync since we're using the same storage
        drifts.push({
          configId: config.id,
          key: config.key,
          environment,
          expectedValue: config.value,
          actualValue: config.value,
          status: DriftStatus.IN_SYNC,
          detectedAt: new Date(),
        });
      }
    }
    return drifts;
  }

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
    if (environment) items = items.filter(f => f.environment === environment);
    return { items: items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), total: items.length };
  }

  async toggleFlag(flagId: string, status: FeatureFlagStatus): Promise<FeatureFlag | null> {
    const existing = this.featureFlags.get(flagId);
    if (!existing) return null;
    const updated: FeatureFlag = { ...existing, status, updatedAt: new Date() };
    this.featureFlags.set(flagId, updated);
    return updated;
  }

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

  async gitOpsSync(tenantId: string): Promise<{ status: string; syncedCount: number }> {
    return { status: 'synced', syncedCount: this.configs.size };
  }
}
