/**
 * Queue Job Model
 *
 * Defines the data structures for the generic task queue system.
 * Jobs are persisted in PostgreSQL and support priority-based
 * dequeue, retry with backoff, and tenant-scoped isolation.
 */

/**
 * Possible statuses for a queue job
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Priority levels for job scheduling
 */
export enum JobPriority {
  LOW = -1,
  NORMAL = 0,
  HIGH = 1,
  CRITICAL = 2,
}

/**
 * Input for creating a new job (enqueue)
 */
export interface JobInput {
  /** ID for the job. If not provided, one will be generated. */
  id?: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Queue name (default: 'default') */
  queueName?: string;
  /** Job type identifier (e.g. 'pipeline-execution', 'email-send') */
  jobType: string;
  /** Arbitrary payload data for the job */
  payload?: Record<string, unknown>;
  /** Priority level (default: 0 = NORMAL) */
  priority?: number;
  /** Maximum retry attempts (default: 3) */
  maxAttempts?: number;
}

/**
 * Full job entity as stored in the database
 */
export interface Job {
  id: string;
  tenantId: string | null;
  queueName: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  maxAttempts: number;
  attempts: number;
  nextRetryAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgWaitTime: number; // ms
  avgExecutionTime: number; // ms
}

/**
 * Options for listing jobs
 */
export interface ListJobsOptions {
  page?: number;
  limit?: number;
  status?: JobStatus;
  queueName?: string;
  tenantId?: string;
  jobType?: string;
}

/**
 * Paginated result for job listings
 */
export interface PaginatedJobsResult {
  data: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
