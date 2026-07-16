/**
 * BuildLog 模型测试
 */
import {
  createBuildLog,
  appendLogEntry,
  appendLogEntries,
  completeBuildLog,
  createLogEntry,
  parseLogLine,
  LogLevel,
} from '../BuildLog';

describe('BuildLog', () => {
  describe('createBuildLog', () => {
    it('should create empty log', () => {
      const log = createBuildLog();

      expect(log.id).toBeDefined();
      expect(log.entries).toEqual([]);
      expect(log.isComplete).toBe(false);
      expect(log.totalLines).toBe(0);
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const log = createBuildLog({
        runId: 'run-1',
        stageId: 'stage-1',
        taskId: 'task-1',
        podId: 'pod-1',
        podName: 'build-pod',
        containerName: 'main',
      });

      expect(log.runId).toBe('run-1');
      expect(log.stageId).toBe('stage-1');
      expect(log.taskId).toBe('task-1');
      expect(log.podId).toBe('pod-1');
      expect(log.podName).toBe('build-pod');
      expect(log.containerName).toBe('main');
    });
  });

  describe('appendLogEntry', () => {
    it('should append a single entry', () => {
      const log = createBuildLog();
      const updated = appendLogEntry(log, 'Build started');

      expect(updated.entries).toHaveLength(1);
      expect(updated.entries[0].message).toBe('Build started');
      expect(updated.entries[0].level).toBe(LogLevel.INFO);
      expect(updated.totalLines).toBe(1);
    });

    it('should accept custom level and source', () => {
      const log = createBuildLog();
      const updated = appendLogEntry(log, 'Error occurred', {
        level: LogLevel.ERROR,
        source: 'builder',
        stream: 'stderr',
      });

      expect(updated.entries[0].level).toBe(LogLevel.ERROR);
      expect(updated.entries[0].source).toBe('builder');
      expect(updated.entries[0].stream).toBe('stderr');
    });
  });

  describe('appendLogEntries', () => {
    it('should append multiple entries', () => {
      const log = createBuildLog();
      const entries = [
        createLogEntry('line 1'),
        createLogEntry('line 2'),
        createLogEntry('line 3'),
      ];

      const updated = appendLogEntries(log, entries);

      expect(updated.entries).toHaveLength(3);
      expect(updated.totalLines).toBe(3);
    });
  });

  describe('completeBuildLog', () => {
    it('should mark log as complete', () => {
      const log = createBuildLog();
      const completed = completeBuildLog(log);

      expect(completed.isComplete).toBe(true);
      expect(completed.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('createLogEntry', () => {
    it('should create entry with defaults', () => {
      const entry = createLogEntry('test message');

      expect(entry.message).toBe('test message');
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.stream).toBe('stdout');
      expect(entry.timestamp).toBeDefined();
    });

    it('should accept custom options', () => {
      const entry = createLogEntry('warn msg', {
        level: LogLevel.WARN,
        source: 'container',
        stream: 'stderr',
      });

      expect(entry.level).toBe(LogLevel.WARN);
      expect(entry.source).toBe('container');
      expect(entry.stream).toBe('stderr');
    });
  });

  describe('parseLogLine', () => {
    it('should parse structured log line', () => {
      const entry = parseLogLine('[2024-01-01T00:00:00Z] [INFO] [main] Hello world');

      expect(entry.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(entry.level).toBe(LogLevel.INFO);
      expect(entry.source).toBe('main');
      expect(entry.message).toBe('Hello world');
    });

    it('should parse log line without source', () => {
      const entry = parseLogLine('[2024-01-01T00:00:00Z] [ERROR] Something broke');

      expect(entry.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(entry.level).toBe(LogLevel.ERROR);
      expect(entry.message).toBe('Something broke');
    });

    it('should fallback for unstructured lines', () => {
      const entry = parseLogLine('Plain log message', 'my-source');

      expect(entry.message).toBe('Plain log message');
      expect(entry.source).toBe('my-source');
      expect(entry.level).toBe(LogLevel.INFO);
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct values', () => {
      expect(LogLevel.INFO).toBe('INFO');
      expect(LogLevel.WARN).toBe('WARN');
      expect(LogLevel.ERROR).toBe('ERROR');
      expect(LogLevel.DEBUG).toBe('DEBUG');
    });
  });
});
