/**
 * SSEConnectionManager 单元测试
 *
 * 测试 SSE 连接管理：添加、移除、心跳、优雅关闭。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

// Mock ChatOpsSSEConnectionRepository
const mockRepo = {
  create: jest.fn().mockResolvedValue({}),
  markDisconnected: jest.fn().mockResolvedValue(undefined),
  updateHeartbeat: jest.fn().mockResolvedValue(undefined),
  disconnectAll: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../repositories/ChatOpsSSEConnectionRepository', () => ({
  ChatOpsSSEConnectionRepository: jest.fn().mockImplementation(() => mockRepo),
}));

import { EventEmitter } from 'events';
import { SSEConnectionManager } from '../SSEConnectionManager';

function createMockReply(overrides: Record<string, any> = {}): any {
  return {
    raw: {
      write: jest.fn(),
      writableEnded: false,
      ...overrides,
    },
    ...overrides,
  };
}

describe('SSEConnectionManager', () => {
  let manager: SSEConnectionManager;
  let localBus: EventEmitter;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localBus = new EventEmitter();
    mockDb = { query: jest.fn() };
    mockRepo.create.mockResolvedValue({});
    mockRepo.markDisconnected.mockResolvedValue(undefined);
    mockRepo.updateHeartbeat.mockResolvedValue(undefined);
    mockRepo.disconnectAll.mockResolvedValue(undefined);

    manager = new SSEConnectionManager(localBus, mockDb, 'tenant-1');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create manager with localBus', () => {
      expect(manager).toBeDefined();
    });

    it('should work without db', () => {
      const mgr = new SSEConnectionManager(localBus);
      expect(mgr).toBeDefined();
    });
  });

  describe('addConnection', () => {
    it('should add a connection', async () => {
      const reply = createMockReply();
      const listener = jest.fn();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener,
        connectedAt: new Date(),
      }, reply);

      expect(manager.getActiveConnectionCount()).toBe(1);
    });

    it('should register listener on localBus', async () => {
      const reply = createMockReply();
      const listener = jest.fn();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener,
        connectedAt: new Date(),
      }, reply);

      localBus.emit('chatops:recommendation_update', { data: 'test' });
      expect(listener).toHaveBeenCalled();
    });

    it('should evict oldest connection when user limit reached', async () => {
      const reply = createMockReply();

      // Add 5 connections for same user (MAX_CONNECTIONS_PER_USER = 5)
      for (let i = 0; i < 5; i++) {
        await manager.addConnection({
          id: `conn-${i}`,
          userId: 'user-1',
          listener: jest.fn(),
          connectedAt: new Date(),
        }, reply);
      }

      // 6th connection should evict the first
      await manager.addConnection({
        id: 'conn-5',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      expect(manager.getActiveConnectionCount()).toBe(5);
    });

    it('should handle duplicate connection id', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      // Should have cleaned up old and added new
      expect(manager.getActiveConnectionCount()).toBe(1);
    });
  });

  describe('removeConnection', () => {
    it('should remove connection', async () => {
      const reply = createMockReply();
      const listener = jest.fn();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener,
        connectedAt: new Date(),
      }, reply);

      await manager.removeConnection('conn-1');

      expect(manager.getActiveConnectionCount()).toBe(0);
    });

    it('should remove listener from localBus', async () => {
      const reply = createMockReply();
      const listener = jest.fn();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener,
        connectedAt: new Date(),
      }, reply);

      await manager.removeConnection('conn-1');

      localBus.emit('chatops:recommendation_update', {});
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent connection', async () => {
      await manager.removeConnection('nonexistent');
      // Should not throw
      expect(manager.getActiveConnectionCount()).toBe(0);
    });

    it('should mark as disconnected in DB', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.removeConnection('conn-1');

      expect(mockRepo.markDisconnected).toHaveBeenCalledWith('conn-1');
    });
  });

  describe('shutdown', () => {
    it('should shutdown all connections', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.addConnection({
        id: 'conn-2',
        userId: 'user-2',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      // Start shutdown but don't await yet
      const shutdownPromise = manager.shutdown();

      // Advance timers to skip the 2s wait
      jest.advanceTimersByTime(2000);

      await shutdownPromise;

      expect(manager.getActiveConnectionCount()).toBe(0);
    });

    it('should send shutdown event to clients', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      const shutdownPromise = manager.shutdown();
      jest.advanceTimersByTime(2000);
      await shutdownPromise;

      expect(reply.raw.write).toHaveBeenCalledWith(
        'event: shutdown\ndata: {"reason":"server_shutdown"}\n\n',
      );
    });

    it('should handle shutdown with no connections', async () => {
      await manager.shutdown();
      // Should not throw
    });

    it('should disconnect all in DB', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      const shutdownPromise = manager.shutdown();
      jest.advanceTimersByTime(2000);
      await shutdownPromise;

      expect(mockRepo.disconnectAll).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('getActiveConnectionCount', () => {
    it('should return 0 when no connections', () => {
      expect(manager.getActiveConnectionCount()).toBe(0);
    });

    it('should return correct count', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.addConnection({
        id: 'conn-2',
        userId: 'user-2',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      expect(manager.getActiveConnectionCount()).toBe(2);
    });
  });

  describe('getConnectionsByUser', () => {
    it('should group connections by user', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.addConnection({
        id: 'conn-2',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.addConnection({
        id: 'conn-3',
        userId: 'user-2',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      const counts = manager.getConnectionsByUser();
      expect(counts.get('user-1')).toBe(2);
      expect(counts.get('user-2')).toBe(1);
    });

    it('should return empty map when no connections', () => {
      const counts = manager.getConnectionsByUser();
      expect(counts.size).toBe(0);
    });
  });

  // ==================== Heartbeat ====================

  describe('heartbeat', () => {
    it('should send heartbeat at interval', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      // Advance past heartbeat interval (30 seconds)
      jest.advanceTimersByTime(30_000);

      expect(reply.raw.write).toHaveBeenCalledWith(':heartbeat\n\n');
      expect(mockRepo.updateHeartbeat).toHaveBeenCalledWith('conn-1');
    });

    it('should remove connection when writableEnded is true', async () => {
      const reply = createMockReply({ writableEnded: false });

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      expect(manager.getActiveConnectionCount()).toBe(1);

      // Set writableEnded to true
      reply.raw.writableEnded = true;

      // Advance past heartbeat interval
      jest.advanceTimersByTime(30_000);

      // Allow async removeConnection to complete
      await Promise.resolve();
      await Promise.resolve();

      expect(manager.getActiveConnectionCount()).toBe(0);
    });

    it('should remove connection when write throws error', async () => {
      const reply = createMockReply();
      reply.raw.write.mockImplementation(() => {
        throw new Error('Stream destroyed');
      });

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      expect(manager.getActiveConnectionCount()).toBe(1);

      // Advance past heartbeat interval
      jest.advanceTimersByTime(30_000);

      // Allow async removeConnection to complete
      await Promise.resolve();
      await Promise.resolve();

      expect(manager.getActiveConnectionCount()).toBe(0);
    });

    it('should not send heartbeat for removed connections', async () => {
      const reply = createMockReply();

      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      await manager.removeConnection('conn-1');

      // Advance past heartbeat interval
      jest.advanceTimersByTime(30_000);

      // write should not be called for heartbeat (only for shutdown if applicable)
      expect(reply.raw.write).not.toHaveBeenCalledWith(':heartbeat\n\n');
    });
  });

  // ==================== DB Persist ====================

  describe('DB persist', () => {
    it('should handle DB persist failure gracefully', async () => {
      mockRepo.create.mockRejectedValue(new Error('DB write failed'));
      const reply = createMockReply();

      // Should not throw
      await manager.addConnection({
        id: 'conn-1',
        userId: 'user-1',
        listener: jest.fn(),
        connectedAt: new Date(),
      }, reply);

      expect(manager.getActiveConnectionCount()).toBe(1);
    });
  });
});
