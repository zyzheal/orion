/**
 * Database DevOps API Service
 *
 * - SQL 审核（提交审核、查看历史、统计）
 * - 慢查询分析（收集、统计、Top N、趋势）
 * - 敏感数据发现与脱敏（检测、脱敏、扫描）
 * - Schema 变更管理（创建、审批、执行、回滚）
 * - 健康检查
 */
import { api } from './client';
import type { ApiResponse } from './types';

// ============================================================================
// Type Definitions
// ============================================================================

/** SQL 审核结果 */
export interface SQLAuditResult {
  id: string;
  sql: string;
  statementType: string;
  timestamp: string;
  violations: AuditViolation[];
  explainAnalysis?: ExplainAnalysis;
  riskScore: number;
  approved: boolean;
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
}

export interface AuditViolation {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ExplainAnalysis {
  nodes: ExplainNode[];
  fullTableScans: ExplainNode[];
  missingIndexes: ExplainNode[];
  estimatedCost: number;
  recommendations: string[];
  riskLevel: string;
}

export interface ExplainNode {
  id: number;
  selectType: string;
  table: string;
  type: string;
  possibleKeys: string | null;
  key: string | null;
  keyLen: string | null;
  ref: string | null;
  rows: number;
  filtered: number;
  extra: string | null;
}

/** SQL 审核统计 */
export interface SQLAuditStats {
  totalAudits: number;
  approvedCount: number;
  rejectedCount: number;
  averageRiskScore: number;
  topViolations: { ruleName: string; count: number }[];
  byStatementType: Record<string, number>;
}

/** 审核规则 */
export interface AuditRule {
  id: string;
  name: string;
  category: string;
  severity: string;
  description: string;
  enabled: boolean;
}

/** 慢查询条目 */
export interface SlowQueryEntry {
  id: string;
  timestamp: string;
  database: string;
  user: string;
  sql: string;
  queryTime: number;
  lockTime: number;
  rowsSent: number;
  rowsExamined: number;
  normalizedSql: string;
  fingerprint: string;
}

/** 慢查询统计 */
export interface SlowQueryStats {
  totalQueries: number;
  totalDuration: number;
  avgQueryTime: number;
  maxQueryTime: number;
  p50QueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  avgRowsExamined: number;
  maxRowsExamined: number;
}

/** 慢查询 Top N */
export interface SlowQueryTopN {
  fingerprint: string;
  sampleSql: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  avgRowsExamined: number;
  database: string;
  optimizationTips: string[];
}

/** 慢查询趋势 */
export interface SlowQueryTrend {
  timeBucket: string;
  count: number;
  avgQueryTime: number;
  maxQueryTime: number;
  totalDuration: number;
}

/** 慢查询分布 */
export interface SlowQueryDistribution {
  byTimeRange: { range: string; count: number }[];
  byDatabase: { database: string; count: number }[];
  byUser: { user: string; count: number }[];
}

/** 慢查询告警 */
export interface SlowQueryAlert {
  id: string;
  timestamp: string;
  severity: string;
  message: string;
  query: SlowQueryEntry;
  threshold: number;
}

/** 敏感数据检测结果 */
export interface SensitiveDataDetectResult {
  type: string;
  ruleName: string;
  confidence: number;
}

/** 脱敏结果 */
export interface MaskResult {
  original: string;
  masked: string;
  strategy: string;
  type: string;
  reversible: boolean;
}

/** 扫描报告 */
export interface ScanReport {
  id: string;
  timestamp: string;
  database: string;
  tablesScanned: number;
  fieldsScanned: number;
  sensitiveFieldsFound: number;
  results: FieldScanResult[];
  summary: Record<string, number>;
  duration: number;
}

export interface FieldScanResult {
  columnName: string;
  tableName: string;
  database: string;
  dataType: string;
  matchedType: string;
  matchedRule: string;
  confidence: number;
  sampleValues: string[];
  sampleCount: number;
  sensitiveCount: number;
}

/** 敏感数据统计 */
export interface SensitiveDataStats {
  totalScans: number;
  totalSensitiveFields: number;
  totalMaskOperations: number;
  byType: Record<string, number>;
  byStrategy: Record<string, number>;
}

/** Schema 变更 */
export interface SchemaChange {
  id: string;
  version: string;
  database: string;
  tableName: string;
  changeType: string;
  riskLevel: string;
  status: string;
  title: string;
  description: string;
  sql: string;
  rollbackSql?: string;
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComment?: string;
  executedAt?: string;
  executionDuration?: number;
  executionLog?: string;
  tags: string[];
}

/** 变更执行结果 */
export interface ExecutionResult {
  success: boolean;
  changeId: string;
  duration: number;
  log: string;
  error?: string;
}

/** 变更统计 */
export interface ChangeStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byRiskLevel: Record<string, number>;
  averageExecutionTime: number;
  successRate: number;
  rollbackRate: number;
}

