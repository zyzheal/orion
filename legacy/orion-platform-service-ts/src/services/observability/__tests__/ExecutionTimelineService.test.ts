/**
 * ExecutionTimelineService - Comprehensive Tests
 *
 * Tests for timeline CRUD, event management, status updates,
 * replay data, and shutdown. All operations backed by mock repository.
 */

import {
  ExecutionTimelineService,
  TimelineEntry,
  TimelineEvent,
  registerTimelineForShutdown,
  shutdownAllTimelines,
} from '../ExecutionTimelineService';
import { ExecutionTimelineRepository } from '../../../repositories/ExecutionTimelineRepository';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createMockRepository(): jest.Mocked<ExecutionTimelineRepository> {
  return {
    saveTimeline: jest.fn().mockImplementation(async (params: any) => ({
      id: params.id,
      run_id: params.runId,
      task_id: params.taskId,
      plugin_id: params.pluginId,
      step_name: params.stepName,
      started_at: params.startedAt,
      ended_at: params.endedAt || null,
      duration_ms: params.durationMs ?? null,
      status: params.status,
      isolation_tier: params.isolationTier || null,
      trace_id: params.traceId || null,
      span_id: null,
      error_message: params.errorMessage || null,
      tenant_id: params.tenantId,
      created_at: new Date(),
      updated_at: new Date(),
    })),
    saveEvent: jest.fn().mockImplementation(async (params: any) => ({
      id: params.id,
      timeline_id: params.timelineId,
      event_type: params.eventType,
      timestamp: params.timestamp,
      level: params.level,
      message: params.message || null,
      metadata: params.metadata || null,
      sequence_num: params.sequenceNum,
    })),
    findByRunId: jest.fn().mockResolvedValue([]),
    findByTimelineId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    getNextSequenceNum: jest.fn().mockResolvedValue(1),
  } as any;
}

function createTimelineEntry(overrides: Partial<TimelineEntry> = {}): Omit<TimelineEntry, 'id'> {
  return {
    runId: 'run-001',
    taskId: 'task-001',
    pluginId: 'plugin-001',
    stepName: 'build',
    startedAt: new Date(),
    status: 'running',
    ...overrides,
  };
}

