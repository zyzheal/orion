/**
 * ExecutionTimelineRepository - Comprehensive Tests
 *
 * Tests for saveTimeline, saveEvent, findByRunId, findByTimelineId,
 * findById, getNextSequenceNum, parameter mapping, optional field handling,
 * metadata serialization, error propagation, and edge cases.
 */

import { ExecutionTimelineRepository } from '../../../repositories/ExecutionTimelineRepository';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockPool() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ExecutionTimelineRepository', () => {
  let pool: ReturnType<typeof createMockPool>;
  let repo: ExecutionTimelineRepository;

  beforeEach(() => {
    pool = createMockPool();
    repo = new ExecutionTimelineRepository(pool as any);
  });

  // ─── saveTimeline ────────────────────────────────────────────────────────

  describe('saveTimeline', () => {
    it('should call pool.query with INSERT ... ON CONFLICT SQL', async () => {
      await repo.saveTimeline({
        id: 'tl-001',
        runId: 'run-001',
        taskId: 'task-001',
        pluginId: 'plugin-001',
        stepName: 'build',
        startedAt: new Date('2026-06-02T10:00:00Z'),
        status: 'running',
        tenantId: 'tenant-001',
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO execution_timelines');
      expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    });

    it('should pass all required fields as parameters', async () => {
      await repo.saveTimeline({
        id: 'tl-001',
        runId: 'run-001',
        taskId: 'task-001',
        pluginId: 'plugin-001',
        stepName: 'build',
        startedAt: new Date('2026-06-02T10:00:00Z'),
        status: 'running',
        tenantId: 'tenant-001',
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params).toEqual([
        'tl-001',
        'run-001',
        'task-001',
        'plugin-001',
        'build',
        new Date('2026-06-02T10:00:00Z'),
        null,  // endedAt
        null,  // durationMs
        'running',
        null,  // isolationTier
        null,  // traceId
        null,  // errorMessage
        'tenant-001',
      ]);
    });

    it('should pass optional fields when present', async () => {
      await repo.saveTimeline({
        id: 'tl-001',
        runId: 'run-001',
        taskId: 'task-001',
        pluginId: 'plugin-001',
        stepName: 'build',
        startedAt: new Date('2026-06-02T10:00:00Z'),
        endedAt: new Date('2026-06-02T10:05:00Z'),
        durationMs: 300000,
        status: 'success',
        isolationTier: 'tier-1',
        traceId: 'trace-abc',
        errorMessage: 'step failed',
        tenantId: 'tenant-001',
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params[6]).toEqual(new Date('2026-06-02T10:05:00Z')); // endedAt
      expect(params[7]).toBe(300000); // durationMs
      expect(params[9]).toBe('tier-1'); // isolationTier
      expect(params[10]).toBe('trace-abc'); // traceId
      expect(params[11]).toBe('step failed'); // errorMessage
    });

    it('should use null for undefined optional fields', async () => {
      await repo.saveTimeline({
        id: 'tl-001',
        runId: 'run-001',
        taskId: 'task-001',
        pluginId: 'plugin-001',
        stepName: 'build',
        startedAt: new Date('2026-06-02T10:00:00Z'),
        status: 'running',
        tenantId: 'tenant-001',
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params[6]).toBeNull();  // endedAt
      expect(params[7]).toBeNull();  // durationMs
      expect(params[9]).toBeNull();  // isolationTier
      expect(params[10]).toBeNull(); // traceId
      expect(params[11]).toBeNull(); // errorMessage
    });

    it('should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('connection refused'));

      await expect(repo.saveTimeline({
        id: 'tl-001',
        runId: 'run-001',
        taskId: 'task-001',
        pluginId: 'plugin-001',
        stepName: 'build',
        startedAt: new Date(),
        status: 'running',
        tenantId: 'tenant-001',
      })).rejects.toThrow('connection refused');
    });

    it('should handle all timeline statuses', async () => {
      const statuses = ['running', 'success', 'failed', 'timeout', 'cancelled'];

      for (const status of statuses) {
        pool.query.mockClear();
        await repo.saveTimeline({
          id: 'tl-001',
          runId: 'run-001',
          taskId: 'task-001',
          pluginId: 'plugin-001',
          stepName: 'build',
          startedAt: new Date(),
          status,
          tenantId: 'tenant-001',
        });
        const [, params] = pool.query.mock.calls[0];
        expect(params[8]).toBe(status);
      }
    });
  });

  // ─── saveEvent ───────────────────────────────────────────────────────────

  describe('saveEvent', () => {
    it('should call pool.query with INSERT INTO execution_events', async () => {
      await repo.saveEvent({
        id: 'evt-001',
        timelineId: 'tl-001',
        eventType: 'start',
        timestamp: new Date('2026-06-02T10:00:00Z'),
        level: 'info',
        sequenceNum: 1,
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO execution_events');
    });

    it('should pass all required fields as parameters', async () => {
      await repo.saveEvent({
        id: 'evt-001',
        timelineId: 'tl-001',
        eventType: 'start',
        timestamp: new Date('2026-06-02T10:00:00Z'),
        level: 'info',
        sequenceNum: 1,
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params).toEqual([
        'evt-001',
        'tl-001',
        'start',
        new Date('2026-06-02T10:00:00Z'),
        'info',
        null,  // message
        null,  // metadata
        1,     // sequenceNum
      ]);
    });

    it('should pass message when present', async () => {
      await repo.saveEvent({
        id: 'evt-001',
        timelineId: 'tl-001',
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
        message: 'Build started',
        sequenceNum: 1,
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params[5]).toBe('Build started');
    });

    it('should serialize metadata to JSON string', async () => {
      const metadata = { key: 'value', count: 42, nested: { a: 1 } };
      await repo.saveEvent({
        id: 'evt-001',
        timelineId: 'tl-001',
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
        metadata,
        sequenceNum: 1,
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params[6]).toBe(JSON.stringify(metadata));
    });

    it('should use null for undefined metadata', async () => {
      await repo.saveEvent({
        id: 'evt-001',
        timelineId: 'tl-001',
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
        sequenceNum: 1,
      });

      const [, params] = pool.query.mock.calls[0];
      expect(params[6]).toBeNull();
    });

    it('should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('constraint violation'));

      await expect(repo.saveEvent({
        id: 'evt-001',
        timelineId: 'tl-001',
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
        sequenceNum: 1,
      })).rejects.toThrow('constraint violation');
    });
  });

  // ─── findByRunId ─────────────────────────────────────────────────────────

  describe('findByRunId', () => {
    it('should query with correct SQL and parameter', async () => {
      await repo.findByRunId('run-123');

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM execution_timelines');
      expect(sql).toContain('WHERE run_id = $1');
      expect(sql).toContain('ORDER BY started_at ASC');
      expect(params).toEqual(['run-123']);
    });

    it('should return empty array when no rows found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const results = await repo.findByRunId('non-existent');
      expect(results).toEqual([]);
    });

    it('should return multiple rows', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { id: 'tl-1', run_id: 'run-1' },
          { id: 'tl-2', run_id: 'run-1' },
        ],
      });

      const results = await repo.findByRunId('run-1');
      expect(results).toHaveLength(2);
    });

    it('should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('timeout'));

      await expect(repo.findByRunId('run-001')).rejects.toThrow('timeout');
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should query with correct SQL and parameter', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'tl-123' }] });

      await repo.findById('tl-123');

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM execution_timelines WHERE id = $1');
      expect(params).toEqual(['tl-123']);
    });

    it('should return null when not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('non-existent');
      expect(result).toBeNull();
    });

    it('should return the row when found', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'tl-1', status: 'running' }] });

      const result = await repo.findById('tl-1');
      expect(result).toEqual({ id: 'tl-1', status: 'running' });
    });
  });

  // ─── findByTimelineId ────────────────────────────────────────────────────

  describe('findByTimelineId', () => {
    it('should query with correct SQL and parameter', async () => {
      await repo.findByTimelineId('tl-456');

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM execution_events');
      expect(sql).toContain('WHERE timeline_id = $1');
      expect(sql).toContain('ORDER BY sequence_num ASC');
      expect(params).toEqual(['tl-456']);
    });

    it('should return empty array when no rows found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const results = await repo.findByTimelineId('non-existent');
      expect(results).toEqual([]);
    });

    it('should return multiple events ordered by sequence_num', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { id: 'evt-1', sequence_num: 1 },
          { id: 'evt-2', sequence_num: 2 },
          { id: 'evt-3', sequence_num: 3 },
        ],
      });

      const results = await repo.findByTimelineId('tl-1');
      expect(results).toHaveLength(3);
      expect(results[0].sequence_num).toBe(1);
      expect(results[1].sequence_num).toBe(2);
      expect(results[2].sequence_num).toBe(3);
    });

    it('should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('connection lost'));

      await expect(repo.findByTimelineId('tl-001')).rejects.toThrow('connection lost');
    });
  });

  // ─── getNextSequenceNum ──────────────────────────────────────────────────

  describe('getNextSequenceNum', () => {
    it('should return 1 when no events exist', async () => {
      pool.query.mockResolvedValue({ rows: [{ next_seq: 1 }] });

      const seq = await repo.getNextSequenceNum('tl-001');
      expect(seq).toBe(1);
    });

    it('should return max + 1 when events exist', async () => {
      pool.query.mockResolvedValue({ rows: [{ next_seq: 6 }] });

      const seq = await repo.getNextSequenceNum('tl-001');
      expect(seq).toBe(6);
    });

    it('should query with correct SQL', async () => {
      pool.query.mockResolvedValue({ rows: [{ next_seq: 1 }] });

      await repo.getNextSequenceNum('tl-123');

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('COALESCE(MAX(sequence_num), 0) + 1');
      expect(sql).toContain('WHERE timeline_id = $1');
      expect(params).toEqual(['tl-123']);
    });
  });
});
