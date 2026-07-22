/**
 * Data Pipeline Models
 *
 * 数据管道数据模型，用于数据管道创建、执行、调度及血缘追踪。
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 管道状态
 */
export enum PipelineStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled',
}

/**
 * 管道执行状态
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 调度类型
 */
export enum ScheduleType {
  MANUAL = 'manual',
  CRON = 'cron',
  EVENT = 'event',
}

/**
 * 数据管道实体
 */
export interface DataPipeline {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  input_config: Record<string, any>;
  processors: Array<{
    type: string;
    config: Record<string, any>;
    order: number;
  }>;
  output_config: Record<string, any>;
  status: PipelineStatus;
  schedule_type: ScheduleType;
  cron_expression: string | null;
  last_run_id: string | null;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建数据管道输入
 */
export interface DataPipelineCreateInput {
  name: string;
  description?: string;
  input_config: Record<string, any>;
  processors: Array<{
    type: string;
    config: Record<string, any>;
    order: number;
  }>;
  output_config: Record<string, any>;
  created_by?: string;
}

/**
 * 管道执行记录
 */
export interface PipelineExecution {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  status: ExecutionStatus;
  started_at: Date;
  finished_at: Date | null;
  input_count: number;
  output_count: number;
  error_message: string | null;
  metadata: Record<string, any>;
}

/**
 * 数据血缘节点
 */
export interface DataLineageNode {
  id: string;
  type: 'source' | 'processor' | 'sink';
  name: string;
  config: Record<string, any>;
}

/**
 * 数据血缘边
 */
export interface DataLineageEdge {
  from: string;
  to: string;
  transform: string;
}

/**
 * 数据血缘
 */
export interface DataLineage {
  pipeline_id: string;
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
}

/**
 * 创建数据管道（工具函数）
 */
export function createDataPipeline(
  tenantId: string,
  input: DataPipelineCreateInput,
): DataPipeline {
  const now = new Date();
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    name: input.name,
    description: input.description || '',
    input_config: input.input_config,
    processors: input.processors,
    output_config: input.output_config,
    status: PipelineStatus.DRAFT,
    schedule_type: ScheduleType.MANUAL,
    cron_expression: null,
    last_run_id: null,
    last_run_at: null,
    next_run_at: null,
    created_by: input.created_by || 'system',
    created_at: now,
    updated_at: now,
  };
}

/**
 * 创建执行记录（工具函数）
 */
export function createPipelineExecution(
  tenantId: string,
  pipelineId: string,
): PipelineExecution {
  return {
    id: uuidv4(),
    tenant_id: tenantId,
    pipeline_id: pipelineId,
    status: ExecutionStatus.PENDING,
    started_at: new Date(),
    finished_at: null,
    input_count: 0,
    output_count: 0,
    error_message: null,
    metadata: {},
  };
}
