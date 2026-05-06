/**
 * TrafficRecorderService 单元测试
 */

import { TrafficRecorderService, RecordingConfig } from '../TrafficRecorderService';

describe('TrafficRecorderService', () => {
  let service: TrafficRecorderService;

  beforeEach(() => {
    service = new TrafficRecorderService();
  });

  describe('startRecording', () => {
    it('应该开始录制会话', async () => {
      const config: RecordingConfig = {
        name: 'test-recording',
      };

      const session = await service.startRecording('twin-1', config);

      expect(session.id).toBeDefined();
      expect(session.twinId).toBe('twin-1');
      expect(session.name).toBe('test-recording');
      expect(session.status).toBe('active');
      expect(session.records).toEqual([]);
    });

    it('应该支持过滤模式', async () => {
      const config: RecordingConfig = {
        name: 'filtered-recording',
        filterPatterns: ['/api/v1', '/api/v2'],
      };

      const session = await service.startRecording('twin-1', config);

      expect(session.filterPatterns).toContain('/api/v1');
      expect(session.filterPatterns).toContain('/api/v2');
    });
  });

  describe('pauseRecording', () => {
    it('应该暂停活动录制', async () => {
      const session = await service.startRecording('twin-1', { name: 'pause-test' });

      const paused = await service.pauseRecording(session.id);

      expect(paused).not.toBeNull();
      expect(paused!.status).toBe('paused');
      expect(paused!.pausedAt).toBeDefined();
    });

    it('应该返回 null 如果会话不存在', async () => {
      const result = await service.pauseRecording('nonexistent');
      expect(result).toBeNull();
    });

    it('应该返回 null 如果会话已暂停', async () => {
      const session = await service.startRecording('twin-1', { name: 'pause-already' });
      await service.pauseRecording(session.id);

      const result = await service.pauseRecording(session.id);
      expect(result).toBeNull();
    });
  });

  describe('resumeRecording', () => {
    it('应该恢复已暂停的录制', async () => {
      const session = await service.startRecording('twin-1', { name: 'resume-test' });
      await service.pauseRecording(session.id);

      const resumed = await service.resumeRecording(session.id);

      expect(resumed).not.toBeNull();
      expect(resumed!.status).toBe('active');
    });

    it('应该返回 null 如果会话不在暂停状态', async () => {
      const session = await service.startRecording('twin-1', { name: 'resume-active' });

      const result = await service.resumeRecording(session.id);
      expect(result).toBeNull();
    });
  });

  describe('stopRecording', () => {
    it('应该停止录制', async () => {
      const session = await service.startRecording('twin-1', { name: 'stop-test' });

      const stopped = await service.stopRecording(session.id);

      expect(stopped).not.toBeNull();
      expect(stopped!.status).toBe('completed');
      expect(stopped!.completedAt).toBeDefined();
    });

    it('应该返回 null 如果会话不存在', async () => {
      const result = await service.stopRecording('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('recordTraffic', () => {
    it('应该记录流量到活动会话', async () => {
      const session = await service.startRecording('twin-1', { name: 'record-test' });

      const record = await service.recordTraffic(
        session.id,
        'twin-1',
        { method: 'GET', path: '/api/users' },
        { statusCode: 200, headers: {}, latencyMs: 50 },
      );

      expect(record).not.toBeNull();
      expect(record!.id).toBeDefined();
      expect(record!.request.path).toBe('/api/users');
      expect(record!.response.statusCode).toBe(200);
    });

    it('应该返回 null 如果会话不在活动状态', async () => {
      const session = await service.startRecording('twin-1', { name: 'record-inactive' });
      await service.stopRecording(session.id);

      const record = await service.recordTraffic(
        session.id,
        'twin-1',
        { method: 'GET', path: '/api/users' },
        { statusCode: 200, headers: {}, latencyMs: 50 },
      );

      expect(record).toBeNull();
    });

    it('应该应用过滤模式', async () => {
      const session = await service.startRecording('twin-1', {
        name: 'filter-test',
        filterPatterns: ['/api/'],
      });

      // Matching path
      const matchingRecord = await service.recordTraffic(
        session.id,
        'twin-1',
        { method: 'GET', path: '/api/users' },
        { statusCode: 200, headers: {}, latencyMs: 50 },
      );
      expect(matchingRecord).not.toBeNull();

      // Non-matching path
      const nonMatchingRecord = await service.recordTraffic(
        session.id,
        'twin-1',
        { method: 'GET', path: '/health' },
        { statusCode: 200, headers: {}, latencyMs: 10 },
      );
      expect(nonMatchingRecord).toBeNull();
    });
  });

  describe('getSession', () => {
    it('应该返回录制会话', async () => {
      const session = await service.startRecording('twin-1', { name: 'get-test' });

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
    it('应该返回所有会话', async () => {
      await service.startRecording('twin-1', { name: 's1' });
      await service.startRecording('twin-1', { name: 's2' });
      await service.startRecording('twin-2', { name: 's3' });

      const sessions = await service.listSessions();
      expect(sessions.length).toBe(3);
    });

    it('应该支持按 twinId 过滤', async () => {
      await service.startRecording('twin-1', { name: 's1' });
      await service.startRecording('twin-1', { name: 's2' });
      await service.startRecording('twin-2', { name: 's3' });

      const filtered = await service.listSessions('twin-1');
      expect(filtered.length).toBe(2);
    });
  });

  describe('getRecords', () => {
    it('应该返回会话中的所有记录', async () => {
      const session = await service.startRecording('twin-1', { name: 'records-test' });
      await service.recordTraffic(session.id, 'twin-1', { method: 'GET', path: '/api/a' }, { statusCode: 200, headers: {}, latencyMs: 10 });
      await service.recordTraffic(session.id, 'twin-1', { method: 'GET', path: '/api/b' }, { statusCode: 200, headers: {}, latencyMs: 20 });

      const records = await service.getRecords(session.id);
      expect(records.length).toBe(2);
    });

    it('应该返回空数组如果会话不存在', async () => {
      const records = await service.getRecords('nonexistent');
      expect(records).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    it('应该删除会话', async () => {
      const session = await service.startRecording('twin-1', { name: 'delete-test' });

      const result = await service.deleteSession(session.id);
      expect(result).toBe(true);

      const found = await service.getSession(session.id);
      expect(found).toBeNull();
    });

    it('应该从活动录制集合中移除', async () => {
      const session = await service.startRecording('twin-1', { name: 'active-delete' });

      expect(service.getActiveRecordingCount()).toBe(1);

      await service.deleteSession(session.id);

      expect(service.getActiveRecordingCount()).toBe(0);
    });
  });

  describe('getActiveRecordingCount', () => {
    it('应该返回活动录制数量', async () => {
      expect(service.getActiveRecordingCount()).toBe(0);

      const s1 = await service.startRecording('twin-1', { name: 'active-1' });
      const s2 = await service.startRecording('twin-1', { name: 'active-2' });
      expect(service.getActiveRecordingCount()).toBe(2);

      await service.stopRecording(s1.id);
      expect(service.getActiveRecordingCount()).toBe(1);
    });
  });

  describe('isRecording', () => {
    it('应该检查孪生是否正在录制', async () => {
      expect(service.isRecording('twin-1')).toBe(false);

      await service.startRecording('twin-1', { name: 'is-recording' });
      expect(service.isRecording('twin-1')).toBe(true);
    });
  });
});
