/**
 * TrafficReplayService 单元测试
 */

import { TrafficReplayService, ReplayConfig } from '../TrafficReplayService';
import { TrafficRecord } from '../TrafficRecorderService';

describe('TrafficReplayService', () => {
  let service: TrafficReplayService;

  beforeEach(() => {
    service = new TrafficReplayService();
  });

  const createSampleRecords = (): TrafficRecord[] => [
    {
      id: 'rec-1',
      twinId: 'twin-1',
      request: { method: 'GET', path: '/api/users' },
      response: { statusCode: 200, headers: {}, latencyMs: 50 },
      timestamp: new Date().toISOString(),
      metadata: {},
    },
    {
      id: 'rec-2',
      twinId: 'twin-1',
      request: { method: 'POST', path: '/api/users' },
      response: { statusCode: 201, headers: {}, latencyMs: 100 },
      timestamp: new Date().toISOString(),
      metadata: {},
    },
  ];

  describe('startReplay', () => {
    it('应该开始回放会话', async () => {
      const records = createSampleRecords();

      const session = await service.startReplay(
        'twin-1',
        'session-1',
        records,
        'http://sandbox.local:9000',
      );

      expect(session.id).toBeDefined();
      expect(session.twinId).toBe('twin-1');
      expect(session.recordingSessionId).toBe('session-1');
      expect(session.sandboxEndpoint).toBe('http://sandbox.local:9000');
      expect(session.totalRequests).toBe(2);
      expect(['pending', 'running'].includes(session.status)).toBe(true);
    });

    it('应该支持回放配置', async () => {
      const records = createSampleRecords();
      const config: ReplayConfig = {
        speedMultiplier: 2,
        maxConcurrency: 5,
        compareResponses: false,
      };

      const session = await service.startReplay(
        'twin-1',
        'session-1',
        records,
        'http://sandbox.local:9000',
        config,
      );

      expect(session.config.speedMultiplier).toBe(2);
      expect(session.config.maxConcurrency).toBe(5);
    });

    it('应该支持路径过滤', async () => {
      const records = createSampleRecords();
      const config: ReplayConfig = {
        filterPaths: ['/api/users'],
      };

      const session = await service.startReplay(
        'twin-1',
        'session-1',
        records,
        'http://sandbox.local:9000',
        config,
      );

      expect(session.totalRequests).toBe(2);
    });
  });

  describe('getSession', () => {
    it('应该返回回放会话', async () => {
      const records = createSampleRecords();
      const session = await service.startReplay('twin-1', 'session-1', records, 'http://sandbox.local:9000');

      // Wait briefly for async replay to complete
      await new Promise(r => setTimeout(r, 200));

      const result = await service.getSession(session.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(session.id);
    });

    it('应该返回 null 如果不存在', async () => {
      const result = await service.getSession('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('应该返回所有回放会话', async () => {
      const records = createSampleRecords();
      await service.startReplay('twin-1', 's1', records, 'http://sandbox.local:9000');
      await service.startReplay('twin-1', 's2', records, 'http://sandbox.local:9000');
      await service.startReplay('twin-2', 's3', records, 'http://sandbox.local:9000');

      // Wait briefly for async replay to complete
      await new Promise(r => setTimeout(r, 200));

      const sessions = await service.listSessions();
      expect(sessions.length).toBe(3);
    });

    it('应该支持按 twinId 过滤', async () => {
      const records = createSampleRecords();
      await service.startReplay('twin-1', 's1', records, 'http://sandbox.local:9000');
      await service.startReplay('twin-1', 's2', records, 'http://sandbox.local:9000');
      await service.startReplay('twin-2', 's3', records, 'http://sandbox.local:9000');

      // Wait briefly for async replay to complete
      await new Promise(r => setTimeout(r, 200));

      const filtered = await service.listSessions('twin-1');
      expect(filtered.length).toBe(2);
      expect(filtered.every(s => s.twinId === 'twin-1')).toBe(true);
    });
  });

  describe('cancelSession', () => {
    it('应该返回 null 如果会话不在运行状态', async () => {
      // Since replay completes quickly, cancelled state is rare
      const result = await service.cancelSession('nonexistent');
      expect(result).toBeNull();
    });
  });
});
