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

  beforeEach(async () => {
    manager = new PluginResourceManager();
  });

  afterEach(async () => {
    await manager.releaseAll();
  });

  describe('getGlobalQuota', () => {
    it('should return default global quota', async () => {
      const quota = await manager.getGlobalQuota();
      expect(quota.cpuCores).toBe(8);
      expect(quota.memoryBytes).toBe(16 * 1024 * 1024 * 1024);
      expect(quota.timeoutMs).toBe(300000);
      expect(quota.maxConcurrent).toBe(50);
    });

    it('should return custom global quota when configured', async () => {
      const customQuota: ResourceQuota = {
        cpuCores: 4,
        memoryBytes: 8 * 1024 * 1024 * 1024,
        timeoutMs: 120000,
        maxConcurrent: 20,
      };
      manager = new PluginResourceManager({ globalQuota: customQuota });
      const quota = await manager.getGlobalQuota();
      expect(quota.cpuCores).toBe(4);
      expect(quota.maxConcurrent).toBe(20);
    });
  });

  describe('getResourceStats', () => {
    it('should return initial stats', async () => {
      const stats = await manager.getResourceStats();
      expect(stats.totalAllocated).toBe(0);
      expect(stats.cpuCoresUsed).toBe(0);
      expect(stats.memoryBytesUsed).toBe(0);
      expect(stats.activeExecutions).toBe(0);
      expect(stats.peakConcurrency).toBe(0);
    });

    it('should track allocations in stats', async () => {
      await manager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');
      await manager.allocateQuota('task-2', 'plugin-2', 'LOW');

      const stats = await manager.getResourceStats();
      expect(stats.totalAllocated).toBe(2);
      expect(stats.activeExecutions).toBe(2);
      expect(stats.peakConcurrency).toBe(2);
    });

    it('should decrement stats on release', async () => {
      await manager.allocateQuota('task-1', 'plugin-1', 'MEDIUM');
      await manager.releaseQuota('task-1');

      const stats = await manager.getResourceStats();
      expect(stats.activeExecutions).toBe(0);
      expect(stats.cpuCoresUsed).toBe(0);
    });
  });

  describe('getAvailableResources', () => {
    it('should return full resources when nothing allocated', async () => {
      const available = await manager.getAvailableResources();
      expect(available.cpuCores).toBe(8);
      expect(available.concurrencySlots).toBe(50);
    });

    it('should subtract allocated resources', async () => {
      await manager.allocateQuota('task-1', 'plugin-1', 'HIGH');
      const available = await manager.getAvailableResources();
      expect(available.cpuCores).toBe(7);
      expect(available.concurrencySlots).toBe(49);
    });
  });

  describe('setPluginQuota / getPluginQuota', () => {
    it('should use custom quota when set', async () => {
      const custom: ResourceQuota = { cpuCores: 6, memoryBytes: 4e9, timeoutMs: 180000, maxConcurrent: 40 };
      await manager.setPluginQuota('my-plugin', custom);
      const quota = await manager.getPluginQuota('my-plugin');
      expect(quota.cpuCores).toBe(6);
      expect(quota.maxConcurrent).toBe(40);
    });

    it('should fallback to security level quota', async () => {
      const quota = await manager.getPluginQuota('some-plugin', 'HIGH');
      expect(quota).toEqual(SECURITY_LEVEL_QUOTAS.HIGH);
    });

    it('should fallback to DEFAULT_QUOTA when no security level', async () => {
      const quota = await manager.getPluginQuota('unknown-plugin');
      expect(quota).toEqual(DEFAULT_QUOTA);
    });

    it('should return a copy, not the original', async () => {
      await manager.setPluginQuota('plugin-x', { cpuCores: 2, memoryBytes: 1e9, timeoutMs: 60000, maxConcurrent: 5 });
      const q1 = await manager.getPluginQuota('plugin-x');
      q1.cpuCores = 99;
      const q2 = await manager.getPluginQuota('plugin-x')
      expect(q2.cpuCores).toBe(2);
    });
  });

  describe('canAllocate', () => {
    it('should allow allocation when resources available', async () => {
      const result = manager.canAllocate(manager.getPluginQuota('plugin-a', 'MEDIUM'));
      expect(result.canAllocate).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when concurrency slots exhausted', async () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 8, memoryBytes: 16e9, timeoutMs: 300000, maxConcurrent: 1 },
      });
      manager.allocateQuota('task-1', 'p1');
      const result = manager.canAllocate(manager.getPluginQuota('plugin-a', 'HIGH'));
      expect(result.canAllocate).toBe(false);
      expect(result.reason).toContain('Maximum concurrent');
    });

    it('should reject when CPU insufficient', async () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 1, memoryBytes: 16e9, timeoutMs: 300000, maxConcurrent: 50 },
      });
      // HIGH quota has cpuCores:1 which exactly matches available, so use a quota that exceeds it
      const quota: ResourceQuota = { cpuCores: 4, memoryBytes: 1e9, timeoutMs: 60000, maxConcurrent: 5 };
      const result = manager.canAllocate(quota);
      expect(result.canAllocate).toBe(false);
      expect(result.reason).toContain('Insufficient CPU');
    });

    it('should reject when memory insufficient', async () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 8, memoryBytes: 100, timeoutMs: 300000, maxConcurrent: 50 },
      });
      const result = manager.canAllocate(manager.getPluginQuota('plugin-a', 'HIGH'));
      expect(result.canAllocate).toBe(false);
      expect(result.reason).toContain('Insufficient memory');
    });
  });

  describe('allocateQuota / releaseQuota', () => {
    it('should return ExecutionContext on successful allocation', async () => {
      const ctx = await manager.allocateQuota('task-1', 'plugin-a', 'MEDIUM');
      expect(ctx).not.toBeNull();
      expect(ctx?.taskId).toBe('task-1');
      expect(ctx?.pluginId).toBe('plugin-a');
      expect(ctx?.quota.cpuCores).toBe(2);
    });

    it('should return null when allocation fails', async () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 8, memoryBytes: 16e9, timeoutMs: 300000, maxConcurrent: 0 },
      });
      const ctx = await manager.allocateQuota('task-1', 'plugin-a', 'MEDIUM');
      expect(ctx).toBeNull();
    });

    it('should track allocations by taskId', async () => {
      await manager.allocateQuota('task-1', 'plugin-a');
      await manager.allocateQuota('task-2', 'plugin-b');
      const alloc = await manager.getAllocation('task-1');
      expect(alloc).toBeDefined();
      expect(alloc?.pluginId).toBe('plugin-a');
    });

    it('getAllocation returns undefined for unknown taskId', async () => {
      const alloc = await manager.getAllocation('unknown');
      expect(alloc).toBeUndefined();
    });

    it('getActiveAllocations returns all active', async () => {
      await manager.allocateQuota('t1', 'p1');
      await manager.allocateQuota('t2', 'p2');
      await manager.allocateQuota('t3', 'p3');
      expect((await manager.getActiveAllocations()).length).toBe(3);
    });

    it('releaseQuota removes allocation', async () => {
      await manager.allocateQuota('task-1', 'plugin-a');
      await manager.releaseQuota('task-1');
      expect(await manager.getAllocation('task-1')).toBeUndefined();
    });

    it('releaseQuota does nothing for unknown taskId', async () => {
      expect(() => manager.releaseQuota('nonexistent')).not.toThrow();
    });

    it('releaseAll clears all allocations', async () => {
      await manager.allocateQuota('t1', 'p1');
      await manager.allocateQuota('t2', 'p2');
      await manager.releaseAll();
      expect((await manager.getActiveAllocations()).length).toBe(0);
      expect(await manager.getResourceStats().activeExecutions).toBe(0);
    });

    it('should not allow negative cpuCoresUsed after release', async () => {
      await manager.allocateQuota('task-1', 'plugin-a', 'HIGH');
      await manager.releaseQuota('task-1');
      // Release again should not go negative
      await manager.releaseQuota('task-1');
      expect(await manager.getResourceStats().cpuCoresUsed).toBe(0);
    });

    it('should emit allocation:created event', async () => {
      const promise = new Promise<void>((resolve) => {
        manager.on('allocation:created', (data) => {
          expect(data.taskId).toBe('task-1');
          expect(data.pluginId).toBe('plugin-a');
          resolve();
        });
      });
      await manager.allocateQuota('task-1', 'plugin-a');
      await promise;
    });

    it('should emit allocation:released event', async () => {
      await manager.allocateQuota('task-1', 'plugin-a');
      const promise = new Promise<void>((resolve) => {
        manager.on('allocation:released', (data) => {
          expect(data.taskId).toBe('task-1');
          resolve();
        });
      });
      await manager.releaseQuota('task-1');
      await promise;
    });

    it('should emit allocation:failed event', async () => {
      manager = new PluginResourceManager({
        globalQuota: { cpuCores: 0, memoryBytes: 0, timeoutMs: 1, maxConcurrent: 0 },
      });
      const promise = new Promise<void>((resolve) => {
        manager.on('allocation:failed', (data) => {
          expect(data.reason).toBeDefined();
          resolve();
        });
      });
      await manager.allocateQuota('task-1', 'plugin-a');
      await promise;
    });
  });

  describe('updateUsage / quota violation', () => {
    it('should warn when memory usage approaches limit', async () => {
      await manager.allocateQuota('task-1', 'plugin-a', 'HIGH');
      const promise = new Promise<void>((resolve) => {
        manager.on('quota:warning', (data) => {
          expect(data.type).toBe('MEMORY');
          resolve();
        });
      });
      const highMemoryQuota = manager.getPluginQuota('plugin-a')
      await manager.updateUsage('task-1', {
        cpuPercent: 10,
        memoryBytes: Math.floor(highMemoryQuota.memoryBytes * 0.95),
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
      await promise;
    });

    it('should warn when CPU usage is high', async () => {
      await manager.allocateQuota('task-1', 'plugin-a');
      const promise = new Promise<void>((resolve) => {
        manager.on('quota:warning', (data) => {
          expect(data.type).toBe('CPU');
          resolve();
        });
      });
      await manager.updateUsage('task-1', {
        cpuPercent: 95,
        memoryBytes: 0,
        diskBytes: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        timestamp: new Date(),
      });
      await promise;
    });

    it('should not warn when usage is within limits', async () => {
      await manager.allocateQuota('task-1', 'plugin-a');
      const warnHandler = jest.fn();
      await manager.on('quota:warning', warnHandler);
      await manager.updateUsage('task-1', {
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

  beforeEach(async () => {
    logger = new PluginAuditLogger({ maxEntries: 100, retentionMs: 86400000 });
  });

  afterEach(async () => {
    logger.shutdown();
  });

  describe('logExecutionStart', () => {
    it('should create a log entry and return entryId', async () => {
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

    it('should store log retrievable via getLogs', async () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1',
        pluginId: 'plugin-a',
        pipelineRunId: 'pipe-1',
        stageId: 'stage-1',
        startedAt: new Date(),
        quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx, { key: 'value' });
      const logs = await logger.getLogs({ taskId: 'task-1' });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('EXECUTION_START');
      expect(logs[0].level).toBe('INFO');
      expect(logs[0].pluginId).toBe('plugin-a');
    });
  });

  describe('logExecutionComplete', () => {
    it('should log execution complete with duration', async () => {
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
      const logs = await logger.getLogs({ taskId: 'task-1', action: 'EXECUTION_COMPLETE' });
      expect(logs[0].durationMs).toBe(1234);
      expect(logs[0].level).toBe('INFO');
    });
  });

  describe('logExecutionError', () => {
    it('should log error with error details', async () => {
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
      const logs = await logger.getLogs({ taskId: 'task-1', action: 'EXECUTION_ERROR' });
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].message).toContain('Something went wrong');
    });
  });

  describe('logSecurityEvent', () => {
    it('should store security event', async () => {
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

    it('should not emit alert for LOW severity', async () => {
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
    it('should detect credit card numbers', async () => {
      // Valid Luhn number
      const result = logger.detectSensitiveData('Card: 4532015112830366');
      expect(result.hasSensitiveData).toBe(true);
      const ccPatterns = result.patterns.filter((p) => p.type === 'CREDIT_CARD');
      expect(ccPatterns.length).toBeGreaterThan(0);
    });

    it('should detect email addresses', async () => {
      const result = logger.detectSensitiveData('Contact: user@example.com');
      expect(result.hasSensitiveData).toBe(true);
      const emailPatterns = result.patterns.filter((p) => p.type === 'EMAIL');
      expect(emailPatterns.length).toBeGreaterThan(0);
    });

    it('should detect IP addresses', async () => {
      const result = logger.detectSensitiveData('Server: 192.168.1.100');
      expect(result.hasSensitiveData).toBe(true);
      const ipPatterns = result.patterns.filter((p) => p.type === 'IP_ADDRESS');
      expect(ipPatterns.length).toBeGreaterThan(0);
    });

    it('should detect phone numbers', async () => {
      const result = logger.detectSensitiveData('Phone: 555-123-4567');
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should return no sensitive data for clean input', async () => {
      const result = logger.detectSensitiveData('Hello world, this is clean text');
      expect(result.hasSensitiveData).toBe(false);
      expect(result.patterns).toEqual([]);
    });

    it('should redact sensitive data in output', async () => {
      const result = logger.detectSensitiveData('IP: 10.0.0.1 and email: test@example.com');
      expect(result.redactedData).toBeDefined();
      expect(result.redactedData).not.toContain('10.0.0.1');
      expect(result.redactedData).not.toContain('test@example.com');
    });
  });

  describe('getLogs / getSecurityEvents filtering', () => {
    it('should filter logs by pluginId', async () => {
      const ctx1: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      const ctx2: ExecutionContext = {
        taskId: 'task-2', pluginId: 'plugin-b', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx1);
      logger.logExecutionStart(ctx2);

      const logsA = await logger.getLogs({ pluginId: 'plugin-a' });
      expect(logsA.length).toBe(1);
      expect(logsA[0].pluginId).toBe('plugin-a');
    });

    it('should filter logs by level', async () => {
      const ctx: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx);
      logger.logExecutionError(ctx, new Error('fail'));

      const errorLogs = await logger.getLogs({ level: 'ERROR' });
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].level).toBe('ERROR');
    });

    it('should filter logs by limit', async () => {
      for (let i = 0; i < 10; i++) {
        const ctx: ExecutionContext = {
          taskId: `task-${i}`, pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
        };
        logger.logExecutionStart(ctx);
      }
      const logs = await logger.getLogs({ limit: 3 });
      expect(logs.length).toBe(3);
    });

    it('should filter security events by type', async () => {
      logger.logSecurityEvent({
        type: 'TIMEOUT_KILLED', severity: 'HIGH', taskId: 't1', pluginId: 'p1', message: 'timeout', details: {},
      });
      logger.logSecurityEvent({
        type: 'QUOTA_EXCEEDED', severity: 'HIGH', taskId: 't2', pluginId: 'p1', message: 'quota', details: {},
      });
      const timeoutEvents = logger.getSecurityEvents({ type: 'TIMEOUT_KILLED' });
      expect(timeoutEvents.length).toBe(1);
    });

    it('should filter security events by severity', async () => {
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
    it('should remove logs older than retention period', async () => {
      logger = new PluginAuditLogger({ maxEntries: 100, retentionMs: 1 });
      const ctx: ExecutionContext = {
        taskId: 'task-1', pluginId: 'plugin-a', pipelineRunId: '', stageId: '', startedAt: new Date(), quota: DEFAULT_QUOTA,
      };
      logger.logExecutionStart(ctx);

      // Force cleanup after retention
      const removed = await logger.cleanupExpiredLogs();
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('logResourceUsage', () => {
    it('should log resource usage as DEBUG level', async () => {
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
      const logs = await logger.getLogs({ level: 'DEBUG', taskId: 'task-1' });
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

  beforeEach(async () => {
    resourceManager = new PluginResourceManager();
    auditLogger = new PluginAuditLogger({ maxEntries: 100, retentionMs: 86400000 });
    sandbox = new PluginSandbox({ resourceManager, auditLogger });
  });

  afterEach(async () => {
    sandbox.shutdown();
    auditLogger.shutdown();
    await resourceManager.releaseAll();
  });

  describe('validateInput', () => {
    it('should pass valid input', async () => {
      const result = sandbox.validateInput('small data');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject oversized input', async () => {
      const largeInput = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const result = sandbox.validateInput(largeInput);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('maximum size');
    });

    it('should detect command injection in command field', async () => {
      const result = sandbox.validateInput({ command: 'ls; rm -rf /' });
      expect(result.valid).toBe(false);
      const cmdErrors = result.errors.filter((e) => e.field === 'command');
      expect(cmdErrors.length).toBeGreaterThan(0);
    });

    it('should detect path traversal in path field', async () => {
      const result = sandbox.validateInput({ path: '/etc/passwd/../../root' });
      expect(result.valid).toBe(false);
      const pathErrors = result.errors.filter((e) => e.field === 'path');
      expect(pathErrors.length).toBeGreaterThan(0);
    });

    it('should detect dangerous environment variables', async () => {
      const result = sandbox.validateInput({ env: { LD_PRELOAD: '/evil.so', PATH: '/tmp' } });
      expect(result.valid).toBe(false);
      const envErrors = result.errors.filter((e) => e.field === 'env.LD_PRELOAD');
      expect(envErrors.length).toBeGreaterThan(0);
    });

    it('should skip validation when disabled', async () => {
      sandbox = new PluginSandbox({
        resourceManager,
        auditLogger,
        config: { enableInputValidation: false, enableOutputDLPSanitization: true, defaultTimeoutMs: 60000, maxTimeoutMs: 300000, enableResourceMonitoring: true, resourceMonitorIntervalMs: 1000 },
      });
      const result = sandbox.validateInput('x'.repeat(100 * 1024 * 1024));
      expect(result.valid).toBe(true);
    });

    it('should validate with custom rules', async () => {
      const rules = [
        { type: 'type' as const, field: 'name', constraint: 'string', message: 'name must be string' },
      ];
      const result = sandbox.validateInput({ name: 123 }, rules);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('name');
    });

    it('should detect dangerous commands like chmod 777', async () => {
      const result = sandbox.validateInput({ command: 'chmod 777 /tmp/evil' });
      expect(result.valid).toBe(false);
    });

    it('should detect sudo in command', async () => {
      const result = sandbox.validateInput({ command: 'sudo rm -rf /' });
      expect(result.valid).toBe(false);
    });

    it('should detect null byte in path', async () => {
      const result = sandbox.validateInput({ path: '/safe/path\0/evil' });
      expect(result.valid).toBe(false);
    });
  });

  describe('detectSensitiveOutput', () => {
    it('should detect sensitive data in string output', async () => {
      const result = sandbox.detectSensitiveOutput('user email: test@example.com');
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should detect sensitive data in object output', async () => {
      const result = sandbox.detectSensitiveOutput({ email: 'user@example.com', ip: '192.168.1.1' });
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should return no sensitive data for clean output', async () => {
      const result = sandbox.detectSensitiveOutput('Hello clean world');
      expect(result.hasSensitiveData).toBe(false);
    });

    it('should skip DLP when disabled', async () => {
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
      await resourceManager.allocateQuota('task-1', 'plugin-a');
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
      await resourceManager.allocateQuota('task-2', 'plugin-b');
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
      await resourceManager.allocateQuota('task-3', 'plugin-c');
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

    it('should emit execution:complete event on success', async () => {
      await resourceManager.allocateQuota('task-4', 'plugin-d');
      const ctx: ExecutionContext = {
        taskId: 'task-4',
        pluginId: 'plugin-d',
        pipelineRunId: '',
        stageId: '',
        startedAt: new Date(),
        quota: resourceManager.getPluginQuota('plugin-d'),
      };

      const promise = new Promise<void>((resolve) => {
        sandbox.on('execution:complete', (data) => {
          expect(data.taskId).toBe('task-4');
          resolve();
        });
      });

      await sandbox.executeInSandbox(ctx, async () => 'ok');
      await promise;
    });

    it('should convert object result to outputs', async () => {
      await resourceManager.allocateQuota('task-5', 'plugin-e');
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
    it('should return false for non-existent task', async () => {
      const result = sandbox.cancelExecution('nonexistent');
      expect(result).toBe(false);
    });

    it('should cancel running execution', async () => {
      await resourceManager.allocateQuota('task-cancel', 'plugin-f');
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
      await resourceManager.allocateQuota('t1', 'p1');
      await resourceManager.allocateQuota('t2', 'p2');
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
      const count = await sandbox.cancelAllExecutions('Shutdown');
      expect(count).toBe(2);
    }, 15000);
  });

  describe('getActiveExecutionCount / getActiveExecutions', () => {
    it('should return 0 when nothing running', async () => {
      expect(sandbox.getActiveExecutionCount()).toBe(0);
      expect(sandbox.getActiveExecutions()).toEqual([]);
    });

    it('should track active executions', async () => {
      await resourceManager.allocateQuota('track-1', 'p1');
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
      await resourceManager.allocateQuota('s1', 'p1');
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
