/**
 * QueueService Tests
 *
 * Tests for QueueService and QueueRepository covering:
 * - enqueue/dequeue (push/pop)
 * - job processing (complete, fail, retry)
 * - dead letter queue and retry logic
 * - concurrency control and retry loop
 */

import { QueueService, QueueServiceError } from '../QueueService';
import { QueueRepository, QueueJob } from '../QueueRepository';

// ==================== Mock Helpers ====================

function makeMockRepository() {
  const jobs: Map<string, QueueJob> = new Map();
  let idCounter = 0;

  const repo: jest.Mocked<QueueRepository> = {
    enqueue: jest.fn(async (tenantId, queue, payload, options) => {
      idCounter++;
      const job: QueueJob = {
        id: `job-${idCounter}`,
        tenant_id: tenantId,
        queue,
        payload,
        status: 'pending',
        attempts: 0,
        max_attempts: options?.maxAttempts ?? 3,
        priority: options?.priority ?? 0,
        last_error: undefined,
        next_retry_at: undefined,
        created_at: new Date(),
        updated_at: new Date(),
      };
      jobs.set(job.id, job);
      return job;
    }),

    dequeue: jest.fn(async (queue, limit = 1) => {
      const pending = Array.from(jobs.values())
        .filter((j) => j.queue === queue && j.status === 'pending')
        .sort((a, b) => b.priority - a.priority || a.created_at.getTime() - b.created_at.getTime())
        .slice(0, limit);

      for (const job of pending) {
        job.status = 'processing';
        job.attempts += 1;
      }
      return pending;
    }),

    dequeueWithPriority: jest.fn(async (queue, limit = 1) => {
      return repo.dequeue(queue, limit);
    }),

    retry: jest.fn(async (id, delaySeconds = 0) => {
      const job = jobs.get(id);
      if (!job) return null;
      job.status = 'pending';
      job.next_retry_at = delaySeconds > 0 ? new Date(Date.now() + delaySeconds * 1000) : null;
      job.updated_at = new Date();
      return job;
    }),

    failWithRetry: jest.fn(async (id, error, maxAttempts) => {
      const job = jobs.get(id);
      if (!job) return { shouldRetry: false };

      if (job.attempts < maxAttempts) {
        const delaySeconds = Math.pow(2, job.attempts);
        job.status = 'pending';
        job.last_error = error;
        job.next_retry_at = new Date(Date.now() + delaySeconds * 1000);
        job.updated_at = new Date();
        return { shouldRetry: true, delaySeconds };
      }

      job.status = 'failed';
      job.last_error = error;
      job.updated_at = new Date();
      return { shouldRetry: false };
    }),

    getRetryableJobs: jest.fn(async () => {
      const now = Date.now();
      return Array.from(jobs.values()).filter(
        (j) => j.status === 'pending' && j.next_retry_at && j.next_retry_at.getTime() <= now
      );
    }),

    complete: jest.fn(async (id) => {
      const job = jobs.get(id);
      if (job) {
        job.status = 'completed';
        job.updated_at = new Date();
      }
    }),

    fail: jest.fn(async (id) => {
      const job = jobs.get(id);
      if (job) {
        job.status = 'failed';
        job.updated_at = new Date();
      }
    }),

    findById: jest.fn(async (id) => jobs.get(id) ?? null),

    list: jest.fn(async (filters) => {
      let result = Array.from(jobs.values());
      if (filters.tenantId) result = result.filter((j) => j.tenant_id === filters.tenantId);
      if (filters.queue) result = result.filter((j) => j.queue === filters.queue);
      if (filters.status) result = result.filter((j) => j.status === filters.status);
      result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      return result.slice(offset, offset + limit);
    }),

    countByStatus: jest.fn(async () => {
      const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
      for (const job of jobs.values()) {
        if (job.status in counts) {
          counts[job.status as keyof typeof counts]++;
        }
      }
      return counts;
    }),
  } as unknown as jest.Mocked<QueueRepository>;

  return { repo, jobs };
}