function createDbTimelineRow(overrides: Partial<any> = {}): any {
  return {
    id: 'tl-001',
    run_id: 'run-001',
    task_id: 'task-001',
    plugin_id: 'plugin-001',
    step_name: 'build',
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_ms: null,
    status: 'running',
    isolation_tier: null,
    trace_id: null,
    span_id: null,
    error_message: null,
    tenant_id: 'default',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createDbEventRow(overrides: Partial<any> = {}): any {
  return {
    id: 'evt-001',
    timeline_id: 'tl-001',
    event_type: 'start',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: null,
    metadata: null,
    sequence_num: 1,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ExecutionTimelineService', () => {
  let repo: ReturnType<typeof createMockRepository>;
  let service: ExecutionTimelineService;

  beforeEach(() => {
    repo = createMockRepository();
    service = new ExecutionTimelineService({ repository: repo });
  });

  afterEach(() => {
    service.shutdown();
  });

  // ─── createTimeline ─────────────────────────────────────────────────────

  describe('createTimeline', () => {
    it('should create a timeline with generated id', async () => {
      const timeline = await service.createTimeline(createTimelineEntry());

      expect(timeline.id).toBeDefined();
      expect(timeline.id).toMatch(/^timeline-/);
      expect(timeline.runId).toBe('run-001');
      expect(timeline.taskId).toBe('task-001');
      expect(timeline.status).toBe('running');
    });

    it('should persist to repository', async () => {
      await service.createTimeline(createTimelineEntry());

      expect(repo.saveTimeline).toHaveBeenCalledTimes(1);
    });

    it('should propagate repository errors', async () => {
      repo.saveTimeline.mockRejectedValue(new Error('DB error'));

      await expect(service.createTimeline(createTimelineEntry())).rejects.toThrow('DB error');
    });
  });

  // ─── addEvent ──────────────────────────────────────────────────────────

  describe('addEvent', () => {
    it('should add event with auto-generated id and sequence number', async () => {
      repo.getNextSequenceNum.mockResolvedValue(1);

      const event = await service.addEvent('tl-001', {
        timelineId: 'tl-001',
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
        message: 'Task started',
      });

      expect(event.id).toBe('event-1');
      expect(event.sequenceNum).toBe(1);
      expect(event.message).toBe('Task started');
    });

    it('should increment sequence number for multiple events', async () => {
      repo.getNextSequenceNum.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      await service.addEvent('tl-001', {
        timelineId: 'tl-001',
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
      });
      const second = await service.addEvent('tl-001', {
        timelineId: 'tl-001',
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
      });

      expect(second.sequenceNum).toBe(2);
    });

    it('should persist event to repository', async () => {
      repo.getNextSequenceNum.mockResolvedValue(1);

      await service.addEvent('tl-001', {
        timelineId: 'tl-001',
        eventType: 'complete',
        timestamp: new Date(),
        level: 'info',
      });

      expect(repo.saveEvent).toHaveBeenCalledTimes(1);
    });

    it('should propagate repository errors', async () => {
      repo.getNextSequenceNum.mockResolvedValue(1);
      repo.saveEvent.mockRejectedValue(new Error('DB error'));

      await expect(
        service.addEvent('tl-001', {
          timelineId: 'tl-001',
          eventType: 'error',
          timestamp: new Date(),
          level: 'error',
        })
      ).rejects.toThrow('DB error');
    });

    it('should handle events with metadata', async () => {
      repo.getNextSequenceNum.mockResolvedValue(1);

      const event = await service.addEvent('tl-001', {
        timelineId: 'tl-001',
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
        metadata: { key: 'value', count: 42 },
      });

      expect(event.metadata).toEqual({ key: 'value', count: 42 });
    });
  });

  // ─── updateTimelineStatus ──────────────────────────────────────────────

  describe('updateTimelineStatus', () => {
    it('should update status and set endedAt', async () => {
      const startedAt = new Date('2026-06-02T10:00:00Z');
      repo.findById.mockResolvedValue(createDbTimelineRow({
        id: 'tl-001',
        started_at: startedAt.toISOString(),
      }));

      await service.updateTimelineStatus('tl-001', 'success');

      expect(repo.saveTimeline).toHaveBeenCalledTimes(1);
      const call = repo.saveTimeline.mock.calls[0][0] as any;
      expect(call.status).toBe('success');
      expect(call.endedAt).toBeDefined();
    });

    it('should calculate durationMs', async () => {
      const startedAt = new Date('2026-06-02T10:00:00Z');
      repo.findById.mockResolvedValue(createDbTimelineRow({
        id: 'tl-001',
        started_at: startedAt.toISOString(),
      }));

      const endedAt = new Date('2026-06-02T10:05:00Z');
      await service.updateTimelineStatus('tl-001', 'success', endedAt);

      const call = repo.saveTimeline.mock.calls[0][0] as any;
      expect(call.durationMs).toBe(300000); // 5 minutes
    });

    it('should handle non-existent timeline id gracefully', async () => {
      repo.findById.mockResolvedValue(null);

      // Should not throw
      await service.updateTimelineStatus('non-existent', 'failed');
      expect(repo.saveTimeline).not.toHaveBeenCalled();
    });

    it('should persist update to repository', async () => {
      repo.findById.mockResolvedValue(createDbTimelineRow());

      await service.updateTimelineStatus('tl-001', 'success');

      expect(repo.saveTimeline).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getTimelineByRunId ────────────────────────────────────────────────

  describe('getTimelineByRunId', () => {
    it('should return timelines sorted by startedAt', async () => {
      repo.findByRunId.mockResolvedValue([
        createDbTimelineRow({ id: 'tl-1', started_at: '2026-06-02T09:00:00Z' }),
        createDbTimelineRow({ id: 'tl-2', started_at: '2026-06-02T10:00:00Z' }),
      ]);

      const timelines = await service.getTimelineByRunId('run-001');

      expect(timelines).toHaveLength(2);
      expect(timelines[0].id).toBe('tl-1');
      expect(timelines[1].id).toBe('tl-2');
    });

    it('should return empty array for non-existent run', async () => {
      repo.findByRunId.mockResolvedValue([]);

      const timelines = await service.getTimelineByRunId('non-existent');
      expect(timelines).toEqual([]);
    });

    it('should map snake_case to camelCase', async () => {
      repo.findByRunId.mockResolvedValue([
        createDbTimelineRow({
          id: 'tl-1',
          run_id: 'run-x',
          task_id: 'task-x',
          plugin_id: 'plugin-x',
          step_name: 'test',
          status: 'success',
          ended_at: '2026-06-02T10:05:00Z',
          duration_ms: 300000,
          isolation_tier: 'tier-1',
          trace_id: 'trace-abc',
          error_message: 'some error',
        }),
      ]);

      const timelines = await service.getTimelineByRunId('run-x');

      expect(timelines[0].runId).toBe('run-x');
      expect(timelines[0].taskId).toBe('task-x');
      expect(timelines[0].pluginId).toBe('plugin-x');
      expect(timelines[0].stepName).toBe('test');
      expect(timelines[0].status).toBe('success');
      expect(timelines[0].endedAt).toEqual(new Date('2026-06-02T10:05:00Z'));
      expect(timelines[0].durationMs).toBe(300000);
      expect(timelines[0].isolationTier).toBe('tier-1');
      expect(timelines[0].traceId).toBe('trace-abc');
      expect(timelines[0].errorMessage).toBe('some error');
    });
  });

  // ─── getEvents ─────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('should return events sorted by sequenceNum', async () => {
      repo.findByTimelineId.mockResolvedValue([
        createDbEventRow({ id: 'evt-1', sequence_num: 1, message: 'first' }),
        createDbEventRow({ id: 'evt-2', sequence_num: 2, message: 'second' }),
      ]);

      const events = await service.getEvents('tl-001');

      expect(events).toHaveLength(2);
      expect(events[0].sequenceNum).toBeLessThan(events[1].sequenceNum);
    });

    it('should return empty array for non-existent timeline', async () => {
      repo.findByTimelineId.mockResolvedValue([]);

      const events = await service.getEvents('non-existent');
      expect(events).toEqual([]);
    });

    it('should map snake_case to camelCase', async () => {
      repo.findByTimelineId.mockResolvedValue([
        createDbEventRow({
          id: 'evt-1',
          timeline_id: 'tl-x',
          event_type: 'log',
          level: 'warn',
          message: 'test message',
          metadata: { key: 'value' },
          sequence_num: 5,
        }),
      ]);

      const events = await service.getEvents('tl-x');

      expect(events[0].id).toBe('evt-1');
      expect(events[0].timelineId).toBe('tl-x');
      expect(events[0].eventType).toBe('log');
      expect(events[0].level).toBe('warn');
      expect(events[0].message).toBe('test message');
      expect(events[0].metadata).toEqual({ key: 'value' });
      expect(events[0].sequenceNum).toBe(5);
    });
  });

  // ─── getReplayData ─────────────────────────────────────────────────────

  describe('getReplayData', () => {
    it('should return timelines and events from repository', async () => {
      repo.findByRunId.mockResolvedValue([
        createDbTimelineRow({ id: 'tl-1' }),
      ]);
      repo.findByTimelineId.mockResolvedValue([
        createDbEventRow({ id: 'evt-1', timeline_id: 'tl-1' }),
      ]);

      const replay = await service.getReplayData('run-001');

      expect(replay.timelines).toHaveLength(1);
      expect(replay.events['tl-1']).toHaveLength(1);
    });

    it('should use repository for replay data', async () => {
      repo.findByRunId.mockResolvedValue([createDbTimelineRow({ id: 'tl-1' })]);
      repo.findByTimelineId.mockResolvedValue([]);

      const replay = await service.getReplayData('run-001');

      expect(repo.findByRunId).toHaveBeenCalledWith('run-001');
      expect(replay.timelines).toHaveLength(1);
    });

    it('should return empty data for non-existent run', async () => {
      repo.findByRunId.mockResolvedValue([]);

      const replay = await service.getReplayData('non-existent');
      expect(replay.timelines).toEqual([]);
      expect(replay.events).toEqual({});
    });

    it('should include events for multiple timelines', async () => {
      repo.findByRunId.mockResolvedValue([
        createDbTimelineRow({ id: 'tl-1' }),
        createDbTimelineRow({ id: 'tl-2' }),
      ]);
      repo.findByTimelineId.mockImplementation(async (id: string) => {
        if (id === 'tl-1') return [createDbEventRow({ id: 'evt-1', timeline_id: 'tl-1' })];
        if (id === 'tl-2') return [
          createDbEventRow({ id: 'evt-2', timeline_id: 'tl-2', sequence_num: 1 }),
          createDbEventRow({ id: 'evt-3', timeline_id: 'tl-2', sequence_num: 2 }),
        ];
        return [];
      });

      const replay = await service.getReplayData('run-001');

      expect(replay.timelines).toHaveLength(2);
      expect(replay.events['tl-1']).toHaveLength(1);
      expect(replay.events['tl-2']).toHaveLength(2);
    });
  });

  // ─── shutdown ──────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should complete without error', () => {
      expect(() => service.shutdown()).not.toThrow();
    });
  });

  // ─── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should require repository', () => {
      const svc = new ExecutionTimelineService({ repository: repo });
      expect(svc).toBeDefined();
      svc.shutdown();
    });

    it('should accept custom tenantId', () => {
      const svc = new ExecutionTimelineService({ repository: repo, tenantId: 'tenant-123' });
      expect(svc).toBeDefined();
      svc.shutdown();
    });
  });

  // ─── addEvent edge cases ─────────────────────────────────────────────────

  describe('addEvent edge cases', () => {
    it('should handle events for any timeline id', async () => {
      repo.getNextSequenceNum.mockResolvedValue(1);

      const event = await service.addEvent('any-tl-id', {
        timelineId: 'any-tl-id',
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
        message: 'orphan event',
      });

      expect(event.id).toBe('event-1');
      expect(event.sequenceNum).toBe(1);
      expect(event.message).toBe('orphan event');
    });

    it('should track sequence numbers independently per timeline', async () => {
      repo.getNextSequenceNum.mockImplementation(async (tlId: string) => {
        if (tlId === 'tl-1') return 3; // 2 existing events + 1
        if (tlId === 'tl-2') return 1; // no existing events
        return 1;
      });

      const t1Event = await service.addEvent('tl-1', { timelineId: 'tl-1', eventType: 'log', timestamp: new Date(), level: 'info' });
      const t2Event = await service.addEvent('tl-2', { timelineId: 'tl-2', eventType: 'start', timestamp: new Date(), level: 'info' });

      expect(t1Event.sequenceNum).toBe(3);
      expect(t2Event.sequenceNum).toBe(1);
    });
  });

  // ─── updateTimelineStatus edge cases ─────────────────────────────────────

  describe('updateTimelineStatus edge cases', () => {
    it('should set endedAt to now when not provided', async () => {
      repo.findById.mockResolvedValue(createDbTimelineRow({
        started_at: new Date(Date.now() - 60000).toISOString(),
      }));

      const before = Date.now();
      await service.updateTimelineStatus('tl-001', 'success');
      const after = Date.now();

      const call = repo.saveTimeline.mock.calls[0][0] as any;
      expect(call.endedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(call.endedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should update to all valid statuses', async () => {
      const statuses: TimelineEntry['status'][] = ['success', 'failed', 'timeout', 'cancelled'];

      for (const status of statuses) {
        repo.saveTimeline.mockClear();
        repo.findById.mockResolvedValue(createDbTimelineRow());

        await service.updateTimelineStatus('tl-001', status);

        const call = repo.saveTimeline.mock.calls[0][0] as any;
        expect(call.status).toBe(status);
      }
    });
  });
});

