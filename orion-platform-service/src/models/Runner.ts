/**
 * Runner 数据模型 — 构建资源池 (GAP-CN-07)
 *
 * 表示一个远程 Runner/Agent，可以执行 Pipeline 任务。
 */

import { v4 as uuidv4 } from 'uuid';

export type RunnerStatus = 'online' | 'offline' | 'busy' | 'draining';

export interface RunnerMetadata {
  os?: string;
  arch?: string;
  version?: string;
  [key: string]: unknown;
}

export interface Runner {
  id: string;
  tenantId: string;
  name: string;
  status: RunnerStatus;
  labels: string[];
  maxConcurrent: number;
  currentJobs: number;
  lastHeartbeat: Date;
  metadata: RunnerMetadata;
  endpoint?: string;  // Runner HTTP endpoint, e.g., http://runner-1:8080
  createdAt: Date;
}

export interface RunnerCreateInput {
  tenantId: string;
  name: string;
  labels: string[];
  maxConcurrent: number;
  metadata?: RunnerMetadata;
  endpoint?: string;
}

export interface RunnerUpdateInput {
  status?: RunnerStatus;
  labels?: string[];
  maxConcurrent?: number;
  metadata?: RunnerMetadata;
  endpoint?: string;
}

export function createRunner(input: RunnerCreateInput): Runner {
  const now = new Date();
  return {
    id: uuidv4(),
    tenantId: input.tenantId,
    name: input.name,
    status: 'online',
    labels: input.labels || [],
    maxConcurrent: input.maxConcurrent,
    currentJobs: 0,
    lastHeartbeat: now,
    metadata: input.metadata || {},
    endpoint: input.endpoint,
    createdAt: now,
  };
}

export function isRunnerAvailable(runner: Runner): boolean {
  return runner.status === 'online' && runner.currentJobs < runner.maxConcurrent;
}

export function getRunnerUtilization(runner: Runner): number {
  if (runner.maxConcurrent === 0) return 1;
  return runner.currentJobs / runner.maxConcurrent;
}

/**
 * Check if runner has been stale (no heartbeat within timeout).
 * @param runner The runner to check
 * @param timeoutMinutes Heartbeat timeout in minutes (default: 5)
 */
export function isRunnerStale(runner: Runner, timeoutMinutes = 5): boolean {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const now = new Date();
  const lastHeartbeat = new Date(runner.lastHeartbeat);
  return (now.getTime() - lastHeartbeat.getTime()) > timeoutMs;
}
