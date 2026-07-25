/**
 * Automation (AutoExec) API
 *
 * Features:
 * - Job management (CRUD + execute + enable/disable + execution history)
 * - Time jobs (CRUD + execution records with cron expressions)
 * - Tool library (CRUD + categories + details + parameters)
 * - Script library (CRUD + categories + execution test)
 * - Composite tools (step orchestration + execution)
 * - Approval/review (pending operations + approve/reject)
 * - Global parameters (CRUD)
 * - Tool categories (CRUD)
 */
import apiClient from './client';

// ==================== Job ====================

export interface AutoJob {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: 'script' | 'tool' | 'composite' | 'api';
  config: Record<string, unknown>;
  enabled: boolean;
  schedule: string | null; // cron expression for one-off scheduled jobs
  status: 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  owner: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JobExecutionRecord {
  id: string;
  tenantId: string;
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  params: Record<string, unknown>;
  output: string | null;
  error: string | null;
  durationMs: number | null;
  startedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface CreateJobInput {
  name: string;
  description?: string;
  type: 'script' | 'tool' | 'composite' | 'api';
  config?: Record<string, unknown>;
  enabled?: boolean;
  schedule?: string;
  tags?: string[];
}

export interface UpdateJobInput {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
  schedule?: string | null;
  tags?: string[];
}

export interface ExecuteJobInput {
  params?: Record<string, unknown>;
}

// ==================== Time Job (Scheduled) ====================

export interface TimeJob {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  jobId: string; // references AutoJob
  cronExpression: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: 'completed' | 'failed' | 'running' | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeJobExecution {
  id: string;
  tenantId: string;
  timeJobId: string;
  status: 'completed' | 'failed' | 'running';
  output: string | null;
  error: string | null;
  durationMs: number | null;
  runAt: string;
}

export interface CreateTableInput {
  name: string;
  description?: string;
  jobId: string;
  cronExpression: string;
  enabled?: boolean;
  tags?: string[];
}

export interface UpdateTimeJobInput {
  name?: string;
  description?: string;
  cronExpression?: string;
  enabled?: boolean;
  tags?: string[];
}

// ==================== Tool ====================

export interface AutomationTool {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string | null;
  toolType: 'script' | 'api' | 'builtin' | 'external';
  enabled: boolean;
  config: Record<string, unknown>;
  parameters: ToolParameter[];
  tags: string[];
  version: string;
  owner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolParameter {
  key: string;
  paramType: 'string' | 'number' | 'boolean' | 'secret' | 'enum';
  required: boolean;
  defaultValue: string | null;
  description: string | null;
  options?: string[]; // for enum type
}

export interface CreateToolInput {
  name: string;
  description?: string;
  category?: string;
  toolType: 'script' | 'api' | 'builtin' | 'external';
  config?: Record<string, unknown>;
  parameters?: ToolParameter[];
  tags?: string[];
  version?: string;
}

export interface UpdateToolInput {
  name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  parameters?: ToolParameter[];
  tags?: string[];
  version?: string;
}

export interface ExecuteToolInput {
  params: Record<string, unknown>;
  targets?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  id: string;
  tenantId: string;
  toolId: string;
  status: 'completed' | 'failed';
  output: string | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
}

// ==================== Script (Automation Script Library) ====================

export interface AutomationScript {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  scriptType: 'shell' | 'python' | 'powershell' | 'ansible' | 'groovy';
  category: string | null;
  tags: string[];
  enabled: boolean;
  parameters: ScriptParameterDef[];
  owner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptParameterDef {
  key: string;
  paramType: 'string' | 'number' | 'boolean' | 'secret';
  required: boolean;
  defaultValue: string | null;
  description: string | null;
}

export interface CreateAutomationScriptInput {
  name: string;
  description?: string;
  scriptType: 'shell' | 'python' | 'powershell' | 'ansible' | 'groovy';
  category?: string;
  tags?: string[];
  parameters?: ScriptParameterDef[];
}

export interface UpdateAutomationScriptInput {
  name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  tags?: string[];
  parameters?: ScriptParameterDef[];
}

// ==================== Composite Tool ====================

export interface CompositeTool {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  steps: CompositeStep[];
  tags: string[];
  owner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompositeStep {
  id: string;
  name: string;
  stepType: 'script' | 'tool' | 'api' | 'approval' | 'sleep' | 'condition';
  config: Record<string, unknown>;
  params: Record<string, unknown>;
  dependsOn: string[]; // step ids this step depends on
  order: number;
  onFailure: 'stop' | 'continue' | 'skipDependents';
}

export interface CreateCompositeToolInput {
  name: string;
  description?: string;
  steps?: CompositeStep[];
  tags?: string[];
}

export interface UpdateCompositeToolInput {
  name?: string;
  description?: string;
  steps?: CompositeStep[];
  enabled?: boolean;
  tags?: string[];
}

export interface ExecuteCompositeInput {
  params?: Record<string, unknown>;
}

export interface CompositeExecutionRecord {
  id: string;
  tenantId: string;
  compositeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stepStatuses: Record<string, 'pending' | 'running' | 'completed' | 'failed'>;
  output: string | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

// ==================== Approval / Review ====================

export interface AutomationReview {
  id: string;
  tenantId: string;
  type: 'job' | 'tool' | 'script' | 'composite';
  targetId: string;
  targetName: string;
  operation: 'create' | 'update' | 'execute' | 'delete';
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requester: string;
  approver: string | null;
  comment: string | null;
  createdAt: string;
  approvedAt: string | null;
}

export interface ApproveReviewInput {
  comment?: string;
}

// ==================== Global Parameter ====================

export interface GlobalParam {
  id: string;
  tenantId: string;
  name: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'secret';
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGlobalParamInput {
  name: string;
  value: string;
  valueType?: 'string' | 'number' | 'boolean' | 'secret';
  description?: string;
  tags?: string[];
}

export interface UpdateGlobalParamInput {
  value?: string;
  valueType?: 'string' | 'number' | 'boolean' | 'secret';
  description?: string;
  tags?: string[];
}

// ==================== Tool Category ====================

export interface ToolCategory {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  parentCategoryId: string | null;
  toolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToolCategoryInput {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  parentCategoryId?: string;
}

export interface UpdateToolCategoryInput {
  name?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  parentCategoryId?: string | null;
}

// ==================== API Functions ====================

// --- Jobs ---
export const listJobs = (params?: { type?: string; status?: string; enabled?: boolean; tag?: string }) =>
  apiClient.get<AutoJob[]>('/automation/jobs', { params });

export const getJob = (id: string) =>
  apiClient.get<AutoJob>(`/automation/jobs/${id}`);

export const createJob = (data: CreateJobInput) =>
  apiClient.post<AutoJob>('/automation/jobs', data);

export const updateJob = (id: string, data: UpdateJobInput) =>
  apiClient.put<AutoJob>(`/automation/jobs/${id}`, data);

export const deleteJob = (id: string) =>
  apiClient.delete(`/automation/jobs/${id}`);

export const executeJob = (id: string, data?: ExecuteJobInput) =>
  apiClient.post<JobExecutionRecord>(`/automation/jobs/${id}/execute`, data ?? {});

export const toggleJob = (id: string, enabled: boolean) =>
  apiClient.patch<AutoJob>(`/automation/jobs/${id}/status`, { enabled });

export const getJobExecutions = (id: string, limit?: number) =>
  apiClient.get<JobExecutionRecord[]>(`/automation/jobs/${id}/executions`, { params: { limit } });

// --- Time Jobs ---
export const listTimeJobs = (params?: { enabled?: boolean; tag?: string }) =>
  apiClient.get<TimeJob[]>('/automation/time-jobs', { params });

export const getTimeJob = (id: string) =>
  apiClient.get<TimeJob>(`/automation/time-jobs/${id}`);

export const createTimeJob = (data: CreateTableInput) =>
  apiClient.post<TimeJob>('/automation/time-jobs', data);

export const updateTimeJob = (id: string, data: UpdateTimeJobInput) =>
  apiClient.put<TimeJob>(`/automation/time-jobs/${id}`, data);

export const deleteTimeJob = (id: string) =>
  apiClient.delete(`/automation/time-jobs/${id}`);

export const toggleTimeJob = (id: string, enabled: boolean) =>
  apiClient.patch<TimeJob>(`/automation/time-jobs/${id}/status`, { enabled });

export const getTimeJobExecutions = (id: string, limit?: number) =>
  apiClient.get<TimeJobExecution[]>(`/automation/time-jobs/${id}/executions`, { params: { limit } });

// --- Tools ---
export const listTools = (params?: { category?: string; toolType?: string; enabled?: boolean; tag?: string }) =>
  apiClient.get<AutomationTool[]>('/automation/tools', { params });

export const getTool = (id: string) =>
  apiClient.get<AutomationTool>(`/automation/tools/${id}`);

export const createTool = (data: CreateToolInput) =>
  apiClient.post<AutomationTool>('/automation/tools', data);

export const updateTool = (id: string, data: UpdateToolInput) =>
  apiClient.put<AutomationTool>(`/automation/tools/${id}`, data);

export const deleteTool = (id: string) =>
  apiClient.delete(`/automation/tools/${id}`);

export const executeTool = (id: string, data: ExecuteToolInput) =>
  apiClient.post<ToolExecutionResult>(`/automation/tools/${id}/execute`, data);

// --- Scripts (Automation) ---
export const listAutomationScripts = (params?: { scriptType?: string; category?: string; enabled?: boolean; tag?: string }) =>
  apiClient.get<AutomationScript[]>('/automation/scripts', { params });

export const getAutomationScript = (id: string) =>
  apiClient.get<AutomationScript>(`/automation/scripts/${id}`);

export const createAutomationScript = (data: CreateAutomationScriptInput) =>
  apiClient.post<AutomationScript>('/automation/scripts', data);

export const updateAutomationScript = (id: string, data: UpdateAutomationScriptInput) =>
  apiClient.put<AutomationScript>(`/automation/scripts/${id}`, data);

export const deleteAutomationScript = (id: string) =>
  apiClient.delete(`/automation/scripts/${id}`);

export const testScript = (id: string, data: ExecuteToolInput) =>
  apiClient.post<ToolExecutionResult>(`/automation/scripts/${id}/test`, data);

// --- Composite Tools ---
export const listCompositeTools = (params?: { enabled?: boolean; tag?: string }) =>
  apiClient.get<CompositeTool[]>('/automation/composite-tools', { params });

export const getCompositeTool = (id: string) =>
  apiClient.get<CompositeTool>(`/automation/composite-tools/${id}`);

export const createCompositeTool = (data: CreateCompositeToolInput) =>
  apiClient.post<CompositeTool>('/automation/composite-tools', data);

export const updateCompositeTool = (id: string, data: UpdateCompositeToolInput) =>
  apiClient.put<CompositeTool>(`/automation/composite-tools/${id}`, data);

export const deleteCompositeTool = (id: string) =>
  apiClient.delete(`/automation/composite-tools/${id}`);

export const executeCompositeTool = (id: string, data?: ExecuteCompositeInput) =>
  apiClient.post<CompositeExecutionRecord>(`/automation/composite-tools/${id}/execute`, data ?? {});

export const getCompositeExecutions = (id: string, limit?: number) =>
  apiClient.get<CompositeExecutionRecord[]>(`/automation/composite-tools/${id}/executions`, { params: { limit } });

// --- Approvals ---
export const listReviews = (params?: { status?: string; type?: string }) =>
  apiClient.get<AutomationReview[]>('/automation/reviews', { params });

export const getReview = (id: string) =>
  apiClient.get<AutomationReview>(`/automation/reviews/${id}`);

export const approveReview = (id: string, data?: ApproveReviewInput) =>
  apiClient.post(`/automation/reviews/${id}/approve`, data ?? {});

export const rejectReview = (id: string, data?: ApproveReviewInput) =>
  apiClient.post(`/automation/reviews/${id}/reject`, data ?? {});

// --- Global Parameters ---
export const listGlobalParams = (params?: { tag?: string }) =>
  apiClient.get<GlobalParam[]>('/automation/global-params', { params });

export const getGlobalParam = (id: string) =>
  apiClient.get<GlobalParam>(`/automation/global-params/${id}`);

export const createGlobalParam = (data: CreateGlobalParamInput) =>
  apiClient.post<GlobalParam>('/automation/global-params', data);

export const updateGlobalParam = (id: string, data: UpdateGlobalParamInput) =>
  apiClient.put<GlobalParam>(`/automation/global-params/${id}`, data);

export const deleteGlobalParam = (id: string) =>
  apiClient.delete(`/automation/global-params/${id}`);

// --- Tool Categories ---
export const listToolCategories = (params?: { parentCategoryId?: string }) =>
  apiClient.get<ToolCategory[]>('/automation/tool-categories', { params });

export const getToolCategory = (id: string) =>
  apiClient.get<ToolCategory>(`/automation/tool-categories/${id}`);

export const createToolCategory = (data: CreateToolCategoryInput) =>
  apiClient.post<ToolCategory>('/automation/tool-categories', data);

export const updateToolCategory = (id: string, data: UpdateToolCategoryInput) =>
  apiClient.put<ToolCategory>(`/automation/tool-categories/${id}`, data);

export const deleteToolCategory = (id: string) =>
  apiClient.delete(`/automation/tool-categories/${id}`);
