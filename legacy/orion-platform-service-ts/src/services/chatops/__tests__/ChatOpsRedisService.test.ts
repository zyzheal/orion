/**
 * ChatOpsRedisService 单元测试
 *
 * 测试覆盖: 会话缓存、SSE 连接元数据、推荐缓存、订阅失败缓存、SSE pub/sub
 */

import { ChatOpsRedisService } from '../ChatOpsRedisService';

const mockHset = jest.fn();
const mockHget = jest.fn();
const mockDelete = jest.fn();
const mockExpire = jest.fn();
const mockLrange = jest.fn();
const mockLpush = jest.fn();
const mockPublish = jest.fn();
const mockSubscribe = jest.fn();
const mockIsHealthy = jest.fn();

describe('ChatOpsRedisService', () => {
  let service: ChatOpsRedisService;
  let mockRedis: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsHealthy.mockReturnValue(true);
    mockRedis = {
      isHealthy: mockIsHealthy,
      getClient: jest.fn().mockReturnValue({ expire: mockExpire, lrem: jest.fn().mockResolvedValue(1) }),
      hset: mockHset,
      hget: mockHget,
      delete: mockDelete,
      expire: mockExpire,
      lrange: mockLrange,
      lpush: mockLpush,
      publish: mockPublish,
      subscribe: mockSubscribe,
    };
    service = new ChatOpsRedisService(mockRedis);
  });

  afterEach(() => {
    // Reset subscribe/unsubscribe state between tests
    mockSubscribe.mockClear();
  });

  describe('constructor', () => {
    it('should create service with redis instance', () => {
      expect(service).toBeDefined();
    });
  });

  describe('isHealthy', () => {
    it('should return redis health status', async () => {
      mockIsHealthy.mockReturnValue(true);
      const result = await service.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when redis is unhealthy', async () => {
      mockIsHealthy.mockReturnValue(false);
      const result = await service.isHealthy();
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockIsHealthy.mockImplementation(() => { throw new Error('Redis error'); });
      const result = await service.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('ping', () => {
    it('should return pong from redis client', async () => {
      const mockClient = { ping: jest.fn().mockResolvedValue('PONG') };
      mockRedis.getClient.mockReturnValue(mockClient as any);
      const result = await service.ping();
      expect(result).toBe('PONG');
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should return DISCONNECTED when no client', async () => {
      mockRedis.getClient.mockReturnValue(null);
      const result = await service.ping();
      expect(result).toBe('DISCONNECTED');
    });
  });

  // ==================== Session Cache ====================

  describe('cacheSession', () => {
    it('should cache session data with TTL', async () => {
      mockHset.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await service.cacheSession('sess-1', { userId: 'user-1' }, 3600);

      expect(mockHset).toHaveBeenCalledWith(
        'chatops:session:sess-1',
        'data',
        { userId: 'user-1' }
      );
      expect(mockExpire).toHaveBeenCalledWith('chatops:session:sess-1', 3600);
    });

    it('should use default TTL of 3600 seconds', async () => {
      mockHset.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await service.cacheSession('sess-1', { userId: 'user-1' });

      expect(mockExpire).toHaveBeenCalledWith('chatops:session:sess-1', 3600);
    });

    it('should not throw on redis error', async () => {
      mockHset.mockRejectedValue(new Error('Redis down'));
      await expect(service.cacheSession('sess-1', {})).resolves.toBeUndefined();
    });
  });

  describe('getCachedSession', () => {
    it('should return cached session data', async () => {
      const sessionData = { userId: 'user-1', page: '/pipelines' };
      mockHget.mockResolvedValue(sessionData);

      const result = await service.getCachedSession('sess-1');

      expect(mockHget).toHaveBeenCalledWith('chatops:session:sess-1', 'data');
      expect(result).toEqual(sessionData);
    });

    it('should return null when no cached session', async () => {
      mockHget.mockResolvedValue(null);
      const result = await service.getCachedSession('sess-1');
      expect(result).toBeNull();
    });

    it('should return null on redis error', async () => {
      mockHget.mockRejectedValue(new Error('Redis down'));
      const result = await service.getCachedSession('sess-1');
      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session from redis', async () => {
      mockDelete.mockResolvedValue(1);

      await service.deleteSession('sess-1');

      expect(mockDelete).toHaveBeenCalledWith('chatops:session:sess-1');
    });

    it('should not throw on redis error', async () => {
      mockDelete.mockRejectedValue(new Error('Redis down'));
      await expect(service.deleteSession('sess-1')).resolves.toBeUndefined();
    });
  });

  // ==================== SSE Connection Metadata ====================

  describe('cacheSSEConnection', () => {
    it('should cache SSE connection metadata', async () => {
      mockHset.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await service.cacheSSEConnection({
        id: 'conn-1',
        userId: 'user-1',
        connectedAt: new Date('2025-01-01T00:00:00Z'),
        lastHeartbeatAt: new Date('2025-01-01T00:00:00Z'),
        status: 'active',
      });

      expect(mockHset).toHaveBeenCalledWith(
        'chatops:sse:conn-1',
        expect.objectContaining({
          user_id: 'user-1',
          status: 'active',
        })
      );
      // Verify dates were serialized as ISO strings
      const callArgs = mockHset.mock.calls[0][1];
      expect(callArgs.connected_at).toBe('2025-01-01T00:00:00.000Z');
      expect(callArgs.last_heartbeat_at).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should not throw on redis error', async () => {
      mockHset.mockRejectedValue(new Error('Redis down'));
      await expect(service.cacheSSEConnection({
        id: 'conn-1',
        userId: 'user-1',
        connectedAt: new Date(),
        lastHeartbeatAt: new Date(),
        status: 'active',
      })).resolves.toBeUndefined();
    });
  });

  describe('getSSEConnection', () => {
    it('should return SSE connection data', async () => {
      const connData = {
        user_id: 'user-1',
        connected_at: '2025-01-01T00:00:00.000Z',
        last_heartbeat_at: '2025-01-01T00:00:00.000Z',
        status: 'active',
      };
      mockHget.mockResolvedValue(connData);

      const result = await service.getSSEConnection('conn-1');

      expect(mockHget).toHaveBeenCalledWith('chatops:sse:conn-1', '');
      expect(result).toEqual(connData);
    });

    it('should return null on redis error', async () => {
      mockHget.mockRejectedValue(new Error('Redis down'));
      const result = await service.getSSEConnection('conn-1');
      expect(result).toBeNull();
    });
  });

  describe('removeSSEConnection', () => {
    it('should remove SSE connection from redis', async () => {
      mockDelete.mockResolvedValue(1);

      await service.removeSSEConnection('conn-1');

      expect(mockDelete).toHaveBeenCalledWith('chatops:sse:conn-1');
    });

    it('should not throw on redis error', async () => {
      mockDelete.mockRejectedValue(new Error('Redis down'));
      await expect(service.removeSSEConnection('conn-1')).resolves.toBeUndefined();
    });
  });

  describe('getSSEConnectionsByUser', () => {
    it('should return connection IDs for a user', async () => {
      mockLrange.mockResolvedValue(['conn-1', 'conn-2']);

      const result = await service.getSSEConnectionsByUser('user-1');

      expect(mockLrange).toHaveBeenCalledWith('chatops:sse:user:user-1', 0, -1);
      expect(result).toEqual(['conn-1', 'conn-2']);
    });

    it('should return empty array on error', async () => {
      mockLrange.mockRejectedValue(new Error('Redis down'));
      const result = await service.getSSEConnectionsByUser('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('addSSEConnectionToUserIndex', () => {
    it('should add connection ID to user index', async () => {
      mockLpush.mockResolvedValue(1);

      await service.addSSEConnectionToUserIndex('user-1', 'conn-1');

      expect(mockLpush).toHaveBeenCalledWith('chatops:sse:user:user-1', 'conn-1');
    });

    it('should not throw on redis error', async () => {
      mockLpush.mockRejectedValue(new Error('Redis down'));
      await expect(service.addSSEConnectionToUserIndex('user-1', 'conn-1')).resolves.toBeUndefined();
    });
  });

  describe('removeSSEConnectionFromUserIndex', () => {
    it('should remove connection ID from user index using lrem', async () => {
      const mockClient = { lrem: jest.fn().mockResolvedValue(1) };
      mockRedis.getClient.mockReturnValue(mockClient as any);

      await service.removeSSEConnectionFromUserIndex('user-1', 'conn-1');

      expect(mockClient.lrem).toHaveBeenCalledWith('chatops:sse:user:user-1', 0, 'conn-1');
    });

    it('should not throw when no client available', async () => {
      mockRedis.getClient.mockReturnValue(null);
      await expect(service.removeSSEConnectionFromUserIndex('user-1', 'conn-1')).resolves.toBeUndefined();
    });

    it('should not throw on redis error', async () => {
      const mockClient = { lrem: jest.fn().mockRejectedValue(new Error('Redis down')) };
      mockRedis.getClient.mockReturnValue(mockClient as any);
      await expect(service.removeSSEConnectionFromUserIndex('user-1', 'conn-1')).resolves.toBeUndefined();
    });
  });

  // ==================== Recommendation Cache ====================

  describe('cacheRecommendation', () => {
    it('should cache recommendation with TTL', async () => {
      mockHset.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await service.cacheRecommendation({
        id: 'rec-1',
        type: 'alert',
        severity: 'critical',
        title: 'Test alert',
        description: 'Test description',
        actions: [{ label: 'Investigate', command: 'alert list' }],
        source: 'monitoring',
        createdAt: new Date('2025-01-01T00:00:00Z'),
      });

      expect(mockHset).toHaveBeenCalledWith(
        'chatops:recommendation:rec-1',
        expect.objectContaining({
          type: 'alert',
          severity: 'critical',
          title: 'Test alert',
          source: 'monitoring',
        })
      );
      // Verify actions were JSON-stringified
      const callArgs = mockHset.mock.calls[0][1];
      expect(JSON.parse(callArgs.actions)).toEqual([{ label: 'Investigate', command: 'alert list' }]);
      expect(mockExpire).toHaveBeenCalledWith('chatops:recommendation:rec-1', 1800);
    });

    it('should not throw on redis error', async () => {
      mockHset.mockRejectedValue(new Error('Redis down'));
      await expect(service.cacheRecommendation({
        id: 'rec-1',
        type: 'alert',
        severity: 'critical',
        title: 'Test',
        description: 'Test',
        actions: [],
        source: 'test',
        createdAt: new Date(),
      })).resolves.toBeUndefined();
    });
  });

  describe('getCachedRecommendation', () => {
    it('should return cached recommendation', async () => {
      const recData = {
        type: 'alert',
        severity: 'critical',
        title: 'Test',
        description: 'Test',
        actions: [],
        source: 'test',
        created_at: '2025-01-01T00:00:00.000Z',
      };
      mockHget.mockResolvedValue(recData);

      const result = await service.getCachedRecommendation('rec-1');

      expect(mockHget).toHaveBeenCalledWith('chatops:recommendation:rec-1', '');
      expect(result).toEqual(recData);
    });

    it('should return null on redis error', async () => {
      mockHget.mockRejectedValue(new Error('Redis down'));
      const result = await service.getCachedRecommendation('rec-1');
      expect(result).toBeNull();
    });
  });

  describe('deleteRecommendation', () => {
    it('should delete recommendation from redis', async () => {
      mockDelete.mockResolvedValue(1);

      await service.deleteRecommendation('rec-1');

      expect(mockDelete).toHaveBeenCalledWith('chatops:recommendation:rec-1');
    });

    it('should not throw on redis error', async () => {
      mockDelete.mockRejectedValue(new Error('Redis down'));
      await expect(service.deleteRecommendation('rec-1')).resolves.toBeUndefined();
    });
  });

  describe('getActiveRecommendations', () => {
    it('should return empty array (not tenant-scoped in Redis)', async () => {
      const result = await service.getActiveRecommendations('tenant-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== Subscription Failure Cache ====================

  describe('cacheSubscriptionFailure', () => {
    it('should cache subscription failure with TTL', async () => {
      mockHset.mockResolvedValue(1);

      await service.cacheSubscriptionFailure({
        event: 'alert.created',
        error: 'NATS connection lost',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        retryCount: 3,
      });

      expect(mockHset).toHaveBeenCalledWith(
        'chatops:subscription_failure:alert.created',
        expect.objectContaining({
          error: 'NATS connection lost',
          retry_count: 3,
        })
      );
    });

    it('should not throw on redis error', async () => {
      mockHset.mockRejectedValue(new Error('Redis down'));
      await expect(service.cacheSubscriptionFailure({
        event: 'alert.created',
        error: 'NATS error',
        timestamp: new Date(),
        retryCount: 1,
      })).resolves.toBeUndefined();
    });
  });

  describe('getCachedSubscriptionFailure', () => {
    it('should return cached subscription failure', async () => {
      const failureData = {
        error: 'NATS connection lost',
        timestamp: '2025-01-01T00:00:00.000Z',
        retryCount: 3,
      };
      mockHget.mockResolvedValue(failureData);

      const result = await service.getCachedSubscriptionFailure('alert.created');

      expect(mockHget).toHaveBeenCalledWith('chatops:subscription_failure:alert.created', '');
      expect(result).toEqual(failureData);
    });

    it('should return null on redis error', async () => {
      mockHget.mockRejectedValue(new Error('Redis down'));
      const result = await service.getCachedSubscriptionFailure('alert.created');
      expect(result).toBeNull();
    });
  });

  describe('deleteSubscriptionFailure', () => {
    it('should delete subscription failure from redis', async () => {
      mockDelete.mockResolvedValue(1);

      await service.deleteSubscriptionFailure('alert.created');

      expect(mockDelete).toHaveBeenCalledWith('chatops:subscription_failure:alert.created');
    });

    it('should not throw on redis error', async () => {
      mockDelete.mockRejectedValue(new Error('Redis down'));
      await expect(service.deleteSubscriptionFailure('alert.created')).resolves.toBeUndefined();
    });
  });

  // ==================== SSE Event Pub/Sub ====================

  describe('publishSSEEvent', () => {
    it('should publish event to SSE channel', async () => {
      mockPublish.mockResolvedValue(1);

      await service.publishSSEEvent({ type: 'recommendation', data: { id: 'rec-1' } });

      expect(mockPublish).toHaveBeenCalledWith(
        'chatops:sse:events',
        JSON.stringify({ type: 'recommendation', data: { id: 'rec-1' } })
      );
    });

    it('should not throw on redis error', async () => {
      mockPublish.mockRejectedValue(new Error('Redis down'));
      await expect(service.publishSSEEvent({})).resolves.toBeUndefined();
    });
  });

  describe('subscribeSSEEvents', () => {
    it('should subscribe to SSE events channel', async () => {
      mockSubscribe.mockResolvedValue(undefined);

      await service.subscribeSSEEvents(jest.fn());

      expect(mockSubscribe).toHaveBeenCalledWith(
        'chatops:sse:events',
        expect.any(Function)
      );
    });

    it('should not subscribe twice', async () => {
      mockSubscribe.mockResolvedValue(undefined);

      await service.subscribeSSEEvents(jest.fn());
      await service.subscribeSSEEvents(jest.fn());

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it('should not subscribe when redis client is unavailable', async () => {
      mockRedis.getClient.mockReturnValue(null);
      mockSubscribe.mockClear();

      await service.subscribeSSEEvents(jest.fn());

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('should invoke callback when message received', async () => {
      mockSubscribe.mockImplementation(async (_channel: string, callback: (msg: string) => void) => {
        // Simulate receiving a message
        callback(JSON.stringify({ type: 'test', data: 'hello' }));
      });

      const callback = jest.fn();
      await service.subscribeSSEEvents(callback);

      expect(callback).toHaveBeenCalledWith({ type: 'test', data: 'hello' });
    });

    it('should ignore malformed JSON messages', async () => {
      mockSubscribe.mockImplementation(async (_channel: string, callback: (msg: string) => void) => {
        callback('not-json');
      });

      const callback = jest.fn();
      await service.subscribeSSEEvents(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not throw on subscribe error', async () => {
      mockSubscribe.mockRejectedValue(new Error('Subscribe failed'));
      await expect(service.subscribeSSEEvents(jest.fn())).resolves.toBeUndefined();
    });
  });

  describe('unsubscribeSSEEvents', () => {
    it('should unsubscribe from SSE events channel', async () => {
      const mockClient = { unsubscribe: jest.fn().mockResolvedValue(undefined) };
      mockRedis.getClient.mockReturnValue(mockClient as any);

      // First subscribe to set initialized = true
      mockSubscribe.mockResolvedValue(undefined);
      await service.subscribeSSEEvents(jest.fn());

      await service.unsubscribeSSEEvents();

      expect(mockClient.unsubscribe).toHaveBeenCalledWith('chatops:sse:events');
    });

    it('should not throw when no client', async () => {
      mockRedis.getClient.mockReturnValue(null);
      await expect(service.unsubscribeSSEEvents()).resolves.toBeUndefined();
    });
  });
});
