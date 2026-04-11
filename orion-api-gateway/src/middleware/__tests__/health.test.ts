/**
 * 健康检查测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HealthMiddleware, HealthStatus } from '../health';

describe('HealthMiddleware', () => {
  let healthMiddleware: HealthMiddleware;

  beforeEach(() => {
    healthMiddleware = new HealthMiddleware();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register default self check', () => {
    const handler = healthMiddleware.handler.bind(healthMiddleware);
    expect(handler).toBeDefined();
  });

  it('should return healthy status when all checks pass', async () => {
    const mockRequest = {} as any;
    const mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as any;

    // 模拟健康检查通过
    healthMiddleware.registerCheck('database', async () => ({ status: 'up' }));
    healthMiddleware.registerCheck('cache', async () => ({ status: 'up' }));

    const result = await healthMiddleware.handler(mockRequest, mockReply);

    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.checks.self).toEqual({ status: 'up' });
    expect(result.checks.database).toEqual({ status: 'up' });
    expect(result.checks.cache).toEqual({ status: 'up' });
  });

  it('should return degraded status when some checks fail', async () => {
    healthMiddleware.registerCheck('database', async () => ({ status: 'up' }));
    healthMiddleware.registerCheck('cache', async () => ({ status: 'down', message: 'Connection refused' }));

    const result = await healthMiddleware.handler({} as any, {} as any);

    expect(result.status).toBe('degraded');
    expect(result.checks.cache).toEqual({ status: 'down', message: 'Connection refused' });
  });

  it('should return unhealthy status when all checks fail', async () => {
    // 清除默认的 self check
    const newMiddleware = new HealthMiddleware();

    newMiddleware.registerCheck('database', async () => {
      throw new Error('Connection failed');
    });

    const result = await newMiddleware.handler({} as any, {} as any);

    expect(result.status).toBe('unhealthy');
    expect(result.checks.database?.status).toBe('down');
  });

  it('should handle checker errors gracefully', async () => {
    healthMiddleware.registerCheck('failing', async () => {
      throw new Error('Test error');
    });

    const result = await healthMiddleware.handler({} as any, {} as any);

    expect(result.checks.failing?.status).toBe('down');
    expect(result.checks.failing?.message).toBe('Test error');
  });

  it('should include version in response', async () => {
    const result = await healthMiddleware.handler({} as any, {} as any);

    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('string');
  });

  it('should include timestamp in ISO format', async () => {
    const result = await healthMiddleware.handler({} as any, {} as any);

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp)).toBeInstanceOf(Date);
  });
});
