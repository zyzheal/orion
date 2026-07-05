/**
 * Plugin Audit Logger Tests
 */

import { PluginAuditLogger } from '../plugin/PluginAuditLogger';
import { ExecutionContext, DEFAULT_QUOTA } from '../plugin/types';

describe('PluginAuditLogger', () => {
  let auditLogger: PluginAuditLogger;

  const createMockContext = (taskId: string = 'task-1', pluginId: string = 'plugin-1'): ExecutionContext => ({
    taskId,
    pluginId,
    pipelineRunId: 'pipeline-1',
    stageId: 'stage-1',
    startedAt: new Date(),
    quota: DEFAULT_QUOTA,
  });

  beforeEach(() => {
    auditLogger = new PluginAuditLogger();
  });

  afterEach(() => {
    auditLogger.shutdown();
  });

  describe('Execution Logging', () => {
    it('should log execution start', async () => {
      const context = createMockContext();
      const input = { param: 'value' };

      const entryId = auditLogger.logExecutionStart(context, input);

      expect(entryId).toBeDefined();

      const logs = await auditLogger.getLogs({ taskId: context.taskId });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('EXECUTION_START');
      expect(logs[0].input).toEqual(input);
    });

    it('should log execution complete', async () => {
      const context = createMockContext();
      const output = { result: 'success' };

      auditLogger.logExecutionStart(context);
      const entryId = auditLogger.logExecutionComplete(context, output, 100);

      expect(entryId).toBeDefined();

      const logs = await auditLogger.getLogs({ taskId: context.taskId, action: 'EXECUTION_COMPLETE' });
      expect(logs.length).toBe(1);
      expect(logs[0].output).toEqual(output);
      expect(logs[0].durationMs).toBe(100);
    });

    it('should log execution error', async () => {
      const context = createMockContext();
      const error = new Error('Test error');

      auditLogger.logExecutionStart(context);
      const entryId = auditLogger.logExecutionError(context, error, 50);

      expect(entryId).toBeDefined();

      const logs = await auditLogger.getLogs({ taskId: context.taskId, level: 'ERROR' });
      expect(logs.length).toBe(1);
      expect(logs[0].message).toContain('Test error');
    });
  });

  describe('Security Events', () => {
    it('should log security events', () => {
      const entryId = auditLogger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED',
        severity: 'HIGH',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        message: 'Memory quota exceeded',
        details: { memoryBytes: 2 * 1024 * 1024 * 1024 },
      });

      expect(entryId).toBeDefined();

      const events = auditLogger.getSecurityEvents({ taskId: 'task-1' });
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('QUOTA_EXCEEDED');
      expect(events[0].severity).toBe('HIGH');
    });

    it('should emit security:alert for CRITICAL severity', () => {
      const handler = jest.fn();
      auditLogger.on('security:alert', handler);

      auditLogger.logSecurityEvent({
        type: 'MEMORY_LIMIT_EXCEEDED',
        severity: 'CRITICAL',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        message: 'Memory limit exceeded',
        details: {},
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit security:alert for HIGH severity', () => {
      const handler = jest.fn();
      auditLogger.on('security:alert', handler);

      auditLogger.logSecurityEvent({
        type: 'TIMEOUT_KILLED',
        severity: 'HIGH',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        message: 'Execution killed',
        details: {},
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should not emit security:alert for LOW severity', () => {
      const handler = jest.fn();
      auditLogger.on('security:alert', handler);

      auditLogger.logSecurityEvent({
        type: 'SENSITIVE_DATA_DETECTED',
        severity: 'LOW',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        message: 'Email detected',
        details: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('DLP Detection', () => {
    it('should detect credit card numbers', () => {
      const data = 'Credit card: 4111-1111-1111-1111';
      const result = auditLogger.detectSensitiveData(data);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns.length).toBe(1);
      expect(result.patterns[0].type).toBe('CREDIT_CARD');
    });

    it('should detect email addresses', () => {
      const data = 'Contact: test@example.com';
      const result = auditLogger.detectSensitiveData(data);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns.some(p => p.type === 'EMAIL')).toBe(true);
    });

    it('should detect IP addresses', () => {
      const data = 'Server IP: 192.168.1.100';
      const result = auditLogger.detectSensitiveData(data);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns.some(p => p.type === 'IP_ADDRESS')).toBe(true);
    });

    it('should detect multiple patterns', () => {
      const data = 'Email: test@example.com, IP: 10.0.0.1, Card: 1234-5678-9012-3456';
      const result = auditLogger.detectSensitiveData(data);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns.length).toBeGreaterThanOrEqual(3);
    });

    it('should return redacted data', () => {
      const data = 'Email: john.doe@example.com';
      const result = auditLogger.detectSensitiveData(data);

      expect(result.redactedData).toBeDefined();
      expect(result.redactedData).not.toContain('john.doe@example.com');
    });

    it('should return no patterns for clean data', () => {
      const data = 'Hello World, this is a test message';
      const result = auditLogger.detectSensitiveData(data);

      expect(result.hasSensitiveData).toBe(false);
      expect(result.patterns.length).toBe(0);
    });
  });

  describe('Query Functions', () => {
    it('should filter logs by taskId', async () => {
      const context1 = createMockContext('task-1');
      const context2 = createMockContext('task-2');

      auditLogger.logExecutionStart(context1);
      auditLogger.logExecutionStart(context2);

      const logs = await auditLogger.getLogs({ taskId: 'task-1' });
      expect(logs.length).toBe(1);
      expect(logs[0].taskId).toBe('task-1');
    });

    it('should filter logs by level', async () => {
      const context = createMockContext();

      auditLogger.logExecutionStart(context);
      auditLogger.logExecutionError(context, new Error('Test'));

      const errorLogs = await auditLogger.getLogs({ level: 'ERROR' });
      expect(errorLogs.length).toBe(1);

      const infoLogs = await auditLogger.getLogs({ level: 'INFO' });
      expect(infoLogs.length).toBe(1);
    });

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        auditLogger.logExecutionStart(createMockContext(`task-${i}`));
      }

      const logs = await auditLogger.getLogs({ limit: 3 });
      expect(logs.length).toBe(3);
    });

    it('should filter security events by severity', () => {
      auditLogger.logSecurityEvent({
        type: 'TIMEOUT_KILLED',
        severity: 'HIGH',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        message: 'Timeout',
        details: {},
      });

      auditLogger.logSecurityEvent({
        type: 'SENSITIVE_DATA_DETECTED',
        severity: 'LOW',
        taskId: 'task-2',
        pluginId: 'plugin-2',
        message: 'Data detected',
        details: {},
      });

      const highEvents = auditLogger.getSecurityEvents({ severity: 'HIGH' });
      expect(highEvents.length).toBe(1);

      const lowEvents = auditLogger.getSecurityEvents({ severity: 'LOW' });
      expect(lowEvents.length).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired logs', async () => {
      // 创建一个 retention 很短的 logger
      auditLogger = new PluginAuditLogger({
        retentionMs: 100, // 100ms
      });

      const context = createMockContext();
      auditLogger.logExecutionStart(context);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 200));

      const removedCount = await auditLogger.cleanupExpiredLogs();
      expect(removedCount).toBeGreaterThanOrEqual(1);
    });
  });
});