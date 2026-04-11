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
});