// ─── Global Registry ────────────────────────────────────────────────────────

describe('Timeline Registry', () => {
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
  });

  it('should register and shutdown all timelines', () => {
    const service1 = new ExecutionTimelineService({ repository: repo });
    const service2 = new ExecutionTimelineService({ repository: repo });

    registerTimelineForShutdown(service1);
    registerTimelineForShutdown(service2);

    const shutdownSpy1 = jest.spyOn(service1, 'shutdown');
    const shutdownSpy2 = jest.spyOn(service2, 'shutdown');

    shutdownAllTimelines();

    expect(shutdownSpy1).toHaveBeenCalled();
    expect(shutdownSpy2).toHaveBeenCalled();
  });

  it('should handle shutdown errors gracefully', () => {
    const service = new ExecutionTimelineService({ repository: repo });
    jest.spyOn(service, 'shutdown').mockImplementation(() => {
      throw new Error('shutdown error');
    });

    registerTimelineForShutdown(service);

    expect(() => shutdownAllTimelines()).not.toThrow();
  });

  it('should clear registry after shutdown', () => {
    const service = new ExecutionTimelineService({ repository: repo });
    registerTimelineForShutdown(service);

    shutdownAllTimelines();

    // Calling again should not call shutdown again
    const shutdownSpy = jest.spyOn(service, 'shutdown');
    shutdownAllTimelines();
    expect(shutdownSpy).not.toHaveBeenCalled();
  });
});
