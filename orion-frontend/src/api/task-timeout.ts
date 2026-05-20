/**
 * Task Timeout API Client
 *
 * Backend routes: orion-platform-service/src/api/task-timeout-routes.ts
 */

import { api } from './client';

/**
 * 超时处理动作
 */
export type TimeoutAction = 'remind' | 'escalate' | 'auto_complete' | 'cancel';

/**
 * 超时任务信息（来自后端 GET /v1/task-timeouts/timed-out）
 */
export interface TimedOutTask {
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    assigneeId?: string;
    assigneeName?: string;
    dueDate?: string;
    createdAt: string;
    updatedAt?: string;
  };
  overdueHours: number;
  timeoutAction: TimeoutAction;
}

/**
 * 手动触发检查响应（来自后端 POST /v1/task-timeouts/check-now）
 */
export interface CheckNowResult {
  checkedTasks: number;
  tasks: Array<{
    taskId: string;
    title: string;
    overdueHours: number;
    action: TimeoutAction;
  }>;
}

/**
 * 检查器状态（来自后端 GET /v1/task-timeouts/status）
 */
export interface TimeoutStatus {
  isRunning: boolean;
  processedEventsCount: number;
}

/**
 * 获取当前超时任务列表
 */
export async function getTimedOutTasks() {
  return api.get<{ data: TimedOutTask[] }>('/v1/task-timeouts/timed-out');
}

/**
 * 手动触发超时检查
 */
export async function triggerCheckNow() {
  return api.post<{ data: CheckNowResult }>('/v1/task-timeouts/check-now');
}

/**
 * 获取超时检查器状态
 */
export async function getTimeoutStatus() {
  return api.get<{ data: TimeoutStatus }>('/v1/task-timeouts/status');
}