/**
 * Build Models
 *
 * 构建记录数据模型，对应 migration 006 的 builds 表。
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Build 状态
 */
export enum BuildStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Build 记录
 */
export interface Build {
  id: string;
  tenantId: string;
  projectId: string | null;
  pipelineRunId: string | null;
  image: string | null;
  tag: string | null;
  status: BuildStatus;
  sourceRef: string | null;
  buildArgs: Record<string, any>;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * 创建 Build 输入
 */
export interface BuildCreateInput {
  tenantId: string;
  projectId?: string | null;
  pipelineRunId?: string | null;
  image?: string | null;
  tag?: string | null;
  sourceRef?: string | null;
  buildArgs?: Record<string, any>;
}

/**
 * 更新 Build 输入
 */
export interface BuildUpdateInput {
  image?: string | null;
  tag?: string | null;
  status?: BuildStatus;
  sourceRef?: string | null;
  buildArgs?: Record<string, any>;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  errorMessage?: string | null;
}

/**
 * Build 查询选项
 */
export interface BuildQueryOptions {
  tenantId?: string;
  projectId?: string | null;
  pipelineRunId?: string | null;
  status?: BuildStatus;
  limit?: number;
  offset?: number;
}

/**
 * 创建 Build（工具函数）
 */
export function createBuild(input: BuildCreateInput): Build {
  const now = new Date();
  return {
    id: uuidv4(),
    tenantId: input.tenantId,
    projectId: input.projectId || null,
    pipelineRunId: input.pipelineRunId || null,
    image: input.image || null,
    tag: input.tag || null,
    status: BuildStatus.PENDING,
    sourceRef: input.sourceRef || null,
    buildArgs: input.buildArgs || {},
    startedAt: null,
    completedAt: null,
    durationMs: null,
    errorMessage: null,
    createdAt: now,
  };
}
