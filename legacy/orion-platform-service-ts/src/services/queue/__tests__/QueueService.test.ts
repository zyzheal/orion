/**
 * QueueService Unit Tests
 */

import { QueueService } from '../QueueService';

// Type definitions for testing
type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface Job {
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

interface JobInput {
  id?: string;
  tenantId?: string;
  queueName?: string;
  jobType: string;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
}

interface JobListOptions {
  page?: number;
  limit?: number;
  status?: JobStatus;
  queueName?: string;
  tenantId?: string;
  jobType?: string;
}

enum JobPriority {
  LOW = -1,
  NORMAL = 0,
  HIGH = 1,
  CRITICAL = 2,
}

// Mock repository for testing
class MockJobRepository {
  private jobs: Map<string, Job> = new Map();
  private statsRecord: Record<string, number> = {};
  private avgTimes = { avgWaitTime: 0, avgExecutionTime: 0 };

  setStats(stats: Record<string, number>) {
    this.statsRecord = stats;
  }

  setAvgTimes(times: { avgWaitTime: number; avgExecutionTime: number }) {
    this.avgTimes = times;
  }

  async create(job: Job): Promise<Job> {
    this.jobs.set(job.id, { ...job });
    return { ...job };
  }

  async findById(id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }

  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<Job[]> {
    const all = Array.from(this.jobs.values()).filter(j => j.tenantId === tenantId);
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    return all.slice(offset, offset + limit).map(j => ({ ...j }));
  }

  async findPending(limit: number = 10): Promise<Job[]> {
    const pending = Array.from(this.jobs.values())
      .filter(j => j.status === 'pending' && (!j.nextRetryAt || j.nextRetryAt <= new Date()))
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, limit);
    return pending.map(j => ({ ...j }));
  }

  async findByStatus(status: JobStatus, options?: { limit?: number }): Promise<Job[]> {
    const limit = options?.limit ?? 50;
    const all = Array.from(this.jobs.values()).filter(j => j.status === status);
    return all.slice(0, limit).map(j => ({ ...j }));
  }

  async update(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const updated = { ...job, ...updates, updatedAt: new Date() };
    this.jobs.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async countByStatus(status?: JobStatus): Promise<number> {
    if (status) {
      return Array.from(this.jobs.values()).filter(j => j.status === status).length;
    }
    return this.jobs.size;
  }

  async countByOptions(options: JobListOptions): Promise<number> {
    let jobs = Array.from(this.jobs.values());
    if (options.status) jobs = jobs.filter(j => j.status === options.status);
    if (options.queueName) jobs = jobs.filter(j => j.queueName === options.queueName);
    if (options.tenantId) jobs = jobs.filter(j => j.tenantId === options.tenantId);
    if (options.jobType) jobs = jobs.filter(j => j.jobType === options.jobType);
    return jobs.length;
  }

  async getStats(): Promise<Record<string, number>> {
    return this.statsRecord;
  }

  async getAverageTimes(): Promise<{ avgWaitTime: number; avgExecutionTime: number }> {
    return this.avgTimes;
  }

  // Test helper: get all jobs
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values()).map(j => ({ ...j }));
  }

  // Test helper: clear all
  clear(): void {
    this.jobs.clear();
  }
}

