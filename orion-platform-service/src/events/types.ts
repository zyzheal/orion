/**
 * Pipeline 事件类型定义
 *
 * 符合 CloudEvents 1.0 规范
 * @see https://cloudevents.io/
 */

import { CloudEventType } from '@orion/event-bus';

/**
 * Pipeline 事件类型
 */
export type PipelineEventType =
  | 'pipeline.run.created'
  | 'pipeline.run.started'
  | 'pipeline.run.completed'
  | 'pipeline.run.failed'
  | 'pipeline.run.cancelled'
  | 'pipeline.stage.started'
  | 'pipeline.stage.completed'
  | 'pipeline.stage.failed'
  | 'pipeline.stage.skipped'
  | 'pipeline.task.started'
  | 'pipeline.task.completed'
  | 'pipeline.task.failed';

/**
 * Stage 信息
 */
export interface StageInfo {
  id: string;
  name: string;
  sequence: number;
  status: string;
  dependsOn: string[];
}

/**
 * PipelineRun 事件数据
 */
export interface PipelineRunEventData {
  /** Pipeline ID */
  pipelineId: string;
  /** Pipeline 版本 */
  pipelineVersion: string;
  /** 执行 ID */
  runId: string;
  /** 执行状态 */
  status: string;
  /** 触发类型 */
  triggerType: string;
  /** 触发人 */
  triggeredBy?: string;
  /** Stage 列表 */
  stages?: StageInfo[];
  /** Git 引用 */
  gitRef?: string;
  /** Git SHA */
  gitSha?: string;
  /** 执行耗时 (ms) */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Stage 事件数据
 */
export interface StageEventData {
  /** Pipeline 执行 ID */
  runId: string;
  /** Pipeline ID */
  pipelineId?: string;
  /** Stage ID */
  stageId: string;
  /** Stage 名称 */
  stageName: string;
  /** Stage 序号 */
  sequence: number;
  /** Stage 状态 */
  status: string;
  /** 执行耗时 (ms) */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * Task 事件数据
 */
export interface TaskEventData {
  /** Pipeline 执行 ID */
  runId: string;
  /** Stage ID */
  stageId: string;
  /** Task ID */
  taskId: string;
  /** Task 名称 */
  taskName: string;
  /** Task 序号 */
  sequence: number;
  /** Task 状态 */
  status: string;
  /** 执行耗时 (ms) */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * 事件上下文扩展
 */
export interface PipelineEventExtensions {
  /** 租户 ID */
  tenantId: string;
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId: string;
  /** 事件版本 */
  version?: string;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high' | 'critical';
}