// ==================== Test Suite ====================

describe('QueueService', () => {
  describe('push (enqueue)', () => {
    it('should enqueue a job with default options', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      const job = await service.push('tenant-1', 'email-queue', { to: 'user@example.com', subject: 'Hello' });

      expect(repo.enqueue).toHaveBeenCalledWith('tenant-1', 'email-queue', { to: 'user@example.com', subject: 'Hello' }, { priority: 0, maxAttempts: 3 });
      expect(job.status).toBe('pending');
    });

    it('should enqueue with custom priority', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      await service.push('tenant-1', 'email-queue', { data: 1 }, { priority: 10 });

      expect(repo.enqueue).toHaveBeenCalledWith('tenant-1', 'email-queue', { data: 1 }, { priority: 10, maxAttempts: 3 });
    });

    it('should enqueue with custom maxAttempts', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      await service.push('tenant-1', 'email-queue', { data: 1 }, { maxAttempts: 5 });

      expect(repo.enqueue).toHaveBeenCalledWith('tenant-1', 'email-queue', { data: 1 }, { priority: 0, maxAttempts: 5 });
    });

    it('should enqueue with both priority and maxAttempts', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      await service.push('tenant-1', 'critical', { urgent: true }, { priority: 100, maxAttempts: 1 });

      expect(repo.enqueue).toHaveBeenCalledWith('tenant-1', 'critical', { urgent: true }, { priority: 100, maxAttempts: 1 });
    });
  });

  describe('pop (dequeue)', () => {
    it('should dequeue jobs from a queue', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.dequeue as jest.Mock).mockResolvedValue([
        { id: 'job-1', status: 'processing', attempts: 1, queue: 'email', tenant_id: 't1', payload: {}, max_attempts: 3, priority: 0, created_at: new Date(), updated_at: new Date() },
      ]);

      const jobs = await service.pop('email');
      expect(jobs.length).toBe(1);
      expect(repo.dequeue).toHaveBeenCalledWith('email', undefined);
    });

    it('should dequeue with limit', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.dequeue as jest.Mock).mockResolvedValue([]);

      await service.pop('email', 10);
      expect(repo.dequeue).toHaveBeenCalledWith('email', 10);
    });
  });

  describe('complete', () => {
    it('should mark job as completed', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      await service.complete('job-1');
      expect(repo.complete).toHaveBeenCalledWith('job-1');
    });
  });

  describe('fail', () => {
    it('should call failWithRetry with job max_attempts', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'processing',
        attempts: 1,
        max_attempts: 5,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      (repo.failWithRetry as jest.Mock).mockResolvedValue({ shouldRetry: true, delaySeconds: 2 });

      const result = await service.fail('job-1', 'Connection timeout');
      expect(repo.failWithRetry).toHaveBeenCalledWith('job-1', 'Connection timeout', 5);
      expect(result.shouldRetry).toBe(true);
    });

    it('should use default error message when not provided', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'processing',
        attempts: 1,
        max_attempts: 3,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      (repo.failWithRetry as jest.Mock).mockResolvedValue({ shouldRetry: false });

      await service.fail('job-1');
      expect(repo.failWithRetry).toHaveBeenCalledWith('job-1', 'Unknown error', 3);
    });

    it('should throw when job not found', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.fail('nonexistent')).rejects.toThrow(QueueServiceError);
      await expect(service.fail('nonexistent')).rejects.toThrow('Job not found: nonexistent');
    });
  });

  describe('retry', () => {
    it('should retry a failed job', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'failed',
        attempts: 2,
        max_attempts: 3,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      (repo.retry as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'pending',
        attempts: 2,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        max_attempts: 3,
        priority: 0,
        next_retry_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.retry('job-1', 60);
      expect(repo.retry).toHaveBeenCalledWith('job-1', 60);
      expect(result?.status).toBe('pending');
    });

    it('should retry a processing job', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'processing',
        attempts: 1,
        max_attempts: 3,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      (repo.retry as jest.Mock).mockResolvedValue({ id: 'job-1', status: 'pending', attempts: 1, queue: 'email', tenant_id: 't1', payload: {}, max_attempts: 3, priority: 0, next_retry_at: null, created_at: new Date(), updated_at: new Date() });

      await service.retry('job-1');
      expect(repo.retry).toHaveBeenCalled();
    });

    it('should use default delay based on attempts', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'failed',
        attempts: 3,
        max_attempts: 5,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      (repo.retry as jest.Mock).mockResolvedValue({ id: 'job-1', status: 'pending', attempts: 3, queue: 'email', tenant_id: 't1', payload: {}, max_attempts: 5, priority: 0, next_retry_at: null, created_at: new Date(), updated_at: new Date() });

      await service.retry('job-1');
      // Default delay: 2^3 = 8 seconds
      expect(repo.retry).toHaveBeenCalledWith('job-1', 8);
    });

    it('should throw when job not found', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);
      (repo.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.retry('nonexistent')).rejects.toThrow(QueueServiceError);
    });

    it('should throw when job is in invalid state', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.findById as jest.Mock).mockResolvedValue({
        id: 'job-1',
        status: 'completed',
        attempts: 1,
        max_attempts: 3,
        queue: 'email',
        tenant_id: 't1',
        payload: {},
        priority: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(service.retry('job-1')).rejects.toThrow(QueueServiceError);
      await expect(service.retry('job-1')).rejects.toThrow("Cannot retry job in 'completed' state");
    });
  });

  describe('processRetryableJobs', () => {
    it('should process all retryable jobs', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.getRetryableJobs as jest.Mock).mockResolvedValue([
        { id: 'job-1', status: 'pending', next_retry_at: new Date(Date.now() - 1000), attempts: 1, max_attempts: 3, queue: 'email', tenant_id: 't1', payload: {}, priority: 0, created_at: new Date(), updated_at: new Date() },
        { id: 'job-2', status: 'pending', next_retry_at: new Date(Date.now() - 1000), attempts: 2, max_attempts: 3, queue: 'email', tenant_id: 't1', payload: {}, priority: 0, created_at: new Date(), updated_at: new Date() },
      ]);

      (repo.retry as jest.Mock).mockResolvedValue({ id: 'job-1', status: 'pending', attempts: 1, queue: 'email', tenant_id: 't1', payload: {}, max_attempts: 3, priority: 0, next_retry_at: null, created_at: new Date(), updated_at: new Date() });

      const processed = await service.processRetryableJobs();
      expect(processed).toBe(2);
      expect(repo.retry).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no retryable jobs', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.getRetryableJobs as jest.Mock).mockResolvedValue([]);

      const processed = await service.processRetryableJobs();
      expect(processed).toBe(0);
    });
  });

  describe('findById', () => {
    it('should find job by ID', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      const mockJob = {
        id: 'job-1', status: 'pending', attempts: 0, max_attempts: 3, queue: 'email', tenant_id: 't1', payload: { key: 'value' }, priority: 0, created_at: new Date(), updated_at: new Date(),
      };
      (repo.findById as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.findById('job-1');
      expect(result?.id).toBe('job-1');
      expect(result?.payload).toEqual({ key: 'value' });
    });

    it('should return null when not found', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);
      (repo.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list jobs with filters', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.list as jest.Mock).mockResolvedValue([
        { id: 'job-1', status: 'pending', queue: 'email', tenant_id: 't1', payload: {}, max_attempts: 3, priority: 0, attempts: 0, created_at: new Date(), updated_at: new Date() },
      ]);

      const result = await service.list({ tenantId: 't1', queue: 'email', status: 'pending' });
      expect(repo.list).toHaveBeenCalledWith({ tenantId: 't1', queue: 'email', status: 'pending' });
      expect(result.length).toBe(1);
    });

    it('should list jobs with pagination', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.list as jest.Mock).mockResolvedValue([]);

      await service.list({ limit: 20, offset: 40 });
      expect(repo.list).toHaveBeenCalledWith({ limit: 20, offset: 40 });
    });

    it('should list all jobs with no filters', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.list as jest.Mock).mockResolvedValue([]);

      await service.list({});
      expect(repo.list).toHaveBeenCalledWith({});
    });
  });

  describe('getStats', () => {
    it('should return status counts', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo);

      (repo.countByStatus as jest.Mock).mockResolvedValue({
        pending: 10,
        processing: 5,
        completed: 100,
        failed: 3,
      });

      const stats = await service.getStats();
      expect(stats.pending).toBe(10);
      expect(stats.processing).toBe(5);
      expect(stats.completed).toBe(100);
      expect(stats.failed).toBe(3);
    });
  });

  describe('retry loop', () => {
    it('should start retry loop and return cleanup function', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo, { retryIntervalMs: 50 });

      (repo.getRetryableJobs as jest.Mock).mockResolvedValue([]);

      const stop = service.startRetryLoop(50);
      expect(typeof stop).toBe('function');

      // Let the loop run once
      await new Promise((r) => setTimeout(r, 150));

      // Verify it processed at least once
      expect(repo.getRetryableJobs).toHaveBeenCalled();

      stop();
    }, 10000);

    it('should stop the retry loop when cleanup called', async () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo, { retryIntervalMs: 50 });

      (repo.getRetryableJobs as jest.Mock).mockResolvedValue([]);

      const callCountBefore = (repo.getRetryableJobs as jest.Mock).mock.calls.length;
      const stop = service.startRetryLoop(50);

      await new Promise((r) => setTimeout(r, 200));
      stop();

      await new Promise((r) => setTimeout(r, 150));

      // After stopping, no more calls should be made
      // (within a small margin for the in-flight call)
      const callsAfterStop = (repo.getRetryableJobs as jest.Mock).mock.calls.length;
      expect(callsAfterStop).toBeLessThanOrEqual(callCountBefore + 5);
    }, 10000);

    it('should use default retryIntervalMs from options', () => {
      const { repo } = makeMockRepository();
      const service = new QueueService(repo, { retryIntervalMs: 5000 });

      // startRetryLoop uses default from constructor when no interval passed
      const stop = service.startRetryLoop();
      expect(typeof stop).toBe('function');
      stop();
    });
  });
});

