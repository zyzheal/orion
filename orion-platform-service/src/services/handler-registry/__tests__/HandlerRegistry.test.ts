/**
 * HandlerRegistry Tests
 */
import { HandlerRegistry } from '../HandlerRegistry';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-123',
}));

const mockQuery = jest.fn();
const mockRedis = { publish: jest.fn(async () => {}) };

const mockHandler = {
  execute: jest.fn(async (payload) => ({ result: 'ok', ...payload })),
  healthCheck: jest.fn(async () => ({ status: 'healthy' })),
};

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    registry = new HandlerRegistry({ query: mockQuery });
  });

  describe('register', () => {
    it('should register a handler in memory', () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      const entry = registry.getEntry('pipeline', 'docker-build');
      expect(entry).toBeDefined();
      expect(entry!.status).toBe('active');
      expect(entry!.invokeCount).toBe(0);
    });

    it('should persist metadata asynchronously', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      // Wait for async persist
      await new Promise(r => setTimeout(r, 50));
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('should return handler when active', () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      const handler = registry.resolve('pipeline', 'docker-build');
      expect(handler).toBeDefined();
    });

    it('should return undefined for unknown domain', () => {
      expect(registry.resolve('unknown', 'handler')).toBeUndefined();
    });

    it('should return undefined for disabled handler', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      await registry.disable('pipeline', 'docker-build');
      expect(registry.resolve('pipeline', 'docker-build')).toBeUndefined();
    });

    it('should increment invokeCount on resolve', () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      registry.resolve('pipeline', 'docker-build');
      registry.resolve('pipeline', 'docker-build');
      const entry = registry.getEntry('pipeline', 'docker-build');
      expect(entry!.invokeCount).toBe(2);
    });
  });

  describe('enable/disable', () => {
    it('should toggle handler status', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      await registry.disable('pipeline', 'docker-build');
      expect(registry.getEntry('pipeline', 'docker-build')!.status).toBe('disabled');

      await registry.enable('pipeline', 'docker-build');
      expect(registry.getEntry('pipeline', 'docker-build')!.status).toBe('active');
    });

    it('should throw for unknown handler', async () => {
      await expect(registry.enable('x', 'y')).rejects.toThrow('not found');
    });
  });

  describe('invoke', () => {
    it('should execute handler and return result', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      const result = await registry.invoke('pipeline', 'docker-build', { image: 'test' });
      expect(result).toEqual({ result: 'ok', image: 'test' });
      expect(mockHandler.execute).toHaveBeenCalled();
    });

    it('should throw for disabled handler', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      await registry.disable('pipeline', 'docker-build');
      await expect(registry.invoke('pipeline', 'docker-build', {})).rejects.toThrow('disabled');
    });

    it('should track error count on failure', async () => {
      const failHandler = { execute: jest.fn(async () => { throw new Error('boom'); }) };
      registry.register('pipeline', 'fail', failHandler as any);
      await expect(registry.invoke('pipeline', 'fail', {})).rejects.toThrow('boom');
      expect(registry.getEntry('pipeline', 'fail')!.errorCount).toBe(1);
    });
  });

  describe('unregister', () => {
    it('should remove handler from registry', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      await registry.unregister('pipeline', 'docker-build');
      expect(registry.resolve('pipeline', 'docker-build')).toBeUndefined();
      expect(registry.getDomains()).not.toContain('pipeline');
    });
  });

  describe('healthCheck', () => {
    it('should report health status for all handlers', async () => {
      registry.register('pipeline', 'docker-build', mockHandler as any);
      const result = await registry.healthCheck();
      expect(result.total).toBe(1);
      expect(result.healthy).toBe(1);
      expect(result.handlers[0].healthStatus).toBe('healthy');
    });
  });

  describe('list', () => {
    it('should filter by domain', async () => {
      registry.register('pipeline', 'a', mockHandler as any);
      registry.register('deploy', 'b', mockHandler as any);
      const list = await registry.list({ domain: 'pipeline' });
      expect(list).toHaveLength(1);
      expect(list[0].domain).toBe('pipeline');
    });
  });

  describe('with Redis', () => {
    it('should publish notifications', async () => {
      const redisRegistry = new HandlerRegistry({ query: mockQuery }, mockRedis as any);
      redisRegistry.register('pipeline', 'docker-build', mockHandler as any);
      await new Promise(r => setTimeout(r, 50));
      expect(mockRedis.publish).toHaveBeenCalled();
    });
  });
});
