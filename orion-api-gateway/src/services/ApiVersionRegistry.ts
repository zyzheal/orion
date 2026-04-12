/**
 * API 版本注册表
 *
 * 管理所有 API 版本的定义、状态和变更历史
 */

import { EventEmitter } from 'events';

/**
 * 版本状态枚举
 */
export type VersionStatus = 'development' | 'stable' | 'deprecated' | 'retired';

/**
 * 版本定义
 */
export interface VersionDefinition {
  version: string;           // 版本号，如 "v1", "v2"
  status: VersionStatus;      // 版本状态
  releaseDate: Date;         // 发布日期
  deprecationDate?: Date;    // 弃用日期（deprecated 状态时必填）
  sunsetDate?: Date;          // 退役日期（deprecated/retired 状态时必填）
  migrationGuide?: string;   // 迁移指南 URL
  changelog?: string;        // 变更日志
  features: string[];        // 功能列表
  breakingChanges?: string[]; // 破坏性变更列表
  successorVersion?: string;  // 后继版本
}

/**
 * 版本变更记录
 */
export interface VersionChangeRecord {
  version: string;
  fromStatus: VersionStatus;
  toStatus: VersionStatus;
  changedAt: Date;
  changedBy?: string;
  reason?: string;
}

/**
 * 弃用公告
 */
export interface DeprecationNotice {
  version: string;
  warning: string;
  deprecationDate: Date;
  sunsetDate: Date;
  migrationGuide?: string;
  createdAt: Date;
}

/**
 * 版本注册表配置
 */
export interface ApiVersionRegistryConfig {
  currentVersion: string;      // 当前最新版本
  defaultVersion: string;      // 默认版本
  supportedVersions: string[]; // 支持的版本列表
}

/**
 * API 版本注册表
 *
 * 管理所有 API 版本的生命周期
 */
export class ApiVersionRegistry extends EventEmitter {
  private versions: Map<string, VersionDefinition> = new Map();
  private changeHistory: VersionChangeRecord[] = [];
  private deprecationNotices: Map<string, DeprecationNotice> = new Map();
  private config: ApiVersionRegistryConfig;

  constructor(config?: Partial<ApiVersionRegistryConfig>) {
    super();
    this.config = {
      currentVersion: config?.currentVersion || 'v1',
      defaultVersion: config?.defaultVersion || 'v1',
      supportedVersions: config?.supportedVersions || ['v1'],
    };
  }

  /**
   * 注册版本
   */
  registerVersion(definition: Omit<VersionDefinition, 'releaseDate'> & { releaseDate?: Date }): VersionDefinition {
    const version: VersionDefinition = {
      ...definition,
      releaseDate: definition.releaseDate || new Date(),
    };

    // 验证版本格式
    if (!this.isValidVersionFormat(version.version)) {
      throw new Error(`Invalid version format: ${version.version}. Expected format: vX`);
    }

    // 验证状态转换
    const existing = this.versions.get(version.version);
    if (existing) {
      this.validateStatusTransition(existing.status, version.status);
      this.recordChange(existing.status, version.status, version.version);
    }

    this.versions.set(version.version, version);

    // 如果是弃用状态，创建弃用公告
    if (version.status === 'deprecated') {
      this.createDeprecationNotice(version);
    }

    this.emit('version:registered', version);
    return version;
  }

  /**
   * 获取版本定义
   */
  getVersion(version: string): VersionDefinition | undefined {
    return this.versions.get(version);
  }

  /**
   * 获取所有版本
   */
  getAllVersions(): VersionDefinition[] {
    return Array.from(this.versions.values());
  }

  /**
   * 获取指定状态的版本
   */
  getVersionsByStatus(status: VersionStatus): VersionDefinition[] {
    return this.getAllVersions().filter(v => v.status === status);
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): VersionDefinition | undefined {
    return this.versions.get(this.config.currentVersion);
  }

  /**
   * 获取默认版本
   */
  getDefaultVersion(): VersionDefinition | undefined {
    return this.versions.get(this.config.defaultVersion);
  }

  /**
   * 获取支持的版本列表
   */
  getSupportedVersions(): VersionDefinition[] {
    return this.config.supportedVersions
      .map(v => this.versions.get(v))
      .filter((v): v is VersionDefinition => v !== undefined);
  }

