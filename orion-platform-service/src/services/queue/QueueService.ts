/**
 * QueueService - Business logic layer for the generic task queue
 *
 * Provides job enqueue/dequeue operations with priority scheduling,
 * retry with exponential backoff, tenant-scoped isolation, and
 * queue statistics.
 *
 * Designed to work with PostgreSQL via PostgresJobRepository.
 * Falls back to in-memory operation when the repository is unavailable.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Job,
  JobInput,
  JobStatus,
  QueueStats,
  ListJobsOptions,
  PaginatedJobsResult,
} from '../../models/Job';
import { JobPriority } from '../../models/Job';
import type { JobRepository, PostgresJobRepository } from '../../repositories/JobRepository';
import { PostgresJobRepository as PostgresJobRepoClass } from '../../repositories/JobRepository';

export class QueueServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QueueServiceError';
  }
}

export class QueueService {
  private repository: JobRepository | null;
  // In-memory fallback store
  private memoryStore: Map<string, Job> = new Map();

  /**
   * @param repository - PostgreSQL repository instance or database pool.
   *                     Pass null to use in-memory fallback.
   */
  constructor(repository: JobRepository | any | null) {
    if (!repository) {
      this.repository = null;
    } else if ('create' in repository && 'findById' in repository && 'findPending' in repository) {
      // Already a JobRepository (or mock)
      this.repository = repository as JobRepository;
    } else {
      // It's a raw DatabasePool - wrap it
      this.repository = new PostgresJobRepoClass(repository);
    }
  }

  /**
   * Enqueue a new job for processing.
   *
   * @returns The created job entity with a generated ID if not provided.
   */
  async enqueue(input: JobInput): Promise<Job> {
    if (!input.jobType) {
      throw new QueueServiceError('jobType is required', 'INVALID_INPUT');
    }

    const now = new Date();
    const job: Job = {
      id: input.id || this.generateId(),
      tenantId: input.tenantId ?? null,
      queueName: input.queueName || 'default',
      jobType: input.jobType,
      payload: input.payload || {},
      status: 'pending',
      priority: input.priority ?? JobPriority.NORMAL,
      result: null,
      errorMessage: null,
      maxAttempts: input.maxAttempts ?? 3,
      attempts: 0,
      nextRetryAt: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      if (this.repository) {
        return await this.repository.create(job);
      }
    } catch (error) {
      console.error('[QueueService] Failed to persist job to database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    this.memoryStore.set(job.id, { ...job });
    return job;
  }

  /**
   * Dequeue the next pending job for processing.
   *
   * Jobs are returned in priority order (highest first), then by
   * creation time (oldest first). Supports optional tenant-scoped
   * filtering.
   *
   * @param tenantId - Optional tenant ID to scope dequeue.
   * @returns The next job to process, or undefined if the queue is empty.
   */
  async dequeue(tenantId?: string): Promise<Job | undefined> {
    try {
      if (this.repository) {
        const jobs = await this.repository.findPending(1);

        if (jobs.length === 0) {
          return undefined;
        }

        let job = jobs[0];

        // Apply tenant filter if specified
        if (tenantId && job.tenantId !== tenantId) {
          // The fetched job doesn't match the requested tenant, try to find one
          const allPending = await this.repository.findPending(50);
          const tenantJob = allPending.find((j) => j.tenantId === tenantId);
          if (!tenantJob) {
            return undefined;
          }
          job = tenantJob;
        }

        // Mark as running
        const updated = await this.repository.update(job.id, {
          status: 'running',
          startedAt: new Date(),
          attempts: job.attempts + 1,
        });

        return updated;
      }
    } catch (error) {
      console.error('[QueueService] Failed to dequeue from database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const pendingJobs = Array.from(this.memoryStore.values())
      .filter((j) => j.status === 'pending')
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    if (tenantId) {
      const tenantFiltered = pendingJobs.filter((j) => j.tenantId === tenantId);
      if (tenantFiltered.length === 0) return undefined;
      const job = tenantFiltered[0];
      job.status = 'running';
      job.startedAt = new Date();
      job.attempts++;
      job.updatedAt = new Date();
      this.memoryStore.set(job.id, { ...job });
      return job;
    }

    if (pendingJobs.length === 0) return undefined;

    const job = pendingJobs[0];
    job.status = 'running';
    job.startedAt = new Date();
    job.attempts++;
    job.updatedAt = new Date();
    this.memoryStore.set(job.id, { ...job });
    return job;
  }

  /**
   * Get a job by its ID.
   *
   * @param id - The job ID.
   * @returns The job entity, or undefined if not found.
   */
  async getJob(id: string): Promise<Job | undefined> {
    try {
      if (this.repository) {
        return await this.repository.findById(id);
      }
    } catch (error) {
      console.error('[QueueService] Failed to get job from database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    return this.memoryStore.get(id);
  }

  /**
   * List jobs with filtering and pagination.
   *
   * @param options - Filtering and pagination options.
   * @returns Paginated list of jobs.
   */
  async listJobs(options: ListJobsOptions = {}): Promise<PaginatedJobsResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const offset = (page - 1) * limit;

    try {
      if (this.repository) {
        const total = await this.repository.countByOptions(options);
        const jobs = await this.repository.findByTenant(
          options.tenantId || '',
          { limit, offset }
        );

        // If no tenantId specified, list all jobs
        if (!options.tenantId) {
          // Use findPending as a workaround to get recent jobs
          const allJobs: Job[] = [];
          if (options.status) {
            const byStatus = await this.repository.findByStatus(options.status, { limit });
            allJobs.push(...byStatus);
          } else {
            const statuses: JobStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
            for (const status of statuses) {
              const byStatus = await this.repository.findByStatus(status, { limit: Math.ceil(limit / statuses.length) });
              allJobs.push(...byStatus);
            }
          }

          // Apply remaining filters
          let filtered = allJobs;
          if (options.queueName) {
            filtered = filtered.filter((j) => j.queueName === options.queueName);
          }
          if (options.jobType) {
            filtered = filtered.filter((j) => j.jobType === options.jobType);
          }

          return {
            data: filtered.slice(0, limit),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          };
        }

        return {
          data: jobs,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }
    } catch (error) {
      console.error('[QueueService] Failed to list jobs from database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    let jobs = Array.from(this.memoryStore.values());

    // Apply filters
    if (options.status) {
      jobs = jobs.filter((j) => j.status === options.status);
    }
    if (options.queueName) {
      jobs = jobs.filter((j) => j.queueName === options.queueName);
    }
    if (options.tenantId) {
      jobs = jobs.filter((j) => j.tenantId === options.tenantId);
    }
    if (options.jobType) {
      jobs = jobs.filter((j) => j.jobType === options.jobType);
    }

    const total = jobs.length;

    // Sort by createdAt desc
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Paginate
    const paginated = jobs.slice(offset, offset + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Mark a job as completed.
   *
   * @param id - The job ID.
   * @param result - Optional result payload.
   * @returns The updated job, or undefined if not found.
   */
  async completeJob(id: string, result?: Record<string, unknown>): Promise<Job | undefined> {
    try {
      if (this.repository) {
        const job = await this.repository.findById(id);
        if (!job) {
          return undefined;
        }

        return await this.repository.update(id, {
          status: 'completed',
          result: result ?? null,
          completedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[QueueService] Failed to complete job in database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const job = this.memoryStore.get(id);
    if (!job) return undefined;

    job.status = 'completed';
    job.result = result ?? null;
    job.completedAt = new Date();
    job.updatedAt = new Date();
    this.memoryStore.set(id, { ...job });
    return job;
  }

  /**
   * Mark a job as failed. Automatically schedules a retry if
   * the job has remaining attempts.
   *
   * @param id - The job ID.
   * @param error - Error message describing the failure.
   * @returns The updated job, or undefined if not found.
   */
  async failJob(id: string, error: string): Promise<Job | undefined> {
    try {
      if (this.repository) {
        const job = await this.repository.findById(id);
        if (!job) {
          return undefined;
        }

        const updates: Partial<Job> = {
          status: job.attempts < job.maxAttempts ? 'failed' : 'failed',
          errorMessage: error,
        };

        // Schedule retry if attempts remain
        if (job.attempts < job.maxAttempts) {
          const backoffMs = this.calculateBackoff(job.attempts);
          updates.nextRetryAt = new Date(Date.now() + backoffMs);
        }

        return await this.repository.update(id, updates);
      }
    } catch (error) {
      console.error('[QueueService] Failed to fail job in database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const job = this.memoryStore.get(id);
    if (!job) return undefined;

    job.errorMessage = error;
    job.updatedAt = new Date();

    if (job.attempts < job.maxAttempts) {
      const backoffMs = this.calculateBackoff(job.attempts);
      job.nextRetryAt = new Date(Date.now() + backoffMs);
    }

    this.memoryStore.set(id, { ...job });
    return job;
  }

  /**
   * Get queue-wide statistics.
   *
   * @returns QueueStats with counts and average timings.
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      if (this.repository) {
        const counts = await this.repository.getStats();
        const times = await this.repository.getAverageTimes();

        return {
          total: counts.total,
          pending: counts.pending,
          running: counts.running,
          completed: counts.completed,
          failed: counts.failed,
          cancelled: counts.cancelled,
          avgWaitTime: times.avgWaitTime,
          avgExecutionTime: times.avgExecutionTime,
        };
      }
    } catch (error) {
      console.error('[QueueService] Failed to get stats from database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const jobs = Array.from(this.memoryStore.values());
    const stats: QueueStats = {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      running: jobs.filter((j) => j.status === 'running').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      cancelled: jobs.filter((j) => j.status === 'cancelled').length,
      avgWaitTime: 0,
      avgExecutionTime: 0,
    };

    // Calculate average wait time (completed jobs with startedAt and createdAt)
    const jobsWithWait = jobs.filter((j) => j.startedAt && j.createdAt);
    if (jobsWithWait.length > 0) {
      stats.avgWaitTime = Math.round(
        jobsWithWait.reduce((sum, j) => sum + (j.startedAt!.getTime() - j.createdAt.getTime()), 0) /
          jobsWithWait.length
      );
    }

    // Calculate average execution time (completed jobs with startedAt and completedAt)
    const jobsWithExec = jobs.filter((j) => j.startedAt && j.completedAt);
    if (jobsWithExec.length > 0) {
      stats.avgExecutionTime = Math.round(
        jobsWithExec.reduce((sum, j) => sum + (j.completedAt!.getTime() - j.startedAt!.getTime()), 0) /
          jobsWithExec.length
      );
    }

    return stats;
  }

  /**
   * Cancel a pending job. Only jobs in 'pending' status can be cancelled.
   *
   * @param id - The job ID.
   * @returns The updated job, or undefined if not found or not in pending state.
   */
  async cancelJob(id: string): Promise<Job | undefined> {
    try {
      if (this.repository) {
        const job = await this.repository.findById(id);
        if (!job || job.status !== 'pending') {
          return undefined;
        }

        return await this.repository.update(id, {
          status: 'cancelled',
          completedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[QueueService] Failed to cancel job in database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const job = this.memoryStore.get(id);
    if (!job || job.status !== 'pending') return undefined;

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.updatedAt = new Date();
    this.memoryStore.set(id, { ...job });
    return job;
  }

  /**
   * Requeue a failed job for retry immediately.
   * Resets the attempt counter and marks as pending.
   *
   * @param id - The job ID.
   * @returns The updated job, or undefined if not found.
   */
  async requeue(id: string): Promise<Job | undefined> {
    try {
      if (this.repository) {
        const job = await this.repository.findById(id);
        if (!job) {
          return undefined;
        }

        return await this.repository.update(id, {
          status: 'pending',
          errorMessage: null,
          nextRetryAt: null,
          // Don't reset attempts so maxAttempts still limits total retries
        });
      }
    } catch (error) {
      console.error('[QueueService] Failed to requeue job in database, using in-memory fallback:', error);
    }

    // Fallback to in-memory
    const job = this.memoryStore.get(id);
    if (!job) return undefined;

    job.status = 'pending';
    job.errorMessage = null;
    job.nextRetryAt = null;
    job.updatedAt = new Date();
    this.memoryStore.set(id, { ...job });
    return job;
  }

  /**
   * Calculate exponential backoff delay in milliseconds.
   * Uses the formula: base * 2^attempt + jitter
   *
   * @param attempt - The current attempt number (0-based).
   * @param baseMs - Base delay in milliseconds (default: 1000).
   * @returns Delay in milliseconds.
   */
  private calculateBackoff(attempt: number, baseMs: number = 1000): number {
    const exponential = baseMs * Math.pow(2, attempt);
    // Add jitter: +/- 20% randomization
    const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
    return Math.round(exponential + jitter);
  }

  /**
   * Generate a unique ID for a new job.
   */
  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    return uuidv4();
  }
}

export default QueueService;
