/**
 * BackupPlanRepository 测试
 *
 * 测试 PostgreSQL Repository 的备份计划 CRUD 操作。
 * Mock DatabasePool 模拟数据库交互。
 */

import { BackupPlanRepository, BackupPlanRecord } from '../BackupPlanRepository';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const store = new Map<string, BackupPlanRecord>();

  return {
    store,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      const upper = text.toUpperCase();

      // INSERT
      if (upper.includes('INSERT INTO BACKUP_CONFIGS')) {
        const row: BackupPlanRecord = {
          id: params?.[0],
          tenant_id: params?.[1],
          name: params?.[2],
          type: params?.[3],
          target: JSON.parse(params?.[4] || '{}'),
          schedule: params?.[5],
          retention_days: params?.[6],
          encryption_key: params?.[7],
          storage_config: JSON.parse(params?.[8] || '{}'),
          enabled: params?.[9],
          created_at: new Date(),
          updated_at: new Date(),
        };
        store.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // DELETE by id
      if (upper.includes('DELETE FROM BACKUP_CONFIGS WHERE ID')) {
        const id = params?.[0];
        const existed = store.has(id);
        store.delete(id);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }

      // UPDATE
      if (upper.includes('UPDATE BACKUP_CONFIGS SET')) {
        const id = params?.[params.length - 1];
        const row = store.get(id);
        if (!row) return { rows: [], rowCount: 0 };

        // Parse SET clause to find which fields to update
        const setMatch = text.match(/SET\s+(.+?)\s+WHERE/i);
        if (setMatch) {
          const fields = setMatch[1].split(',').map(f => f.trim());
          let paramIdx = 0;
          for (const field of fields) {
            const colMatch = field.match(/(\w+)\s*=\s*\$\d+/);
            if (colMatch) {
              const col = colMatch[1];
              const val = params?.[paramIdx];
              if (col === 'target' || col === 'storage_config') {
                (row as any)[col] = typeof val === 'string' ? JSON.parse(val) : val;
              } else if (col !== 'updated_at') {
                (row as any)[col] = val;
              }
              paramIdx++;
            }
          }
          row.updated_at = new Date();
        }
        return { rows: [row], rowCount: 1 };
      }

      // SELECT by tenant_id
      if (upper.includes('WHERE TENANT_ID = $1')) {
        const tenantId = params?.[0];
        const results = Array.from(store.values())
          .filter(r => r.tenant_id === tenantId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT by id
      if (upper.includes('SELECT * FROM BACKUP_CONFIGS WHERE ID = $1')) {
        const id = params?.[0];
        const row = store.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT all
      if (upper.includes('SELECT * FROM BACKUP_CONFIGS ORDER BY')) {
        const results = Array.from(store.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('BackupPlanRepository', () => {
  let repo: BackupPlanRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new BackupPlanRepository(mockDb as any);
  });

  // ---- create ----

  describe('create', () => {
    it('should create a backup plan with all fields', async () => {
      const plan = {
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Daily Backup',
        type: 'full',
        target: { path: '/data' },
        schedule: '0 2 * * *',
        retention_days: 30,
        encryption_key: 'key-123',
        storage_config: { bucket: 'backups' },
        enabled: true,
      };

      const result = await repo.create(plan);

      expect(result.id).toBe('plan-1');
      expect(result.name).toBe('Daily Backup');
      expect(result.type).toBe('full');
      expect(result.target).toEqual({ path: '/data' });
      expect(result.schedule).toBe('0 2 * * *');
      expect(result.retention_days).toBe(30);
      expect(result.enabled).toBe(true);
    });

    it('should create plan with null schedule', async () => {
      const plan = {
        id: 'plan-2',
        tenant_id: 'tenant-1',
        name: 'Manual Backup',
        type: 'incremental',
        target: { path: '/data' },
        schedule: null,
        retention_days: 7,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      };

      const result = await repo.create(plan);
      expect(result.schedule).toBeNull();
    });
  });

  // ---- findById ----

  describe('findById', () => {
    it('should find plan by id', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Test Plan',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const found = await repo.findById('plan-1');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Plan');
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ---- findAll ----

  describe('findAll', () => {
    it('should return all plans sorted by created_at DESC', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Plan 1',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });
      await repo.create({
        id: 'plan-2',
        tenant_id: 'tenant-2',
        name: 'Plan 2',
        type: 'incremental',
        target: {},
        schedule: null,
        retention_days: 7,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const results = await repo.findAll();
      expect(results).toHaveLength(2);
    });

    it('should filter by tenant id when provided', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Plan 1',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });
      await repo.create({
        id: 'plan-2',
        tenant_id: 'tenant-2',
        name: 'Plan 2',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 7,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const results = await repo.findAll('tenant-1');
      expect(results).toHaveLength(1);
      expect(results[0].tenant_id).toBe('tenant-1');
    });

    it('should return empty array when no plans exist', async () => {
      const results = await repo.findAll();
      expect(results).toHaveLength(0);
    });
  });

  // ---- update ----

  describe('update', () => {
    it('should update plan fields', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Old Name',
        type: 'full',
        target: { path: '/data' },
        schedule: '0 2 * * *',
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const updated = await repo.update('plan-1', { name: 'New Name', retention_days: 60 });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
      expect(updated!.retention_days).toBe(60);
    });

    it('should return null when updating non-existent plan', async () => {
      const result = await repo.update('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should return existing plan when no fields to update', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Test',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const result = await repo.update('plan-1', {});
      expect(result).toBeDefined();
      expect(result!.name).toBe('Test');
    });

    it('should handle JSON fields (target, storage_config)', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Test',
        type: 'full',
        target: { old: true },
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: { old: true },
        enabled: true,
      });

      const updated = await repo.update('plan-1', {
        target: { new: true },
        storage_config: { bucket: 'new-bucket' },
      });

      expect(updated!.target).toEqual({ new: true });
      expect(updated!.storage_config).toEqual({ bucket: 'new-bucket' });
    });

    it('should skip id field in updates', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Test',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const result = await repo.update('plan-1', { id: 'hacked', name: 'Updated' });
      expect(result!.id).toBe('plan-1');
      expect(result!.name).toBe('Updated');
    });
  });

  // ---- delete ----

  describe('delete', () => {
    it('should delete plan by id', async () => {
      await repo.create({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'To Delete',
        type: 'full',
        target: {},
        schedule: null,
        retention_days: 30,
        encryption_key: null,
        storage_config: {},
        enabled: true,
      });

      const deleted = await repo.delete('plan-1');
      expect(deleted).toBe(true);

      const found = await repo.findById('plan-1');
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent plan', async () => {
      const deleted = await repo.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });
});
