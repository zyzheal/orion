/**
 * Orion CMDB Service - Type Definitions
 * CMDB 服务完整类型定义
 */

// ============================================================
// 基础枚举
// ============================================================

/** 节点类型 */
export enum CmdbNodeType {
  APPLICATION = 'application',
  SERVICE = 'service',
  DATABASE = 'database',
  SERVER = 'server',
  CONTAINER = 'container',
  NETWORK = 'network',
  STORAGE = 'storage',
  CONFIG = 'config',
}

/** 节点状态 */
export enum CmdbNodeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DECOMMISSIONED = 'decommissioned',
  MAINTENANCE = 'maintenance',
  ERROR = 'error',
}

/** 对账状态 */
export enum ReconciliationStatus {
  SYNCED = 'synced',
  DRIFT_DETECTED = 'drift_detected',
  MISSING_IN_CMDB = 'missing_in_cmdb',
  MISSING_IN_K8S = 'missing_in_k8s',
  CONFLICT = 'conflict',
}

// ============================================================
// 核心类型
// ============================================================

/** CMDB 节点 (配置项 CI) */
export interface CmdbNode {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点类型 */
  type: CmdbNodeType;
  /** 节点状态 */
  status: CmdbNodeStatus;
  /** 所属应用 ID */
  applicationId?: string;
  /** 父节点 ID */
  parentId?: string;
  /** 节点属性 (JSON) */
  attributes: Record<string, unknown>;
  /** 标签 */
  tags: string[];
  /** 描述 */
  description?: string;
  /** 负责人 */
  ownerId?: string;
  /** 环境 (dev/staging/prod) */
  environment: string;
  /** 租户 ID */
  tenantId: string;
  /** K8s 资源名称 (如适用) */
  k8sResourceName?: string;
  /** K8s 命名空间 */
  k8sNamespace?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** CMDB 应用 */
export interface CmdbApplication {
  /** 应用 ID */
  id: string;
  /** 应用名称 */
  name: string;
  /** 应用编码 */
  code: string;
  /** 描述 */
  description?: string;
  /** 负责人 */
  ownerId: string;
  /** 团队成员 */
  teamIds: string[];
  /** 关联节点 ID 列表 */
  nodeIds: string[];
  /** 依赖的应用 ID 列表 */
  dependencyIds: string[];
  /** 业务线 */
  businessLine?: string;
  /** 环境 */
  environment: string;
  /** 租户 ID */
  tenantId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** CMDB 拓扑关系 */
export interface CmdbTopology {
  /** 拓扑 ID */
  id: string;
  /** 源节点 ID */
  sourceNodeId: string;
  /** 目标节点 ID */
  targetNodeId: string;
  /** 关系类型 */
  relationType: 'depends_on' | 'hosts' | 'connected_to' | 'manages' | 'monitors';
  /** 关系属性 */
  attributes: Record<string, unknown>;
  /** 描述 */
  description?: string;
  /** 创建时间 */
  createdAt: Date;
}

/** 对账结果 */
export interface CmdbReconciliation {
  /** 对账 ID */
  id: string;
  /** 对账名称 */
  name: string;
  /** 对账类型 */
  reconciliationType: 'k8s' | 'cloud' | 'manual';
  /** 对账状态 */
  status: ReconciliationStatus;
  /** 差异详情 */
  diffs: ReconciliationDiff[];
  /** 同步的节点数量 */
  reconciledCount: number;
  /** 发现的差异数量 */
  driftCount: number;
  /** 执行者 */
  executorId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间 */
  completedAt?: Date;
}

/** 对账差异 */
export interface ReconciliationDiff {
  /** 差异 ID */
  id: string;
  /** 差异类型 */
  type: 'missing' | 'extra' | 'modified';
  /** 节点 ID */
  nodeId?: string;
  /** K8s 资源名称 */
  k8sResourceName: string;
  /** CMDB 中的值 */
  cmdbValue?: Record<string, unknown>;
  /** K8s 中的值 */
  k8sValue: Record<string, unknown>;
  /** 差异字段 */
  changedFields: string[];
}
