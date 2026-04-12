/**
 * CMDB 类型定义
 */

/**
 * 配置项 (CI) 类型
 */
export type CiType =
  | 'APPLICATION'
  | 'SERVICE'
  | 'DATABASE'
  | 'SERVER'
  | 'CONTAINER'
  | 'K8S_CLUSTER'
  | 'K8S_DEPLOYMENT'
  | 'K8S_POD'
  | 'NETWORK'
  | 'LOAD_BALANCER'
  | 'STORAGE'
  | 'MIDDLEWARE'
  | 'PIPELINE'
  | 'ENVIRONMENT';

/**
 * 配置项状态
 */
export type CiStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DECOMMISSIONED'
  | 'PENDING'
  | 'MAINTENANCE';

/**
 * 关联关系类型
 */
export type RelationType =
  | 'DEPENDS_ON'
  | 'HOSTED_ON'
  | 'CONNECTS_TO'
  | 'BELONGS_TO'
  | 'USES'
  | 'CONTAINS'
  | 'VERSION_OF'
  | 'DEPLOYED_TO'
  | 'MONITORED_BY';

/**
 * 配置项基础信息
 */
export interface CIBase {
  tenantId: bigint;
  ciType: CiType;
  name: string;
  description?: string;
  status?: CiStatus;
  environment?: string;
  tags?: string[];
  attributes?: Record<string, any>;
  createdBy: string;
}

/**
 * 配置项
 */
export interface CI extends CIBase {
  id: string;
  ciId: string;
  version: number;
  relations?: CIRelation[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * 创建配置项输入
 */
export interface CreateCIInput extends CIBase {
  ciId: string;
  attributes?: Record<string, any>;
}

/**
 * 更新配置项输入
 */
export interface UpdateCIInput {
  description?: string;
  status?: CiStatus;
  environment?: string;
  tags?: string[];
  attributes?: Record<string, any>;
}

/**
 * 配置项关联关系
 */
export interface CIRelation {
  id: string;
  fromCiId: string;
  toCiId: string;
  relationType: RelationType;
  description?: string;
  createdBy: string;
  createdAt: Date;
  deletedAt?: Date;
}

/**
 * 创建关联关系输入
 */
export interface CreateRelationInput {
  fromCiId: string;
  toCiId: string;
  relationType: RelationType;
  description?: string;
}

/**
 * 配置项版本
 */
export interface CIVersion {
  id: string;
  ciId: string;
  version: number;
  changes: string;
  data: Record<string, any>;
  createdBy: string;
  createdAt: Date;
}

/**
 * 查询配置项过滤器
 */
export interface CIFilters {
  tenantId: bigint;
  ciType?: CiType;
  status?: CiStatus;
  environment?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

/**
 * 配置项列表响应
 */
export interface CIListResponse {
  data: CI[];
  total: number;
  limit: number;
  offset: number;
}
