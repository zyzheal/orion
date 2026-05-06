/**
 * Plugin Service Tests
 *
 * Integration tests for the plugin service module covering:
 * - PluginResourceManager (quota management, concurrency)
 * - PluginAuditLogger (audit logging, DLP detection, security events)
 * - PluginSandbox (execution, validation, cancellation)
 * - Types and configurations
 */

import { PluginResourceManager } from '../PluginResourceManager';
import { PluginAuditLogger } from '../PluginAuditLogger';
import { PluginSandbox } from '../PluginSandbox';
import {
  DEFAULT_QUOTA,
  SECURITY_LEVEL_QUOTAS,
  type ResourceQuota,
  type ExecutionContext,
} from '../types';

// ==================== PluginResourceManager Tests ====================

describe('PluginResourceManager', () => {
  let manager: PluginResourceManager;

  beforeEach(() => {
    manager = new PluginResourceManager();
  });

  afterEach(() => {
    manager.releaseAll();
  });

  describe('getGlobalQuota', () => {
    it('should return default global quota', () => {
      const quota = manager.getGlobalQuota();
      expect(quota.cpuCores).toBe(8);
      expect(quota.memoryBytes).toBe(16 * 1024 * 1024 * 1024);
      expect(quota.timeoutMs).toBe(300000);
      expect(quota.maxConcurrent).toBe(50);
    });

    it('should return custom global quota when configured', () => {
      const customQuota: ResourceQuota = {
        cpuCores: 4,
        memoryBytes: 8 * 1024 * 1024 * 1024,
        timeoutMs: 120000,
        maxConcurrent: 20,
      };
      manager = new PluginResourceManager({ globalQuota: customQuota });
      const quota = manager.getGlobalQuota();
      expect(quota.cpuCores).toBe(4);
      expect(quota.maxConcurrent).toBe(20);
    });
  });

  describe('getResourceStats', () => {
    it('should return initial stats', () => {
      const stats = manager.getResourceStats();
      expect(stats.totalAllocated).toBe(0);
      expect(stats.cpuCoresUsed).toBe(0);
      expect(stats.memoryBytesUsed).toBe(0);
      expect(stats.activeExecutions).toBe(0);
      expect(stats.peakConcurrency).toBe(0);
    });

    it('should track allocations in stats', () => {
      manager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');
      manager.allocateQuota('task-2', 'plugin-2', 'LOW');

      const stats = manager.getResourceStats();
      expect(stats.totalAllocated).toBe(2);
      expect(stats.activeExecutions).toBe(2);
      expect(stats.peakConcurrency).toBe(2);
    });

    it('should decrement stats on release', () => {
      manager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');
      manager.releaseQuota('task-1');

      const stats = manager.getResourceStats();
      expect(stats.activeExecutions).toBe(0);
      expect(stats.cpuCoresUsed).toBe(0);
    });
  });

  describe('getAvailableResources', () => {
    it('should return full resources when nothing allocated', () => {
      const available = manager.getAvailableResources();
      expect(available.cpuCores).toBe(8);
      expect(available.concurrencySlots).toBe(50);
    });

    it('should subtract allocated resources', () => {
      manager.allocateQuota('task-1', 'plugin-1', 'HIGH');
      const available = manager.getAvailableResources();
      expect(available.cpuCores).toBe(7);
      expect(available.concurrencySlots).toBe(49);
    });
  });

  describe('setPluginQuota / getPluginQuota', () => {
    it('should use custom quota when set', () => {
      const custom: ResourceQuota = { cpuCores: 6, memoryBytes: 4e9, timeoutMs: 180000, maxConcurrent: 40 };
      manager.setPluginQuota('my-plugin', custom);
      const quota = manager.getPluginQuota('my-plugin');
      expect(quota.cpuCores).toBe(6);
      expect(quota.maxConcurrent).toBe(40);
    });

    it('should fallback to security level quota', () => {
      const quota = manager.getPluginQuota('unknown', 'HIGH');
      expect(quota).toEqual(SECURITY_LEVEL_QUOTAS.HIGH);
    });

    it('should fallback to DEFAULT_QUOTA when no security level', () => {
      const quota = manager.getPluginQuota('unknown');
      expect(quota).toEqual(DEFAULT_QUOTA);
    });

    it('should return a copy, not the original', () => {
      manager.setPluginQuota('plugin-x', { cpuCores: 2, memoryBytes: 1e9, timeoutMs: 60000, maxConcurrent: 5 });
      const q1 = manager.getPluginQuota('plugin-x');
      q1.cpuCores = 99;
      const q2 = manager.getPluginQuota('plugin-x');
      expect(q2.cpuCores).toBe(2);
    });
  });

  describe('canAllocate', () => {
    it('should allow allocation when resources available', () => {
      const result = manager.canAllocate(DEFAULT_QUOTA);
      expect(result.canAllocate).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when concurrency slots exhausted', () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 8, memoryBytes: 16e9, timeoutMs: 300000, maxConcurrent: 1 },
      });
      manager.allocateQuota('task-1', 'p1');
      const result = manager.canAllocate(DEFAULT_QUOTA);
      expect(result.canAllocate).toBe(false);
      expect(result.reason).toContain('Maximum concurrent');
    });

    it('should reject when CPU insufficient', () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 1, memoryBytes: 16e9, timeoutMs: 300000, maxConcurrent: 50 },
      });
      const highCpu: ResourceQuota = { cpuCores: 4, memoryBytes: 1e9, timeoutMs: 60000, maxConcurrent: 5 };
      const result = manager.canAllocate(highCpu);
      expect(result.canAllocate).toBe(false);
      expect(result.reason).toContain('Insufficient CPU');
    });

    it('should reject when memory insufficient', () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 8, memoryBytes: 100, timeoutMs: 300000, maxConcurrent: 50 },
      });
      const result = manager.canAllocate(DEFAULT_QUOTA);
      expect(result.canAllocate).toBe(false);
      expect(result.reason).toContain('Insufficient memory');
    });
  });

  describe('allocateQuota / releaseQuota', () => {
    it('should return ExecutionContext on successful allocation', () => {
      const ctx = manager.allocateQuota('task-1', 'plugin-a', 'MEDIUM');
      expect(ctx).not.toBeNull();
      expect(ctx?.taskId).toBe('task-1');
      expect(ctx?.pluginId).toBe('plugin-a');
      expect(ctx?.quota.cpuCores).toBe(2);
    });

    it('should return null when allocation fails', () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 8, memoryBytes: 16e9, timeoutMs: 300000, maxConcurrent: 0 },
      });
      const ctx = manager.allocateQuota('task-1', 'plugin-a');
      expect(ctx).toBeNull();
    });

    it('should track allocations by taskId', () => {
      manager.allocateQuota('task-1', 'plugin-a');
      manager.allocateQuota('task-2', 'plugin-b');
      const alloc = manager.getAllocation('task-1');
      expect(alloc).toBeDefined();
      expect(alloc?.pluginId).toBe('plugin-a');
    });

    it('getAllocation returns undefined for unknown taskId', () => {
      const alloc = manager.getAllocation('nonexistent');
      expect(alloc).toBeUndefined();
    });

    it('getActiveAllocations returns all active', () => {
      manager.allocateQuota('t1', 'p1');
      manager.allocateQuota('t2', 'p2');
      manager.allocateQuota('t3', 'p3');
      expect(manager.getActiveAllocations().length).toBe(3);
    });

    it('releaseQuota removes allocation', () => {
      manager.allocateQuota('task-1', 'plugin-a');
      manager.releaseQuota('task-1');
      expect(manager.getAllocation('task-1')).toBeUndefined();
    });

    it('releaseQuota does nothing for unknown taskId', () => {
      expect(() => manager.releaseQuota('nonexistent')).not.toThrow();
    });

    it('releaseAll clears all allocations', () => {
      manager.allocateQuota('t1', 'p1');
      manager.allocateQuota('t2', 'p2');
      manager.releaseAll();
      expect(manager.getActiveAllocations().length).toBe(0);
      expect(manager.getResourceStats().activeExecutions).toBe(0);
    });

    it('should not allow negative cpuCoresUsed after release', () => {
      manager.allocateQuota('task-1', 'plugin-a', 'HIGH');
      manager.releaseQuota('task-1');
      // Release again should not go negative
      manager.releaseQuota('task-1');
      expect(manager.getResourceStats().cpuCoresUsed).toBe(0);
    });

    it('should emit allocation:created event', (done) => {
      manager.on('allocation:created', (data) => {
        expect(data.taskId).toBe('task-1');
        expect(data.pluginId).toBe('plugin-a');
        done();
      });
      manager.allocateQuota('task-1', 'plugin-a');
    });

    it('should emit allocation:released event', (done) => {
      manager.allocateQuota('task-1', 'plugin-a');
      manager.on('allocation:released', (data) => {
        expect(data.taskId).toBe('task-1');
        done();
      });
      manager.releaseQuota('task-1');
    });

    it('should emit allocation:failed event', (done) => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 0, memoryBytes: 0, timeoutMs: 1, maxConcurrent: 0 },
      });
      manager.on('allocation:failed', (data) => {
        expect(data.reason).toBeDefined();
        done();
      });
      manager.allocateQuota('task-1', 'plugin-a');
    });
  });

  describe('updateUsage / quota violation', () => {
    it('should warn when memory usage approaches limit', (done) => {
      manager.allocateQuota('task-1', 'plugin-a', 'HIGH');
      manager.on('quota:warning', (data) => {
        expect(data.type).toBe('MEMORY');
        done();
      });
      const highMemoryQuota = manager.getPluginQuota('plugin-a', 'HIGH');
      manager.updateUsage('task-1', {
        cpuPercent: 10,
        memoryBytes: Math.floor(highMemoryQuota.memoryBytes * 0.95),
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
    });

    it('should warn when CPU usage is high', (done) => {
      manager.allocateQuota('task-1', 'plugin-a');
      manager.on('quota:warning', (data) => {
        expect(data.type).toBe('CPU');
        done();
      });
      manager.updateUsage('task-1', {
        cpuPercent: 95,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
    });

    it('should not warn when usage is within limits', () => {
      manager.allocateQuota('task-1', 'plugin-a');
      const warnHandler = jest.fn();
      manager.on('quota:warning', warnHandler);
      manager.updateUsage('task-1', {
        cpuPercent: 50,
        memoryBytes: 100,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
      expect(warnHandler).not.toHaveBeenCalled();
    });
  });
});

// ==================== PluginAuditLogger Tests ====================

describe('PluginAuditLogger', () => {
  let logger: PluginAuditLogger;

  beforeEach(() => {
    logger = new PluginAuditLogger({ maxEntries: 100, retentionMs: 86400000 });
  });

  afterEach(() => {
    logger.shutdown();
  });

  describe('logExecutionStart', () => {
    it('should create a log entry and return entryId', () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1',
        pluginId: 'plugin-a',
        pipelineRunId: 'pipe-1',
        stageId: 'stage-1',
        startedAt: new Date(),
        quota: DEFAULT_QUOTA,
      };
      const entryId = logger.logExecutionStart(ctx);
      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
    });

    it('should store log retrievable via getLogs', () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1',
        pluginId: 'plugin-a',
        pipelineRunId: 'pipe-1',
        stageId: 'stage-1',
        startedAt: new Date(),
        quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx, { key: 'value' });
      const logs = logger.getLogs({ taskId: 'task-1' });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('EXECUTION_START');
      expect(logs[0].level).toBe('INFO');
      expect(logs[0].pluginId).toBe('plugin-a');
    });
  });

  describe('logExecutionComplete', () => {
    it('should log execution complete with duration', () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1',
        pluginId: 'plugin-a',
        pipelineRunId: 'pipe-1',
        stageId: 'stage-1',
        startedAt: new Date(),
        quota: DEFAULT_QUOTA,
      };
      const entryId = logger.logExecutionComplete(ctx, { result: 'ok' }, 1234);
      expect(entryId).toBeDefined();
      const logs = logger.getLogs({ taskId: 'task-1', action: 'EXECUTION_COMPLETE' });
      expect(logs[0].durationMs).toBe(1234);
      expect(logs[0].level).toBe('INFO');
    });
  });

  describe('logExecutionError', () => {
    it('should log error with error details', () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1',
        pluginId: 'plugin-a',
        pipelineRunId: 'pipe-1',
        stageId: 'stage-1',
        startedAt: new Date(),
        quota: DEFAULT_QUOTA,
      };
      const err = new Error('Something went wrong');
      const entryId = logger.logExecutionError(ctx, err, 5678);
      expect(entryId).toBeDefined();
      const logs = logger.getLogs({ taskId: 'task-1', action: 'EXECUTION_ERROR' });
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].message).toContain('Something went wrong');
    });
  });

  describe('logSecurityEvent', () => {
    it('should store security event', () => {
      const eventId = logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED',
        severity: 'HIGH',
        taskId: 'task-1',
        pluginId: 'plugin-a',
        message: 'Quota exceeded',
        details: { limit: 100 },
      });
      expect(eventId).toBeDefined();
      const events = logger.getSecurityEvents({ taskId: 'task-1' });
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('QUOTA_EXCEEDED');
    });

    it('should emit security:alert for HIGH severity', (done) => {
      logger.on('security:alert', (event) => {
        expect(event.severity).toBe('HIGH');
        done();
      });
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED',
        severity: 'HIGH',
        taskId: 'task-1',
        pluginId: 'plugin-a',
        message: 'Timeout',
        details: {},
      });
    });

    it('should emit security:alert for CRITICAL severity', (done) => {
      logger.on('security:alert', (event) => {
        expect(event.severity).toBe('CRITICAL');
        done();
      });
      logger.logSecurityEvent({
        type: 'MEMORY_LIMIT_EXCEEDED',
        severity: 'CRITICAL',
        taskId: 'task-1',
        pluginId: 'plugin-a',
        message: 'Memory exceeded',
        details: {},
      });
    });

    it('should not emit alert for LOW severity', () => {
      const handler = jest.fn();
      logger.on('security:alert', handler);
      logger.logSecurityEvent({
        type: 'INPUT_VALIDATION_FAILED',
        severity: 'LOW',
        taskId: 'task-1',
        pluginId: 'plugin-a',
        message: 'Low severity',
        details: {},
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should always emit security:event regardless of severity', (done) => {
      logger.on('security:event', (event) => {
        expect(event.severity).toBe('MEDIUM');
        done();
      });
      logger.logSecurityEvent({
        type: 'SENSITIVE_DATA_DETECTED',
        severity: 'MEDIUM',
        taskId: 'task-1',
        pluginId: 'plugin-a',
        message: 'Sensitive data',
        details: {},
      });
    });
  });

  describe('detectSensitiveData (DLP)', () => {
    it('should detect credit card numbers', () => {
      // Valid Luhn number
      const result = logger.detectSensitiveData('Card: 4532015112830366');
      expect(result.hasSensitiveData).toBe(true);
      const ccPatterns = result.patterns.filter((p) => p.type === 'CREDIT_CARD');
      expect(ccPatterns.length).toBeGreaterThan(0);
    });

    it('should detect email addresses', () => {
      const result = logger.detectSensitiveData('Contact: user@example.com');
      expect(result.hasSensitiveData).toBe(true);
      const emailPatterns = result.patterns.filter((p) => p.type === 'EMAIL');
      expect(emailPatterns.length).toBeGreaterThan(0);
    });

    it('should detect IP addresses', () => {
      const result = logger.detectSensitiveData('Server: 192.168.1.100');
      expect(result.hasSensitiveData).toBe(true);
      const ipPatterns = result.patterns.filter((p) => p.type === 'IP_ADDRESS');
      expect(ipPatterns.length).toBeGreaterThan(0);
    });

    it('should detect phone numbers', () => {
      const result = logger.detectSensitiveData('Phone: 555-123-4567');
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should return no sensitive data for clean input', () => {
      const result = logger.detectSensitiveData('Hello world, this is clean text');
      expect(result.hasSensitiveData).toBe(false);
      expect(result.patterns).toEqual([]);
    });

    it('should redact sensitive data in output', () => {
      const result = logger.detectSensitiveData('IP: 10.0.0.1 and email: test@example.com');
      expect(result.redactedData).toBeDefined();
      expect(result.redactedData).not.toContain('10.0.0.1');
      expect(result.redactedData).not.toContain('test@example.com');
    });
  });

  describe('getLogs / getSecurityEvents filtering', () => {
    it('should filter logs by pluginId', () => {
      const ctx1: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      const ctx2: ExecutionContext = {
        taskId: 'task-2', pluginId: 'plugin-b', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx1);
      logger.logExecutionStart(ctx2);

      const logsA = logger.getLogs({ pluginId: 'plugin-a' });
      expect(logsA.length).toBe(1);
      expect(logsA[0].pluginId).toBe('plugin-a');
    });

    it('should filter logs by level', () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx);
      logger.logExecutionError(ctx, new Error('fail'));

      const errorLogs = logger.getLogs({ level: 'ERROR' });
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].level).toBe('ERROR');
    });

    it('should filter logs by limit', () => {
      for (let i = 0; i < 10; i++) {
        const ctx: ExecutionContext = {
          taskId: `task-${i}`, pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
        };
        logger.logExecutionStart(ctx);
      }
      const logs = logger.getLogs({ limit: 3 });
      expect(logs.length).toBe(3);
    });

    it('should filter security events by type', () => {
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED', severity: 'HIGH', taskId: 't1', pluginId: 'p1', message: 'timeout', details: {},
      });
      logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED', severity: 'HIGH', taskId: 't2', pluginId: 'p1', message: 'quota', details: {},
      });
      const timeoutEvents = logger.getSecurityEvents({ type: 'TIMEOUT_KILLED' });
      expect(timeoutEvents.length).toBe(1);
    });

    it('should filter security events by severity', () => {
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED', severity: 'HIGH', taskId: 't1', pluginId: 'p1', message: 'timeout', details: {},
      });
      logger.logSecurityEvent({
        type: 'SENSITIVE_DATA_DETECTED', severity: 'MEDIUM', taskId: 't2', pluginId: 'p1', message: 'dlp', details: {},
      });
      const highEvents = logger.getSecurityEvents({ severity: 'HIGH' });
      expect(highEvents.length).toBe(1);
    });
  });

  describe('cleanupExpiredLogs', () => {
    it('should remove logs older than retention period', () => {
      logger = new PluginAuditLogger({ maxEntries: 100, retentionMs: 1 });
      const ctx: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx);

      // Force cleanup after retention
      const removed = logger.cleanupExpiredLogs();
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('logResourceUsage', () => {
    it('should log resource usage as DEBUG level', () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logResourceUsage(ctx, {
        cpuPercent: 45,
        memoryBytes: 512 * 1024 * 1024,
        diskBytes: 100 * 1024 * 1024,
        networkRxBytes: 1024,
        networkTxBytes: 2048,
        timestamp: new Date(),
      });
      const logs = logger.getLogs({ level: 'DEBUG', taskId: 'task-1' });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('RESOURCE_USAGE');
    });
  });
});

