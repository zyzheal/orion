/**
 * DigitalTwinServices 单元测试
 */

import { DigitalTwinService, DigitalTwinRepository, DigitalTwinError } from '../DigitalTwinServices';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('DigitalTwinServices', () => {
  let service: DigitalTwinService;
  let repository: DigitalTwinRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DigitalTwinRepository(mockPool as any);
    service = new DigitalTwinService(mockPool as any);
  });

  describe('DigitalTwinRepository', () => {
    describe('createSnapshot', () => {
      it('应该创建快照', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 's1',
            tenant_id: 'tenant1',
            environment: 'production',
            status: 'creating',
            components: [],
            topology: {},
          }],
        });

        const result = await repository.createSnapshot({
          tenant_id: 'tenant1',
          environment: 'production',
        });

        expect(result.environment).toBe('production');
        expect(result.status).toBe('creating');
      });

      it('应该支持备注', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', note: 'Pre-deployment snapshot' }],
        });

        const result = await repository.createSnapshot({
          tenant_id: 'tenant1',
          environment: 'production',
          note: 'Pre-deployment snapshot',
        });

        expect(result.note).toBe('Pre-deployment snapshot');
      });

      it('应该支持创建者', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', created_by: 'user1' }],
        });

        const result = await repository.createSnapshot({
          tenant_id: 'tenant1',
          environment: 'production',
          created_by: 'user1',
        });

        expect(result.created_by).toBe('user1');
      });
    });

    describe('findSnapshotById', () => {
      it('应该返回快照', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', environment: 'production' }],
        });

        const result = await repository.findSnapshotById('s1');

        expect(result).not.toBeNull();
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findSnapshotById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listSnapshots', () => {
      it('应该返回快照列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 's1', environment: 'production' },
            { id: 's2', environment: 'staging' },
          ],
        });

        const result = await repository.listSnapshots('tenant1');

        expect(result.length).toBe(2);
      });

      it('应该支持按环境过滤', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', environment: 'production' }],
        });

        await repository.listSnapshots('tenant1', { environment: 'production' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('environment'),
          expect.arrayContaining(['tenant1', 'production'])
        );
      });

      it('应该支持按状态过滤', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', status: 'ready' }],
        });

        await repository.listSnapshots('tenant1', { status: 'ready' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status'),
          expect.any(Array)
        );
      });
    });

    describe('updateSnapshot', () => {
      it('应该更新快照', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', status: 'ready' }],
        });

        const result = await repository.updateSnapshot('s1', {
          status: 'ready',
        });

        expect(result!.status).toBe('ready');
      });
    });

    describe('deleteSnapshot', () => {
      it('应该删除快照', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 1 });

        const result = await repository.deleteSnapshot('s1');

        expect(result).toBe(true);
      });

      it('应该返回 false 如果快照不存在', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 0 });

        const result = await repository.deleteSnapshot('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('createRecording', () => {
      it('应该创建流量录制', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'r1',
            tenant_id: 'tenant1',
            source_env: 'production',
            status: 'recording',
          }],
        });

        const result = await repository.createRecording({
          tenant_id: 'tenant1',
          source_env: 'production',
        });

        expect(result.source_env).toBe('production');
        expect(result.status).toBe('recording');
      });

      it('应该支持路径前缀过滤', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', path_prefixes: ['/api/v1'] }],
        });

        const result = await repository.createRecording({
          tenant_id: 'tenant1',
          source_env: 'production',
          path_prefixes: ['/api/v1'],
        });

        expect(result.path_prefixes).toContain('/api/v1');
      });

      it('应该支持脱敏规则', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', desensitization_rules: ['email', 'phone'] }],
        });

        const result = await repository.createRecording({
          tenant_id: 'tenant1',
          source_env: 'production',
          desensitization_rules: ['email', 'phone'],
        });

        expect(result.desensitization_rules).toContain('email');
      });
    });

    describe('findRecordingById', () => {
      it('应该返回录制', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1' }],
        });

        const result = await repository.findRecordingById('r1');

        expect(result).not.toBeNull();
      });
    });

    describe('listRecordings', () => {
      it('应该返回录制列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1' }],
        });

        const result = await repository.listRecordings('tenant1');

        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('DigitalTwinService', () => {
    describe('createSnapshot', () => {
      it('应该创建快照', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', status: 'creating' }],
        });

        const result = await service.createSnapshot({
          tenant_id: 'tenant1',
          environment: 'production',
        });

        expect(result.status).toBe('creating');
      });
    });

    describe('getSnapshot', () => {
      it('应该返回快照', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1' }],
        });

        const result = await service.getSnapshot('s1');

        expect(result).not.toBeNull();
      });
    });

    describe('listSnapshots', () => {
      it('应该返回快照列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1' }],
        });

        const result = await service.listSnapshots('tenant1');

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('restoreSnapshot', () => {
      it('应该恢复快照', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              id: 's1',
              status: 'ready',
              components: [],
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 's1', status: 'restoring' }],
          });

        const result = await service.restoreSnapshot('s1', {
          target_env: 'staging',
        });

        expect(result).toBeDefined();
      });

      it('应该支持 dry run', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', components: [] }],
        });

        const result = await service.restoreSnapshot('s1', {
          target_env: 'staging',
          dry_run: true,
        });

        expect(result).toBeDefined();
      });
    });

    describe('deleteSnapshot', () => {
      it('应该删除快照', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 1 });

        const result = await service.deleteSnapshot('s1');

        expect(result).toBe(true);
      });
    });

    describe('startRecording', () => {
      it('应该开始录制', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', status: 'recording' }],
        });

        const result = await service.startRecording({
          tenant_id: 'tenant1',
          source_env: 'production',
        });

        expect(result.status).toBe('recording');
      });
    });

    describe('stopRecording', () => {
      it('应该停止录制', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', status: 'stopped' }],
        });

        const result = await service.stopRecording('r1');

        expect(result.status).toBe('stopped');
      });
    });

    describe('startReplay', () => {
      it('应该开始回放', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{ id: 'r1', request_count: 100 }],
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'rp1',
              status: 'running',
              progress: 0,
            }],
          });

        const result = await service.startReplay({
          tenant_id: 'tenant1',
          recording_id: 'r1',
          target_env: 'staging',
        });

        expect(result.status).toBe('running');
      });

      it('应该支持速度倍数', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{ id: 'r1' }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'rp1', speed_multiplier: 2 }],
          });

        const result = await service.startReplay({
          tenant_id: 'tenant1',
          recording_id: 'r1',
          target_env: 'staging',
          speed_multiplier: 2,
        });

        expect(result.speed_multiplier).toBe(2);
      });

      it('应该支持并行度', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{ id: 'r1' }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'rp1', parallelism: 10 }],
          });

        const result = await service.startReplay({
          tenant_id: 'tenant1',
          recording_id: 'r1',
          target_env: 'staging',
          parallelism: 10,
        });

        expect(result.parallelism).toBe(10);
      });
    });

    describe('getReplayStatus', () => {
      it('应该返回回放状态', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'rp1',
            status: 'running',
            progress: 50,
            matched_count: 50,
            mismatched_count: 0,
          }],
        });

        const result = await service.getReplayStatus('rp1');

        expect(result!.progress).toBe(50);
      });
    });

    describe('getReplayMismatches', () => {
      it('应该返回不匹配列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { request_id: 'req1', path: '/api/v1/users' },
          ],
        });

        const result = await service.getReplayMismatches('rp1');

        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('TwinSnapshot', () => {
    it('应该包含完整的快照信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's1',
          tenant_id: 'tenant1',
          environment: 'production',
          status: 'ready',
          components: [{
            name: 'service-a',
            type: 'service',
            version: 'v1.0.0',
            replicas: 3,
          }],
          topology: {},
          size_bytes: 1024,
          storage_path: '/snapshots/s1',
          created_by: 'user1',
          note: 'Snapshot',
          created_at: new Date(),
          completed_at: new Date(),
        }],
      });

      const result = await repository.createSnapshot({
        tenant_id: 'tenant1',
        environment: 'production',
      });

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant1');
    });

    it('应该支持不同的快照状态', async () => {
      const statuses = ['creating', 'ready', 'failed', 'restoring'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', status }],
        });

        const result = await repository.findSnapshotById('s1');
        if (result) {
          expect(['creating', 'ready', 'failed', 'restoring'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  describe('TrafficRecording', () => {
    it('应该包含完整的录制信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          tenant_id: 'tenant1',
          source_env: 'production',
          status: 'recording',
          path_prefixes: [],
          desensitization_rules: [],
          request_count: 100,
          size_bytes: 1024,
          storage_path: '/recordings/r1',
          started_by: 'user1',
          started_at: new Date(),
          completed_at: null,
        }],
      });

      const result = await repository.createRecording({
        tenant_id: 'tenant1',
        source_env: 'production',
      });

      expect(result.id).toBeDefined();
      expect(result.request_count).toBeDefined();
    });

    it('应该支持不同的录制状态', async () => {
      const statuses = ['recording', 'completed', 'stopped', 'failed'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', status }],
        });

        const result = await repository.findRecordingById('r1');
        if (result) {
          expect(['recording', 'completed', 'stopped', 'failed'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  describe('DigitalTwinError', () => {
    it('应该正确设置错误信息', () => {
      const error = new DigitalTwinError('Snapshot not found', 'SNAPSHOT_NOT_FOUND');

      expect(error.message).toBe('Snapshot not found');
      expect(error.code).toBe('SNAPSHOT_NOT_FOUND');
      expect(error.name).toBe('DigitalTwinError');
    });
  });
});