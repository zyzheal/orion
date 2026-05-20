/**
 * Workflow Task API Service
 * 工作流人工任务 API 客户端
 *
 * Backend routes: /v1/workflow-tasks
 * - GET /v1/workflow-tasks - 任务列表
 * - GET /v1/workflow-tasks/:id - 任务详情
 * - POST /v1/workflow-tasks/:id/claim - 认领任务
 * - POST /v1/workflow-tasks/:id/complete - 完成任务
 */
import { api } from './client';

// ==================== 类型定义 ====================

export type TaskStatus = 'pending' | 'assigned' | 'completed' | 'cancelled';
export type TaskType = 'manual' | 'system';
export type AssigneeType = 'user' | 'role';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkflowTask {
  id: string;
  instance_id: string;
  node_id: string;
  task_type: TaskType;
  assignee_type: AssigneeType;
  assignee_id?: string;
  candidate_users?: string[];
  candidate_roles?: string[];
  title: string;
  description?: string;
  form_data?: Record<string, unknown>;
  status: TaskStatus;
  priority: Priority;
  due_date?: string;
  completed_at?: string;
  completed_by?: string;
  completion_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskListQuery {
  assigneeId?: string;
  status?: TaskStatus;
  limit?: number;
  offset?: number;
}

export interface ClaimTaskInput {
  comment?: string;
}

export interface CompleteTaskInput {
  comment?: string;
  formData?: Record<string, unknown>;
}

export interface TaskListResponse {
  success: boolean;
  data: WorkflowTask[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface TaskResponse {
  success: boolean;
  data: WorkflowTask;
  message?: string;
  warning?: string;
}

// ==================== API 方法 ====================

/**
 * 获取任务列表
 */
export async function getTasks(params?: TaskListQuery): Promise<TaskListResponse> {
  const query = new URLSearchParams();
  if (params?.assigneeId) query.set('assigneeId', params.assigneeId);
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const res = await api.get(`/v1/workflow-tasks${query.toString() ? `?${query}` : ''}`);
  return res.data as unknown as TaskListResponse;
}

/**
 * 获取单个任务详情
 */
export async function getTask(id: string): Promise<WorkflowTask> {
  const res = await api.get(`/v1/workflow-tasks/${id}`);
  return (res.data as unknown as TaskResponse).data;
}

/**
 * 认领任务
 */
export async function claimTask(id: string, data?: ClaimTaskInput): Promise<WorkflowTask> {
  const res = await api.post(`/v1/workflow-tasks/${id}/claim`, data);
  return (res.data as unknown as TaskResponse).data;
}

/**
 * 完成任务
 */
export async function completeTask(
  id: string,
  data?: CompleteTaskInput
): Promise<{ task: WorkflowTask; warning?: string }> {
  const res = await api.post(`/v1/workflow-tasks/${id}/complete`, data);
  const response = res.data as unknown as TaskResponse;
  return {
    task: response.data,
    warning: response.warning,
  };
}