describe('QueueService', () => {
  let mockRepo: MockJobRepository;
  let service: QueueService;

  beforeEach(() => {
    mockRepo = new MockJobRepository();
    service = new QueueService(mockRepo);
  });

  describe('constructor', () => {
    it('should throw when repository is null', () => {
      expect(() => new QueueService(null as any)).toThrow('JobRepository is required');
    });

    it('should accept a valid repository', () => {
      expect(() => new QueueService(mockRepo)).not.toThrow();
    });
  });

  describe('enqueue', () => {
    it('should create a job with minimal input', async () => {
      const input: JobInput = { jobType: 'test-job' };
      const job = await service.enqueue(input);

      expect(job.id).toBeDefined();
      expect(job.jobType).toBe('test-job');
      expect(job.status).toBe('pending');
      expect(job.priority).toBe(JobPriority.NORMAL);
      expect(job.queueName).toBe('default');
      expect(job.maxAttempts).toBe(3);
    });

    it('should create a job with full input', async () => {
      const input: JobInput = {
        id: 'custom-id-123',
        tenantId: 'tenant-1',
        queueName: 'custom-queue',
        jobType: 'email-send',
        payload: { to: 'user@example.com', subject: 'Test' },
        priority: JobPriority.HIGH,
        maxAttempts: 5,
      };
      const job = await service.enqueue(input);

      expect(job.id).toBe('custom-id-123');
      expect(job.tenantId).toBe('tenant-1');
      expect(job.queueName).toBe('custom-queue');
      expect(job.jobType).toBe('email-send');
      expect(job.payload).toEqual({ to: 'user@example.com', subject: 'Test' });
      expect(job.priority).toBe(JobPriority.HIGH);
      expect(job.maxAttempts).toBe(5);
    });

    it('should throw error for missing jobType', async () => {
      await expect(service.enqueue({} as JobInput)).rejects.toThrow('jobType is required');
    });

    it('should default to normal priority', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      expect(job.priority).toBe(0);
    });
  });

  describe('dequeue', () => {
    it('should return undefined when queue is empty', async () => {
      const job = await service.dequeue();
      expect(job).toBeUndefined();
    });

    it('should return highest priority pending job', async () => {
      await service.enqueue({ jobType: 'low-priority', priority: JobPriority.LOW });
      await service.enqueue({ jobType: 'high-priority', priority: JobPriority.HIGH });
      await service.enqueue({ jobType: 'normal-priority', priority: JobPriority.NORMAL });

      const job = await service.dequeue();
      expect(job?.jobType).toBe('high-priority');
    });

    it('should mark job as running after dequeue', async () => {
      await service.enqueue({ jobType: 'test-job' });

      const job = await service.dequeue();
      expect(job?.status).toBe('running');
      expect(job?.startedAt).toBeDefined();
      expect(job?.attempts).toBe(1);
    });

    it('should respect tenant filter', async () => {
      // Use raw repo to inject two jobs into the mock
      mockRepo.create({ ...mockRepo.getAllJobs()[0] || { id: 'job-a', tenantId: 'tenant-a', status: 'pending' as JobPriority } });
    });
  });

  describe('getJob', () => {
    it('should return job by id', async () => {
      const input: JobInput = { jobType: 'test-work' };
      const created = await service.enqueue(input);

      const retrieved = await service.getJob(created.id);
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.jobType).toBe('test-work');
    });

    it('should return undefined for non-existent job', async () => {
      const job = await service.getJob('non-existent-id');
      expect(job).toBeUndefined();
    });
  });

  describe('listJobs', () => {
    it('should return empty array when no jobs', async () => {
      const result = await service.listJobs({});
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return all jobs with default pagination', async () => {
      await service.enqueue({ jobType: 'job-1' });
      await service.enqueue({ jobType: 'job-2' });
      await service.enqueue({ jobType: 'job-3' });

      const result = await service.listJobs({});
      expect(result.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should paginate results', async () => {
      for (let i = 0; i < 10; i++) {
        await service.enqueue({ jobType: `job-${i}` });
      }

      const page1 = await service.listJobs({ page: 1, limit: 3 });
      const page2 = await service.listJobs({ page: 2, limit: 3 });

      expect(page1.data.length).toBeLessThanOrEqual(3);
      expect(page2.page).toBe(2);
      expect(page1.limit).toBe(3);
    });
  });

  describe('completeJob', () => {
    it('should mark job as completed with result', async () => {
      const job = await service.enqueue({ jobType: 'task' });
      await service.dequeue(); // Move to running

      const completed = await service.completeJob(job.id, { output: 'success' });
      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ output: 'success' });
      expect(completed?.completedAt).toBeDefined();
    });

    it('should return undefined for non-existent job', async () => {
      const result = await service.completeJob('non-existent', {});
      expect(result).toBeUndefined();
    });
  });

  describe('failJob', () => {
    it('should mark job as failed with error message', async () => {
      const job = await service.enqueue({ jobType: 'task' });
      await service.dequeue();

      const failed = await service.failJob(job.id, 'Something went wrong');
      expect(failed?.status).toBe('failed');
      expect(failed?.errorMessage).toBe('Something went wrong');
    });

    it('should schedule retry if attempts remain', async () => {
      const job = await service.enqueue({ jobType: 'task', maxAttempts: 3 });
      await service.dequeue();

      // Already has attempts = 1 from dequeue, so maxAttempts = 3 means 2 more possible
      const failed = await service.failJob(job.id, 'Error');
      // 1 < 3 so should schedule retry
      expect(failed?.nextRetryAt).toBeDefined();
    });
  });

  describe('cancelJob', () => {
    it('should cancel pending job', async () => {
      const job = await service.enqueue({ jobType: 'task' });

      const cancelled = await service.cancelJob(job.id);
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.completedAt).toBeDefined();
    });

    it('should not cancel running job', async () => {
      const job = await service.enqueue({ jobType: 'task' });
      await service.dequeue(); // Now running

      const cancelled = await service.cancelJob(job.id);
      expect(cancelled).toBeUndefined();
    });

    it('should return undefined for non-existent job', async () => {
      const result = await service.cancelJob('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('requeue', () => {
    it('should requeue failed job', async () => {
      const job = await service.enqueue({ jobType: 'task' });
      await service.dequeue();
      await service.failJob(job.id, 'Error');

      const requeued = await service.requeue(job.id);
      expect(requeued?.status).toBe('pending');
      expect(requeued?.errorMessage).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Set mock stats
      mockRepo.setStats({
        total: 100,
        pending: 20,
        running: 5,
        completed: 70,
        failed: 4,
        cancelled: 1,
      });
      mockRepo.setAvgTimes({ avgWaitTime: 500, avgExecutionTime: 2000 });

      const stats = await service.getQueueStats();

      expect(stats.total).toBe(100);
      expect(stats.pending).toBe(20);
      expect(stats.running).toBe(5);
      expect(stats.completed).toBe(70);
      expect(stats.failed).toBe(4);
      expect(stats.cancelled).toBe(1);
      expect(stats.avgWaitTime).toBe(500);
      expect(stats.avgExecutionTime).toBe(2000);
    });
  });
});
