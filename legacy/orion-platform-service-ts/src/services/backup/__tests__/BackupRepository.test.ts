/**
 * BackupRepository 测试
 *
 * 测试 PostgreSQL Repository 的备份任务 CRUD 操作。
 * Mock DatabasePool 模拟数据库交互。
 */

import { BackupRepository, BackupJobRecord, BackupRestoreRecord } from '../BackupRepository';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const jobs = new Map<string, BackupJobRecord>();
  const restores = new Map<string, BackupRestoreRecord>();

  return {
    jobs,
    restores,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      const upper = text.toUpperCase();

      // INSERT backup_jobs
      if (upper.includes('INSERT INTO BACKUP_JOBS')) {
        const row: BackupJobRecord = {
          id: params?.[0],
          tenant_id: params?.[1],
          config_id: params?.[2],
          status: 'running',
          started_at: new Date(),
          completed_at: null,
          size_bytes: 0,
          storage_path: params?.[3] || null,
          error_message: null,
        };
        jobs.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // INSERT backup_restores
      if (upper.includes('INSERT INTO BACKUP_RESTORES')) {
        const row: BackupRestoreRecord = {
          id: params?.[0],
          tenant_id: params?.[1],
          backup_job_id: params?.[2],
          status: 'running',
          requested_by: params?.[3] || null,
          started_at: new Date(),
          completed_at: null,
          error_message: null,
          created_at: new Date(),
        };
        restores.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // UPDATE backup_jobs SET status = 'completed'
      if (upper.includes("UPDATE BACKUP_JOBS SET STATUS = 'COMPLETED'")) {
        const sizeBytes = params?.[0];
        const id = params?.[1];
        const row = jobs.get(id);
        if (row) {
          row.status = 'completed';
          row.size_bytes = sizeBytes;
          row.completed_at = new Date();
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // UPDATE backup_jobs SET status = 'failed'
      if (upper.includes("UPDATE BACKUP_JOBS SET STATUS = 'FAILED'")) {
        const errorMessage = params?.[0];
        const id = params?.[1];
        const row = jobs.get(id);
        if (row) {
          row.status = 'failed';
          row.error_message = errorMessage;
          row.completed_at = new Date();
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // UPDATE backup_restores SET status = 'completed'
      if (upper.includes("UPDATE BACKUP_RESTORES SET STATUS = 'COMPLETED'")) {
        const id = params?.[0];
        const row = restores.get(id);
        if (row) {
          row.status = 'completed';
          row.completed_at = new Date();
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // UPDATE backup_restores SET status = 'failed'
      if (upper.includes("UPDATE BACKUP_RESTORES SET STATUS = 'FAILED'")) {
        const errorMessage = params?.[0];
        const id = params?.[1];
        const row = restores.get(id);
        if (row) {
          row.status = 'failed';
          row.error_message = errorMessage;
          row.completed_at = new Date();
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // DELETE backup_jobs
      if (upper.includes('DELETE FROM BACKUP_JOBS WHERE ID')) {
        const id = params?.[0];
        const existed = jobs.has(id);
        jobs.delete(id);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }

      // SELECT backup_jobs WHERE config_id
      if (upper.includes('WHERE CONFIG_ID = $1')) {
        const configId = params?.[0];
        const results = Array.from(jobs.values())
          .filter(r => r.config_id === configId)
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT backup_jobs WHERE tenant_id
      if (upper.includes('WHERE TENANT_ID = $1') && upper.includes('BACKUP_JOBS')) {
        const tenantId = params?.[0];
        const results = Array.from(jobs.values())
          .filter(r => r.tenant_id === tenantId)
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT backup_restores WHERE tenant_id
      if (upper.includes('WHERE TENANT_ID = $1') && upper.includes('BACKUP_RESTORES')) {
        const tenantId = params?.[0];
        const results = Array.from(restores.values())
          .filter(r => r.tenant_id === tenantId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT backup_jobs WHERE id = $1
      if (upper.includes('SELECT * FROM BACKUP_JOBS WHERE ID = $1')) {
        const id = params?.[0];
        const row = jobs.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT backup_restores WHERE id = $1
      if (upper.includes('SELECT * FROM BACKUP_RESTORES WHERE ID = $1')) {
        const id = params?.[0];
        const row = restores.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT all backup_jobs
      if (upper.includes('SELECT * FROM BACKUP_JOBS ORDER BY')) {
        const results = Array.from(jobs.values())
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('BackupRepository', () => {
  let repo: BackupRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new BackupRepository(mockDb as any);
  });

  // ---- createJob ----

  describe('createJob', () => {
    it('should create a backup job with required fields', async () => {
      const result = await repo.createJob('tenant-1', 'config-1');

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.config_id).toBe('config-1');
      expect(result.status).toBe('running');
      expect(result.storage_path).toBeNull();
    });

    it('should create a backup job with storage path', async () => {
      const result = await repo.createJob('tenant-1', 'config-1', '/backups/backup-1.tar.gz');

      expect(result.storage_path).toBe('/backups/backup-1.tar.gz');
    });

    it('should create a backup job with null config_id', async () => {
      const result = await repo.createJob('tenant-1', null);

      expect(result.config_id).toBeNull();
    });
  });

  // ---- findJobById ----

  describe('findJobById', () => {
    it('should find job by id', async () => {
      const created = await repo.createJob('tenant-1', 'config-1');
      const found = await repo.findJobById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findJobById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ---- findAllJobs ----

  describe('findAllJobs', () => {
    it('should return all jobs sorted by started_at DESC', async () => {
      await repo.createJob('tenant-1', 'config-1');
      await repo.createJob('tenant-2', 'config-2');

      const results = await repo.findAllJobs();
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no jobs exist', async () => {
      const results = await repo.findAllJobs();
      expect(results).toHaveLength(0);
    });
  });

  // ---- findJobsByTenant ----

  describe('findJobsByTenant', () => {
    it('should find jobs by tenant id', async () => {
      await repo.createJob('tenant-1', 'config-1');
      await repo.createJob('tenant-1', 'config-2');
      await repo.createJob('tenant-2', 'config-3');

      const results = await repo.findJobsByTenant('tenant-1');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.tenant_id === 'tenant-1')).toBe(true);
    });

    it('should return empty array for non-existent tenant', async () => {
      const results = await repo.findJobsByTenant('non-existent');
      expect(results).toHaveLength(0);
    });
  });

  // ---- findJobsByConfig ----

  describe('findJobsByConfig', () => {
    it('should find jobs by config id', async () => {
      await repo.createJob('tenant-1', 'config-1');
      await repo.createJob('tenant-1', 'config-1');
      await repo.createJob('tenant-1', 'config-2');

      const results = await repo.findJobsByConfig('config-1');
      expect(results).toHaveLength(2);
    });
  });

  // ---- completeJob ----

  describe('completeJob', () => {
    it('should complete a running job', async () => {
      const created = await repo.createJob('tenant-1', 'config-1');
      const completed = await repo.completeJob(created.id, 1024 * 1024);

      expect(completed).toBeDefined();
      expect(completed!.status).toBe('completed');
      expect(completed!.size_bytes).toBe(1024 * 1024);
      expect(completed!.completed_at).toBeDefined();
    });

    it('should return null for non-existent job', async () => {
      const result = await repo.completeJob('non-existent', 0);
      expect(result).toBeNull();
    });
  });

  // ---- failJob ----

  describe('failJob', () => {
    it('should fail a running job with error message', async () => {
      const created = await repo.createJob('tenant-1', 'config-1');
      const failed = await repo.failJob(created.id, 'Disk full');

      expect(failed).toBeDefined();
      expect(failed!.status).toBe('failed');
      expect(failed!.error_message).toBe('Disk full');
      expect(failed!.completed_at).toBeDefined();
    });
  });

  // ---- deleteJob ----

  describe('deleteJob', () => {
    it('should delete job by id', async () => {
      const created = await repo.createJob('tenant-1', 'config-1');
      const deleted = await repo.deleteJob(created.id);

      expect(deleted).toBe(true);

      const found = await repo.findJobById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent job', async () => {
      const deleted = await repo.deleteJob('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ---- createRestore ----

  describe('createRestore', () => {
    it('should create a restore record', async () => {
      const result = await repo.createRestore('tenant-1', 'job-1', 'user-1');

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.backup_job_id).toBe('job-1');
      expect(result.requested_by).toBe('user-1');
      expect(result.status).toBe('running');
    });

    it('should create restore without requested_by', async () => {
      const result = await repo.createRestore('tenant-1', 'job-1');

      expect(result.requested_by).toBeNull();
    });
  });

  // ---- findRestoreById ----

  describe('findRestoreById', () => {
    it('should find restore by id', async () => {
      const created = await repo.createRestore('tenant-1', 'job-1');
      const found = await repo.findRestoreById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findRestoreById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ---- findRestoresByTenant ----

  describe('findRestoresByTenant', () => {
    it('should find restores by tenant id', async () => {
      await repo.createRestore('tenant-1', 'job-1');
      await repo.createRestore('tenant-1', 'job-2');
      await repo.createRestore('tenant-2', 'job-3');

      const results = await repo.findRestoresByTenant('tenant-1');
      expect(results).toHaveLength(2);
    });
  });

  // ---- completeRestore ----

  describe('completeRestore', () => {
    it('should complete a running restore', async () => {
      const created = await repo.createRestore('tenant-1', 'job-1');
      const completed = await repo.completeRestore(created.id);

      expect(completed).toBeDefined();
      expect(completed!.status).toBe('completed');
      expect(completed!.completed_at).toBeDefined();
    });
  });

  // ---- failRestore ----

  describe('failRestore', () => {
    it('should fail a running restore with error message', async () => {
      const created = await repo.createRestore('tenant-1', 'job-1');
      const failed = await repo.failRestore(created.id, 'Backup corrupted');

      expect(failed).toBeDefined();
      expect(failed!.status).toBe('failed');
      expect(failed!.error_message).toBe('Backup corrupted');
    });
  });
});
