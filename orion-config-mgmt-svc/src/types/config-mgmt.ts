/**
 * Orion Configuration Management Service - Type Definitions
 * 配置管理服务完整类型定义
 */

// ============================================================
// 基础枚举
// ============================================================

/** 配置项类型 */
export enum ConfigItemType {
  APPLICATION = 'application',
  DATABASE = 'database',
  INFRASTRUCTURE = 'infrastructure',
  FEATURE_FLAG = 'feature_flag',
  ENVIRONMENT = 'environment',
  SERVICE = 'service',
}

/** 配置状态 */
export enum ConfigStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

/** 审批状态 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/** 特性开关状态 */
export enum FeatureFlagStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  PARTIAL = 'partial',
}

/** 漂移状态 */
export enum DriftStatus {
  IN_SYNC = 'in_sync',
  DRIFTED = 'drifted',
  UNKNOWN = 'unknown',
}

// ============================================================
// 核心类型
// ============================================================

/** 配置项 */
export interface ConfigItem {
  /** 配置 ID */
  id: string;
  /** 配置键 */
  key: string;
  /** 配置值 (JSON) */
  value: Record<string, unknown> | string | number | boolean;
  /** 配置类型 */
  itemType: ConfigItemType;
  /** 配置状态 */
  status: ConfigStatus;
  /** 描述 */
  description?: string;
  /** 所属应用/服务 */
  appId?: string;
  /** 环境 */
  environment: string;
  /** 当前版本号 */
  currentVersion: number;
  /** 租户 ID */
  tenantId: string;
  /** 创建人 */
  createdBy: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 配置版本 */
export interface ConfigVersion {
  /** 版本 ID */
  id: string;
  /** 配置 ID */
  configId: string;
  /** 版本号 */
  version: number;
  /** 版本值 */
  value: Record<string, unknown> | string | number | boolean;
  /** 变更说明 */
  changeReason?: string;
  /** 变更人 */
  changedBy: string;
  /** 关联审批 ID */
  approvalId?: string;
  /** 创建时间 */
  createdAt: Date;
}

/** 配置差异 */
export interface ConfigDiff {
  /** 差异 ID */
  id: string;
  /** 配置键 */
  key: string;
  /** 旧值 */
  oldValue?: Record<string, unknown> | string | number | boolean;
  /** 新值 */
  newValue: Record<string, unknown> | string | number | boolean;
  /** 差异类型 */
  diffType: 'added' | 'removed' | 'modified';
  /** 差异路径 (嵌套对象) */
  path?: string;
}

/** 配置漂移 */
export interface ConfigDrift {
  /** 漂移 ID */
  id: string;
  /** 配置 ID */
  configId: string;
  /** 期望值 */
  expectedValue: Record<string, unknown>;
  /** 实际值 */
  actualValue: Record<string, unknown>;
  /** 漂移状态 */
  status: DriftStatus;
  /** 漂移字段列表 */
  driftedFields: string[];
  /** 检测时间 */
  detectedAt: Date;
  /** 租户 ID */
  tenantId: string;
}

/** 特性开关 */
export interface FeatureFlag {
  /** 特性开关 ID */
  id: string;
  /** 特性键 */
  key: string;
  /** 特性名称 */
  name: string;
  /** 特性描述 */
  description?: string;
  /** 状态 */
  status: FeatureFlagStatus;
  /** 目标用户百分比 (灰度) */
  rolloutPercentage?: number;
  /** 目标用户列表 (白名单) */
  targetUserIds?: string[];
  /** 所属应用 */
  appId?: string;
  /** 环境 */
  environment: string;
  /** 创建人 */
  createdBy: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 配置审批 */
export interface ConfigApproval {
  /** 审批 ID */
  id: string;
  /** 审批标题 */
  title: string;
  /** 审批描述 */
  description?: string;
  /** 审批状态 */
  status: ApprovalStatus;
  /** 配置变更内容 */
  changes: ConfigDiff[];
  /** 申请人 */
  requesterId: string;
  /** 审批人 */
  approverIds: string[];
  /** 审批意见 */
  comments?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 审批时间 */
  decidedAt?: Date;
  /** 租户 ID */
  tenantId: string;
}

/** GitOps 配置 */
export interface GitOpsConfig {
  /** 配置 ID */
  id: string;
  /** Git 仓库 URL */
  repoUrl: string;
  /** 分支 */
  branch: string;
  /** 配置路径 */
  configPath: string;
  /** 同步策略 */
  syncStrategy: 'auto' | 'manual' | 'dry_run';
  /** 上次同步 commit */
  lastSyncCommit?: string;
  /** 上次同步时间 */
  lastSyncAt?: Date;
  /** 同步状态 */
  syncStatus: 'synced' | 'pending' | 'error';
  /** 租户 ID */
  tenantId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}
