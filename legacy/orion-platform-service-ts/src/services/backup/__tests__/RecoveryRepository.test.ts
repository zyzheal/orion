/**
 * RecoveryRepository 测试
 *
 * 测试 PostgreSQL Repository 的恢复执行记录 CRUD 操作。
 * Mock DatabasePool 模拟数据库交互。
 */

import { RecoveryRepository, RecoveryExecutionRecord } from '../RecoveryRepository';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const store = new Map<string, RecoveryExecutionRecord>();

  return {
    store,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      const upper = text.toUpperCase();

      // INSERT
      if (upper.includes('INSERT INTO BACKUP_RESTORES')) {
        const row: RecoveryExecutionRecord = {
          id: params?.[0],
          tenant_id: params?.[1],
          backup_job_id: params?.[2],
          status: params?.[3],
          requested_by: params?.[4],
          started_at: params?.[5],
          completed_at: null,
          error_message: null,
          created_at: new Date(),
        };
        store.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // UPDATE with error message
      if (upper.includes('UPDATE BACKUP_RESTORES SET STATUS = $1, ERROR_MESSAGE = $2')) {
        const status = params?.[0];
        const errorMessage = params?.[1];
        const id = params?.[2];
        const row = store.get(id);
        if (row) {
          row.status = status;
          row.error_message = errorMessage;
          row.completed_at = new Date();
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // UPDATE with completed_at (status = completed or failed)
      if (upper.includes('UPDATE BACKUP_RESTORES SET STATUS = $1, COMPLETED_AT')) {
        const status = params?.[0];
        const id = params?.[1];
        const row = store.get(id);
        if (row) {
          row.status = status;
          row.completed_at = new Date();
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // UPDATE status only
      if (upper.includes('UPDATE BACKUP_RESTORES SET STATUS = $1 WHERE ID = $2')) {
        const status = params?.[0];
        const id = params?.[1];
        const row = store.get(id);
        if (row) {
          row.status = status;
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // DELETE by id
      if (upper.includes('DELETE FROM BACKUP_RESTORES WHERE ID')) {
        const id = params?.[0];
        const existed = store.has(id);
        store.delete(id);
        return { rows: [], rowCount: existed ? 1 : 0 };
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
      if (upper.includes('SELECT * FROM BACKUP_RESTORES WHERE ID = $1')) {
        const id = params?.[0];
        const row = store.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT all
      if (upper.includes('SELECT * FROM BACKUP_RESTORES ORDER BY')) {
        const results = Array.from(store.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('RecoveryRepository', () => {
  let repo: RecoveryRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new RecoveryRepository(mockDb as any);
  });

  // ---- create ----

  describe('create', () => {
    it('should create a recovery execution record', async () => {
      const input = {
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: 'user-1',
        started_at: new Date(),
      };

      const result = await repo.create(input);

      expect(result.id).toBe('restore-1');
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.backup_job_id).toBe('job-1');
      expect(result.status).toBe('running');
      expect(result.requested_by).toBe('user-1');
      expect(result.created_at).toBeDefined();
    });

    it('should create record with null requested_by', async () => {
      const input = {
        id: 'restore-2',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      };

      const result = await repo.create(input);
      expect(result.requested_by).toBeNull();
    });
  });

  // ---- findById ----

  describe('findById', () => {
    it('should find record by id', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const found = await repo.findById('restore-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('restore-1');
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ---- findAll ----

  describe('findAll', () => {
    it('should return all records when no tenant filter', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });
      await repo.create({
        id: 'restore-2',
        tenant_id: 'tenant-2',
        backup_job_id: 'job-2',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const results = await repo.findAll();
      expect(results).toHaveLength(2);
    });

    it('should filter by tenant id when provided', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });
      await repo.create({
        id: 'restore-2',
        tenant_id: 'tenant-2',
        backup_job_id: 'job-2',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const results = await repo.findAll('tenant-1');
      expect(results).toHaveLength(1);
      expect(results[0].tenant_id).toBe('tenant-1');
    });

    it('should return empty array when no records exist', async () => {
      const results = await repo.findAll();
      expect(results).toHaveLength(0);
    });
  });

  // ---- updateStatus ----

  describe('updateStatus', () => {
    it('should update status with error message', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const updated = await repo.updateStatus('restore-1', 'failed', 'Backup corrupted');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('failed');
      expect(updated!.error_message).toBe('Backup corrupted');
      expect(updated!.completed_at).toBeDefined();
    });

    it('should update status to completed', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const updated = await repo.updateStatus('restore-1', 'completed');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('completed');
      expect(updated!.completed_at).toBeDefined();
    });

    it('should update status to failed without error message', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const updated = await repo.updateStatus('restore-1', 'failed');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('failed');
      expect(updated!.completed_at).toBeDefined();
    });

    it('should update status without setting completed_at for other statuses', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const updated = await repo.updateStatus('restore-1', 'pending');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('pending');
    });

    it('should return null for non-existent id', async () => {
      const result = await repo.updateStatus('non-existent', 'completed');
      expect(result).toBeNull();
    });
  });

  // ---- delete ----

  describe('delete', () => {
    it('should delete record by id', async () => {
      await repo.create({
        id: 'restore-1',
        tenant_id: 'tenant-1',
        backup_job_id: 'job-1',
        status: 'running',
        requested_by: null,
        started_at: new Date(),
      });

      const deleted = await repo.delete('restore-1');
      expect(deleted).toBe(true);

      const found = await repo.findById('restore-1');
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent record', async () => {
      const deleted = await repo.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });
});
