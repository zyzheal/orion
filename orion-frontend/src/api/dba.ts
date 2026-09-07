/**
 * DBA (Database Administration) API Service
 * SQL order management, data source management, audit
 */
import { api } from './client';

export interface SqlOrder {
  id: string;
  tenantId: string;
  userId: string;
  database: string;
  sql: string;
  comment: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  type: 'query' | 'insert' | 'update' | 'delete' | 'ddl';
  createdAt: string;
  executedAt?: string;
  result?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'redis' | 'mongodb';
  host: string;
  port: number;
  database: string;
  status: 'online' | 'offline' | 'error';
  lastChecked?: string;
}

export interface CreateOrderInput {
  database: string;
  sql: string;
  comment: string;
  type?: string;
}

export interface AuditRule {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  severity: 'info' | 'warning' | 'error';
  enabled: boolean;
}

// ---- Orders ----

export function listOrders(params?: {
  tenantId?: string;
  page?: number;
  limit?: number;
  status?: string;
}) {
  return api.get('/dba/orders', { params });
}

export function getOrder(id: string) {
  return api.get(`/dba/orders/${id}`);
}

export function createOrder(data: CreateOrderInput) {
  return api.post('/dba/orders', data);
}

export function approveOrder(id: string) {
  return api.post(`/dba/orders/${id}/approve`);
}

export function rejectOrder(id: string, reason: string) {
  return api.post(`/dba/orders/${id}/reject`, { reason });
}

export function executeOrder(id: string) {
  return api.post(`/dba/orders/${id}/execute`);
}

// ---- Data Sources ----

export function listDataSources(tenantId: string) {
  return api.get('/dba/datasources', { params: { tenantId } });
}

export function createDataSource(data: Omit<DataSource, 'id' | 'status'>) {
  return api.post('/dba/datasources', data);
}

export function updateDataSource(id: string, data: Partial<DataSource>) {
  return api.put(`/dba/datasources/${id}`, data);
}

export function deleteDataSource(id: string) {
  return api.delete(`/dba/datasources/${id}`);
}

export function testConnection(id: string) {
  return api.post(`/dba/datasources/${id}/test`);
}

// ---- Audit Rules ----

export function listAuditRules(tenantId: string) {
  return api.get('/dba/audit-rules', { params: { tenantId } });
}

export function createAuditRule(data: Omit<AuditRule, 'id'>) {
  return api.post('/dba/audit-rules', data);
}

export function updateAuditRule(id: string, data: Partial<AuditRule>) {
  return api.put(`/dba/audit-rules/${id}`, data);
}

// ---- Query Execution ----

export function executeQuery(sourceId: string, sql: string, limit?: number) {
  return api.post('/dba/query', { sourceId, sql, limit: limit || 100 });
}

// =====================================================================
// DBA Extension Modules (Phase 2, 2026-09-06)
// Four new endpoints: multi-stage approval, paged query + Excel export,
// LLM-assisted SQL review, gh-ost-based Online Schema Change.
// =====================================================================

// ---- Multi-stage Approval (/dba/approval/*) ----

export interface ApprovalStepDef {
  id: string;
  role: string;
  mode: string; // "any" | "all"
  required: number;
  timeoutHours: number;
  timeoutAction: string;
  approvers: string[];
}