/** Schema 版本 */
export interface SchemaVersion {
  version: string;
  database: string;
  appliedAt: string;
  changes: string[];
  checksum: string;
}

/** 健康检查结果 */
export interface HealthCheckResult {
  status: string;
  timestamp: string;
  components: {
    sqlAudit: { status: string; totalAudits: number; averageRiskScore: number };
    slowQuery: { status: string; totalQueries: number; p95QueryTime: number };
    sensitiveData: { status: string; totalScans: number; sensitiveFieldsFound: number };
    schemaChange: { status: string; totalChanges: number; successRate: number };
  };
}

// ============================================================================
// API Functions - SQL Audit
// ============================================================================

/** 审核 SQL */
export const auditSQL = async (params: {
  sql: string;
  database?: string;
  table?: string;
  includeExplain?: boolean;
}): Promise<SQLAuditResult> => {
  const response = await api.post<SQLAuditResult>('/v1/database-devops/sql-audit', params);
  return response.data.data;
};

/** 批量审核 */
export const auditSQLBatch = async (requests: {
  sql: string;
  database?: string;
}[]): Promise<SQLAuditResult[]> => {
  const response = await api.post<SQLAuditResult[]>('/v1/database-devops/sql-audit/batch', { requests });
  return response.data.data;
};

/** 获取审核历史 */
export const getAuditHistory = async (params?: {
  statementType?: string;
  approved?: boolean;
  minRiskScore?: number;
  since?: string;
  limit?: number;
}): Promise<SQLAuditResult[]> => {
  const response = await api.get<SQLAuditResult[]>('/v1/database-devops/sql-audit/history', { params });
  return response.data.data;
};

/** 获取审核统计 */
export const getAuditStats = async (): Promise<SQLAuditStats> => {
  const response = await api.get<SQLAuditStats>('/v1/database-devops/sql-audit/stats');
  return response.data.data;
};

/** 获取审核规则 */
export const getAuditRules = async (): Promise<AuditRule[]> => {
  const response = await api.get<AuditRule[]>('/v1/database-devops/sql-audit/rules');
  return response.data.data;
};

/** 更新规则状态 */
export const updateAuditRule = async (id: string, enabled: boolean): Promise<{ success: boolean }> => {
  const response = await api.patch<{ success: boolean }>(`/v1/database-devops/sql-audit/rules/${id}`, { enabled });
  return response.data.data;
};

// ============================================================================
// API Functions - Slow Query
// ============================================================================

/** 收集慢查询 */
export const collectSlowQuery = async (entry: Omit<SlowQueryEntry, 'id' | 'normalizedSql' | 'fingerprint'>): Promise<SlowQueryEntry> => {
  const response = await api.post<SlowQueryEntry>('/v1/database-devops/slow-query/collect', entry);
  return response.data.data;
};

/** 获取慢查询统计 */
export const getSlowQueryStats = async (params?: {
  database?: string;
  since?: string;
  until?: string;
}): Promise<SlowQueryStats> => {
  const response = await api.get<SlowQueryStats>('/v1/database-devops/slow-query/stats', { params });
  return response.data.data;
};

/** 获取 Top N 慢查询 */
export const getSlowQueryTopN = async (params?: {
  n?: number;
  database?: string;
  since?: string;
}): Promise<SlowQueryTopN[]> => {
  const response = await api.get<SlowQueryTopN[]>('/v1/database-devops/slow-query/top', { params });
  return response.data.data;
};

/** 获取慢查询趋势 */
export const getSlowQueryTrend = async (params?: {
  database?: string;
  since?: string;
  until?: string;
  granularity?: 'hour' | 'day';
}): Promise<SlowQueryTrend[]> => {
  const response = await api.get<SlowQueryTrend[]>('/v1/database-devops/slow-query/trend', { params });
  return response.data.data;
};

/** 获取慢查询分布 */
export const getSlowQueryDistribution = async (params?: {
  since?: string;
}): Promise<SlowQueryDistribution> => {
  const response = await api.get<SlowQueryDistribution>('/v1/database-devops/slow-query/distribution', { params });
  return response.data.data;
};

/** 获取慢查询告警 */
export const getSlowQueryAlerts = async (limit?: number): Promise<SlowQueryAlert[]> => {
  const response = await api.get<SlowQueryAlert[]>('/v1/database-devops/slow-query/alerts', { params: { limit } });
  return response.data.data;
};

