/**
 * Alert 类型定义
 */

/**
 * 告警级别
 */
export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

/**
 * 告警状态
 */
export enum AlertStatus {
  FIRING = 'firing',
  RESOLVED = 'resolved',
  SILENCED = 'silenced',
  SUPPRESSED = 'suppressed',
  ACKNOWLEDGED = 'acknowledged',
}

/**
 * 告警来源类型
 */
export enum AlertSourceType {
  NODE = 'node',
  DATABASE = 'database',
  NETWORK = 'network',
  APPLICATION = 'application',
  SERVICE = 'service',
  INFRASTRUCTURE = 'infrastructure',
  CUSTOM = 'custom',
}

/**
 * 告警标签
 */
export interface AlertLabels {
  [key: string]: string;
}

/**
 * 告警注解
 */
export interface AlertAnnotations {
  summary?: string;
  description?: string;
  runbookUrl?: string;
  [key: string]: string | undefined;
}

/**
 * 告警
 */
export interface Alert {
  id: string;
  fingerprint: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  sourceType: AlertSourceType;
  sourceId: string;
  sourceName: string;
  labels: AlertLabels;
  annotations: AlertAnnotations;
  value: number;
  threshold: number;
  startsAt: Date;
  endsAt?: Date;
  resolvedAt?: Date;
  silencedAt?: Date;
  suppressedAt?: Date;
  suppressedReason?: string;
  rootCauseAlertId?: string;
  relatedAlertIds?: string[];
  maintenanceWindowId?: string;
  knownIssueId?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建告警输入
 */
export interface CreateAlertInput {
  name: string;
  severity: AlertSeverity;
  sourceType: AlertSourceType;
  sourceId: string;
  sourceName: string;
  labels?: AlertLabels;
  annotations?: AlertAnnotations;
  value: number;
  threshold: number;
  tenantId: string;
}

/**
 * 维护窗口
 */
export interface MaintenanceWindow {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  startTime: Date;
  endTime: Date;
  scope: {
    sourceTypes?: AlertSourceType[];
    sourceIds?: string[];
    labelSelectors?: Record<string, string>;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 已知问题
 */
export interface KnownIssue {
  id: string;
  title: string;
  description?: string;
  tenantId: string;
  fingerprintPattern?: string;
  labelSelectors?: Record<string, string>;
  silenceDuration: number; // 静默时长（毫秒）
  status: 'open' | 'resolved';
  resolvedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 告警拓扑节点
 */
export interface AlertTopologyNode {
  id: string;
  type: AlertSourceType;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  parentId?: string;
  childrenIds?: string[];
}

/**
 * 告警拓扑边
 */
export interface AlertTopologyEdge {
  source: string;
  target: string;
  relationType: 'depends_on' | 'runs_on' | 'connected_to';
}

/**
 * 告警拓扑图
 */
export interface AlertTopologyGraph {
  nodes: AlertTopologyNode[];
  edges: AlertTopologyEdge[];
}

/**
 * 抑制规则类型
 */
export enum SuppressionRuleType {
  MAINTENANCE_WINDOW = 'maintenance_window',
  NODE_FAILURE = 'node_failure',
  DATABASE_FAILURE = 'database_failure',
  NETWORK_FAILURE = 'network_failure',
  ROOT_CAUSE = 'root_cause',
  DUPLICATION = 'duplication',
  KNOWN_ISSUE = 'known_issue',
}

/**
 * 抑制规则结果
 */
export interface SuppressionResult {
  suppressed: boolean;
  ruleType?: SuppressionRuleType;
  reason?: string;
  relatedAlertId?: string;
  maintenanceWindowId?: string;
  knownIssueId?: string;
  silencedUntil?: Date;
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysis {
  rootCauseAlertId: string;
  affectedAlertIds: string[];
  topologyPath: string[];
  confidence: number; // 0-1
  analysis: string;
}

/**
 * 告警指纹
 */
export interface AlertFingerprint {
  fingerprint: string;
  labelsHash: string;
  nameHash: string;
  sourceHash: string;
}

/**
 * 重复合并配置
 */
export interface DeduplicationConfig {
  deduplicationWindowMs: number; // 去重窗口（默认4小时）
  maxGroupSize: number; // 最大分组大小
  aggregationIntervalMs: number; // 聚合间隔
}

/**
 * 告警分组
 */
export interface AlertGroup {
  fingerprint: string;
  alerts: Alert[];
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  suppressed: boolean;
  suppressionReason?: string;
}