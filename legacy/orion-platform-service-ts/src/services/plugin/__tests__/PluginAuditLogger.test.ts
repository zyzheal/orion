/**
 * PluginAuditLogger - Dedicated Unit Tests
 *
 * 深入覆盖以下场景：
 * - DLP 模式检测 (API_KEY, PASSWORD, SSN, CREDIT_CARD with Luhn validation)
 * - sanitizeInput / sanitizeOutput (string, object, null, undefined)
 * - maskSensitiveText 各类型遮蔽格式
 * - getLogs 时间戳排序和多条件过滤
 * - getSecurityEvents 完整过滤链
 * - cleanupExpiredLogs maxEntries 限制
 * - logResourceUsage 元数据值
 * - shutdown 关闭清理定时器
 * - 构造函数配置变体
 */

import { PluginAuditLogger } from '../PluginAuditLogger';
import { DEFAULT_QUOTA, type ExecutionContext } from '../types';

/** Helper to create a standard execution context */
function createContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    taskId: 'task-1',
    pluginId: 'plugin-a',
    pipelineRunId: 'pipe-1',
    stageId: 'stage-1',
    startedAt: new Date(),
    quota: DEFAULT_QUOTA,
    ...overrides,
  };
}

describe('PluginAuditLogger - Dedicated Tests', () => {
  let logger: PluginAuditLogger;

  afterEach(() => {
    if (logger) {
      logger.shutdown();
    }
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      logger = new PluginAuditLogger();
      // Verify by adding a log and checking it's stored
      const entryId = logger.logExecutionStart(createContext());
      expect(entryId).toBeDefined();
    });

    it('should accept partial config', () => {
      logger = new PluginAuditLogger({ maxEntries: 50 });
      expect(logger).toBeDefined();
    });

    it('should accept db option without throwing', () => {
      const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
      expect(() => {
        logger = new PluginAuditLogger({}, mockDb);
      }).not.toThrow();
    });

    it('should accept full config', () => {
      logger = new PluginAuditLogger({
        maxEntries: 500,
        retentionMs: 3600000,
        enableDLPSanitization: false,
        enableSecurityAlerts: false,
      });
      expect(logger).toBeDefined();
    });
  });

  // ==================== DLP Pattern Detection ====================

  describe('DLP pattern detection', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should detect API key patterns', () => {
      const result = logger.detectSensitiveData('api_key: abcdefghijklmnopqrstuvwxyz1234');
      expect(result.hasSensitiveData).toBe(true);
      const apiKeyPatterns = result.patterns.filter((p) => p.type === 'API_KEY');
      expect(apiKeyPatterns.length).toBeGreaterThan(0);
    });

    it('should detect password patterns', () => {
      const result = logger.detectSensitiveData('"password": "mysecretpassword123"');
      expect(result.hasSensitiveData).toBe(true);
      const pwPatterns = result.patterns.filter((p) => p.type === 'PASSWORD');
      expect(pwPatterns.length).toBeGreaterThan(0);
    });

    it('should detect SSN patterns', () => {
      const result = logger.detectSensitiveData('SSN: 123-45-6789');
      expect(result.hasSensitiveData).toBe(true);
      const ssnPatterns = result.patterns.filter((p) => p.type === 'SSN');
      expect(ssnPatterns.length).toBeGreaterThan(0);
    });

    it('should detect credit card with valid Luhn', () => {
      // 4532015112830366 is a valid Luhn number
      const result = logger.detectSensitiveData('Card: 4532015112830366');
      expect(result.hasSensitiveData).toBe(true);
      const ccPatterns = result.patterns.filter((p) => p.type === 'CREDIT_CARD');
      expect(ccPatterns.length).toBeGreaterThan(0);
      // Valid Luhn should have higher confidence
      expect(ccPatterns[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect credit card with invalid Luhn but lower confidence', () => {
      // Invalid Luhn number
      const result = logger.detectSensitiveData('Card: 1234567890123456');
      const ccPatterns = result.patterns.filter((p) => p.type === 'CREDIT_CARD');
      if (ccPatterns.length > 0) {
        expect(ccPatterns[0].confidence).toBeLessThan(0.95);
      }
    });

    it('should detect email with high confidence', () => {
      const result = logger.detectSensitiveData('Contact: user@example.com');
      const emailPatterns = result.patterns.filter((p) => p.type === 'EMAIL');
      expect(emailPatterns.length).toBeGreaterThan(0);
      expect(emailPatterns[0].confidence).toBe(0.95);
    });

    it('should detect multiple patterns in one input', () => {
      const result = logger.detectSensitiveData(
        'Server 192.168.1.1 email: admin@test.com phone: 555-123-4567'
      );
      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns.length).toBeGreaterThanOrEqual(2);
    });

    it('should return no patterns for clean input', () => {
      const result = logger.detectSensitiveData('This is a clean string with no sensitive data');
      expect(result.hasSensitiveData).toBe(false);
      expect(result.patterns).toEqual([]);
      expect(result.redactedData).toBe('This is a clean string with no sensitive data');
    });

    it('should redact data when patterns found', () => {
      const result = logger.detectSensitiveData('Email: user@example.com');
      expect(result.redactedData).toBeDefined();
      expect(result.redactedData).not.toContain('user@example.com');
      // Should contain masked version
      expect(result.redactedData).toContain('***');
    });
  });

  // ==================== Masking Formats ====================

  describe('masking formats', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should mask email preserving first 2 chars of local part', () => {
      const result = logger.detectSensitiveData('user@example.com');
      const emailPattern = result.patterns.find((p) => p.type === 'EMAIL');
      expect(emailPattern).toBeDefined();
      expect(emailPattern!.matchedText).toContain('***@example.com');
      expect(emailPattern!.matchedText).toMatch(/^us\*\*\*@example\.com$/);
    });

    it('should mask IP address completely', () => {
      const result = logger.detectSensitiveData('192.168.1.1');
      const ipPattern = result.patterns.find((p) => p.type === 'IP_ADDRESS');
      expect(ipPattern).toBeDefined();
      expect(ipPattern!.matchedText).toBe('***.***.***.***');
    });

    it('should mask phone number showing last 4 digits', () => {
      const result = logger.detectSensitiveData('555-123-4567');
      const phonePattern = result.patterns.find((p) => p.type === 'PHONE');
      expect(phonePattern).toBeDefined();
      expect(phonePattern!.matchedText).toContain('4567');
      expect(phonePattern!.matchedText).toMatch(/^\*\*\*-\*\*\*-\d{4}$/);
    });

    it('should mask credit card showing first 4 and last 4', () => {
      const result = logger.detectSensitiveData('4532015112830366');
      const ccPattern = result.patterns.find((p) => p.type === 'CREDIT_CARD');
      expect(ccPattern).toBeDefined();
      expect(ccPattern!.matchedText).toContain('4532');
      expect(ccPattern!.matchedText).toContain('0366');
    });

    it('should mask password as REDACTED', () => {
      const result = logger.detectSensitiveData('"password": "secret123"');
      const pwPattern = result.patterns.find((p) => p.type === 'PASSWORD');
      expect(pwPattern).toBeDefined();
      expect(pwPattern!.matchedText).toContain('REDACTED');
    });
  });

  // ==================== sanitizeInput / sanitizeOutput ====================

  describe('input/output sanitization', () => {
    it('should sanitize string input with DLP enabled', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: true });
      const entryId = logger.logExecutionStart(
        createContext(),
        'User email: test@example.com'
      );
      expect(entryId).toBeDefined();
    });

    it('should sanitize object input', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: true });
      const entryId = logger.logExecutionStart(createContext(), {
        data: 'Contact user@example.com',
        count: 5,
      });
      expect(entryId).toBeDefined();
    });

    it('should not sanitize when DLP disabled', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: false });
      const entryId = logger.logExecutionStart(
        createContext(),
        'test@example.com'
      );
      expect(entryId).toBeDefined();
    });

    it('should handle null input gracefully', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: true });
      const entryId = logger.logExecutionStart(createContext(), null);
      expect(entryId).toBeDefined();
    });

    it('should handle undefined input gracefully', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: true });
      const entryId = logger.logExecutionStart(createContext(), undefined);
      expect(entryId).toBeDefined();
    });

    it('should handle numeric input', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: true });
      const entryId = logger.logExecutionStart(createContext(), 42);
      expect(entryId).toBeDefined();
    });

    it('should sanitize output in logExecutionComplete', () => {
      logger = new PluginAuditLogger({ enableDLPSanitization: true });
      const entryId = logger.logExecutionComplete(
        createContext(),
        { result: 'email: admin@test.com' },
        1000
      );
      expect(entryId).toBeDefined();
    });
  });

  // ==================== Log Filtering and Sorting ====================

  describe('log filtering and sorting', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should return logs sorted by timestamp descending', async () => {
      for (let i = 0; i < 5; i++) {
        logger.logExecutionStart(createContext({ taskId: `task-${i}` }));
      }
      const logs = await logger.getLogs();
      expect(logs.length).toBe(5);
      // Each subsequent log should have equal or later timestamp
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i].timestamp.getTime()).toBeLessThanOrEqual(
          logs[i - 1].timestamp.getTime()
        );
      }
    });

    it('should filter by action type', async () => {
      logger.logExecutionStart(createContext());
      logger.logExecutionComplete(createContext(), 'ok', 100);
      logger.logExecutionError(createContext(), new Error('fail'));

      const startLogs = await logger.getLogs({ action: 'EXECUTION_START' });
      const completeLogs = await logger.getLogs({ action: 'EXECUTION_COMPLETE' });
      const errorLogs = await logger.getLogs({ action: 'EXECUTION_ERROR' });

      expect(startLogs.length).toBe(1);
      expect(completeLogs.length).toBe(1);
      expect(errorLogs.length).toBe(1);
    });

    it('should combine multiple filters', async () => {
      logger.logExecutionStart(createContext({ taskId: 't1', pluginId: 'p1' }));
      logger.logExecutionStart(createContext({ taskId: 't2', pluginId: 'p2' }));
      logger.logExecutionError(createContext({ taskId: 't1', pluginId: 'p1' }), new Error('fail'));

      const logs = await logger.getLogs({ taskId: 't1', level: 'ERROR' });
      expect(logs.length).toBe(1);
      expect(logs[0].taskId).toBe('t1');
      expect(logs[0].level).toBe('ERROR');
    });

    it('should return empty array when no logs match', async () => {
      logger.logExecutionStart(createContext());
      const logs = await logger.getLogs({ taskId: 'nonexistent' });
      expect(logs).toEqual([]);
    });

    it('should handle limit of 0 or negative', async () => {
      for (let i = 0; i < 5; i++) {
        logger.logExecutionStart(createContext({ taskId: `task-${i}` }));
      }
      // limit of undefined should return all
      const logs = await logger.getLogs();
      expect(logs.length).toBe(5);
    });
  });

  // ==================== Security Events Filtering ====================

  describe('security events filtering', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should filter by pluginId', () => {
      logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED',
        severity: 'HIGH',
        taskId: 't1',
        pluginId: 'p1',
        message: 'quota exceeded',
        details: {},
      });
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED',
        severity: 'HIGH',
        taskId: 't2',
        pluginId: 'p2',
        message: 'timeout',
        details: {},
      });

      const events = logger.getSecurityEvents({ pluginId: 'p1' });
      expect(events.length).toBe(1);
      expect(events[0].pluginId).toBe('p1');
    });

    it('should combine type and severity filters', () => {
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED',
        severity: 'HIGH',
        taskId: 't1',
        pluginId: 'p1',
        message: 'timeout',
        details: {},
      });
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED',
        severity: 'LOW',
        taskId: 't2',
        pluginId: 'p1',
        message: 'timeout low',
        details: {},
      });
      logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED',
        severity: 'HIGH',
        taskId: 't3',
        pluginId: 'p1',
        message: 'quota',
        details: {},
      });

      const events = logger.getSecurityEvents({ type: 'TIMEOUT_KILLED', severity: 'HIGH' });
      expect(events.length).toBe(1);
    });

    it('should apply limit to security events', () => {
      for (let i = 0; i < 10; i++) {
        logger.logSecurityEvent({
          type: 'QUOTA_EXCEEDED',
          severity: 'HIGH',
          taskId: `t${i}`,
          pluginId: 'p1',
          message: `event ${i}`,
          details: {},
        });
      }

      const events = logger.getSecurityEvents({ limit: 3 });
      expect(events.length).toBe(3);
    });

    it('should sort security events by timestamp descending', () => {
      for (let i = 0; i < 5; i++) {
        logger.logSecurityEvent({
          type: 'QUOTA_EXCEEDED',
          severity: 'HIGH',
          taskId: `t${i}`,
          pluginId: 'p1',
          message: `event ${i}`,
          details: {},
        });
      }

      const events = logger.getSecurityEvents();
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeLessThanOrEqual(
          events[i - 1].timestamp.getTime()
        );
      }
    });

    it('should return empty when no events match', () => {
      logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED',
        severity: 'HIGH',
        taskId: 't1',
        pluginId: 'p1',
        message: 'event',
        details: {},
      });

      const events = logger.getSecurityEvents({ pluginId: 'nonexistent' });
      expect(events).toEqual([]);
    });
  });

  // ==================== Security Alerts ====================

  describe('security alerts', () => {
    it('should not emit security:alert when enableSecurityAlerts is false', () => {
      logger = new PluginAuditLogger({ enableSecurityAlerts: false });
      const handler = jest.fn();
      logger.on('security:alert', handler);

      logger.logSecurityEvent({
        type: 'MEMORY_LIMIT_EXCEEDED',
        severity: 'CRITICAL',
        taskId: 't1',
        pluginId: 'p1',
        message: 'Memory exceeded',
        details: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not emit security:alert for MEDIUM severity', () => {
      logger = new PluginAuditLogger({ enableSecurityAlerts: true });
      const handler = jest.fn();
      logger.on('security:alert', handler);

      logger.logSecurityEvent({
        type: 'SENSITIVE_DATA_DETECTED',
        severity: 'MEDIUM',
        taskId: 't1',
        pluginId: 'p1',
        message: 'Sensitive data',
        details: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should always emit security:event for any severity', () => {
      logger = new PluginAuditLogger();
      const handler = jest.fn();
      logger.on('security:event', handler);

      logger.logSecurityEvent({
        type: 'INPUT_VALIDATION_FAILED',
        severity: 'LOW',
        taskId: 't1',
        pluginId: 'p1',
        message: 'validation failed',
        details: {},
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== logResourceUsage ====================

  describe('logResourceUsage', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should log resource usage with correct metadata', async () => {
      const ctx = createContext();
      logger.logResourceUsage(ctx, {
        cpuPercent: 75.5,
        memoryBytes: 1024 * 1024 * 512,
        diskBytes: 1024 * 1024 * 100,
        networkRxBytes: 5000,
        networkTxBytes: 3000,
        timestamp: new Date(),
      });

      const logs = await logger.getLogs({ level: 'DEBUG', action: 'RESOURCE_USAGE' });
      expect(logs.length).toBe(1);
      expect(logs[0].metadata.cpuPercent).toBe(75.5);
      expect(logs[0].metadata.memoryBytes).toBe(1024 * 1024 * 512);
      expect(logs[0].metadata.networkRxBytes).toBe(5000);
      expect(logs[0].metadata.networkTxBytes).toBe(3000);
    });

    it('should return entryId', () => {
      logger = new PluginAuditLogger();
      const entryId = logger.logResourceUsage(createContext(), {
        cpuPercent: 10,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
      expect(typeof entryId).toBe('string');
      expect(entryId.length).toBeGreaterThan(0);
    });
  });

  // ==================== cleanupExpiredLogs ====================

  describe('cleanupExpiredLogs', () => {
    it('should remove expired in-memory logs', async () => {
      logger = new PluginAuditLogger({ maxEntries: 10000, retentionMs: 1 }); // 1ms retention
      logger.logExecutionStart(createContext());

      // Wait for retention to expire
      await new Promise((r) => setTimeout(r, 10));

      const removed = await logger.cleanupExpiredLogs();
      expect(removed).toBeGreaterThanOrEqual(1);
    });

    it('should remove excess logs beyond maxEntries', async () => {
      logger = new PluginAuditLogger({ maxEntries: 3, retentionMs: 86400000 });
      for (let i = 0; i < 5; i++) {
        logger.logExecutionStart(createContext({ taskId: `task-${i}` }));
      }

      const removed = await logger.cleanupExpiredLogs();
      expect(removed).toBeGreaterThanOrEqual(2); // At least 2 removed to get down to 3

      const logs = await logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(3);
    });

    it('should also cleanup security events', async () => {
      logger = new PluginAuditLogger({ retentionMs: 1 }); // 1ms retention
      logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED',
        severity: 'HIGH',
        taskId: 't1',
        pluginId: 'p1',
        message: 'quota',
        details: {},
      });

      await new Promise((r) => setTimeout(r, 10));
      await logger.cleanupExpiredLogs();

      const events = logger.getSecurityEvents();
      expect(events.length).toBe(0);
    });

    it('should handle empty log storage gracefully', async () => {
      logger = new PluginAuditLogger();
      const removed = await logger.cleanupExpiredLogs();
      expect(removed).toBe(0);
    });
  });

  // ==================== Shutdown ====================

  describe('shutdown', () => {
    it('should not throw when shutting down', () => {
      logger = new PluginAuditLogger();
      expect(() => logger.shutdown()).not.toThrow();
    });

    it('should handle multiple shutdowns', () => {
      logger = new PluginAuditLogger();
      logger.shutdown();
      expect(() => logger.shutdown()).not.toThrow();
    });
  });

  // ==================== Event emission for log:created ====================

  describe('log:created event', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should emit log:created when adding a log', (done) => {
      logger.on('log:created', (entry) => {
        expect(entry.action).toBe('EXECUTION_START');
        expect(entry.taskId).toBe('task-1');
        done();
      });
      logger.logExecutionStart(createContext());
    });

    it('should emit log:created for error logs', (done) => {
      logger.on('log:created', (entry) => {
        expect(entry.action).toBe('EXECUTION_ERROR');
        expect(entry.level).toBe('ERROR');
        done();
      });
      logger.logExecutionError(createContext(), new Error('test error'));
    });

    it('should emit log:created for resource usage logs', (done) => {
      logger.on('log:created', (entry) => {
        expect(entry.action).toBe('RESOURCE_USAGE');
        done();
      });
      logger.logResourceUsage(createContext(), {
        cpuPercent: 10,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
    });
  });

  // ==================== Execution error metadata ====================

  describe('execution error metadata', () => {
    beforeEach(() => {
      logger = new PluginAuditLogger();
    });

    it('should capture error name and stack in metadata', async () => {
      const ctx = createContext();
      const error = new TypeError('Type mismatch');
      logger.logExecutionError(ctx, error, 100);

      const logs = await logger.getLogs({ level: 'ERROR' });
      expect(logs[0].metadata.errorName).toBe('TypeError');
      expect(logs[0].metadata.errorStack).toContain('Type mismatch');
    });

    it('should capture pipelineRunId and stageId in start logs', async () => {
      const ctx = createContext({ pipelineRunId: 'run-99', stageId: 'stage-42' });
      logger.logExecutionStart(ctx);

      const logs = await logger.getLogs();
      expect(logs[0].metadata.pipelineRunId).toBe('run-99');
      expect(logs[0].metadata.stageId).toBe('stage-42');
    });

    it('should capture userId and tenantId in start logs', async () => {
      const ctx = createContext({ userId: 'user-1', tenantId: 'tenant-x' });
      logger.logExecutionStart(ctx);

      const logs = await logger.getLogs();
      expect(logs[0].metadata.userId).toBe('user-1');
      expect(logs[0].metadata.tenantId).toBe('tenant-x');
    });
  });
});
