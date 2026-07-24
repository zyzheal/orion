/**
 * 健康检查测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HealthChecker } from '../services/health';

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker('test-service');
  });

  it('should have default self check', () => {
    const checks = healthChecker.getRegisteredChecks();
    expect(checks).toContain('self');
  });

  it('should register custom check', () => {
    healthChecker.registerCheck('database', async () => ({
      status: 'up',
      latency: 10,
    }));

    const checks = healthChecker.getRegisteredChecks();
    expect(checks).toContain('database');
  });

  it('should return healthy status when all checks pass', async () => {
    healthChecker.registerCheck('cache', async () => ({
      status: 'up',
      latency: 5,
    }));

    const result = await healthChecker.check();

    expect(result.status).toBe('healthy');
    expect(result.service).toBe('test-service');
    expect(result.checks.self.status).toBe('up');
    expect(result.checks.cache.status).toBe('up');
  });

  it('should return degraded status when some checks fail', async () => {
    healthChecker.registerCheck('database', async () => ({
      status: 'up',
      latency: 10,
    }));
    healthChecker.registerCheck('cache', async () => ({
      status: 'down',
      message: 'Connection refused',
    }));

    const result = await healthChecker.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.cache.status).toBe('down');
  });

  it('should handle checker errors', async () => {
    healthChecker.registerCheck('failing', async () => {
      throw new Error('Test error');
    });

    const result = await healthChecker.check();

    expect(result.checks.failing?.status).toBe('down');
    expect(result.checks.failing?.message).toBe('Test error');
  });

  it('should include latency in check results', async () => {
    healthChecker.registerCheck('fast', async () => {
      return { status: 'up', latency: 1 };
    });

    const result = await healthChecker.check();

    expect(result.checks.fast.latency).toBeDefined();
    expect(typeof result.checks.fast.latency).toBe('number');
  });

  it('should include timestamp and version', async () => {
    const result = await healthChecker.check();

    expect(result.timestamp).toBeDefined();
    expect(result.version).toBeDefined();
    expect(new Date(result.timestamp)).toBeInstanceOf(Date);
  });

  describe('readiness checks', () => {
    it('should mark self as ready check by default', () => {
      const readyChecks = healthChecker.getReadyChecks();
      expect(readyChecks).toContain('self');
    });

    it('should mark additional checks as ready checks', () => {
      healthChecker.registerCheck('database', async () => ({ status: 'up' }));
      healthChecker.markAsReadyCheck('database');

      const readyChecks = healthChecker.getReadyChecks();
      expect(readyChecks).toContain('database');
    });

    it('should return ready when all ready checks pass', async () => {
      healthChecker.registerCheck('database', async () => ({ status: 'up' }));
      healthChecker.markAsReadyCheck('database');

      const result = await healthChecker.checkReady();

      expect(result.ready).toBe(true);
      expect(result.checks.self.status).toBe('up');
      expect(result.checks.database.status).toBe('up');
    });

    it('should return not ready when a ready check fails', async () => {
      healthChecker.registerCheck('database', async () => ({ status: 'down', message: 'Connection refused' }));
      healthChecker.markAsReadyCheck('database');

      const result = await healthChecker.checkReady();

      expect(result.ready).toBe(false);
      expect(result.checks.database.status).toBe('down');
    });

    it('should not include non-ready checks in readiness result', async () => {
      healthChecker.registerCheck('redis', async () => ({ status: 'up' }));
      // redis 未标记为 ready check，不应出现在 readiness 结果中

      const result = await healthChecker.checkReady();

      expect(Object.keys(result.checks)).not.toContain('redis');
      expect(Object.keys(result.checks)).toContain('self');
    });

    it('should handle ready check errors gracefully', async () => {
      healthChecker.registerCheck('failing', async () => {
        throw new Error('Ready check failed');
      });
      healthChecker.markAsReadyCheck('failing');

      const result = await healthChecker.checkReady();

      expect(result.ready).toBe(false);
      expect(result.checks.failing?.status).toBe('down');
      expect(result.checks.failing?.message).toBe('Ready check failed');
    });
  });
});