describe('QueueRepository', () => {
  describe('enqueue SQL', () => {
    it('should generate correct INSERT query', async () => {
      const mockPool = {
        query: jest.fn(async () => ({
          rows: [{
            id: 'job-1',
            tenant_id: 't1',
            queue: 'email',
            payload: '{"to":"user@example.com"}',
            status: 'pending',
            attempts: 0,
            max_attempts: 3,
            priority: 5,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })),
      };

      const repo = new QueueRepository(mockPool as any);
      const job = await repo.enqueue('t1', 'email', { to: 'user@example.com' }, { priority: 5, maxAttempts: 3 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_jobs'),
        expect.arrayContaining(['t1', 'email', '{"to":"user@example.com"}', 3, 5])
      );
      expect(job.id).toBe('job-1');
    });

    it('should use default priority and maxAttempts', async () => {
      const mockPool = {
        query: jest.fn(async () => ({
          rows: [{
            id: 'job-1',
            tenant_id: 't1',
            queue: 'email',
            payload: '{}',
            status: 'pending',
            attempts: 0,
            max_attempts: 3,
            priority: 0,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.enqueue('t1', 'email', {});

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_jobs'),
        expect.arrayContaining(['t1', 'email', '{}', 3, 0])
      );
    });
  });

  describe('dequeue SQL', () => {
    it('should generate correct UPDATE query with priority ordering', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.dequeue('email', 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE queue_jobs SET status'),
        ['email', 5]
      );
    });

    it('should use default limit of 1', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.dequeue('email');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['email', 1]
      );
    });
  });

  describe('complete / fail', () => {
    it('complete should set status to completed', async () => {
      const mockPool = {
        query: jest.fn(async () => ({})),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.complete('job-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
        ['job-1']
      );
    });

    it('fail should set status to failed', async () => {
      const mockPool = {
        query: jest.fn(async () => ({})),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.fail('job-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'failed'"),
        ['job-1']
      );
    });
  });

  describe('list with dynamic filters', () => {
    it('should build query with tenantId filter', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.list({ tenantId: 't1', limit: 10, offset: 0 });

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('tenant_id = $1');
    });

    it('should build query with queue filter', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.list({ queue: 'email', limit: 20, offset: 0 });

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('queue = $1');
    });

    it('should build query with status filter', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.list({ status: 'pending', limit: 50, offset: 0 });

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('status = $1');
    });

    it('should build query with multiple filters', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.list({ tenantId: 't1', queue: 'email', status: 'pending', limit: 10, offset: 0 });

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('tenant_id = $1');
      expect(callArgs[0]).toContain('queue = $2');
      expect(callArgs[0]).toContain('status = $3');
    });

    it('should use default limit and offset when not provided', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.list({});

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('LIMIT');
    });
  });

  describe('countByStatus', () => {
    it('should aggregate counts by status', async () => {
      const mockPool = {
        query: jest.fn(async () => ({
          rows: [
            { status: 'pending', count: '10' },
            { status: 'completed', count: '50' },
            { status: 'failed', count: '3' },
          ],
        })),
      };

      const repo = new QueueRepository(mockPool as any);
      const stats = await repo.countByStatus();

      expect(stats.pending).toBe(10);
      expect(stats.completed).toBe(50);
      expect(stats.failed).toBe(3);
      expect(stats.processing).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return job when found', async () => {
      const mockPool = {
        query: jest.fn(async () => ({
          rows: [{
            id: 'job-1',
            tenant_id: 't1',
            queue: 'email',
            payload: '{}',
            status: 'pending',
            attempts: 0,
            max_attempts: 3,
            priority: 0,
            created_at: new Date(),
          }],
        })),
      };

      const repo = new QueueRepository(mockPool as any);
      const job = await repo.findById('job-1');
      expect(job?.id).toBe('job-1');
    });

    it('should return null when not found', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      const job = await repo.findById('nonexistent');
      expect(job).toBeNull();
    });
  });

  describe('retry', () => {
    it('should set status to pending with retry time', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [{ id: 'job-1' }] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.retry('job-1', 60);

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('status = $1');
    });

    it('should retry immediately when delaySeconds is 0', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [{ id: 'job-1' }] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.retry('job-1', 0);

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toContain(null);
    });

    it('should return null when job not found', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      const result = await repo.retry('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('failWithRetry', () => {
    it('should retry when attempts below max', async () => {
      const mockPool = {
        query: jest.fn(async () => ({
          rows: [{
            id: 'job-1',
            attempts: 1,
            max_attempts: 3,
            status: 'processing',
          }],
        })),
      };

      const repo = new QueueRepository(mockPool as any);
      const result = await repo.failWithRetry('job-1', 'Timeout', 3);

      expect(result.shouldRetry).toBe(true);
      expect(result.delaySeconds).toBe(2); // 2^1
    });

    it('should fail permanently when attempts reach max', async () => {
      const mockPool = {
        query: jest.fn(async () => ({
          rows: [{
            id: 'job-1',
            attempts: 3,
            max_attempts: 3,
            status: 'processing',
          }],
        })),
      };

      const repo = new QueueRepository(mockPool as any);
      const result = await repo.failWithRetry('job-1', 'Max retries', 3);

      expect(result.shouldRetry).toBe(false);
    });

    it('should return shouldRetry false when job not found', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      const result = await repo.failWithRetry('nonexistent', 'error', 3);
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe('getRetryableJobs', () => {
    it('should query for retryable jobs', async () => {
      const mockPool = {
        query: jest.fn(async () => ({ rows: [] })),
      };

      const repo = new QueueRepository(mockPool as any);
      await repo.getRetryableJobs();

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain("status = 'pending'");
      expect(callArgs[0]).toContain('next_retry_at IS NOT NULL');
    });
  });
});
