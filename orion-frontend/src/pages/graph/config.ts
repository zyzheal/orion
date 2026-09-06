/**
 * Graph Page Configuration Constants
 * Color/label maps for status indicators, tab keys, and the default
 * Cypher placeholder shown in the query editor.
 */
import type {
  ServiceDependency,
  InfrastructureNode,
  ImpactNode,
} from '@/api/graph';

// ---- Service Dependency Status ----

export const serviceStatusColorMap: Record<ServiceDependency['status'], string> = {
  running: 'green',
  stopped: 'red',
  degraded: 'orange',
  unknown: 'default',
};

export const serviceStatusLabelMap: Record<ServiceDependency['status'], string> = {
  running: '运行中',
  stopped: '已停止',
  degraded: '降级',
  unknown: '未知',
};

// ---- Infrastructure Node Type ----

export const infraTypeLabelMap: Record<InfrastructureNode['type'], string> = {
  host: '主机',
  network: '网络',
  storage: '存储',
  database: '数据库',
  cache: '缓存',
  load_balancer: '负载均衡',
};

// ---- Impact Level ----

export const impactLevelColorMap: Record<ImpactNode['impactLevel'], string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
};

export const impactLevelLabelMap: Record<ImpactNode['impactLevel'], string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

// ---- Tab Configuration ----

export type GraphTabKey = 'dependencies' | 'infrastructure' | 'impact' | 'cypher';

export const DEFAULT_ACTIVE_TAB: GraphTabKey = 'dependencies';

// ---- Cypher Placeholder ----

export const CYPHER_PLACEHOLDER =
  'MATCH (s:Service)-[:DEPENDS_ON]->(d:Service)\nRETURN s.name, d.name, s.status, d.status\nLIMIT 25';
