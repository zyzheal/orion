/**
 * ConfigVersionService 测试
 *
 * 测试配置版本管理服务：变更记录、历史查询、回滚、快照、差异比较。
 * Mock ConfigVersionRepository 模拟数据库交互。
 */

import { ConfigVersionService } from '../ConfigVersionService';
import { ConfigVersionRepository, type ConfigVersionEntity, type ConfigSnapshotEntity } from '../../repositories/ConfigVersionRepository';

// ==================== Mock Repository ====================

function createMockRepo() {
  const versions = new Map<string, ConfigVersionEntity>();
  const snapshots = new Map<string, ConfigSnapshotEntity>();

  const mockRepo = {
    versions,
    snapshots,

    getMaxVersion: jest.fn(async (domain: string, key: string): Promise<number> => {
      let max = 0;
      for (const v of versions.values()) {
        if (v.domain === domain && v.key === key) {
          max = Math.max(max, v.version);
        }
      }
      return max;
    }),

    insertVersion: jest.fn(async (entity: ConfigVersionEntity): Promise<void> => {
      versions.set(entity.id, { ...entity });
    }),

    findVersions: jest.fn(async (params: { domain?: string; key?: string; limit?: number } = {}): Promise<ConfigVersionEntity[]> => {
      let results = Array.from(versions.values());
      if (params.domain) {
        results = results.filter(v => v.domain === params.domain);
      }
      if (params.key) {
        results = results.filter(v => v.key === params.key);
      }
      results.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
      const limit = params.limit ?? 50;
      return results.slice(0, limit);
    }),

    findVersionById: jest.fn(async (id: string): Promise<ConfigVersionEntity | undefined> => {
      return versions.get(id);
    }),

    findSnapshotById: jest.fn(async (id: string): Promise<ConfigSnapshotEntity | undefined> => {
      return snapshots.get(id);
    }),

    findSnapshots: jest.fn(async (params: { limit?: number } = {}): Promise<ConfigSnapshotEntity[]> => {
      const results = Array.from(snapshots.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const limit = params.limit ?? 20;
      return results.slice(0, limit);
    }),

    insertSnapshot: jest.fn(async (entity: ConfigSnapshotEntity): Promise<void> => {
      snapshots.set(entity.id, { ...entity });
    }),
  };

  return mockRepo;
}

// ==================== Tests ====================

describe('ConfigVersionService', () => {
  let service: ConfigVersionService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new ConfigVersionService(mockRepo as unknown as ConfigVersionRepository);
  });

  // ---- recordChange ----

  describe('recordChange', () => {
    it('should record a config change', async () => {
      const result = await service.recordChange(
        'pipeline',
        'max-retries',
        3,
        5,
        'admin',
        'update',
        'Increased retries'
      );

      expect(result.id).toBeDefined();
      expect(result.domain).toBe('pipeline');
      expect(result.key).toBe('max-retries');
      expect(result.oldValue).toBe(3);
      expect(result.newValue).toBe(5);
      expect(result.changedBy).toBe('admin');
      expect(result.changeType).toBe('update');
      expect(result.version).toBe(1);
      expect(result.comment).toBe('Increased retries');
      expect(result.checksum).toBeDefined();
    });

    it('should increment version for same domain/key', async () => {
      await service.recordChange('pipeline', 'timeout', 100, 200, 'user1', 'update');
      const v2 = await service.recordChange('pipeline', 'timeout', 200, 300, 'user2', 'update');

      expect(v2.version).toBe(2);
    });

    it('should record create change type', async () => {
      const result = await service.recordChange(
        'deploy',
        'new-key',
        null,
        'initial-value',
        'admin',
        'create'
      );

      expect(result.changeType).toBe('create');
      expect(result.version).toBe(1);
    });

    it('should record delete change type', async () => {
      await service.recordChange('deploy', 'old-key', 'value', null, 'admin', 'delete');

      const history = await service.getHistory('deploy', 'old-key');
      expect(history[0].changeType).toBe('delete');
    });
  });

  // ---- getHistory ----

  describe('getHistory', () => {
    it('should return history for domain and key', async () => {
      await service.recordChange('pipeline', 'timeout', 100, 200, 'user1', 'update');
      await service.recordChange('pipeline', 'timeout', 200, 300, 'user2', 'update');

      const history = await service.getHistory('pipeline', 'timeout');

      expect(history).toHaveLength(2);
    });

    it('should return history for domain only', async () => {
      await service.recordChange('pipeline', 'key1', null, 'v1', 'user1', 'create');
      await service.recordChange('pipeline', 'key2', null, 'v2', 'user1', 'create');

      const history = await service.getHistory('pipeline');

      expect(history).toHaveLength(2);
    });

    it('should return all history when no filters', async () => {
      await service.recordChange('pipeline', 'key1', null, 'v1', 'user1', 'create');
      await service.recordChange('deploy', 'key2', null, 'v2', 'user1', 'create');

      const history = await service.getHistory();

      expect(history).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await service.recordChange('pipeline', 'key', i, i + 1, 'user', 'update');
      }

      const history = await service.getHistory('pipeline', 'key', 5);

      expect(history).toHaveLength(5);
    });
  });

  // ---- rollback ----

  describe('rollback', () => {
    it('should rollback to target version', async () => {
      await service.recordChange('pipeline', 'timeout', 100, 200, 'user1', 'update');
      await service.recordChange('pipeline', 'timeout', 200, 300, 'user2', 'update');
      await service.recordChange('pipeline', 'timeout', 300, 400, 'user3', 'update');

      const rollback = await service.rollback('pipeline', 'timeout', 1, 'admin', 'Too high');

      expect(rollback).toBeDefined();
      expect(rollback.changeType).toBe('update');
      expect(rollback.changedBy).toBe('admin');
    });

    it('should throw when version not found', async () => {
      await service.recordChange('pipeline', 'timeout', 100, 200, 'user1', 'update');

      await expect(
        service.rollback('pipeline', 'timeout', 999, 'admin')
      ).rejects.toThrow('Version 999 not found for pipeline.timeout');
    });
  });

  // ---- createSnapshot ----

  describe('createSnapshot', () => {
    it('should create a config snapshot', async () => {
      const configData = {
        pipeline: { timeout: 300, retries: 3 },
        deploy: { strategy: 'rolling' },
      };

      const snapshot = await service.createSnapshot(
        'pre-release-v1',
        configData,
        'admin',
        'Before v1.0 release'
      );

      expect(snapshot.id).toBeDefined();
      expect(snapshot.snapshotName).toBe('pre-release-v1');
      expect(snapshot.createdBy).toBe('admin');
      expect(snapshot.configData).toEqual(configData);
      expect(snapshot.checksum).toBeDefined();
      expect(snapshot.description).toBe('Before v1.0 release');
    });

    it('should create snapshot without description', async () => {
      const snapshot = await service.createSnapshot(
        'backup',
        { key: 'value' },
        'system'
      );

      expect(snapshot.description).toBeUndefined();
    });
  });

  // ---- restoreSnapshot ----

  describe('restoreSnapshot', () => {
    it('should restore snapshot by id', async () => {
      const created = await service.createSnapshot(
        'test-snap',
        { key: 'value' },
        'admin'
      );

      const restored = await service.restoreSnapshot(created.id, 'admin');

      expect(restored).toBeDefined();
      expect(restored.snapshotName).toBe('test-snap');
    });

    it('should throw when snapshot not found', async () => {
      await expect(
        service.restoreSnapshot('non-existent', 'admin')
      ).rejects.toThrow('Snapshot non-existent not found');
    });
  });

  // ---- listSnapshots ----

  describe('listSnapshots', () => {
    it('should list snapshots sorted by created_at DESC', async () => {
      await service.createSnapshot('snap-1', { a: 1 }, 'user1');
      await service.createSnapshot('snap-2', { b: 2 }, 'user2');

      const snapshots = await service.listSnapshots();

      expect(snapshots).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createSnapshot(`snap-${i}`, { i }, 'user');
      }

      const snapshots = await service.listSnapshots(3);

      expect(snapshots).toHaveLength(3);
    });

    it('should return empty array when no snapshots', async () => {
      const snapshots = await service.listSnapshots();
      expect(snapshots).toHaveLength(0);
    });
  });

  // ---- diff ----

  describe('diff', () => {
    it('should detect added keys', async () => {
      const v1 = await service.recordChange('pipeline', 'config', { a: 1 }, { a: 1, b: 2 }, 'user', 'update');
      const v2 = await service.recordChange('pipeline', 'config', { a: 1, b: 2 }, { a: 1, b: 2, c: 3 }, 'user', 'update');

      const result = await service.diff(v1.id, v2.id);

      expect(result.added).toContain('c');
    });

    it('should detect removed keys', async () => {
      const v1 = await service.recordChange('pipeline', 'config', { a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, 'user', 'update');
      const v2 = await service.recordChange('pipeline', 'config', { a: 1, b: 2 }, { a: 1 }, 'user', 'update');

      const result = await service.diff(v1.id, v2.id);

      expect(result.removed).toContain('b');
    });

    it('should detect changed keys', async () => {
      const v1 = await service.recordChange('pipeline', 'config', { a: 1 }, { a: 1, b: 'old' }, 'user', 'update');
      const v2 = await service.recordChange('pipeline', 'config', { a: 1, b: 'old' }, { a: 1, b: 'new' }, 'user', 'update');

      const result = await service.diff(v1.id, v2.id);

      expect(result.changed).toContainEqual({ key: 'b', old: 'old', new: 'new' });
    });

    it('should throw when version not found', async () => {
      await expect(
        service.diff('non-existent-1', 'non-existent-2')
      ).rejects.toThrow('Version not found');
    });
  });
});
