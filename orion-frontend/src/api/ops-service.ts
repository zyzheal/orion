/**
 * Ops Service API - 运维操作平台
 * 提供主机管理、终端连接、批量执行、计划任务 API
 */
import { api } from './client';

// ==================== 类型定义 ====================

export interface Session {
  id: string;
  user_id: string;
  host_id: string;
  session_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  name: string;
  command: string;
  target_hosts: string[];
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  result?: TaskResult[];
}

export interface TaskResult {
  host_id: string;
  host_name: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  executed_at: string;
}

export interface CronJob {
  id: string;
  name: string;
  command: string;
  cron_expr: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_run?: string;
  next_run?: string;
}

export interface Host {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: 'online' | 'offline' | 'unknown';
  os: string;
  tags: string[];
  last_heartbeat?: string;
  created_at: string;
}

// ==================== Session API ====================

/**
 * 创建新的终端会话
 */
export const createSession = (hostId: string, sessionType: string) =>
  api.post<Session>('/ops/sessions', {
    host_id: hostId,
    session_type: sessionType,
  });

/**
 * 获取会话详情
 */
export const getSession = (id: string) =>
  api.get<Session>(`/ops/sessions/${id}`);

/**
 * 关闭终端会话
 */
export const closeSession = (id: string) =>
  api.delete<void>(`/ops/sessions/${id}`);

/**
 * 获取当前用户的所有会话
 */
export const listSessions = () =>
  api.get<Session[]>('/ops/sessions');


// ==================== Batch Execution API ====================

/**
 * 创建并执行批量任务
 */
export const executeBatch = (name: string, command: string, hosts: string[]) =>
  api.post<Task>('/ops/tasks', {
    name,
    command,
    target_hosts: hosts,
  });

/**
 * 获取任务详情
 */
export const getTask = (id: string) =>
  api.get<Task>(`/ops/tasks/${id}`);

/**
 * 获取任务执行结果
 */
export const getTaskResults = (id: string) =>
  api.get<TaskResult[]>(`/ops/tasks/${id}/results`);

/**
 * 获取所有任务列表
 */
export const listTasks = () =>
  api.get<Task[]>('/ops/tasks');

/**
 * 取消正在执行的任务
 */
export const cancelTask = (id: string) =>
  api.post<void>(`/ops/tasks/${id}/cancel`, {});


// ==================== Cron Jobs API ====================

/**
 * 获取所有计划任务
 */
export const getCronJobs = () =>
  api.get<CronJob[]>('/ops/cron');

/**
 * 获取单个计划任务
 */
export const getCronJob = (id: string) =>
  api.get<CronJob>(`/ops/cron/${id}`);

/**
 * 创建计划任务
 */
export const createCronJob = (data: {
  name: string;
  command: string;
  cron_expr: string;
  enabled?: boolean;
}) =>
  api.post<CronJob>('/ops/cron', data);

/**
 * 更新计划任务
 */
export const updateCronJob = (id: string, data: Partial<Omit<CronJob, 'id' | 'created_at' | 'updated_at'>>) =>
  api.put<CronJob>(`/ops/cron/${id}`, data);

/**
 * 删除计划任务
 */
export const deleteCronJob = (id: string) =>
  api.delete<void>(`/ops/cron/${id}`);

/**
 * 手动触发计划任务
 */
export const triggerCronJob = (id: string) =>
  api.post<CronJob>(`/ops/cron/${id}/trigger`, {});


// ==================== Hosts API ====================

/**
 * 获取所有主机
 */
export const getHosts = () =>
  api.get<Host[]>('/ops/hosts');

/**
 * 获取单个主机
 */
export const getHost = (id: string) =>
  api.get<Host>(`/ops/hosts/${id}`);

/**
 * 添加主机
 */
export const createHost = (data: {
  name: string;
  ip: string;
  port: number;
  os?: string;
  tags?: string[];
}) =>
  api.post<Host>('/ops/hosts', data);

/**
 * 更新主机
 */
export const updateHost = (id: string, data: Partial<Omit<Host, 'id' | 'created_at'>>) =>
  api.put<Host>(`/ops/hosts/${id}`, data);

/**
 * 删除主机
 */
export const deleteHost = (id: string) =>
  api.delete<void>(`/ops/hosts/${id}`);

/**
 * 测试主机连接
 */
export const testHostConnection = (id: string) =>
  api.post<{ success: boolean; latency: number; message: string }>(`/ops/hosts/${id}/test`, {});


// ==================== 导出所有 API ====================

export default {
  // Session
  createSession,
  getSession,
  closeSession,
  listSessions,
  // Task
  executeBatch,
  getTask,
  getTaskResults,
  listTasks,
  cancelTask,
  // Cron
  getCronJobs,
  getCronJob,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  triggerCronJob,
  // Host
  getHosts,
  getHost,
  createHost,
  updateHost,
  deleteHost,
  testHostConnection,
};