  /**
   * 更新版本状态
   */
  updateVersionStatus(
    version: string,
    newStatus: VersionStatus,
    options?: {
      deprecationDate?: Date;
      sunsetDate?: Date;
      migrationGuide?: string;
      changedBy?: string;
      reason?: string;
    }
  ): VersionDefinition {
    const existing = this.versions.get(version);
    if (!existing) {
      throw new Error(`Version not found: ${version}`);
    }

    // 验证状态转换
    this.validateStatusTransition(existing.status, newStatus);

    const previousStatus = existing.status;
    const updated: VersionDefinition = {
      ...existing,
      status: newStatus,
    };

    // 根据新状态设置相关字段
    if (newStatus === 'deprecated') {
      if (!options?.deprecationDate || !options?.sunsetDate) {
        throw new Error('Deprecation date and sunset date are required for deprecated status');
      }
      updated.deprecationDate = options.deprecationDate;
      updated.sunsetDate = options.sunsetDate;
      updated.migrationGuide = options.migrationGuide;
    }

    if (newStatus === 'retired') {
      if (!existing.sunsetDate && !options?.sunsetDate) {
        throw new Error('Sunset date is required for retired status');
      }
      if (options?.sunsetDate) {
        updated.sunsetDate = options.sunsetDate;
      }
    }

    this.versions.set(version, updated);
    this.recordChange(previousStatus, newStatus, version, options?.changedBy, options?.reason);

    // 创建弃用公告
    if (newStatus === 'deprecated') {
      this.createDeprecationNotice(updated);
    }

    this.emit('version:status:changed', { previousStatus, newStatus, version: updated });
    return updated;
  }

  /**
   * 检查版本是否存在
   */
  hasVersion(version: string): boolean {
    return this.versions.has(version);
  }

  /**
   * 检查版本是否支持
   */
  isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  /**
   * 检查版本是否活跃（非 retired）
   */
  isVersionActive(version: string): boolean {
    const v = this.versions.get(version);
    return v !== undefined && v.status !== 'retired';
  }

  /**
   * 检查版本是否弃用
   */
  isVersionDeprecated(version: string): boolean {
    const v = this.versions.get(version);
    return v?.status === 'deprecated';
  }

  /**
   * 获取弃用公告
   */
  getDeprecationNotice(version: string): DeprecationNotice | undefined {
    return this.deprecationNotices.get(version);
  }

  /**
   * 获取所有弃用公告
   */
  getAllDeprecationNotices(): DeprecationNotice[] {
    return Array.from(this.deprecationNotices.values());
  }

  /**
   * 获取版本变更历史
   */
  getVersionHistory(version?: string): VersionChangeRecord[] {
    if (version) {
      return this.changeHistory.filter(r => r.version === version);
    }
    return [...this.changeHistory];
  }

  /**
   * 解析版本字符串
   */
  parseVersion(versionString: string): string | null {
    // 支持多种格式: v1, V1, 1, /v1/
    const match = versionString.match(/[vV]?(\d+)/);
    if (match) {
      return `v${match[1]}`;
    }
    return null;
  }

  /**
   * 比较版本
   */
  compareVersions(v1: string, v2: string): number {
    const num1 = parseInt(v1.replace(/[^\d]/g, ''), 10);
    const num2 = parseInt(v2.replace(/[^\d]/g, ''), 10);
    return num1 - num2;
  }

  /**
   * 获取配置
   */
  getConfig(): ApiVersionRegistryConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ApiVersionRegistryConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config:updated', this.config);
  }

  // ==================== 私有方法 ====================

  /**
   * 验证版本格式
   */
  private isValidVersionFormat(version: string): boolean {
    return /^v\d+$/.test(version);
  }

  /**
   * 验证状态转换
   */
  private validateStatusTransition(from: VersionStatus, to: VersionStatus): void {
    const validTransitions: Record<VersionStatus, VersionStatus[]> = {
      development: ['stable', 'deprecated', 'retired'],
      stable: ['deprecated', 'retired'],
      deprecated: ['retired'],
      retired: [],
    };

    if (!validTransitions[from].includes(to)) {
      throw new Error(`Invalid status transition: ${from} -> ${to}`);
    }
  }

  /**
   * 记录变更
   */
  private recordChange(
    fromStatus: VersionStatus,
    toStatus: VersionStatus,
    version: string,
    changedBy?: string,
    reason?: string
  ): void {
    const record: VersionChangeRecord = {
      version,
      fromStatus,
      toStatus,
      changedAt: new Date(),
      changedBy,
      reason,
    };
    this.changeHistory.push(record);
  }

  /**
   * 创建弃用公告
   */
  private createDeprecationNotice(version: VersionDefinition): void {
    if (!version.deprecationDate || !version.sunsetDate) {
      return;
    }

    const notice: DeprecationNotice = {
      version: version.version,
      warning: `API version ${version.version} is deprecated`,
      deprecationDate: version.deprecationDate,
      sunsetDate: version.sunsetDate,
      migrationGuide: version.migrationGuide,
      createdAt: new Date(),
    };

    this.deprecationNotices.set(version.version, notice);
    this.emit('deprecation:notice', notice);
  }
}

// 默认导出
export const versionRegistry = new ApiVersionRegistry();