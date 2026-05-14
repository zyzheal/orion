/** Runner model */

export type RunnerStatus = 'online' | 'offline' | 'busy' | 'draining';

export interface Runner {
  id: string;
  tenantId: string;
  name: string;
  status: RunnerStatus;
  labels: string[];
  maxConcurrent: number;
  currentJobs: number;
  lastHeartbeat: Date;
  metadata: Record<string, any>;
  endpoint?: string;
  createdAt: Date;
}

export interface RunnerCreateInput {
  tenantId: string;
  name: string;
  labels: string[];
  maxConcurrent: number;
  metadata?: Record<string, any>;
  endpoint?: string;
}

export interface RunnerUpdateInput {
  status?: RunnerStatus;
  labels?: string[];
  maxConcurrent?: number;
  metadata?: Record<string, any>;
  endpoint?: string;
}
