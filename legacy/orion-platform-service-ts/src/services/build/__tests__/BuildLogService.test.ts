/**
 * BuildLogService 单元测试 - PostgreSQL Repository 模式
 */

import { BuildLogService } from '../BuildLogService';
import { LogLevel } from '../../../models/BuildLog';

// Mock repository matching BuildLogRepository's actual API
const createMockRepo = () => ({
  create: jest.fn().mockResolvedValue(undefined),
  findByBuildId: jest.fn().mockResolvedValue([]),
  findByProjectId: jest.fn().mockResolvedValue([]),
  appendLogContent: jest.fn().mockResolvedValue(undefined),
  mapRowToEntity: jest.fn(),
});

describe('BuildLogService', () => {
  let mockRepo: ReturnType<typeof createMockRepo>;
  let service: BuildLogService;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new BuildLogService(mockRepo as any);
  });

  describe('constructor', () => {
    it('should throw when no repository provided', () => {
      expect(() => new BuildLogService()).toThrow('BuildLogRepository is required for BuildLogService');
    });

    it('should throw when repository is null', () => {
      expect(() => new BuildLogService(null as any)).toThrow('BuildLogRepository is required for BuildLogService');
    });

    it('should accept a repository and initialize', () => {
      expect(() => new BuildLogService(mockRepo as any)).not.toThrow();
    });
  });

  describe('createLog', () => {
    it('should create a build log', async () => {
      const log = await service.createLog({
        runId: 'run-123',
        podName: 'build-pod-1',
        containerName: 'build',
      });

      expect(log).toBeDefined();
      expect(log.runId).toBe('run-123');
      expect(log.podName).toBe('build-pod-1');
      expect(log.containerName).toBe('build');
      expect(log.entries).toEqual([]);
      expect(log.isComplete).toBe(false);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should create a log without options', async () => {
      const log = await service.createLog();
      expect(log).toBeDefined();
      expect(log.entries).toEqual([]);
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });

  describe('getLog', () => {
    it('should return log by ID', async () => {
      const created = await service.createLog({ runId: 'run-1' });
      const found = await service.getLog(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.getLog('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('queryLogs', () => {
    it('should return all logs', async () => {
      await service.createLog({ runId: 'run-1' });
      await service.createLog({ runId: 'run-2' });

      const logs = await service.queryLogs({});
      expect(logs.length).toBe(2);
    });

    it('should filter by runId', async () => {
      await service.createLog({ runId: 'run-1' });
      await service.createLog({ runId: 'run-2' });

      const logs = await service.queryLogs({ runId: 'run-1' });
      expect(logs.length).toBe(1);
      expect(logs[0].runId).toBe('run-1');
    });

    it('should filter by taskId', async () => {
      await service.createLog({ taskId: 'task-1' });
      await service.createLog({ taskId: 'task-2' });

      const logs = await service.queryLogs({ taskId: 'task-1' });
      expect(logs.length).toBe(1);
    });

    it('should filter by podId', async () => {
      await service.createLog({ podId: 'pod-1' });
      await service.createLog({ podId: 'pod-2' });

      const logs = await service.queryLogs({ podId: 'pod-1' });
      expect(logs.length).toBe(1);
    });

    it('should support pagination', async () => {
      await service.createLog({ runId: 'run-1' });
      await service.createLog({ runId: 'run-2' });
      await service.createLog({ runId: 'run-3' });

      const logs = await service.queryLogs({ limit: 2, offset: 0 });
      expect(logs.length).toBeLessThanOrEqual(2);
    });
  });

  // ==================== 日志条目管理 ====================

  describe('appendEntry', () => {
    it('should append a log entry', async () => {
      const log = await service.createLog({ runId: 'run-1' });

      const updated = await service.appendEntry(log.id, 'Build started');
      expect(updated).toBeDefined();
      expect(updated?.entries.length).toBe(1);
      expect(updated?.entries[0].message).toBe('Build started');
      expect(updated?.entries[0].level).toBe(LogLevel.INFO);
      expect(mockRepo.appendLogContent).toHaveBeenCalled();
    });

    it('should append entry with custom level', async () => {
      const log = await service.createLog({ runId: 'run-1' });

      const updated = await service.appendEntry(log.id, 'Warning message', {
        level: LogLevel.WARN,
      });

      expect(updated?.entries[0].level).toBe(LogLevel.WARN);
    });

    it('should append entry with source', async () => {
      const log = await service.createLog({ runId: 'run-1' });

      const updated = await service.appendEntry(log.id, 'Error in container', {
        level: LogLevel.ERROR,
        source: 'build-container',
        stream: 'stderr',
      });

      expect(updated?.entries[0].source).toBe('build-container');
      expect(updated?.entries[0].stream).toBe('stderr');
    });

    it('should return null for non-existent log', async () => {
      const updated = await service.appendEntry('non-existent', 'test');
      expect(updated).toBeNull();
    });
  });

  describe('appendEntries', () => {
    it('should append multiple entries', async () => {
      const log = await service.createLog({ runId: 'run-1' });

      const updated = await service.appendEntries(log.id, [
        {
          timestamp: new Date().toISOString(),
          level: LogLevel.INFO,
          message: 'Step 1',
        },
        {
          timestamp: new Date().toISOString(),
          level: LogLevel.INFO,
          message: 'Step 2',
        },
      ]);

      expect(updated?.entries.length).toBe(2);
      expect(updated?.totalLines).toBe(2);
      expect(mockRepo.appendLogContent).toHaveBeenCalled();
    });
  });

  describe('importFromRawText', () => {
    it('should parse structured log lines', async () => {
      const log = await service.createLog({ runId: 'run-1' });
      const rawText = `[2024-01-01T00:00:00Z] [INFO] Build started
[2024-01-01T00:00:01Z] [ERROR] [build] Compilation failed`;

      const updated = await service.importFromRawText(log.id, rawText);

      expect(updated?.entries.length).toBe(2);
      expect(updated?.entries[0].message).toBe('Build started');
      expect(updated?.entries[1].source).toBe('build');
      expect(updated?.entries[1].level).toBe(LogLevel.ERROR);
    });

    it('should handle unstructured lines', async () => {
      const log = await service.createLog({ runId: 'run-1' });
      const rawText = 'Plain log line without format';

      const updated = await service.importFromRawText(log.id, rawText);

      expect(updated?.entries.length).toBe(1);
      expect(updated?.entries[0].message).toBe('Plain log line without format');
      expect(updated?.entries[0].level).toBe(LogLevel.INFO);
    });
  });

  describe('completeLog', () => {
    it('should mark log as complete', async () => {
      const log = await service.createLog({ runId: 'run-1' });

      const completed = await service.completeLog(log.id);
      expect(completed?.isComplete).toBe(true);
    });

    it('should return null for non-existent log', async () => {
      const completed = await service.completeLog('non-existent');
      expect(completed).toBeNull();
    });
  });

  // ==================== 日志文本输出 ====================

  describe('getLogText', () => {
    it('should format log entries as text', async () => {
      const log = await service.createLog({ runId: 'run-1' });
      await service.appendEntry(log.id, 'Build started', {
        level: LogLevel.INFO,
        source: 'build',
      });
      await service.appendEntry(log.id, 'Error occurred', {
        level: LogLevel.ERROR,
        source: 'build',
      });

      const fullLog = await service.getLog(log.id);
      const text = service.getLogText(fullLog!);

      expect(text).toContain('[INFO]');
      expect(text).toContain('[ERROR]');
      expect(text).toContain('Build started');
      expect(text).toContain('Error occurred');
    });
  });

  // ==================== 订阅/推送测试 ====================

  describe('subscribe/unsubscribe', () => {
    it('should subscribe to log stream', async () => {
      const received: any[] = [];

      const subscriberId = service.subscribe(
        { runId: 'run-1' },
        {
          onLog: (entry) => received.push(entry),
        }
      );

      expect(subscriberId).toBeDefined();
      expect(service.getSubscriberCount()).toBe(1);

      // Unsubscribe
      const unsubscribed = service.unsubscribe(subscriberId);
      expect(unsubscribed).toBe(true);
      expect(service.getSubscriberCount()).toBe(0);
    });

    it('should notify subscribers of new entries', async () => {
      const received: any[] = [];

      const log = await service.createLog({ runId: 'run-1' });

      service.subscribe(
        { runId: 'run-1' },
        {
          onLog: (entry) => received.push(entry),
        }
      );

      await service.appendEntry(log.id, 'New log entry');

      expect(received.length).toBe(1);
      expect(received[0].message).toBe('New log entry');
    });

    it('should not notify non-matching subscribers', async () => {
      const received: any[] = [];

      const log = await service.createLog({ runId: 'run-1' });

      // Subscribe to different run
      service.subscribe(
        { runId: 'run-2' },
        {
          onLog: (entry) => received.push(entry),
        }
      );

      await service.appendEntry(log.id, 'Entry for run-1');

      expect(received.length).toBe(0);
    });

    it('should notify on complete', async () => {
      let completed = false;
      const log = await service.createLog({ runId: 'run-1' });

      service.subscribe(
        { runId: 'run-1' },
        {
          onLog: () => {},
          onComplete: () => {
            completed = true;
          },
        }
      );

      await service.completeLog(log.id);

      expect(completed).toBe(true);
    });
  });

  // ==================== 清理测试 ====================

  describe('cleanupCompletedLogs', () => {
    it('should cleanup old completed logs', async () => {
      const log = await service.createLog({ runId: 'run-1' });
      await service.completeLog(log.id);

      // With default 24h threshold, should not clean recent logs
      const cleaned = await service.cleanupCompletedLogs(0); // 0ms = clean all
      expect(cleaned).toBe(1);
    });

    it('should not cleanup incomplete logs', async () => {
      await service.createLog({ runId: 'run-1' });
      // Don't complete the log

      const cleaned = await service.cleanupCompletedLogs(0);
      expect(cleaned).toBe(0);
    });
  });
});
