/**
 * QueueService Error & Compatibility Tests
 *
 * 覆盖: QueueServiceError 类、兼容方法 (push/pop/complete/fail/retry/list/findById)
 */

import { QueueService, QueueServiceError } from '../QueueService';

describe('QueueServiceError', () => {
  it('should create error with message and code', () => {
    const error = new QueueServiceError('Something failed', 'ERR_QUEUE');
    expect(error.message).toBe('Something failed');
    expect(error.code).toBe('ERR_QUEUE');
  });

  it('should have name set to QueueServiceError', () => {
    const error = new QueueServiceError('test', 'TEST_CODE');
    expect(error.name).toBe('QueueServiceError');
  });

  it('should be an instance of Error', () => {
    const error = new QueueServiceError('test', 'TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(QueueServiceError);
  });

  it('should preserve stack trace', () => {
    const error = new QueueServiceError('test', 'TEST_CODE');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('QueueServiceError');
  });
});

describe('QueueService - Compatibility Methods', () => {
  let service: QueueService;

  beforeEach(() => {
    service = new QueueService(null); // Use in-memory mode
  });

  describe('push', () => {
    it('should create a job with tenant and queue info', async () => {
      const job = await service.push('tenant-1', 'emails', { to: 'user@test.com' });
      expect(job.tenantId).toBe('tenant-1');
      expect(job.queueName).toBe('emails');
      expect(job.payload).toEqual({ to: 'user@test.com' });
    });

    it('should use default jobType', async () => {
      const job = await service.push('t1', 'q1', {});
      expect(job.jobType).toBe('default');
    });

    it('should accept priority option', async () => {
      const job = await service.push('t1', 'q1', {}, { priority: 5 });
      expect(job.priority).toBe(5);
    });

    it('should accept maxAttempts option', async () => {
      const job = await service.push('t1', 'q1', {}, { maxAttempts: 10 });
      expect(job.maxAttempts).toBe(10);
    });
  });

  describe('pop', () => {
    it('should return empty array when queue is empty', async () => {
      const jobs = await service.pop();
      expect(jobs).toEqual([]);
    });

    it('should return array with one job when available', async () => {
      await service.enqueue({ jobType: 'test' });
      const jobs = await service.pop();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('running');
    });
  });

  describe('complete (alias)', () => {
    it('should complete a job via alias method', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();

      const completed = await service.complete(job.id);
      expect(completed?.status).toBe('completed');
    });

    it('should return undefined for non-existent job', async () => {
      const result = await service.complete('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('fail (alias)', () => {
    it('should fail a job via alias method', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();

      const failed = await service.fail(job.id, 'Error message');
      expect(failed?.errorMessage).toBe('Error message');
    });

    it('should return undefined for non-existent job', async () => {
      const result = await service.fail('non-existent', 'error');
      expect(result).toBeUndefined();
    });
  });

  describe('retry (alias)', () => {
    it('should requeue a failed job', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();
      await service.failJob(job.id, 'Error');

      const retried = await service.retry(job.id);
      expect(retried?.status).toBe('pending');
    });
  });

  describe('list (alias)', () => {
    it('should list jobs with filters', async () => {
      await service.enqueue({ jobType: 'job-1' });
      await service.enqueue({ jobType: 'job-2' });

      const result = await service.list({});
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      await service.enqueue({ jobType: 'pending-job' });
      await service.enqueue({ jobType: 'running-job' });
      await service.dequeue();

      const result = await service.list({ status: 'running' });
      expect(result.data.every(j => j.status === 'running')).toBe(true);
    });
  });

  describe('findById (alias)', () => {
    it('should find job by id', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      const found = await service.findById(job.id);
      expect(found?.id).toBe(job.id);
    });

    it('should return undefined for non-existent id', async () => {
      const found = await service.findById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getStats (alias)', () => {
    it('should return stats via alias method', async () => {
      const stats = await service.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
    });
  });

  describe('requeue', () => {
    it('should reset failed job to pending', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();
      await service.failJob(job.id, 'Error');

      const requeued = await service.requeue(job.id);
      expect(requeued?.status).toBe('pending');
      expect(requeued?.errorMessage).toBeNull();
      expect(requeued?.nextRetryAt).toBeNull();
    });

    it('should return undefined for non-existent job', async () => {
      const result = await service.requeue('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      const cancelled = await service.cancelJob(job.id);
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.completedAt).toBeDefined();
    });

    it('should not cancel a running job', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();

      const cancelled = await service.cancelJob(job.id);
      expect(cancelled).toBeUndefined();
    });

    it('should return undefined for non-existent job', async () => {
      const result = await service.cancelJob('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('listJobs pagination', () => {
    it('should calculate totalPages correctly', async () => {
      for (let i = 0; i < 10; i++) {
        await service.enqueue({ jobType: `job-${i}` });
      }

      const result = await service.listJobs({ limit: 3 });
      expect(result.totalPages).toBe(Math.ceil(result.total / 3));
    });

    it('should return correct page number', async () => {
      const result = await service.listJobs({ page: 2, limit: 5 });
      expect(result.page).toBe(2);
    });

    it('should return correct limit', async () => {
      const result = await service.listJobs({ limit: 10 });
      expect(result.limit).toBe(10);
    });
  });

  describe('getQueueStats with computed averages', () => {
    it('should compute avgWaitTime from completed jobs', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();
      await service.completeJob(job.id, {});

      const stats = await service.getQueueStats();
      expect(stats.avgWaitTime).toBeGreaterThanOrEqual(0);
    });

    it('should compute avgExecutionTime from completed jobs', async () => {
      const job = await service.enqueue({ jobType: 'test' });
      await service.dequeue();
      await service.completeJob(job.id, {});

      const stats = await service.getQueueStats();
      expect(stats.avgExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
