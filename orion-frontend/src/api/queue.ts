/**
 * Queue Management API Service
 * Queue job operations: enqueue, dequeue, complete, fail, and statistics
 */
import { api } from './client';

// ---- Types ----

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueJob {
  id: string;
  tenant_id: string;
  queue: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  created_at: string;
}

export interface EnqueueInput {
  tenantId: string;
  payload: Record<string, unknown>;
}

export interface DequeueInput {
  limit?: number;
}

export interface JobListParams {
  tenantId?: string;
  queue?: string;
  status?: JobStatus;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

// ---- Job Operations ----

/**
 * Enqueue a job to a specific queue
 * POST /queue/:queueName/jobs
 */
export function enqueueJob(queueName: string, data: EnqueueInput) {
  return api.post<QueueJob>(`/queue/${queueName}/jobs`, data);
}

/**
 * Dequeue jobs from a queue for processing
 * POST /queue/:queueName/dequeue
 */
export function dequeueJob(queueName: string, data?: DequeueInput) {
  return api.post<{ jobs: QueueJob[]; count: number }>(`/queue/${queueName}/dequeue`, data);
}

// ---- Job State Management ----

/**
 * Mark a job as completed
 * POST /queue/jobs/:id/complete
 */
export function completeJob(id: string) {
  return api.post(`/queue/jobs/${id}/complete`);
}

/**
 * Mark a job as failed
 * POST /queue/jobs/:id/fail
 */
export function failJob(id: string) {
  return api.post(`/queue/jobs/${id}/fail`);
}

// ---- Query Operations ----

/**
 * List jobs with optional filters
 * GET /queue/jobs
 */
export function listJobs(params?: JobListParams) {
  return api.get<{ jobs: QueueJob[]; count: number }>('/queue/jobs', { params });
}

/**
 * Get job by ID
 * GET /queue/jobs/:id
 */
export function getJob(id: string) {
  return api.get<QueueJob>(`/queue/jobs/${id}`);
}

// ---- Stats ----

/**
 * Get queue statistics
 * GET /queue/stats
 */
export function getQueueStats() {
  return api.get<QueueStats>('/queue/stats');
}
