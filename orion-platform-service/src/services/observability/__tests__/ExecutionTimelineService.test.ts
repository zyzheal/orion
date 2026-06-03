/**
 * ExecutionTimelineService - Comprehensive Tests
 *
 * Tests for timeline CRUD, event management, status updates,
 * replay data, database persistence, and shutdown.
 */

import {
  ExecutionTimelineService,
  TimelineEntry,
  TimelineEvent,
  TimelineEventRepository,
  registerTimelineForShutdown,
  shutdownAllTimelines,
} from '../ExecutionTimelineService';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createMockRepository(): jest.Mocked<TimelineEventRepository> {
  return {
    saveTimeline: jest.fn().mockResolvedValue(undefined),
    saveEvent: jest.fn().mockResolvedValue(undefined),
    findByRunId: jest.fn().mockResolvedValue([]),
    findByTimelineId: jest.fn().mockResolvedValue([]),
  };
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ExecutionTimelineService', () => {
  let service: ExecutionTimelineService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new ExecutionTimelineService();
  });

  afterEach(() => {
    service.shutdown();
    jest.useRealTimers();
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

    it('should persist to repository when available', async () => {
      const repo = createMockRepository();
      const svc = new ExecutionTimelineService({ repository: repo });

      await svc.createTimeline(createTimelineEntry());

      expect(repo.saveTimeline).toHaveBeenCalledTimes(1);
      svc.shutdown();
    });

    it('should not throw when repository save fails', async () => {
      const repo = createMockRepository();
      repo.saveTimeline.mockRejectedValue(new Error('DB error'));
      const svc = new ExecutionTimelineService({ repository: repo });

      const timeline = await svc.createTimeline(createTimelineEntry());
      expect(timeline).toBeDefined();
      svc.shutdown();
    });

    it('should initialize events and sequence counter', async () => {
      const timeline = await service.createTimeline(createTimelineEntry());

      const events = service.getEvents(timeline.id);
      expect(events).toEqual([]);
    });
  });

  // ─── addEvent ──────────────────────────────────────────────────────────

  describe('addEvent', () => {
    it('should add event with auto-generated id and sequence number', async () => {
      const timeline = await service.createTimeline(createTimelineEntry());

      const event = await service.addEvent(timeline.id, {
        timelineId: timeline.id,
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
      const timeline = await service.createTimeline(createTimelineEntry());

      await service.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
      });
      const second = await service.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
      });

      expect(second.sequenceNum).toBe(2);
    });

    it('should persist event to repository', async () => {
      const repo = createMockRepository();
      const svc = new ExecutionTimelineService({ repository: repo });
      const timeline = await svc.createTimeline(createTimelineEntry());

      await svc.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'complete',
        timestamp: new Date(),
        level: 'info',
      });

      expect(repo.saveEvent).toHaveBeenCalledTimes(1);
      svc.shutdown();
    });

    it('should not throw when repository event save fails', async () => {
      const repo = createMockRepository();
      repo.saveEvent.mockRejectedValue(new Error('DB error'));
      const svc = new ExecutionTimelineService({ repository: repo });
      const timeline = await svc.createTimeline(createTimelineEntry());

      const event = await svc.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'error',
        timestamp: new Date(),
        level: 'error',
      });

      expect(event).toBeDefined();
      svc.shutdown();
    });

    it('should handle events with metadata', async () => {
      const timeline = await service.createTimeline(createTimelineEntry());

      const event = await service.addEvent(timeline.id, {
        timelineId: timeline.id,
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
      const timeline = await service.createTimeline(createTimelineEntry());

      service.updateTimelineStatus(timeline.id, 'success');

      const timelines = service.getTimelineByRunId('run-001');
      expect(timelines[0].status).toBe('success');
      expect(timelines[0].endedAt).toBeDefined();
    });

    it('should calculate durationMs', async () => {
      const startedAt = new Date('2026-06-02T10:00:00Z');
      const timeline = await service.createTimeline(createTimelineEntry({ startedAt }));

      const endedAt = new Date('2026-06-02T10:05:00Z');
      service.updateTimelineStatus(timeline.id, 'success', endedAt);

      const timelines = service.getTimelineByRunId('run-001');
      expect(timelines[0].durationMs).toBe(300000); // 5 minutes
    });

    it('should handle non-existent timeline id gracefully', () => {
      expect(() => {
        service.updateTimelineStatus('non-existent', 'failed');
      }).not.toThrow();
    });

    it('should persist update to repository', async () => {
      const repo = createMockRepository();
      const svc = new ExecutionTimelineService({ repository: repo });
      const timeline = await svc.createTimeline(createTimelineEntry());

      svc.updateTimelineStatus(timeline.id, 'success');

      // saveTimeline called once for create, once for update
      expect(repo.saveTimeline).toHaveBeenCalledTimes(2);
      svc.shutdown();
    });
  });

  // ─── getTimelineByRunId ────────────────────────────────────────────────

  describe('getTimelineByRunId', () => {
    it('should return timelines sorted by startedAt', async () => {
      const t1 = await service.createTimeline(createTimelineEntry({
        runId: 'run-1',
        startedAt: new Date('2026-06-02T10:00:00Z'),
      }));
      const t2 = await service.createTimeline(createTimelineEntry({
        runId: 'run-1',
        startedAt: new Date('2026-06-02T09:00:00Z'),
      }));

      const timelines = service.getTimelineByRunId('run-1');

      expect(timelines).toHaveLength(2);
      expect(timelines[0].id).toBe(t2.id); // Earlier one first
      expect(timelines[1].id).toBe(t1.id);
    });

    it('should return empty array for non-existent run', () => {
      const timelines = service.getTimelineByRunId('non-existent');
      expect(timelines).toEqual([]);
    });

    it('should filter by runId', async () => {
      await service.createTimeline(createTimelineEntry({ runId: 'run-1' }));
      await service.createTimeline(createTimelineEntry({ runId: 'run-2' }));

      const timelines = service.getTimelineByRunId('run-1');
      expect(timelines).toHaveLength(1);
    });
  });

  // ─── getEvents ─────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('should return events sorted by sequenceNum', async () => {
      const timeline = await service.createTimeline(createTimelineEntry());

      await service.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
        message: 'second',
      });
      await service.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
        message: 'third',
      });

      const events = service.getEvents(timeline.id);
      expect(events).toHaveLength(2);
      expect(events[0].sequenceNum).toBeLessThan(events[1].sequenceNum);
    });

    it('should return empty array for non-existent timeline', () => {
      const events = service.getEvents('non-existent');
      expect(events).toEqual([]);
    });
  });

  // ─── getReplayData ─────────────────────────────────────────────────────

  describe('getReplayData', () => {
    it('should return timelines and events from memory', async () => {
      const timeline = await service.createTimeline(createTimelineEntry({ runId: 'run-replay' }));
      await service.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
      });

      const replay = await service.getReplayData('run-replay');

      expect(replay.timelines).toHaveLength(1);
      expect(replay.events[timeline.id]).toHaveLength(1);
    });

    it('should use repository when available', async () => {
      const repo = createMockRepository();
      const timeline: TimelineEntry = {
        id: 'tl-1',
        runId: 'run-db',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        stepName: 'build',
        startedAt: new Date(),
        status: 'success',
      };
      repo.findByRunId.mockResolvedValue([timeline]);
      repo.findByTimelineId.mockResolvedValue([]);

      const svc = new ExecutionTimelineService({ repository: repo });
      const replay = await svc.getReplayData('run-db');

      expect(repo.findByRunId).toHaveBeenCalledWith('run-db');
      expect(replay.timelines).toHaveLength(1);
      svc.shutdown();
    });

    it('should fallback to memory when repository fails', async () => {
      const repo = createMockRepository();
      repo.findByRunId.mockRejectedValue(new Error('DB error'));

      const svc = new ExecutionTimelineService({ repository: repo });
      const timeline = await svc.createTimeline(createTimelineEntry({ runId: 'run-fallback' }));

      const replay = await svc.getReplayData('run-fallback');
      expect(replay.timelines).toHaveLength(1);
      svc.shutdown();
    });
  });

  // ─── shutdown ──────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should clear all data', async () => {
      await service.createTimeline(createTimelineEntry());

      service.shutdown();

      const timelines = service.getTimelineByRunId('run-001');
      expect(timelines).toEqual([]);
    });

    it('should clear cleanup timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      service.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  // ─── cleanup timer ─────────────────────────────────────────────────────

  describe('cleanup timer', () => {
    it('should evict stale timelines after TTL', async () => {
      const oldDate = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      await service.createTimeline(createTimelineEntry({ startedAt: oldDate }));

      // Advance timers to trigger cleanup (5 minutes interval)
      jest.advanceTimersByTime(5 * 60 * 1000);

      const timelines = service.getTimelineByRunId('run-001');
      expect(timelines).toEqual([]);
    });

    it('should keep recent timelines', async () => {
      await service.createTimeline(createTimelineEntry());

      // Advance timers
      jest.advanceTimersByTime(5 * 60 * 1000);

      const timelines = service.getTimelineByRunId('run-001');
      expect(timelines).toHaveLength(1);
    });

    it('should evict old timelines and their events', async () => {
      const oldDate = new Date(Date.now() - 31 * 60 * 1000);
      const timeline = await service.createTimeline(createTimelineEntry({ startedAt: oldDate }));
      await service.addEvent(timeline.id, {
        timelineId: timeline.id,
        eventType: 'log',
        timestamp: new Date(),
        level: 'info',
      });

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(service.getTimelineByRunId('run-001')).toEqual([]);
      expect(service.getEvents(timeline.id)).toEqual([]);
    });

    it('should evict multiple old timelines in one cleanup cycle', async () => {
      const oldDate = new Date(Date.now() - 31 * 60 * 1000);
      await service.createTimeline(createTimelineEntry({ startedAt: oldDate, runId: 'run-old-1' }));
      await service.createTimeline(createTimelineEntry({ startedAt: oldDate, runId: 'run-old-2' }));
      await service.createTimeline(createTimelineEntry({ runId: 'run-new' }));

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(service.getTimelineByRunId('run-old-1')).toEqual([]);
      expect(service.getTimelineByRunId('run-old-2')).toEqual([]);
      expect(service.getTimelineByRunId('run-new')).toHaveLength(1);
    });
  });

  // ─── Constructor edge cases ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should work without options', () => {
      const svc = new ExecutionTimelineService();
      expect(svc).toBeDefined();
      svc.shutdown();
    });

    it('should work with empty options', () => {
      const svc = new ExecutionTimelineService({});
      expect(svc).toBeDefined();
      svc.shutdown();
    });
  });

  // ─── addEvent edge cases ─────────────────────────────────────────────────

  describe('addEvent edge cases', () => {
    it('should handle events for non-existent timeline (graceful fallback)', async () => {
      // addEvent works even if timeline wasn't created via createTimeline
      const event = await service.addEvent('non-existent-tl', {
        timelineId: 'non-existent-tl',
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
      const t1 = await service.createTimeline(createTimelineEntry());
      const t2 = await service.createTimeline(createTimelineEntry({ runId: 'run-002' }));

      await service.addEvent(t1.id, { timelineId: t1.id, eventType: 'start', timestamp: new Date(), level: 'info' });
      await service.addEvent(t1.id, { timelineId: t1.id, eventType: 'log', timestamp: new Date(), level: 'info' });
      const t2Event = await service.addEvent(t2.id, { timelineId: t2.id, eventType: 'start', timestamp: new Date(), level: 'info' });

      // t2 should have its own sequence starting at 1
      expect(t2Event.sequenceNum).toBe(1);

      const t1Events = service.getEvents(t1.id);
      expect(t1Events).toHaveLength(2);
    });
  });

  // ─── getTimelineByRunId edge cases ───────────────────────────────────────

  describe('getTimelineByRunId edge cases', () => {
    it('should handle multiple runs independently', async () => {
      await service.createTimeline(createTimelineEntry({ runId: 'run-a' }));
      await service.createTimeline(createTimelineEntry({ runId: 'run-a' }));
      await service.createTimeline(createTimelineEntry({ runId: 'run-b' }));

      expect(service.getTimelineByRunId('run-a')).toHaveLength(2);
      expect(service.getTimelineByRunId('run-b')).toHaveLength(1);
      expect(service.getTimelineByRunId('run-c')).toHaveLength(0);
    });
  });

  // ─── updateTimelineStatus edge cases ─────────────────────────────────────

  describe('updateTimelineStatus edge cases', () => {
    it('should set endedAt to now when not provided', async () => {
      const timeline = await service.createTimeline(createTimelineEntry());

      const before = Date.now();
      service.updateTimelineStatus(timeline.id, 'success');
      const after = Date.now();

      const result = service.getTimelineByRunId('run-001')[0];
      expect(result.endedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.endedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle repository save failure on update silently', async () => {
      const repo = createMockRepository();
      repo.saveTimeline.mockRejectedValueOnce(undefined).mockResolvedValue(undefined);
      const svc = new ExecutionTimelineService({ repository: repo });
      const timeline = await svc.createTimeline(createTimelineEntry());

      // Should not throw even if repo fails on update
      expect(() => {
        svc.updateTimelineStatus(timeline.id, 'failed');
      }).not.toThrow();

      svc.shutdown();
    });

    it('should update to all valid statuses', async () => {
      const statuses: TimelineEntry['status'][] = ['success', 'failed', 'timeout', 'cancelled'];

      for (const status of statuses) {
        const timeline = await service.createTimeline(createTimelineEntry());
        service.updateTimelineStatus(timeline.id, status);
        const result = service.getTimelineByRunId('run-001').find(t => t.id === timeline.id)!;
        expect(result.status).toBe(status);
      }
    });
  });

  // ─── getReplayData edge cases ────────────────────────────────────────────

  describe('getReplayData edge cases', () => {
    it('should return empty data for non-existent run', async () => {
      const replay = await service.getReplayData('non-existent');
      expect(replay.timelines).toEqual([]);
      expect(replay.events).toEqual({});
    });

    it('should include events for multiple timelines', async () => {
      const t1 = await service.createTimeline(createTimelineEntry({ runId: 'run-multi' }));
      const t2 = await service.createTimeline(createTimelineEntry({ runId: 'run-multi' }));

      await service.addEvent(t1.id, { timelineId: t1.id, eventType: 'start', timestamp: new Date(), level: 'info' });
      await service.addEvent(t2.id, { timelineId: t2.id, eventType: 'start', timestamp: new Date(), level: 'info' });
      await service.addEvent(t2.id, { timelineId: t2.id, eventType: 'complete', timestamp: new Date(), level: 'info' });

      const replay = await service.getReplayData('run-multi');
      expect(replay.timelines).toHaveLength(2);
      expect(replay.events[t1.id]).toHaveLength(1);
      expect(replay.events[t2.id]).toHaveLength(2);
    });

    it('should return repository events when repo is available', async () => {
      const repo = createMockRepository();
      const timeline: TimelineEntry = {
        id: 'tl-db',
        runId: 'run-db-evt',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        stepName: 'build',
        startedAt: new Date(),
        status: 'success',
      };
      const event: TimelineEvent = {
        id: 'evt-db',
        timelineId: 'tl-db',
        eventType: 'start',
        timestamp: new Date(),
        level: 'info',
        sequenceNum: 1,
      };
      repo.findByRunId.mockResolvedValue([timeline]);
      repo.findByTimelineId.mockResolvedValue([event]);

      const svc = new ExecutionTimelineService({ repository: repo });
      const replay = await svc.getReplayData('run-db-evt');

      expect(replay.events['tl-db']).toHaveLength(1);
      expect(replay.events['tl-db'][0].id).toBe('evt-db');
      svc.shutdown();
    });
  });
});

// ─── Global Registry ────────────────────────────────────────────────────────

describe('Timeline Registry', () => {
  it('should register and shutdown all timelines', () => {
    const service1 = new ExecutionTimelineService();
    const service2 = new ExecutionTimelineService();

    registerTimelineForShutdown(service1);
    registerTimelineForShutdown(service2);

    const shutdownSpy1 = jest.spyOn(service1, 'shutdown');
    const shutdownSpy2 = jest.spyOn(service2, 'shutdown');

    shutdownAllTimelines();

    expect(shutdownSpy1).toHaveBeenCalled();
    expect(shutdownSpy2).toHaveBeenCalled();
  });

  it('should handle shutdown errors gracefully', () => {
    const service = new ExecutionTimelineService();
    jest.spyOn(service, 'shutdown').mockImplementation(() => {
      throw new Error('shutdown error');
    });

    registerTimelineForShutdown(service);

    expect(() => shutdownAllTimelines()).not.toThrow();
  });

  it('should clear registry after shutdown', () => {
    const service = new ExecutionTimelineService();
    registerTimelineForShutdown(service);

    shutdownAllTimelines();

    // Calling again should not call shutdown again
    const shutdownSpy = jest.spyOn(service, 'shutdown');
    shutdownAllTimelines();
    expect(shutdownSpy).not.toHaveBeenCalled();
  });
});
