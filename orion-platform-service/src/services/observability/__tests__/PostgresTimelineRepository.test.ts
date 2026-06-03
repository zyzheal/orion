/**
 * PostgresTimelineRepository - Comprehensive Tests
 *
 * Tests for saveTimeline, saveEvent, findByRunId, findByTimelineId,
 * parameter mapping, optional field handling, metadata serialization,
 * error propagation, and edge cases.
 */

import { PostgresTimelineRepository, TimelineEntry, TimelineEvent } from '../ExecutionTimelineService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

function createTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'tl-001',
    runId: 'run-001',
    taskId: 'task-001',
    pluginId: 'plugin-001',
    stepName: 'build',
    startedAt: new Date('2026-06-02T10:00:00Z'),
    status: 'running',
    ...overrides,
  };
}

function createTimelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'evt-001',
    timelineId: 'tl-001',
    eventType: 'start',
    timestamp: new Date('2026-06-02T10:00:00Z'),
    level: 'info',
    sequenceNum: 1,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PostgresTimelineRepository', () => {
  let db: ReturnType<typeof createMockDb>;
  let repo: PostgresTimelineRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new PostgresTimelineRepository(db);
  });

  // ─── saveTimeline ────────────────────────────────────────────────────────

  describe('saveTimeline', () => {
    it('should call db.query with INSERT ... ON CONFLICT SQL', async () => {
      const timeline = createTimelineEntry();
      await repo.saveTimeline(timeline);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO execution_timelines');
      expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    });

    it('should pass all required fields as parameters', async () => {
      const timeline = createTimelineEntry();
      await repo.saveTimeline(timeline);

      const [, params] = db.query.mock.calls[0];
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
      ]);
    });

    it('should pass optional fields when present', async () => {
      const timeline = createTimelineEntry({
        endedAt: new Date('2026-06-02T10:05:00Z'),
        durationMs: 300000,
        isolationTier: 'tier-1',
        traceId: 'trace-abc',
        errorMessage: 'step failed',
      });
      await repo.saveTimeline(timeline);

      const [, params] = db.query.mock.calls[0];
      expect(params[6]).toEqual(new Date('2026-06-02T10:05:00Z')); // endedAt
      expect(params[7]).toBe(300000); // durationMs
      expect(params[9]).toBe('tier-1'); // isolationTier
      expect(params[10]).toBe('trace-abc'); // traceId
      expect(params[11]).toBe('step failed'); // errorMessage
    });

    it('should use null for undefined optional fields', async () => {
      const timeline = createTimelineEntry({
        endedAt: undefined,
        durationMs: undefined,
        isolationTier: undefined,
        traceId: undefined,
        errorMessage: undefined,
      });
      await repo.saveTimeline(timeline);

      const [, params] = db.query.mock.calls[0];
      expect(params[6]).toBeNull();  // endedAt
      expect(params[7]).toBeNull();  // durationMs
      expect(params[9]).toBeNull();  // isolationTier
      expect(params[10]).toBeNull(); // traceId
      expect(params[11]).toBeNull(); // errorMessage
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('connection refused'));

      await expect(repo.saveTimeline(createTimelineEntry())).rejects.toThrow('connection refused');
    });

    it('should handle all timeline statuses', async () => {
      const statuses: TimelineEntry['status'][] = ['running', 'success', 'failed', 'timeout', 'cancelled'];

      for (const status of statuses) {
        db.query.mockClear();
        await repo.saveTimeline(createTimelineEntry({ status }));
        const [, params] = db.query.mock.calls[0];
        expect(params[8]).toBe(status);
      }
    });
  });

  // ─── saveEvent ───────────────────────────────────────────────────────────

  describe('saveEvent', () => {
    it('should call db.query with INSERT INTO execution_events', async () => {
      const event = createTimelineEvent();
      await repo.saveEvent(event);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO execution_events');
    });

    it('should pass all required fields as parameters', async () => {
      const event = createTimelineEvent();
      await repo.saveEvent(event);

      const [, params] = db.query.mock.calls[0];
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
      const event = createTimelineEvent({ message: 'Build started' });
      await repo.saveEvent(event);

      const [, params] = db.query.mock.calls[0];
      expect(params[5]).toBe('Build started');
    });

    it('should use null for undefined message', async () => {
      const event = createTimelineEvent({ message: undefined });
      await repo.saveEvent(event);

      const [, params] = db.query.mock.calls[0];
      expect(params[5]).toBeNull();
    });

    it('should serialize metadata to JSON string', async () => {
      const metadata = { key: 'value', count: 42, nested: { a: 1 } };
      const event = createTimelineEvent({ metadata });
      await repo.saveEvent(event);

      const [, params] = db.query.mock.calls[0];
      expect(params[6]).toBe(JSON.stringify(metadata));
    });

    it('should use null for undefined metadata', async () => {
      const event = createTimelineEvent({ metadata: undefined });
      await repo.saveEvent(event);

      const [, params] = db.query.mock.calls[0];
      expect(params[6]).toBeNull();
    });

    it('should handle all event types', async () => {
      const eventTypes: TimelineEvent['eventType'][] = ['start', 'heartbeat', 'log', 'error', 'complete', 'timeout'];

      for (const eventType of eventTypes) {
        db.query.mockClear();
        await repo.saveEvent(createTimelineEvent({ eventType }));
        const [, params] = db.query.mock.calls[0];
        expect(params[2]).toBe(eventType);
      }
    });

    it('should handle all log levels', async () => {
      const levels: TimelineEvent['level'][] = ['debug', 'info', 'warn', 'error'];

      for (const level of levels) {
        db.query.mockClear();
        await repo.saveEvent(createTimelineEvent({ level }));
        const [, params] = db.query.mock.calls[0];
        expect(params[4]).toBe(level);
      }
    });

    it('should pass sequenceNum correctly', async () => {
      const event = createTimelineEvent({ sequenceNum: 42 });
      await repo.saveEvent(event);

      const [, params] = db.query.mock.calls[0];
      expect(params[7]).toBe(42);
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('constraint violation'));

      await expect(repo.saveEvent(createTimelineEvent())).rejects.toThrow('constraint violation');
    });
  });

  // ─── findByRunId ─────────────────────────────────────────────────────────

  describe('findByRunId', () => {
    it('should query with correct SQL and parameter', async () => {
      await repo.findByRunId('run-123');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM execution_timelines');
      expect(sql).toContain('WHERE run_id = $1');
      expect(sql).toContain('ORDER BY started_at ASC');
      expect(params).toEqual(['run-123']);
    });

    it('should map snake_case columns to camelCase fields', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 'tl-001',
          run_id: 'run-001',
          task_id: 'task-001',
          plugin_id: 'plugin-001',
          step_name: 'build',
          started_at: '2026-06-02T10:00:00.000Z',
          ended_at: '2026-06-02T10:05:00.000Z',
          duration_ms: 300000,
          status: 'success',
          isolation_tier: 'tier-1',
          trace_id: 'trace-abc',
          error_message: null,
        }],
      });

      const results = await repo.findByRunId('run-001');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tl-001');
      expect(results[0].runId).toBe('run-001');
      expect(results[0].taskId).toBe('task-001');
      expect(results[0].pluginId).toBe('plugin-001');
      expect(results[0].stepName).toBe('build');
      expect(results[0].startedAt).toEqual(new Date('2026-06-02T10:00:00.000Z'));
      expect(results[0].endedAt).toEqual(new Date('2026-06-02T10:05:00.000Z'));
      expect(results[0].durationMs).toBe(300000);
      expect(results[0].status).toBe('success');
      expect(results[0].isolationTier).toBe('tier-1');
      expect(results[0].traceId).toBe('trace-abc');
      expect(results[0].errorMessage).toBeNull();
    });

    it('should handle null ended_at as undefined', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 'tl-001',
          run_id: 'run-001',
          task_id: 'task-001',
          plugin_id: 'plugin-001',
          step_name: 'build',
          started_at: '2026-06-02T10:00:00.000Z',
          ended_at: null,
          duration_ms: null,
          status: 'running',
          isolation_tier: null,
          trace_id: null,
          error_message: null,
        }],
      });

      const results = await repo.findByRunId('run-001');

      expect(results[0].endedAt).toBeUndefined();
    });

    it('should return empty array when no rows found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await repo.findByRunId('non-existent');
      expect(results).toEqual([]);
    });

    it('should return multiple rows', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 'tl-1', run_id: 'run-1', task_id: 't1', plugin_id: 'p1', step_name: 'build', started_at: '2026-06-02T09:00:00Z', ended_at: null, duration_ms: null, status: 'running', isolation_tier: null, trace_id: null, error_message: null },
          { id: 'tl-2', run_id: 'run-1', task_id: 't2', plugin_id: 'p1', step_name: 'test', started_at: '2026-06-02T10:00:00Z', ended_at: null, duration_ms: null, status: 'running', isolation_tier: null, trace_id: null, error_message: null },
        ],
      });

      const results = await repo.findByRunId('run-1');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('tl-1');
      expect(results[1].id).toBe('tl-2');
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('timeout'));

      await expect(repo.findByRunId('run-001')).rejects.toThrow('timeout');
    });
  });

  // ─── findByTimelineId ────────────────────────────────────────────────────

  describe('findByTimelineId', () => {
    it('should query with correct SQL and parameter', async () => {
      await repo.findByTimelineId('tl-456');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM execution_events');
      expect(sql).toContain('WHERE timeline_id = $1');
      expect(sql).toContain('ORDER BY sequence_num ASC');
      expect(params).toEqual(['tl-456']);
    });

    it('should map snake_case columns to camelCase fields', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 'evt-001',
          timeline_id: 'tl-001',
          event_type: 'start',
          timestamp: '2026-06-02T10:00:00.000Z',
          level: 'info',
          message: 'Task started',
          metadata: null,
          sequence_num: 1,
        }],
      });

      const results = await repo.findByTimelineId('tl-001');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('evt-001');
      expect(results[0].timelineId).toBe('tl-001');
      expect(results[0].eventType).toBe('start');
      expect(results[0].timestamp).toEqual(new Date('2026-06-02T10:00:00.000Z'));
      expect(results[0].level).toBe('info');
      expect(results[0].message).toBe('Task started');
      expect(results[0].sequenceNum).toBe(1);
    });

    it('should parse JSON string metadata', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 'evt-001',
          timeline_id: 'tl-001',
          event_type: 'log',
          timestamp: '2026-06-02T10:00:00.000Z',
          level: 'info',
          message: null,
          metadata: '{"key":"value","count":42}',
          sequence_num: 1,
        }],
      });

      const results = await repo.findByTimelineId('tl-001');
      expect(results[0].metadata).toEqual({ key: 'value', count: 42 });
    });

    it('should handle object metadata (already parsed by driver)', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 'evt-001',
          timeline_id: 'tl-001',
          event_type: 'log',
          timestamp: '2026-06-02T10:00:00.000Z',
          level: 'info',
          message: null,
          metadata: { key: 'value' },  // Already an object (e.g. jsonb column)
          sequence_num: 1,
        }],
      });

      const results = await repo.findByTimelineId('tl-001');
      expect(results[0].metadata).toEqual({ key: 'value' });
    });

    it('should handle null metadata as undefined', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 'evt-001',
          timeline_id: 'tl-001',
          event_type: 'log',
          timestamp: '2026-06-02T10:00:00.000Z',
          level: 'info',
          message: null,
          metadata: null,
          sequence_num: 1,
        }],
      });

      const results = await repo.findByTimelineId('tl-001');
      expect(results[0].metadata).toBeUndefined();
    });

    it('should return empty array when no rows found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const results = await repo.findByTimelineId('non-existent');
      expect(results).toEqual([]);
    });

    it('should return multiple events ordered by sequence_num', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 'evt-1', timeline_id: 'tl-1', event_type: 'start', timestamp: '2026-06-02T10:00:00Z', level: 'info', message: null, metadata: null, sequence_num: 1 },
          { id: 'evt-2', timeline_id: 'tl-1', event_type: 'log', timestamp: '2026-06-02T10:00:01Z', level: 'info', message: 'step 1', metadata: null, sequence_num: 2 },
          { id: 'evt-3', timeline_id: 'tl-1', event_type: 'complete', timestamp: '2026-06-02T10:00:02Z', level: 'info', message: null, metadata: null, sequence_num: 3 },
        ],
      });

      const results = await repo.findByTimelineId('tl-1');
      expect(results).toHaveLength(3);
      expect(results[0].sequenceNum).toBe(1);
      expect(results[1].sequenceNum).toBe(2);
      expect(results[2].sequenceNum).toBe(3);
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('connection lost'));

      await expect(repo.findByTimelineId('tl-001')).rejects.toThrow('connection lost');
    });
  });
});
