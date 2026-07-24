/**
 * QueueRepository Unit Tests
 *
 * Tests all CRUD operations, query filtering, error scenarios,
 * and edge cases for the PostgreSQL-backed queue job repository.
 */

import { QueueRepository, QueueJob } from '../QueueRepository';

// Mock DatabasePool
const createMockPool = () => ({
  query: jest.fn(),
});

type MockPool = ReturnType<typeof createMockPool>;

describe('QueueRepository', () => {
  let mockPool: MockPool;
  let repository: QueueRepository;

  beforeEach(() => {
    mockPool = createMockPool();
    repository = new QueueRepository(mockPool as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create a sample QueueJob
  const createSampleJob = (overrides: Partial<QueueJob> = {}): QueueJob => ({
    id: 'job-001',
    tenant_id: 'tenant-1',
    queue: 'default',
    payload: { task: 'build' },
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
    priority: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  describe('enqueue', () => {
    it('should insert a new job with default options', async () => {
      const job = createSampleJob();
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.enqueue('tenant-1', 'default', { task: 'build' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_jobs'),
        ['tenant-1', 'default', '{"task":"build"}', 3, 0]
      );
      expect(result).toEqual(job);
    });

    it('should insert a job with custom priority and maxAttempts', async () => {
      const job = createSampleJob({ priority: 5, max_attempts: 10 });
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.enqueue('tenant-1', 'emails', { to: 'user@test.com' }, {
        priority: 5,
        maxAttempts: 10,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO queue_jobs'),
        ['tenant-1', 'emails', '{"to":"user@test.com"}', 10, 5]
      );
      expect(result.priority).toBe(5);
      expect(result.max_attempts).toBe(10);
    });

    it('should default priority to 0 when not specified', async () => {
      const job = createSampleJob();
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      await repository.enqueue('tenant-1', 'default', {});

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[4]).toBe(0); // priority param
    });

    it('should default maxAttempts to 3 when not specified', async () => {
      const job = createSampleJob();
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      await repository.enqueue('tenant-1', 'default', {});

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[3]).toBe(3); // maxAttempts param
    });

    it('should serialize complex payload to JSON', async () => {
      const complexPayload = { nested: { key: 'value' }, arr: [1, 2, 3] };
      const job = createSampleJob({ payload: complexPayload });
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      await repository.enqueue('tenant-1', 'default', complexPayload);

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[2]).toBe(JSON.stringify(complexPayload));
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('connection refused'));

      await expect(repository.enqueue('tenant-1', 'default', {}))
        .rejects.toThrow('connection refused');
    });
  });

  describe('dequeue', () => {
    it('should dequeue pending jobs with default limit of 1', async () => {
      const job = createSampleJob({ status: 'processing' });
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.dequeue('default');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE queue_jobs SET status = 'processing'"),
        ['default', 1]
      );
      expect(result).toEqual([job]);
    });

    it('should dequeue with custom limit', async () => {
      const jobs = [
        createSampleJob({ id: 'job-1', status: 'processing' }),
        createSampleJob({ id: 'job-2', status: 'processing' }),
        createSampleJob({ id: 'job-3', status: 'processing' }),
      ];
      mockPool.query.mockResolvedValue({ rows: jobs, rowCount: 3 });

      const result = await repository.dequeue('default', 3);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['default', 3]
      );
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no pending jobs', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.dequeue('default');

      expect(result).toEqual([]);
    });

    it('should order by priority DESC then created_at ASC', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.dequeue('default');

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY priority DESC, created_at ASC');
    });

    it('should only dequeue pending status jobs', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.dequeue('default');

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain("status = 'pending'");
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('deadlock detected'));

      await expect(repository.dequeue('default')).rejects.toThrow('deadlock detected');
    });
  });

  describe('dequeueWithPriority', () => {
    it('should delegate to dequeue with same arguments', async () => {
      const job = createSampleJob({ status: 'processing' });
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.dequeueWithPriority('emails', 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE queue_jobs SET status = 'processing'"),
        ['emails', 5]
      );
      expect(result).toEqual([job]);
    });
  });

  describe('retry', () => {
    it('should set status to pending with next_retry_at when delay > 0', async () => {
      const job = createSampleJob({ status: 'pending' });
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.retry('job-001', 60);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE queue_jobs SET status = $1'),
        ['pending', expect.any(Date), 'job-001']
      );
      expect(result).toEqual(job);
    });

    it('should set next_retry_at to null when delay is 0', async () => {
      const job = createSampleJob({ status: 'pending', next_retry_at: undefined });
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.retry('job-001', 0);

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[1]).toBeNull(); // next_retry_at
      expect(result).toEqual(job);
    });

    it('should return null when job not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.retry('non-existent', 30);

      expect(result).toBeNull();
    });

    it('should default delay to 0 seconds', async () => {
      const job = createSampleJob();
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      await repository.retry('job-001');

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[1]).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('timeout'));

      await expect(repository.retry('job-001', 10)).rejects.toThrow('timeout');
    });
  });

  describe('failWithRetry', () => {
    it('should schedule retry when attempts < maxAttempts', async () => {
      const job = createSampleJob({ attempts: 1, max_attempts: 3 });
      // First call: findById
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });
      // Second call: update with retry
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });

      const result = await repository.failWithRetry('job-001', 'timeout error', 3);

      expect(result.shouldRetry).toBe(true);
      expect(result.delaySeconds).toBe(2); // 2^1 = 2
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should mark as failed when attempts >= maxAttempts', async () => {
      const job = createSampleJob({ attempts: 3, max_attempts: 3 });
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });

      const result = await repository.failWithRetry('job-001', 'permanent failure', 3);

      expect(result.shouldRetry).toBe(false);
      expect(result.delaySeconds).toBeUndefined();
    });

    it('should return shouldRetry false when job not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.failWithRetry('non-existent', 'error', 3);

      expect(result.shouldRetry).toBe(false);
    });

    it('should use exponential backoff formula (2^attempts)', async () => {
      const job = createSampleJob({ attempts: 3, max_attempts: 5 });
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });

      const result = await repository.failWithRetry('job-001', 'error', 5);

      expect(result.delaySeconds).toBe(8); // 2^3 = 8
    });

    it('should store error message in last_error field', async () => {
      const job = createSampleJob({ attempts: 0, max_attempts: 3 });
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [job], rowCount: 1 });

      await repository.failWithRetry('job-001', 'connection reset', 3);

      const updateCall = mockPool.query.mock.calls[1];
      expect(updateCall[1][0]).toBe('connection reset');
    });

    it('should propagate database errors from findById', async () => {
      mockPool.query.mockRejectedValue(new Error('db error'));

      await expect(repository.failWithRetry('job-001', 'error', 3))
        .rejects.toThrow('db error');
    });
  });

  describe('getRetryableJobs', () => {
    it('should return jobs with pending status and next_retry_at in the past', async () => {
      const jobs = [createSampleJob({ status: 'pending' })];
      mockPool.query.mockResolvedValue({ rows: jobs, rowCount: 1 });

      const result = await repository.getRetryableJobs();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'pending'")
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('next_retry_at IS NOT NULL')
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('next_retry_at <= NOW()')
      );
      expect(result).toEqual(jobs);
    });

    it('should order by priority DESC then created_at ASC', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.getRetryableJobs();

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY priority DESC, created_at ASC');
    });

    it('should return empty array when no retryable jobs', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.getRetryableJobs();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('query timeout'));

      await expect(repository.getRetryableJobs()).rejects.toThrow('query timeout');
    });
  });

  describe('complete', () => {
    it('should update status to completed', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.complete('job-001');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
        ['job-001']
      );
    });

    it('should set updated_at to NOW()', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.complete('job-001');

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('update failed'));

      await expect(repository.complete('job-001')).rejects.toThrow('update failed');
    });
  });

  describe('fail', () => {
    it('should update status to failed', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.fail('job-001');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'failed'"),
        ['job-001']
      );
    });

    it('should set updated_at to NOW()', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.fail('job-001');

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('constraint violation'));

      await expect(repository.fail('job-001')).rejects.toThrow('constraint violation');
    });
  });

  describe('findById', () => {
    it('should return job when found', async () => {
      const job = createSampleJob();
      mockPool.query.mockResolvedValue({ rows: [job], rowCount: 1 });

      const result = await repository.findById('job-001');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM queue_jobs WHERE id = $1',
        ['job-001']
      );
      expect(result).toEqual(job);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('connection lost'));

      await expect(repository.findById('job-001')).rejects.toThrow('connection lost');
    });
  });

  describe('list', () => {
    it('should return all jobs with no filters', async () => {
      const jobs = [createSampleJob(), createSampleJob({ id: 'job-002' })];
      mockPool.query.mockResolvedValue({ rows: jobs, rowCount: 2 });

      const result = await repository.list({});

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM queue_jobs'),
        [50, 0]
      );
      expect(result).toEqual(jobs);
    });

    it('should filter by tenantId', async () => {
      const jobs = [createSampleJob()];
      mockPool.query.mockResolvedValue({ rows: jobs, rowCount: 1 });

      await repository.list({ tenantId: 'tenant-1' });

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toContain('tenant-1');
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('tenant_id = $1');
    });

    it('should filter by queue', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.list({ queue: 'emails' });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('queue = $1');
      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toContain('emails');
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.list({ status: 'failed' });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('status = $1');
      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toContain('failed');
    });

    it('should combine multiple filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.list({ tenantId: 't1', queue: 'q1', status: 'pending' });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('tenant_id = $1');
      expect(sql).toContain('queue = $2');
      expect(sql).toContain('status = $3');
      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toEqual(['t1', 'q1', 'pending', 50, 0]);
    });

    it('should use custom limit and offset', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.list({ limit: 10, offset: 20 });

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toEqual([10, 20]);
    });

    it('should default limit to 50 and offset to 0', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.list({});

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[0]).toBe(50); // limit
      expect(callArgs[1]).toBe(0);  // offset
    });

    it('should order by created_at DESC', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.list({});

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should return empty array when no matches', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.list({});

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('query failed'));

      await expect(repository.list({})).rejects.toThrow('query failed');
    });
  });

  describe('countByStatus', () => {
    it('should return counts for all statuses', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { status: 'pending', count: '10' },
          { status: 'processing', count: '3' },
          { status: 'completed', count: '50' },
          { status: 'failed', count: '2' },
        ],
        rowCount: 4,
      });

      const result = await repository.countByStatus();

      expect(result).toEqual({
        pending: 10,
        processing: 3,
        completed: 50,
        failed: 2,
      });
    });

    it('should default missing statuses to 0', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ status: 'pending', count: '5' }],
        rowCount: 1,
      });

      const result = await repository.countByStatus();

      expect(result).toEqual({
        pending: 5,
        processing: 0,
        completed: 0,
        failed: 0,
      });
    });

    it('should return all zeros when no jobs exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.countByStatus();

      expect(result).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      });
    });

    it('should ignore unknown status values', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { status: 'pending', count: '3' },
          { status: 'unknown_status', count: '99' },
        ],
        rowCount: 2,
      });

      const result = await repository.countByStatus();

      expect(result.pending).toBe(3);
      expect(result.processing).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should parse string counts to integers', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ status: 'completed', count: '123' }],
        rowCount: 1,
      });

      const result = await repository.countByStatus();

      expect(result.completed).toBe(123);
      expect(typeof result.completed).toBe('number');
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('aggregate failed'));

      await expect(repository.countByStatus()).rejects.toThrow('aggregate failed');
    });
  });
});
