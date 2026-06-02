/**
 * ArtifactRepository 测试
 *
 * 测试 PostgreSQL Repository 的 CRUD 操作、查询、过期清理等。
 * 使用 mock DatabasePool 模拟数据库交互。
 */

import { ArtifactRepository, ArtifactRecord, CreateArtifactInput } from '../ArtifactRepository';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const store = new Map<string, any>();
  let idCounter = 0;

  return {
    store,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      // CREATE
      if (text.includes('INSERT INTO artifacts')) {
        const id = `artifact-${++idCounter}`;
        const row = {
          id,
          tenant_id: params?.[0] || '00000000-0000-0000-0000-000000000000',
          name: params?.[1],
          type: params?.[2],
          storage_type: params?.[3] || 'local',
          storage_path: params?.[4],
          size_bytes: params?.[5] || 0,
          checksum_sha256: params?.[6] || null,
          run_id: params?.[7],
          stage_id: params?.[8] || null,
          expires_at: params?.[9] || null,
          downloaded_count: 0,
          metadata: params?.[10] || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.set(id, row);
        return { rows: [row], rowCount: 1 };
      }

      // DELETE expired
      if (text.includes('DELETE FROM artifacts') && text.includes('expires_at')) {
        let deleted = 0;
        const now = new Date();
        for (const [id, row] of store) {
          if (row.expires_at && new Date(row.expires_at) < now) {
            store.delete(id);
            deleted++;
          }
        }
        return { rows: [], rowCount: deleted };
      }

      // DELETE by id
      if (text.includes('DELETE FROM artifacts WHERE id')) {
        const id = params?.[0];
        const existed = store.has(id);
        store.delete(id);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }

      // UPDATE download count
      if (text.includes('downloaded_count = downloaded_count + 1')) {
        const id = params?.[0];
        const row = store.get(id);
        if (row) {
          row.downloaded_count = (row.downloaded_count || 0) + 1;
          row.updated_at = new Date().toISOString();
        }
        return { rows: [], rowCount: 1 };
      }

      // SELECT by run_id
      if (text.includes('WHERE run_id = $1')) {
        const runId = params?.[0];
        const results = Array.from(store.values())
          .filter(r => r.run_id === runId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT by stage_id
      if (text.includes('WHERE stage_id = $1')) {
        const stageId = params?.[0];
        const results = Array.from(store.values())
          .filter(r => r.stage_id === stageId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT by taskId in metadata
      if (text.includes("metadata->>'taskId' = $1")) {
        const taskId = params?.[0];
        const results = Array.from(store.values())
          .filter(r => r.metadata?.taskId === taskId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT expired
      if (text.includes('expires_at IS NOT NULL') && text.includes('expires_at < NOW()')) {
        const now = new Date();
        const results = Array.from(store.values())
          .filter(r => r.expires_at && new Date(r.expires_at) < now)
          .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // SELECT by id
      if (text.includes('WHERE id = $1') && text.includes('SELECT *')) {
        const id = params?.[0];
        const row = store.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT with filters (findByOptions)
      if (text.includes('SELECT * FROM artifacts WHERE 1=1')) {
        let results = Array.from(store.values());
        const allParams = params || [];

        // Rebuild param mapping by scanning query for param placeholders
        // The actual query from findByOptions builds params in order: runId, stageId, taskId, type, limit, offset
        let paramIdx = 0;
        const runIdMatch = text.match(/run_id = \$(\d+)/);
        const stageIdMatch = text.match(/stage_id = \$(\d+)/);
        const taskIdMatch = text.match(/metadata->>'taskId' = \$(\d+)/);
        const typeMatch = text.match(/type = \$(\d+)/);

        // Build a map of param position -> filter
        const filters: Array<{ idx: number; fn: (r: any) => boolean }> = [];
        if (runIdMatch) filters.push({ idx: parseInt(runIdMatch[1]) - 1, fn: r => r.run_id === allParams[parseInt(runIdMatch[1]) - 1] });
        if (stageIdMatch) filters.push({ idx: parseInt(stageIdMatch[1]) - 1, fn: r => r.stage_id === allParams[parseInt(stageIdMatch[1]) - 1] });
        if (taskIdMatch) filters.push({ idx: parseInt(taskIdMatch[1]) - 1, fn: r => r.metadata?.taskId === allParams[parseInt(taskIdMatch[1]) - 1] });
        if (typeMatch) filters.push({ idx: parseInt(typeMatch[1]) - 1, fn: r => r.type === allParams[parseInt(typeMatch[1]) - 1] });

        // Apply all filters
        for (const filter of filters) {
          results = results.filter(filter.fn);
        }

        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const limit = allParams[allParams.length - 2] || 100;
        const offset = allParams[allParams.length - 1] || 0;
        results = results.slice(offset, offset + limit);

        return { rows: results, rowCount: results.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('ArtifactRepository', () => {
  let repo: ArtifactRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new ArtifactRepository(mockDb as any);
  });

  // ---- createArtifact ----

  describe('createArtifact', () => {
    it('should create artifact with required fields', async () => {
      const input: CreateArtifactInput = {
        name: 'test-binary',
        type: 'binary',
        storage_path: '/artifacts/test-binary.tar.gz',
        run_id: 'run-123',
      };

      const result = await repo.createArtifact(input);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('test-binary');
      expect(result.type).toBe('binary');
      expect(result.run_id).toBe('run-123');
      expect(result.storage_type).toBe('local');
      expect(result.size_bytes).toBe(0);
      expect(result.downloaded_count).toBe(0);
    });

    it('should create artifact with all optional fields', async () => {
      const expiresAt = new Date('2026-12-31');
      const input: CreateArtifactInput = {
        tenant_id: 'tenant-1',
        name: 'docker-image',
        type: 'docker_image',
        storage_type: 'registry',
        storage_path: 'registry.example.com/app:v1',
        size_bytes: 1024 * 1024,
        checksum_sha256: 'sha256:abc123',
        run_id: 'run-456',
        stage_id: 'stage-build',
        expires_at: expiresAt,
        metadata: { buildArg: 'value' },
      };

      const result = await repo.createArtifact(input);

      expect(result.tenant_id).toBe('tenant-1');
      expect(result.storage_type).toBe('registry');
      expect(result.size_bytes).toBe(1024 * 1024);
      expect(result.checksum_sha256).toBe('sha256:abc123');
      expect(result.stage_id).toBe('stage-build');
      expect(result.metadata).toEqual({ buildArg: 'value' });
    });
  });

  // ---- findById ----

  describe('findById', () => {
    it('should find artifact by id', async () => {
      const created = await repo.createArtifact({
        name: 'findable',
        type: 'binary',
        storage_path: '/path',
        run_id: 'run-1',
      });

      const found = await repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('findable');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ---- findByRunId ----

  describe('findByRunId', () => {
    it('should find artifacts by run ID', async () => {
      await repo.createArtifact({
        name: 'artifact-1',
        type: 'binary',
        storage_path: '/path1',
        run_id: 'run-abc',
      });
      await repo.createArtifact({
        name: 'artifact-2',
        type: 'log',
        storage_path: '/path2',
        run_id: 'run-abc',
      });
      await repo.createArtifact({
        name: 'artifact-3',
        type: 'binary',
        storage_path: '/path3',
        run_id: 'run-xyz',
      });

      const results = await repo.findByRunId('run-abc');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.run_id === 'run-abc')).toBe(true);
    });

    it('should return empty array for non-existent run', async () => {
      const results = await repo.findByRunId('non-existent-run');
      expect(results).toHaveLength(0);
    });
  });

  // ---- findByStageId ----

  describe('findByStageId', () => {
    it('should find artifacts by stage ID', async () => {
      await repo.createArtifact({
        name: 'stage-artifact',
        type: 'binary',
        storage_path: '/path',
        run_id: 'run-1',
        stage_id: 'stage-build',
      });

      const results = await repo.findByStageId('stage-build');

      expect(results).toHaveLength(1);
      expect(results[0].stage_id).toBe('stage-build');
    });
  });

  // ---- findByTaskId ----

  describe('findByTaskId', () => {
    it('should find artifacts by task ID in metadata', async () => {
      await repo.createArtifact({
        name: 'task-artifact',
        type: 'binary',
        storage_path: '/path',
        run_id: 'run-1',
        metadata: { taskId: 'task-42' },
      });

      const results = await repo.findByTaskId('task-42');

      expect(results).toHaveLength(1);
      expect(results[0].metadata.taskId).toBe('task-42');
    });
  });

  // ---- findByOptions ----

  describe('findByOptions', () => {
    it('should find artifacts with combined filters', async () => {
      await repo.createArtifact({
        name: 'opt-artifact',
        type: 'binary',
        storage_path: '/path',
        run_id: 'run-1',
        stage_id: 'stage-1',
      });

      const results = await repo.findByOptions({ runId: 'run-1', type: 'binary' });

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.createArtifact({
          name: `artifact-${i}`,
          type: 'binary',
          storage_path: `/path-${i}`,
          run_id: 'run-many',
        });
      }

      const page1 = await repo.findByOptions({ runId: 'run-many', limit: 2, offset: 0 });
      const page2 = await repo.findByOptions({ runId: 'run-many', limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  // ---- findExpired ----

  describe('findExpired', () => {
    it('should find expired artifacts', async () => {
      // Create an expired artifact by directly inserting into store
      mockDb.store.set('expired-1', {
        id: 'expired-1',
        tenant_id: '00000000-0000-0000-0000-000000000000',
        name: 'expired',
        type: 'binary',
        storage_type: 'local',
        storage_path: '/path',
        size_bytes: 100,
        checksum_sha256: null,
        run_id: 'run-old',
        stage_id: null,
        expires_at: new Date('2020-01-01').toISOString(),
        downloaded_count: 0,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const results = await repo.findExpired();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('expired');
    });

    it('should return empty when no expired artifacts exist', async () => {
      const results = await repo.findExpired();
      expect(results).toHaveLength(0);
    });
  });

  // ---- delete ----

  describe('delete', () => {
    it('should delete artifact by id', async () => {
      const created = await repo.createArtifact({
        name: 'to-delete',
        type: 'binary',
        storage_path: '/path',
        run_id: 'run-1',
      });

      const deleted = await repo.delete(created.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false when deleting non-existent artifact', async () => {
      const deleted = await repo.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ---- deleteExpired ----

  describe('deleteExpired', () => {
    it('should delete expired artifacts and return count', async () => {
      // Insert expired artifact directly
      mockDb.store.set('expired-del-1', {
        id: 'expired-del-1',
        tenant_id: '00000000-0000-0000-0000-000000000000',
        name: 'expired-delete',
        type: 'binary',
        storage_type: 'local',
        storage_path: '/path',
        size_bytes: 100,
        checksum_sha256: null,
        run_id: 'run-old',
        stage_id: null,
        expires_at: new Date('2020-01-01').toISOString(),
        downloaded_count: 0,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const count = await repo.deleteExpired();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- incrementDownloadCount ----

  describe('incrementDownloadCount', () => {
    it('should increment download count', async () => {
      const created = await repo.createArtifact({
        name: 'downloadable',
        type: 'binary',
        storage_path: '/path',
        run_id: 'run-1',
      });

      await repo.incrementDownloadCount(created.id);

      // Verify query was called with the right parameters
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('downloaded_count = downloaded_count + 1'),
        [created.id],
      );
    });
  });

  // ---- mapRowToEntity ----

  describe('mapRowToEntity', () => {
    it('should handle null fields gracefully', async () => {
      // Directly test mapRowToEntity via findById with a sparse row
      mockDb.store.set('sparse-1', {
        id: 'sparse-1',
        tenant_id: 't1',
        name: 'sparse',
        type: 'binary',
        storage_type: null,
        storage_path: '/path',
        size_bytes: null,
        checksum_sha256: null,
        run_id: 'run-1',
        stage_id: null,
        expires_at: null,
        downloaded_count: null,
        metadata: null,
        created_at: null,
        updated_at: null,
      });

      const found = await repo.findById('sparse-1');

      expect(found).toBeDefined();
      expect(found!.storage_type).toBe('local');
      expect(found!.size_bytes).toBe(0);
      expect(found!.checksum_sha256).toBeNull();
      expect(found!.stage_id).toBeNull();
      expect(found!.expires_at).toBeNull();
      expect(found!.downloaded_count).toBe(0);
      expect(found!.metadata).toEqual({});
      expect(found!.created_at).toBeInstanceOf(Date);
      expect(found!.updated_at).toBeInstanceOf(Date);
    });

    it('should parse dates correctly', async () => {
      const dateStr = '2026-06-01T12:00:00.000Z';
      mockDb.store.set('dated-1', {
        id: 'dated-1',
        tenant_id: 't1',
        name: 'dated',
        type: 'binary',
        storage_type: 'local',
        storage_path: '/path',
        size_bytes: 100,
        checksum_sha256: null,
        run_id: 'run-1',
        stage_id: null,
        expires_at: dateStr,
        downloaded_count: 5,
        metadata: {},
        created_at: dateStr,
        updated_at: dateStr,
      });

      const found = await repo.findById('dated-1');

      expect(found!.expires_at).toBeInstanceOf(Date);
      expect(found!.expires_at!.toISOString()).toBe(dateStr);
      expect(found!.created_at.toISOString()).toBe(dateStr);
    });
  });
});