// ============================================================================
// API Functions - Sensitive Data
// ============================================================================

/** 检测敏感数据 */
export const detectSensitiveData = async (value: string): Promise<SensitiveDataDetectResult | null> => {
  const response = await api.post<SensitiveDataDetectResult | null>('/v1/database-devops/sensitive-data/detect', { value });
  return response.data.data;
};

/** 脱敏处理 */
export const maskSensitiveData = async (params: {
  value: string;
  type: string;
  strategy?: string;
  options?: Record<string, unknown>;
}): Promise<MaskResult> => {
  const response = await api.post<MaskResult>('/v1/database-devops/sensitive-data/mask', params);
  return response.data.data;
};

/** 扫描数据库 */
export const scanDatabaseSensitiveData = async (params: {
  database: string;
  tables?: string[];
}): Promise<ScanReport> => {
  const response = await api.post<ScanReport>('/v1/database-devops/sensitive-data/scan', params);
  return response.data.data;
};

/** 获取扫描历史 */
export const getScanHistory = async (limit?: number): Promise<ScanReport[]> => {
  const response = await api.get<ScanReport[]>('/v1/database-devops/sensitive-data/scan-history', { params: { limit } });
  return response.data.data;
};

/** 获取脱敏规则 */
export const getSensitiveDataRules = async (): Promise<{ id: string; name: string; type: string; strategy: string; enabled: boolean }[]> => {
  const response = await api.get('/v1/database-devops/sensitive-data/rules');
  return response.data.data;
};

/** 获取敏感数据统计 */
export const getSensitiveDataStats = async (): Promise<SensitiveDataStats> => {
  const response = await api.get<SensitiveDataStats>('/v1/database-devops/sensitive-data/stats');
  return response.data.data;
};

// ============================================================================
// API Functions - Schema Change
// ============================================================================

/** 创建变更 */
export const createSchemaChange = async (params: {
  database: string;
  tableName: string;
  changeType: string;
  title: string;
  description?: string;
  sql: string;
  rollbackSql?: string;
  createdBy: string;
  tags?: string[];
}): Promise<SchemaChange> => {
  const response = await api.post<SchemaChange>('/v1/database-devops/schema-changes', params);
  return response.data.data;
};

/** 查询变更列表 */
export const getSchemaChanges = async (params?: {
  database?: string;
  tableName?: string;
  status?: string;
  changeType?: string;
  createdBy?: string;
  since?: string;
  limit?: number;
}): Promise<SchemaChange[]> => {
  const response = await api.get<SchemaChange[]>('/v1/database-devops/schema-changes', { params });
  return response.data.data;
};

/** 获取变更详情 */
export const getSchemaChangeDetail = async (id: string): Promise<SchemaChange> => {
  const response = await api.get<SchemaChange>(`/v1/database-devops/schema-changes/${id}`);
  return response.data.data;
};

/** 审批变更 */
export const reviewSchemaChange = async (id: string, params: {
  approved: boolean;
  reviewedBy: string;
  comment?: string;
}): Promise<SchemaChange> => {
  const response = await api.post<SchemaChange>(`/v1/database-devops/schema-changes/${id}/review`, params);
  return response.data.data;
};

/** 执行变更 */
export const executeSchemaChange = async (id: string): Promise<ExecutionResult> => {
  const response = await api.post<ExecutionResult>(`/v1/database-devops/schema-changes/${id}/execute`);
  return response.data.data;
};

/** 回滚变更 */
export const rollbackSchemaChange = async (id: string): Promise<ExecutionResult> => {
  const response = await api.post<ExecutionResult>(`/v1/database-devops/schema-changes/${id}/rollback`);
  return response.data.data;
};

/** 获取变更统计 */
export const getSchemaChangeStats = async (): Promise<ChangeStats> => {
  const response = await api.get<ChangeStats>('/v1/database-devops/schema-changes/stats');
  return response.data.data;
};

/** 获取版本历史 */
export const getSchemaVersionHistory = async (database: string): Promise<SchemaVersion[]> => {
  const response = await api.get<SchemaVersion[]>(`/v1/database-devops/schema-changes/versions/${database}`);
  return response.data.data;
};

// ============================================================================
// API Functions - Health Check
// ============================================================================

/** 获取数据库健康状态 */
export const getDatabaseHealthCheck = async (database?: string): Promise<HealthCheckResult> => {
  const response = await api.get<HealthCheckResult>('/v1/database-devops/health-check', { params: { database } });
  return response.data.data;
};
