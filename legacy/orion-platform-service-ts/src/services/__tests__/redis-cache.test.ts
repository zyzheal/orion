/**
 * RedisCache - Redis 缓存服务单元测试
 *
 * 测试覆盖: 连接管理、缓存CRUD、哈希操作、列表操作、发布订阅、健康检查
 */

// Mock ioredis before import
const mockRedisInstance = {
  on: jest.fn(),
  once: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  hset: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  lpush: jest.fn(),
  rpop: jest.fn(),
  llen: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

import { RedisCache } from '../redis-cache';

describe('RedisCache', () => {
  let cache: RedisCache;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new RedisCache({ host: 'localhost', port: 6379 });
  });

  // Helper to connect cache (simulate successful connection)
  const connectCache = async () => {
    // Make `once` resolve immediately for 'connect'
    mockRedisInstance.once.mockImplementation((event: string, cb: any) => {
      if (event === 'connect') cb();
    });

    // Make `on` register handlers
    mockRedisInstance.on.mockImplementation((event: string, handler: any) => {
      // Store handlers for later use
    });

    await cache.connect();
  };

  // ==================== Connection Management ====================

  describe('connect', () => {
    it('should connect to Redis', async () => {
      mockRedisInstance.once.mockImplementation((event: string, cb: any) => {
        if (event === 'connect') cb();
      });

      await cache.connect();

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should not reconnect if already connected', async () => {
      mockRedisInstance.once.mockImplementation((event: string, cb: any) => {
        if (event === 'connect') cb();
      });

      await cache.connect();
      await cache.connect(); // second call

      // Redis constructor should only be called once
      const Redis = require('ioredis');
      expect(Redis).toHaveBeenCalledTimes(1);
    });

    it('should reject on connection timeout', async () => {
      // Don't trigger connect event - let timeout fire
      mockRedisInstance.once.mockImplementation(() => {});

      // We can't easily test the 10s timeout, but we can test the error path
      // by triggering an error
      mockRedisInstance.once.mockImplementation((event: string, cb: any) => {
        if (event === 'error') cb(new Error('Connection refused'));
      });

      await expect(cache.connect()).rejects.toThrow('Connection refused');
    });
  });

  describe('close', () => {
    it('should close connection', async () => {
      await connectCache();
      mockRedisInstance.quit.mockResolvedValue('OK');

      await cache.close();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should do nothing when not connected', async () => {
      await cache.close();

      expect(mockRedisInstance.quit).not.toHaveBeenCalled();
    });
  });

  describe('isHealthy', () => {
    it('should return false when not connected', () => {
      expect(cache.isHealthy()).toBe(false);
    });

    it('should return true when connected', async () => {
      await connectCache();

      // Simulate connect event
      const connectHandler = mockRedisInstance.on.mock.calls.find((c: any) => c[0] === 'connect')?.[1];
      if (connectHandler) connectHandler();

      expect(cache.isHealthy()).toBe(true);
    });
  });

  describe('getClient', () => {
    it('should return null when not connected', () => {
      expect(cache.getClient()).toBeNull();
    });

    it('should return client when connected', async () => {
      await connectCache();

      expect(cache.getClient()).toBeDefined();
    });
  });

  // ==================== Cache CRUD ====================

  describe('set', () => {
    it('should set value without TTL', async () => {
      await connectCache();
      mockRedisInstance.set.mockResolvedValue('OK');

      await cache.set('key1', 'value1');

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key1', '"value1"');
    });

    it('should set value with TTL', async () => {
      await connectCache();
      mockRedisInstance.setex.mockResolvedValue('OK');

      await cache.set('key1', { data: 'test' }, 300);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith('key1', 300, '{"data":"test"}');
    });

    it('should throw when not connected', async () => {
      await expect(cache.set('key1', 'value1')).rejects.toThrow('Redis not connected');
    });
  });

  describe('get', () => {
    it('should get existing value', async () => {
      await connectCache();
      mockRedisInstance.get.mockResolvedValue('{"data":"test"}');

      const result = await cache.get('key1');

      expect(result).toEqual({ data: 'test' });
    });

    it('should return null for non-existent key', async () => {
      await connectCache();
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await cache.get('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      await connectCache();
      mockRedisInstance.get.mockResolvedValue('not-json{');

      const result = await cache.get('key1');

      expect(result).toBeNull();
    });

    it('should throw when not connected', async () => {
      await expect(cache.get('key1')).rejects.toThrow('Redis not connected');
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await connectCache();
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await cache.delete('key1');

      expect(result).toBe(1);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('key1');
    });

    it('should return 0 for non-existent key', async () => {
      await connectCache();
      mockRedisInstance.del.mockResolvedValue(0);

      const result = await cache.delete('non-existent');

      expect(result).toBe(0);
    });

    it('should throw when not connected', async () => {
      await expect(cache.delete('key1')).rejects.toThrow('Redis not connected');
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      await connectCache();
      mockRedisInstance.exists.mockResolvedValue(1);

      const result = await cache.exists('key1');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      await connectCache();
      mockRedisInstance.exists.mockResolvedValue(0);

      const result = await cache.exists('non-existent');

      expect(result).toBe(false);
    });

    it('should throw when not connected', async () => {
      await expect(cache.exists('key1')).rejects.toThrow('Redis not connected');
    });
  });

  describe('ttl', () => {
    it('should return TTL for key', async () => {
      await connectCache();
      mockRedisInstance.ttl.mockResolvedValue(300);

      const result = await cache.ttl('key1');

      expect(result).toBe(300);
    });

    it('should return -1 for key without TTL', async () => {
      await connectCache();
      mockRedisInstance.ttl.mockResolvedValue(-1);

      const result = await cache.ttl('key1');

      expect(result).toBe(-1);
    });

    it('should throw when not connected', async () => {
      await expect(cache.ttl('key1')).rejects.toThrow('Redis not connected');
    });
  });

  // ==================== Atomic Operations ====================

  describe('incr', () => {
    it('should increment value', async () => {
      await connectCache();
      mockRedisInstance.incr.mockResolvedValue(5);

      const result = await cache.incr('counter');

      expect(result).toBe(5);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('counter');
    });

    it('should throw when not connected', async () => {
      await expect(cache.incr('counter')).rejects.toThrow('Redis not connected');
    });
  });

  describe('decr', () => {
    it('should decrement value', async () => {
      await connectCache();
      mockRedisInstance.decr.mockResolvedValue(3);

      const result = await cache.decr('counter');

      expect(result).toBe(3);
      expect(mockRedisInstance.decr).toHaveBeenCalledWith('counter');
    });

    it('should throw when not connected', async () => {
      await expect(cache.decr('counter')).rejects.toThrow('Redis not connected');
    });
  });

  // ==================== Hash Operations ====================

  describe('hset', () => {
    it('should set hash field with object value', async () => {
      await connectCache();
      mockRedisInstance.hset.mockResolvedValue(1);

      const result = await cache.hset('hash1', 'field1', { data: 'test' });

      expect(result).toBe(1);
      expect(mockRedisInstance.hset).toHaveBeenCalledWith('hash1', 'field1', '{"data":"test"}');
    });

    it('should set hash field with string value', async () => {
      await connectCache();
      mockRedisInstance.hset.mockResolvedValue(1);

      await cache.hset('hash1', 'field1', 'string-value');

      expect(mockRedisInstance.hset).toHaveBeenCalledWith('hash1', 'field1', 'string-value');
    });

    it('should throw when not connected', async () => {
      await expect(cache.hset('hash1', 'field1', 'value')).rejects.toThrow('Redis not connected');
    });
  });

  describe('hget', () => {
    it('should get hash field with JSON value', async () => {
      await connectCache();
      mockRedisInstance.hget.mockResolvedValue('{"data":"test"}');

      const result = await cache.hget('hash1', 'field1');

      expect(result).toEqual({ data: 'test' });
    });

    it('should get hash field with plain string', async () => {
      await connectCache();
      mockRedisInstance.hget.mockResolvedValue('plain-string');

      const result = await cache.hget('hash1', 'field1');

      expect(result).toBe('plain-string');
    });

    it('should return null for non-existent field', async () => {
      await connectCache();
      mockRedisInstance.hget.mockResolvedValue(null);

      const result = await cache.hget('hash1', 'non-existent');

      expect(result).toBeNull();
    });

    it('should throw when not connected', async () => {
      await expect(cache.hget('hash1', 'field1')).rejects.toThrow('Redis not connected');
    });
  });

  describe('hgetall', () => {
    it('should get all hash fields', async () => {
      await connectCache();
      mockRedisInstance.hgetall.mockResolvedValue({
        field1: '{"data":"test1"}',
        field2: '{"data":"test2"}',
      });

      const result = await cache.hgetall('hash1');

      expect(result).toEqual({
        field1: { data: 'test1' },
        field2: { data: 'test2' },
      });
    });

    it('should return null for empty hash', async () => {
      await connectCache();
      mockRedisInstance.hgetall.mockResolvedValue({});

      const result = await cache.hgetall('empty-hash');

      expect(result).toBeNull();
    });

    it('should handle mixed JSON and plain values', async () => {
      await connectCache();
      mockRedisInstance.hgetall.mockResolvedValue({
        json: '{"key":"value"}',
        plain: 'text',
      });

      const result = await cache.hgetall('hash1');

      expect(result!.json).toEqual({ key: 'value' });
      expect(result!.plain).toBe('text');
    });

    it('should throw when not connected', async () => {
      await expect(cache.hgetall('hash1')).rejects.toThrow('Redis not connected');
    });
  });

  // ==================== List Operations ====================

  describe('lpush', () => {
    it('should push string values to list', async () => {
      await connectCache();
      mockRedisInstance.lpush.mockResolvedValue(3);

      const result = await cache.lpush('list1', 'a', 'b', 'c');

      expect(result).toBe(3);
      expect(mockRedisInstance.lpush).toHaveBeenCalledWith('list1', 'a', 'b', 'c');
    });

    it('should push object values to list', async () => {
      await connectCache();
      mockRedisInstance.lpush.mockResolvedValue(1);

      await cache.lpush('list1', { id: 1 });

      expect(mockRedisInstance.lpush).toHaveBeenCalledWith('list1', '{"id":1}');
    });

    it('should throw when not connected', async () => {
      await expect(cache.lpush('list1', 'a')).rejects.toThrow('Redis not connected');
    });
  });

  describe('rpop', () => {
    it('should pop JSON value from list', async () => {
      await connectCache();
      mockRedisInstance.rpop.mockResolvedValue('{"id":1}');

      const result = await cache.rpop('list1');

      expect(result).toEqual({ id: 1 });
    });

    it('should pop plain string from list', async () => {
      await connectCache();
      mockRedisInstance.rpop.mockResolvedValue('plain-text');

      const result = await cache.rpop('list1');

      expect(result).toBe('plain-text');
    });

    it('should return null for empty list', async () => {
      await connectCache();
      mockRedisInstance.rpop.mockResolvedValue(null);

      const result = await cache.rpop('empty-list');

      expect(result).toBeNull();
    });

    it('should throw when not connected', async () => {
      await expect(cache.rpop('list1')).rejects.toThrow('Redis not connected');
    });
  });

  describe('llen', () => {
    it('should return list length', async () => {
      await connectCache();
      mockRedisInstance.llen.mockResolvedValue(5);

      const result = await cache.llen('list1');

      expect(result).toBe(5);
    });

    it('should throw when not connected', async () => {
      await expect(cache.llen('list1')).rejects.toThrow('Redis not connected');
    });
  });

  // ==================== Pub/Sub ====================

  describe('publish', () => {
    it('should publish message to channel', async () => {
      await connectCache();
      mockRedisInstance.publish.mockResolvedValue(2);

      const result = await cache.publish('channel1', 'hello');

      expect(result).toBe(2);
      expect(mockRedisInstance.publish).toHaveBeenCalledWith('channel1', 'hello');
    });

    it('should throw when not connected', async () => {
      await expect(cache.publish('channel1', 'hello')).rejects.toThrow('Redis not connected');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to channel', async () => {
      await connectCache();

      // Mock the subscriber Redis instance
      const mockSubscriber = {
        on: jest.fn(),
        subscribe: jest.fn().mockResolvedValue(1),
      };
      const Redis = require('ioredis');
      Redis.mockImplementationOnce(() => mockSubscriber);

      const callback = jest.fn();
      await cache.subscribe('channel1', callback);

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('channel1');
      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should invoke callback on message', async () => {
      await connectCache();

      let messageHandler: any;
      const mockSubscriber = {
        on: jest.fn().mockImplementation((event: string, handler: any) => {
          if (event === 'message') messageHandler = handler;
        }),
        subscribe: jest.fn().mockResolvedValue(1),
      };
      const Redis = require('ioredis');
      Redis.mockImplementationOnce(() => mockSubscriber);

      const callback = jest.fn();
      await cache.subscribe('channel1', callback);

      // Simulate message
      messageHandler('channel1', 'test-message');

      expect(callback).toHaveBeenCalledWith('test-message');
    });

    it('should not invoke callback for different channel', async () => {
      await connectCache();

      let messageHandler: any;
      const mockSubscriber = {
        on: jest.fn().mockImplementation((event: string, handler: any) => {
          if (event === 'message') messageHandler = handler;
        }),
        subscribe: jest.fn().mockResolvedValue(1),
      };
      const Redis = require('ioredis');
      Redis.mockImplementationOnce(() => mockSubscriber);

      const callback = jest.fn();
      await cache.subscribe('channel1', callback);

      messageHandler('other-channel', 'test-message');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should throw when not connected', async () => {
      await expect(cache.subscribe('channel1', jest.fn())).rejects.toThrow('Redis not connected');
    });
  });

  // ==================== Events ====================

  describe('events', () => {
    it('should emit connect event', async () => {
      const connectSpy = jest.fn();
      cache.on('connect', connectSpy);

      mockRedisInstance.once.mockImplementation((event: string, cb: any) => {
        if (event === 'connect') cb();
      });

      await cache.connect();

      // Trigger the on-connect handler
      const connectHandler = mockRedisInstance.on.mock.calls.find((c: any) => c[0] === 'connect')?.[1];
      if (connectHandler) connectHandler();

      expect(connectSpy).toHaveBeenCalled();
    });

    it('should emit close event', async () => {
      const closeSpy = jest.fn();
      cache.on('close', closeSpy);

      await connectCache();

      const closeHandler = mockRedisInstance.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
      if (closeHandler) closeHandler();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should emit error event', async () => {
      const errorSpy = jest.fn();
      cache.on('error', errorSpy);

      await connectCache();

      const errorHandler = mockRedisInstance.on.mock.calls.find((c: any) => c[0] === 'error')?.[1];
      if (errorHandler) errorHandler(new Error('test error'));

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should emit set event', async () => {
      const setSpy = jest.fn();
      cache.on('set', setSpy);

      await connectCache();
      mockRedisInstance.set.mockResolvedValue('OK');

      await cache.set('key1', 'value1');

      expect(setSpy).toHaveBeenCalledWith({ key: 'key1', ttl: undefined });
    });

    it('should emit delete event', async () => {
      const deleteSpy = jest.fn();
      cache.on('delete', deleteSpy);

      await connectCache();
      mockRedisInstance.del.mockResolvedValue(1);

      await cache.delete('key1');

      expect(deleteSpy).toHaveBeenCalledWith({ key: 'key1' });
    });
  });
});
