/**
 * ConfigVersionService 测试
 *
 * 测试配置版本管理服务：变更记录、历史查询、回滚、快照、差异比较。
 * Mock DatabasePool 模拟数据库交互。
 */

import { ConfigVersionService, ConfigVersion, ConfigSnapshot } from '../ConfigVersionService';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const versions = new Map<string, ConfigVersion>();
  const snapshots = new Map<string, ConfigSnapshot>();
  let versionCounter = 0;

  return {
    versions,
    snapshots,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      const upper = text.toUpperCase();

      // INSERT config_versions
      if (upper.includes('INSERT INTO CONFIG_VERSIONS')) {
        const row: ConfigVersion = {
          id: params?.[0],
          domain: params?.[1],
          key: params?.[2],
          oldValue: JSON.parse(params?.[3] || '{}'),
          newValue: JSON.parse(params?.[4] || '{}'),
          changedBy: params?.[5],
          changedAt: params?.[10] || new Date(),
          changeType: params?.[6],
          version: params?.[7],
          comment: params?.[8],
          checksum: params?.[9],
        };
        versions.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // INSERT config_snapshots
      if (upper.includes('INSERT INTO CONFIG_SNAPSHOTS')) {
        const row: ConfigSnapshot = {
          id: params?.[0],
          snapshotName: params?.[1],
          createdBy: params?.[2],
          createdAt: params?.[6] || new Date(),
          configData: JSON.parse(params?.[3] || '{}'),
          checksum: params?.[4],
          description: params?.[5],
        };
        snapshots.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // SELECT MAX(version)
      if (upper.includes('SELECT MAX(VERSION)')) {
        const domain = params?.[0];
        const key = params?.[1];
        let maxVersion = 0;
        for (const v of versions.values()) {
          if (v.domain === domain && v.key === key) {
            maxVersion = Math.max(maxVersion, v.version);
          }
        }
        return { rows: [{ max_version: maxVersion }], rowCount: 1 };
      }

      // SELECT config_versions with WHERE
      if (upper.includes('SELECT * FROM CONFIG_VERSIONS') && upper.includes('WHERE')) {
        // Check if it's a SELECT by id (raw DB format for diff method)
        if (upper.includes('WHERE ID = $1')) {
          const id = params?.[0];
          const row = versions.get(id);
          if (!row) return { rows: [], rowCount: 0 };
          // Return raw DB row format (snake_case) for diff method
          // new_value/old_value as objects (simulating PostgreSQL JSONB)
          const rawRow = {
            id: row.id,
            domain: row.domain,
            key: row.key,
            old_value: row.oldValue,
            new_value: row.newValue,
            changed_by: row.changedBy,
            changed_at: row.changedAt,
            change_type: row.changeType,
            version: row.version,
            comment: row.comment,
            checksum: row.checksum,
          };
          return { rows: [rawRow], rowCount: 1 };
        }

        // SELECT with domain/key filters
        let results = Array.from(versions.values());
        const conditions = text.match(/WHERE\s+(.+?)\s+ORDER/i)?.[1] || '';
        let paramIdx = 0;

        if (conditions.includes('domain')) {
          const domain = params?.[paramIdx++];
          results = results.filter(v => v.domain === domain);
        }
        if (conditions.includes('key =')) {
          const key = params?.[paramIdx++];
          results = results.filter(v => v.key === key);
        }

        results.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
        const limit = params?.[paramIdx] || 50;
        results = results.slice(0, limit);

        const rawResults = results.map(row => ({
          id: row.id,
          domain: row.domain,
          key: row.key,
          old_value: JSON.stringify(row.oldValue),
          new_value: JSON.stringify(row.newValue),
          changed_by: row.changedBy,
          changed_at: row.changedAt,
          change_type: row.changeType,
          version: row.version,
          comment: row.comment,
          checksum: row.checksum,
        }));
        return { rows: rawResults, rowCount: rawResults.length };
      }

      // SELECT config_versions ORDER BY
      if (upper.includes('SELECT * FROM CONFIG_VERSIONS ORDER BY')) {
        const results = Array.from(versions.values())
          .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
        const limit = params?.[0] || 50;
        const rawResults = results.slice(0, limit).map(row => ({
          id: row.id,
          domain: row.domain,
          key: row.key,
          old_value: JSON.stringify(row.oldValue),
          new_value: JSON.stringify(row.newValue),
          changed_by: row.changedBy,
          changed_at: row.changedAt,
          change_type: row.changeType,
          version: row.version,
          comment: row.comment,
          checksum: row.checksum,
        }));
        return { rows: rawResults, rowCount: rawResults.length };
      }

      // SELECT config_snapshots WHERE id
      if (upper.includes('SELECT * FROM CONFIG_SNAPSHOTS WHERE ID')) {
        const id = params?.[0];
        const row = snapshots.get(id);
        if (!row) return { rows: [], rowCount: 0 };
        // Return raw DB row format (snake_case) for mapRowToSnapshot
        const rawRow = {
          id: row.id,
          snapshot_name: row.snapshotName,
          created_by: row.createdBy,
          created_at: row.createdAt,
          config_data: JSON.stringify(row.configData),
          checksum: row.checksum,
          description: row.description,
        };
        return { rows: [rawRow], rowCount: 1 };
      }

      // SELECT config_snapshots ORDER BY
      if (upper.includes('SELECT * FROM CONFIG_SNAPSHOTS ORDER BY')) {
        const results = Array.from(snapshots.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const limit = params?.[0] || 20;
        const rawResults = results.slice(0, limit).map(row => ({
          id: row.id,
          snapshot_name: row.snapshotName,
          created_by: row.createdBy,
          created_at: row.createdAt,
          config_data: JSON.stringify(row.configData),
          checksum: row.checksum,
          description: row.description,
        }));
        return { rows: rawResults, rowCount: rawResults.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('ConfigVersionService', () => {
  let service: ConfigVersionService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new ConfigVersionService(mockDb as any);
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
      ).rejects.toThrow('Version 999 not found');
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
