// src/types/pipeline.ts
// Pipeline 引擎类型定义

/** Pipeline 状态 */
export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived';

/** Pipeline 运行状态 */
export type PipelineRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/** Pipeline 阶段定义 */
export interface PipelineStage {
  /** 阶段唯一 ID */
  id: string;
  /** 阶段名称 */
  name: string;
  /** 阶段类型 (build, test, deploy, etc.) */
  type: string;
  /** 阶段执行命令或脚本路径 */
  command: string;
  /** 依赖的前置阶段 ID 列表 */
  dependsOn: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间 (ms) */
  timeoutMs?: number;
  /** 失败重试次数 */
  retries?: number;
  /** 失败时是否继续后续阶段 */
  continueOnError?: boolean;
}

/** Pipeline 触发器配置 */
export interface PipelineTrigger {
  /** 触发器类型: manual, schedule, webhook, event */
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  /** Cron 表达式 (仅 schedule 类型) */
  cron?: string;
  /** Webhook 事件过滤器 (仅 webhook/event 类型) */
  events?: string[];
}

/** Pipeline 定义 */
export interface Pipeline {
  /** Pipeline ID */
  id: string;
  /** 所属租户 ID */
  tenantId: string;
  /** 所属项目 ID */
  projectId: string;
  /** Pipeline 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 状态 */
  status: PipelineStatus;
  /** 阶段列表 */
  stages: PipelineStage[];
  /** 触发器配置 */
  triggers?: PipelineTrigger[];
  /** 环境变量模板 */
  envTemplate?: Record<string, string>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 创建人 ID */
  createdBy: string;
}

/** Pipeline 运行记录 */
export interface PipelineRun {
  /** 运行 ID */
  runId: string;
  /** Pipeline ID */
  pipelineId: string;
  /** 所属租户 ID */
  tenantId: string;
  /** 运行状态 */
  status: PipelineRunStatus;
  /** 当前执行阶段 */
  currentStage?: string;
  /** 阶段执行结果 */
  stageResults: Record<string, StageRunResult>;
  /** 开始时间 */
  startedAt: string;
  /** 结束时间 */
  finishedAt?: string;
  /** 触发方式 */
  triggeredBy: 'manual' | 'schedule' | 'webhook' | 'event';
  /** 触发人 ID (manual 触发时) */
  triggeredByUserId?: string;
  /** 错误信息 */
  error?: string;
}

/** 阶段运行结果 */
export interface StageRunResult {
  stageId: string;
  status: 'success' | 'failed' | 'skipped' | 'cancelled';
  exitCode?: number;
  startedAt: string;
  finishedAt?: string;
  logRef?: string;
}

/** 创建 Pipeline 请求体 */
export interface CreatePipelineRequest {
  name: string;
  description?: string;
  stages: Omit<PipelineStage, 'id'>[];
  triggers?: PipelineTrigger[];
  envTemplate?: Record<string, string>;
}

/** 更新 Pipeline 请求体 */
export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  stages?: Omit<PipelineStage, 'id'>[];
  triggers?: PipelineTrigger[];
  envTemplate?: Record<string, string>;
  status?: PipelineStatus;
}

/** 运行 Pipeline 请求体 */
export interface RunPipelineRequest {
  /** 手动指定环境变量覆盖 */
  envOverrides?: Record<string, string>;
  /** 仅运行指定阶段 */
  stages?: string[];
}

/** 日志条目 */
export interface LogEntry {
  timestamp: string;
  stageId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  /** 原始输出行 */
  raw?: string;
}

// TODO: 添加 SSE 事件类型定义
// TODO: 添加分页查询相关类型
// TODO: 添加 webhook payload 类型