export interface ApprovalWorkflow {
  id: string;
  tenant_id: string;
  name: string;
  steps: ApprovalStepDef[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  step_index: number;
  def: ApprovalStepDef;
  status: string;
  started_at?: string;
  finished_at?: string;
  escalated_to?: string;
  approvals: ApprovalRecord[];
}

export interface ApprovalRecord {
  id: string;
  instance_id: string;
  step_index: number;
  user_id: string;
  action: string;
  comment: string;
  actioned_at: string;
}

export interface ApprovalInstance {
  id: string;
  tenant_id: string;
  order_id: string;
  workflow_id: string;
  workflow_name: string;
  current_step: number;
  status: string;
  steps: ApprovalStep[];
  created_at: string;
  updated_at: string;
  finished_at?: string;
}

export interface SubmitForApprovalInput {
  order_id: string;
  workflow_id: string;
}

export function listApprovalWorkflows() {
  return api.get<ApprovalWorkflow[]>('/dba/approval/workflows');
}

export function getApprovalWorkflow(id: string) {
  return api.get<ApprovalWorkflow>(`/dba/approval/workflows/${id}`);
}

export function createApprovalWorkflow(data: { name: string; steps: ApprovalStepDef[] }) {
  return api.post<ApprovalWorkflow>('/dba/approval/workflows', data);
}

export function listApprovalInstances(orderId?: string) {
  return api.get<ApprovalInstance[]>('/dba/approval/instances', {
    params: orderId ? { order_id: orderId } : undefined,
  });
}

export function getApprovalInstance(id: string) {
  return api.get<ApprovalInstance>(`/dba/approval/instances/${id}`);
}

export function submitForApproval(data: SubmitForApprovalInput) {
  return api.post<ApprovalInstance>('/dba/approval/instances', data);
}

export function approveApprovalStep(id: string, idx: number, comment?: string) {
  return api.post<ApprovalInstance>(`/dba/approval/instances/${id}/steps/${idx}/approve`, {
    comment,
  });
}

export function rejectApprovalStep(id: string, idx: number, comment?: string) {
  return api.post<ApprovalInstance>(`/dba/approval/instances/${id}/steps/${idx}/reject`, {
    comment,
  });
}

export function escalateApprovalStep(id: string, idx: number) {
  return api.post<ApprovalInstance>(`/dba/approval/instances/${id}/steps/${idx}/escalate`);
}

// ---- Paged Query + Excel Export (/dba/query/paged, /dba/query/export) ----

export interface QueryColumn {
  name: string;
  data_type: string;
}

export interface PagedQueryRequest {
  sql: string;
  data_source_id: string;
  page_token?: string;
  page_size?: number;
  timeout_ms?: number;
}

export interface PagedQueryResult {
  columns: QueryColumn[];
  rows: unknown[][];
  total: number;
  next_page_token?: string;
  query_ms: number;
  truncated: boolean;
}

export interface ExportRequest {
  sql: string;
  data_source_id: string;
  max_rows?: number;
  timeout_ms?: number;
}

export interface ExportResult {
  id: string;
  status: string; // "pending" | "running" | "done" | "failed"
  file_url?: string;
  rows_exported?: number;
  truncated?: boolean;
  error?: string;
  created_at: string;
  updated_at: string;
}

export function executePagedQuery(data: PagedQueryRequest) {
  return api.post<PagedQueryResult>('/dba/query/paged', data);
}

export function exportToExcel(data: ExportRequest) {
  return api.post<ExportResult>('/dba/query/export', data);
}

export function getExportStatus(jobId: string) {
  return api.get<ExportResult>(`/dba/query/export/${jobId}`);
}

// ---- LLM-assisted SQL Review (/db/aireview/*) ----
// Note: backend mounts at /db/aireview (not /dba/aireview) — kept as-is
// to match the Go handler.

export interface AISuggestion {
  category: string;
  severity: string;
  title: string;
  description: string;
  suggestion: string;
  fixed_sql?: string;
}

export interface SQLReviewRequest {
  sql: string;
  db_type?: string;
  context?: string;
  explain_plan?: string;
}

export interface SQLReviewResult {
  id?: string;
  tenant_id?: string;
  local_audit?: unknown;
  ai_suggestions: AISuggestion[];
  verdict: string; // "pass" | "warn" | "reject"
  score: number;
  reviewed_at: string;
  model_used?: string;
  duration: number;
  ai_errors?: string[];
  ai_called: boolean;
}

export interface ReviewRecord {
  id: string;
  tenant_id: string;
  sql: string;
  db_type: string;
  verdict: string;
  score: number;
  model_used: string;
  duration_ms: number;
  local_audit?: string;
  ai_suggestions?: string;
  created_at: string;
}

export function reviewSQL(data: SQLReviewRequest) {
  return api.post<SQLReviewResult>('/db/aireview/review', data);
}

export function listReviewHistory(limit = 20) {
  return api.get<ReviewRecord[]>('/db/aireview/history', { params: { limit } });
}

export function getReviewResult(id: string) {
  return api.get<ReviewRecord>(`/db/aireview/${id}`);
}

// ---- Online Schema Change / gh-ost (/dba/osc/*) ----

export interface OSCJob {
  id: string;
  tenant_id: string;
  user_id: string;
  data_source_id: string;
  table: string;
  alter_sql: string;
  status: string; // "pending" | "running" | "success" | "failed" | "cancelled"
  dry_run: boolean;
  cutover_mode: string;
  max_lag_millis: number;
  chunk_size: number;
  error_message?: string;
  log: string;
  rows_affected?: number;
  max_lag_observed?: number;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
}

export interface CreateOSCJobInput {
  data_source_id: string;
  table: string;
  alter_sql: string;
  dry_run: boolean;
  cutover_mode?: string;
  max_lag_millis?: number;
  chunk_size?: number;
}

export interface DryRunRequest {
  data_source_id: string;
  table: string;
  alter_sql: string;
}

export interface DryRunResult {
  success: boolean;
  message: string;
  duration_ms: number;
  log: string[];
  exit_code?: number;
}

export interface OSCStatus {
  job: OSCJob;
  gh_ost?: unknown;
  reachable: boolean;
  reachable_error?: string;
}

export interface OSCJobListResult {
  data: OSCJob[];
  total: number;
  page: number;
  limit: number;
}

export function listOSCJobs(params?: { page?: number; limit?: number; status?: string }) {
  return api.get<OSCJobListResult>('/dba/osc/jobs', { params });
}

export function getOSCJob(id: string) {
  return api.get<OSCJob>(`/dba/osc/jobs/${id}`);
}

export function createOSCJob(data: CreateOSCJobInput) {
  return api.post<OSCJob>('/dba/osc/jobs', data);
}

export function startOSCJob(id: string) {
  return api.post<OSCJob>(`/dba/osc/jobs/${id}/start`);
}

export function stopOSCJob(id: string) {
  return api.post<OSCJob>(`/dba/osc/jobs/${id}/stop`);
}

export function oscDryRun(data: DryRunRequest) {
  return api.post<DryRunResult>('/dba/osc/dryrun', data);
}

export function getOSCStatus(id: string) {
  return api.get<OSCStatus>(`/dba/osc/jobs/${id}/status`);
}

// ---- Slow Query Collection & Analysis (/dba/slowquery/*) ----

export interface SlowQuery {
  id: string;
  tenant_id: string;
  data_source_id: string;
  db_type: string;
  schema: string;
  query: string;
  query_hash: string;
  call_count: number;
  mean_time_ms: number;
  total_time_ms: number;
  rows_read: number;
  rows_returned: number;
  collected_at: string;
}

export interface SlowQuerySuggestion {
  category: string;
  severity: string;
  title: string;
  description: string;
  fixed_sql?: string;
}

export interface SlowQueryAnalysisResult {
  sql: string;
  query_hash: string;
  db_type: string;
  suggestions: SlowQuerySuggestion[];
  passed: boolean;
  analyzed_at: string;
}

export interface SlowQueryStats {
  distinct_queries: number;
  window_hours: number;
}

export interface SlowQueryCollectResponse {
  collected: number;
}

export function collectSlowQueries(data: {
  data_source_id: string;
  threshold_ms?: number;
  since?: string;
}) {
  return api.post<SlowQueryCollectResponse>('/dba/slowquery/collect', data);
}

export function listTopSlowQueries(params: {
  data_source_id: string;
  limit?: number;
  order_by?: 'total_time_ms' | 'mean_time_ms' | 'rows_read';
  since?: string;
}) {
  return api.get<SlowQuery[]>('/dba/slowquery/top', { params });
}

export function analyzeSlowSQL(data: {
  sql: string;
  db_type?: string;
  schema?: string;
  rows_read?: number;
}) {
  return api.post<SlowQueryAnalysisResult>('/dba/slowquery/analyze', data);
}

export function getSlowQueryStats(data_source_id: string, window_hours = 24) {
  return api.get<SlowQueryStats>('/dba/slowquery/stats', {
    params: { data_source_id, window_hours },
  });
}

// ---- Execution Plan Analysis (/dba/explain/*) ----

export interface ExplainNode {
  node_type: string;
  relation?: string;
  index?: string;
  scan_type?: string;
  cost?: { start: number; run: number; total: number };
  rows?: number;
  actual_time_ms?: number;
  children?: ExplainNode[];
  raw: string;
}

export interface ExplainSuggestion {
  category: string;
  severity: string;
  title: string;
  description: string;
  node_id?: string;
}

export interface ExplainResult {
  sql: string;
  db_type: string;
  plan_text: string;
  plan: ExplainNode;
  suggestions: ExplainSuggestion[];
  passed: boolean;
  duration_ms: number;
  analyzed_at: string;
}

export interface ExplainJob {
  id: string;
  tenant_id: string;
  data_source_id: string;
  db_type: string;
  sql: string;
  plan_text: string;
  passed: boolean;
  duration_ms: number;
  created_at: string;
}

export function analyzeExplainPlan(data: {
  sql: string;
  data_source_id: string;
  db_type?: string;
  schema?: string;
  analyze?: boolean;
}) {
  return api.post<ExplainResult>('/dba/explain/analyze', data);
}

export function listExplainHistory(limit = 50) {
  return api.get<ExplainJob[]>('/dba/explain/history', { params: { limit } });
}

// ---- Index Advisor (/dba/advisor/*) ----

export interface IndexSuggestion {
  table: string;
  columns: string[];
  where?: string;
  kind: string;
  db_type: string;
  sql: string;
  reason: string;
  evidence: string[];
  impact: number;
}

export interface SuggestIndexesResult {
  data_source_id: string;
  db_type: string;
  schema: string;
  suggestions: IndexSuggestion[];
  analyzed_at: string;
}

export function suggestIndexes(data: {
  data_source_id: string;
  db_type?: string;
  schema?: string;
  tables?: string[];
}) {
  return api.post<SuggestIndexesResult>('/dba/advisor/indexes', data);
}