// ==================== PluginSandbox Tests ====================

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;
  let resourceManager: PluginResourceManager;
  let auditLogger: PluginAuditLogger;

  beforeEach(() => {
    resourceManager = new PluginResourceManager();
    auditLogger = new PluginAuditLogger({ maxEntries: 100, retentionMs: 86400000 });
    sandbox = new PluginSandbox({ resourceManager, auditLogger });
  });

  afterEach(() => {
    sandbox.shutdown();
    auditLogger.shutdown();
    resourceManager.releaseAll();
  });

  describe('validateInput', () => {
    it('should pass valid input', () => {
      const result = sandbox.validateInput('small data');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject oversized input', () => {
      const largeInput = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const result = sandbox.validateInput(largeInput);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('maximum size');
    });

    it('should detect command injection in command field', () => {
      const result = sandbox.validateInput({ command: 'ls; rm -rf /' });
      expect(result.valid).toBe(false);
      const cmdErrors = result.errors.filter((e) => e.field === 'command');
      expect(cmdErrors.length).toBeGreaterThan(0);
    });

    it('should detect path traversal in path field', () => {
      const result = sandbox.validateInput({ path: '/etc/passwd/../../root' });
      expect(result.valid).toBe(false);
      const pathErrors = result.errors.filter((e) => e.field === 'path');
      expect(pathErrors.length).toBeGreaterThan(0);
    });

    it('should detect dangerous environment variables', () => {
      const result = sandbox.validateInput({ env: { LD_PRELOAD: '/evil.so', PATH: '/tmp' } });
      expect(result.valid).toBe(false);
      const envErrors = result.errors.filter((e) => e.field === 'env.LD_PRELOAD');
      expect(envErrors.length).toBeGreaterThan(0);
    });

    it('should skip validation when disabled', () => {
      sandbox = new PluginSandbox({
        resourceManager,
        auditLogger,
        config: { enableInputValidation: false, enableOutputDLPSanitization: true, defaultTimeoutMs: 60000, maxTimeoutMs: 300000, enableResourceMonitoring: true, resourceMonitorIntervalMs: 1000 },
      });
      const result = sandbox.validateInput('x'.repeat(100 * 1024 * 1024));
      expect(result.valid).toBe(true);
    });

    it('should validate with custom rules', () => {
      const rules = [
        { type: 'type' as const, field: 'name', constraint: 'string', message: 'name must be string' },
      ];
      const result = sandbox.validateInput({ name: 123 }, rules);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('name');
    });

    it('should detect dangerous commands like chmod 777', () => {
      const result = sandbox.validateInput({ command: 'chmod 777 /tmp/evil' });
      expect(result.valid).toBe(false);
    });

    it('should detect sudo in command', () => {
      const result = sandbox.validateInput({ command: 'sudo rm -rf /' });
      expect(result.valid).toBe(false);
    });

    it('should detect null byte in path', () => {
      const result = sandbox.validateInput({ path: '/safe/path\0/evil' });
      expect(result.valid).toBe(false);
    });
  });

  describe('detectSensitiveOutput', () => {
    it('should detect sensitive data in string output', () => {
      const result = sandbox.detectSensitiveOutput('user email: test@example.com');
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should detect sensitive data in object output', () => {
      const result = sandbox.detectSensitiveOutput({ email: 'user@example.com', ip: '192.168.1.1' });
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should return no sensitive data for clean output', () => {
      const result = sandbox.detectSensitiveOutput('Hello clean world');
      expect(result.hasSensitiveData).toBe(false);
    });

    it('should skip DLP when disabled', () => {
      sandbox = new PluginSandbox({
        resourceManager,
        auditLogger,
        config: { enableInputValidation: true, enableOutputDLPSanitization: false, defaultTimeoutMs: 60000, maxTimeoutMs: 300000, enableResourceMonitoring: true, resourceMonitorIntervalMs: 1000 },
      });
      const result = sandbox.detectSensitiveOutput('user@example.com');
      expect(result.hasSensitiveData).toBe(false);
    });
  });

  describe('executeInSandbox', () => {
    it('should execute function successfully', async () => {
      resourceManager.allocateQuota('task-1', 'plugin-a');
      const ctx: ExecutionContext = {
        taskId: 'task-1',
        pluginId: 'plugin-a',
        pipelineRunId: 'pipe-1',
        stageId: 'stage-1',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-a'),
      };

      const result = await sandbox.executeInSandbox(ctx, async () => 'hello');
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.outputs).toEqual({ result: 'hello' });
    });

    it('should handle function throwing error', async () => {
      resourceManager.allocateQuota('task-2', 'plugin-b');
      const ctx: ExecutionContext = {
        taskId: 'task-2',
        pluginId: 'plugin-b',
        pipelineRunId: '',
        stageId: '',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-b'),
      };

      const result = await sandbox.executeInSandbox(ctx, async () => {
        throw new Error('Task failed');
      });
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toBe('Task failed');
    });

    it('should handle timeout', async () => {
      resourceManager.allocateQuota('task-3', 'plugin-c');
      const ctx: ExecutionContext = {
        taskId: 'task-3',
        pluginId: 'plugin-c',
        pipelineRunId: '',
        stageId: '',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-c'),
      };

      const result = await sandbox.executeInSandbox(ctx, async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return 'done';
      }, { timeout: 50 });
      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('TIMEOUT');
      expect(result.exitCode).toBe(124);
    }, 10000);

    it('should emit execution:complete event on success', (done) => {
      resourceManager.allocateQuota('task-4', 'plugin-d');
      const ctx: ExecutionContext = {
        taskId: 'task-4',
        pluginId: 'plugin-d',
        pipelineRunId: '',
        stageId: '',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-d'),
      };

      sandbox.on('execution:complete', (data) => {
        expect(data.taskId).toBe('task-4');
        done();
      });

      sandbox.executeInSandbox(ctx, async () => 'ok');
    });

    it('should convert object result to outputs', async () => {
      resourceManager.allocateQuota('task-5', 'plugin-e');
      const ctx: ExecutionContext = {
        taskId: 'task-5',
        pluginId: 'plugin-e',
        pipelineRunId: '',
        stageId: '',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-e'),
      };

      const result = await sandbox.executeInSandbox(ctx, async () => ({ foo: 'bar', count: 42 }));
      expect(result.outputs?.foo).toBe('bar');
      expect(result.outputs?.count).toBe('42');
    });
  });

  describe('cancelExecution', () => {
    it('should return false for non-existent task', () => {
      const result = sandbox.cancelExecution('nonexistent');
      expect(result).toBe(false);
    });

    it('should cancel running execution', async () => {
      resourceManager.allocateQuota('task-cancel', 'plugin-f');
      const ctx: ExecutionContext = {
        taskId: 'task-cancel',
        pluginId: 'plugin-f',
        pipelineRunId: '',
        stageId: '',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-f'),
      };

      const execPromise = sandbox.executeInSandbox(ctx, async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const check = setInterval(() => {
            if (signal.aborted) {
              clearInterval(check);
              reject(new Error('Aborted'));
            }
          }, 10);
        });
        return 'done';
      }, { timeout: 10000 });

      // Cancel after a short delay
      await new Promise((r) => setTimeout(r, 50));
      const cancelled = sandbox.cancelExecution('task-cancel', 'User requested');
      expect(cancelled).toBe(true);

      const result = await execPromise;
      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('CANCELLED');
      expect(result.exitCode).toBe(143);
    }, 15000);

    it('should cancel all executions', async () => {
      resourceManager.allocateQuota('t1', 'p1');
      resourceManager.allocateQuota('t2', 'p2');
      const ctx1: ExecutionContext = { taskId: 't1', pluginId: 'p1', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: resourceManager.getPluginQuota('p1') };
      const ctx2: ExecutionContext = { taskId: 't2', pluginId: 'p2', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: resourceManager.getPluginQuota('p2') };

      sandbox.executeInSandbox(ctx1, async (signal) => {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => { if (signal.aborted) { clearInterval(check); resolve(); } }, 10);
        });
        return 'done';
      }, { timeout: 10000 });
      sandbox.executeInSandbox(ctx2, async (signal) => {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => { if (signal.aborted) { clearInterval(check); resolve(); } }, 10);
        });
        return 'done';
      }, { timeout: 10000 });

      await new Promise((r) => setTimeout(r, 50));
      const count = sandbox.cancelAllExecutions('Shutdown');
      expect(count).toBe(2);
    }, 15000);
  });

  describe('getActiveExecutionCount / getActiveExecutions', () => {
    it('should return 0 when nothing running', () => {
      expect(sandbox.getActiveExecutionCount()).toBe(0);
      expect(sandbox.getActiveExecutions()).toEqual([]);
    });

    it('should track active executions', async () => {
      resourceManager.allocateQuota('track-1', 'p1');
      const ctx: ExecutionContext = { taskId: 'track-1', pluginId: 'p1', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: resourceManager.getPluginQuota('p1') };

      sandbox.executeInSandbox(ctx, async (signal) => {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => { if (signal.aborted) { clearInterval(check); resolve(); } }, 10);
        });
        return 'done';
      }, { timeout: 10000 });

      await new Promise((r) => setTimeout(r, 50));
      expect(sandbox.getActiveExecutionCount()).toBe(1);
      expect(sandbox.getActiveExecutions()).toContain('track-1');

      sandbox.cancelExecution('track-1');
      await new Promise((r) => setTimeout(r, 100));
    }, 10000);
  });

  describe('shutdown', () => {
    it('should cancel all executions on shutdown', async () => {
      resourceManager.allocateQuota('s1', 'p1');
      const ctx: ExecutionContext = { taskId: 's1', pluginId: 'p1', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: resourceManager.getPluginQuota('p1') };
      const execPromise = sandbox.executeInSandbox(ctx, async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const check = setInterval(() => {
            if (signal.aborted) {
              clearInterval(check);
              reject(new Error('Aborted'));
            }
          }, 10);
        });
        return 'done';
      }, { timeout: 10000 });

      await new Promise((r) => setTimeout(r, 50));
      expect(sandbox.getActiveExecutionCount()).toBe(1);

      sandbox.shutdown();
      // Allow async cleanup to complete
      await execPromise;
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });
  });
});
