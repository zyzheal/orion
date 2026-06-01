/**
 * ArtifactService 测试 - PostgreSQL Repository 模式
 *
 * 测试 ArtifactService 的 CRUD 操作和 Repository 交互。
 */

import { ArtifactService, ArtifactType } from '@/services/build/ArtifactService';
import { ArtifactRepository, ArtifactRecord } from '@/services/build/ArtifactRepository';

// ==================== Mock Database ====================

class MockDatabasePool {
  private artifacts: Map<string, any> = new Map();
  private queryCalls: Array<{ query: string; params: unknown[] }> = [];

  async query(text: string, params?: unknown[]) {
    this.queryCalls.push({ query: text, params: params || [] });

    // INSERT ... RETURNING
    if (text.includes('INSERT INTO artifacts') && text.includes('RETURNING')) {
      const id = `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const record: ArtifactRecord = {
        id,
        tenant_id: (params as any[])[0] || 'test-tenant',
        name: (params as any[])[1],
        type: (params as any[])[2],
        storage_type: (params as any[])[3] || 'local',
        storage_path: (params as any[])[4],
        size_bytes: (params as any[])[5] || 0,
        checksum_sha256: (params as any[])[6] || null,
        run_id: (params as any[])[7],
        stage_id: (params as any[])[8] || null,
        expires_at: (params as any[])[9] || null,
        downloaded_count: 0,
        metadata: (params as any[])[10] || {},
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.artifacts.set(id, record);
      return { rows: [record], rowCount: 1 };
    }

    // SELECT ... WHERE id = $1
    if (text.includes('SELECT * FROM artifacts WHERE id = $1')) {
      const id = (params as any[])[0];
      const record = this.artifacts.get(id);
      return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
    }

    // SELECT with filters (run_id, stage_id, type, etc.)
    if (text.includes('SELECT * FROM artifacts WHERE')) {
      let results = Array.from(this.artifacts.values());

      // Simple filtering based on params
      if ((params as any[])[0] && text.includes('run_id = $1')) {
        const runId = (params as any[])[0];
        results = results.filter(r => r.run_id === runId);
      }
      if ((params as any[])[0] && text.includes('stage_id = $1')) {
        const stageId = (params as any[])[0];
        results = results.filter(r => r.stage_id === stageId);
      }
      if ((params as any[])[0] && text.includes("metadata->>'taskId'")) {
        const taskId = (params as any[])[0];
        results = results.filter(r => r.metadata?.taskId === taskId);
      }
      if ((params as any[])[0] && text.includes('type = $')) {
        // Find which param index has type
        const typeIndex = text.split('type = $')[1]?.split(' ')[0];
        if (typeIndex) {
          const type = (params as any[])[parseInt(typeIndex) - 1];
          results = results.filter(r => r.type === type);
        }
      }

      // Apply LIMIT/OFFSET
      const limitIndex = text.lastIndexOf('LIMIT $');
      if (limitIndex !== -1) {
        const limitParamIndex = text.substring(limitIndex + 7).split(' ')[0];
        const limit = (params as any[])[parseInt(limitParamIndex) - 1] || 100;
        const offsetParamIndex = text.substring(text.indexOf('OFFSET $') + 8).split(' ')[0];
        const offset = (params as any[])[parseInt(offsetParamIndex) - 1] || 0;
        results = results.slice(offset, offset + limit);
      }

      return { rows: results, rowCount: results.length };
    }

    // DELETE
    if (text.includes('DELETE FROM artifacts WHERE id = $1')) {
      const id = (params as any[])[0];
      const deleted = this.artifacts.delete(id);
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    // UPDATE download count
    if (text.includes('UPDATE artifacts SET downloaded_count')) {
      const id = (params as any[])[0];
      const record = this.artifacts.get(id);
      if (record) {
        record.downloaded_count += 1;
        record.updated_at = new Date();
      }
      return { rows: [], rowCount: record ? 1 : 0 };
    }

    // DELETE expired
    if (text.includes('DELETE FROM artifacts') && text.includes('expires_at')) {
      const now = new Date();
      let count = 0;
      for (const [id, record] of this.artifacts.entries()) {
        if (record.expires_at && new Date(record.expires_at) < now) {
          this.artifacts.delete(id);
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    return { rows: [], rowCount: 0 };
  }

  getQueryCalls() {
    return this.queryCalls;
  }
}

describe.skip('ArtifactService - PostgreSQL Repository', () => {
  let mockDb: MockDatabasePool;
  let service: ArtifactService;

  beforeEach(() => {
    mockDb = new MockDatabasePool();
    service = new ArtifactService(mockDb as any);
  });

  describe('createArtifact', () => {
    it('should create an artifact with required fields', async () => {
      const artifact = await service.createArtifact({
        name: 'test-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-123',
        storagePath: '/artifacts/run-123/test-artifact',
      });

      expect(artifact.id).toBeDefined();
      expect(artifact.name).toBe('test-artifact');
      expect(artifact.type).toBe('binary');
      expect(artifact.runId).toBe('run-123');
      expect(artifact.size).toBe(0);
      expect(artifact.downloadedCount).toBe(0);
      expect(artifact.createdAt).toBeDefined();
    });

    it('should create an artifact with optional fields', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const artifact = await service.createArtifact({
        name: 'full-artifact',
        type: ArtifactType.DOCKER_IMAGE,
        runId: 'run-456',
        stageId: 'stage-1',
        taskId: 'task-1',
        size: 1024,
        storagePath: '/artifacts/full',
        checksum: 'sha256:abc123',
        expiresAt,
        metadata: { key: 'value' },
      });

      expect(artifact.stageId).toBe('stage-1');
      expect(artifact.taskId).toBe('task-1');
      expect(artifact.size).toBe(1024);
      expect(artifact.checksum).toBe('sha256:abc123');
      expect(artifact.expiresAt).toEqual(expiresAt);
      expect(artifact.metadata?.key).toBe('value');
      expect(artifact.metadata?.taskId).toBe('task-1'); // taskId is also in metadata
    });

    it('should create an artifact with tenant ID', async () => {
      const artifact = await service.createArtifact({
        name: 'tenant-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-789',
        storagePath: '/artifacts/tenant',
      }, 'tenant-123');

      const calls = mockDb.getQueryCalls();
      expect(calls[0].params[0]).toBe('tenant-123');
    });

    it('should use default tenant when not provided', async () => {
      await service.createArtifact({
        name: 'no-tenant',
        type: ArtifactType.BINARY,
        runId: 'run-000',
        storagePath: '/artifacts/no-tenant',
      });

      const calls = mockDb.getQueryCalls();
      expect(calls[0].params[0]).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('listArtifacts', () => {
    beforeEach(async () => {
      // Create test data
      await service.createArtifact({
        name: 'artifact-1',
        type: ArtifactType.BINARY,
        runId: 'run-1',
        stageId: 'stage-1',
        storagePath: '/path/1',
      });
      await service.createArtifact({
        name: 'artifact-2',
        type: ArtifactType.DOCKER_IMAGE,
        runId: 'run-1',
        stageId: 'stage-2',
        storagePath: '/path/2',
      });
      await service.createArtifact({
        name: 'artifact-3',
        type: ArtifactType.BINARY,
        runId: 'run-2',
        storagePath: '/path/3',
      });
    });

    it('should list all artifacts without filters', async () => {
      const artifacts = await service.listArtifacts();
      expect(artifacts.length).toBe(3);
    });

    it('should filter by runId', async () => {
      const artifacts = await service.listArtifacts({ runId: 'run-1' });
      expect(artifacts.length).toBe(2);
      expect(artifacts.every(a => a.runId === 'run-1')).toBe(true);
    });

    it('should filter by stageId', async () => {
      const artifacts = await service.listArtifacts({ stageId: 'stage-1' });
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].name).toBe('artifact-1');
    });

    it('should filter by type', async () => {
      const artifacts = await service.listArtifacts({ type: ArtifactType.BINARY });
      expect(artifacts.length).toBe(2);
      expect(artifacts.every(a => a.type === 'binary')).toBe(true);
    });

    it('should filter by taskId', async () => {
      // Create artifact with taskId
      await service.createArtifact({
        name: 'task-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-1',
        taskId: 'task-1',
        storagePath: '/path/task',
      });

      const artifacts = await service.listArtifacts({ taskId: 'task-1' });
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].name).toBe('task-artifact');
    });
  });

  describe('getArtifact', () => {
    it('should return artifact by ID', async () => {
      const created = await service.createArtifact({
        name: 'get-test',
        type: ArtifactType.BINARY,
        runId: 'run-get',
        storagePath: '/path/get',
      });

      const found = await service.getArtifact(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('get-test');
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.getArtifact('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('deleteArtifact', () => {
    it('should delete existing artifact', async () => {
      const created = await service.createArtifact({
        name: 'delete-test',
        type: ArtifactType.BINARY,
        runId: 'run-delete',
        storagePath: '/path/delete',
      });

      const deleted = await service.deleteArtifact(created.id);
      expect(deleted).toBe(true);

      const found = await service.getArtifact(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await service.deleteArtifact('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('recordDownload', () => {
    it('should increment download count', async () => {
      const created = await service.createArtifact({
        name: 'download-test',
        type: ArtifactType.BINARY,
        runId: 'run-download',
        storagePath: '/path/download',
      });

      expect(created.downloadedCount).toBe(0);

      await service.recordDownload(created.id);
      await service.recordDownload(created.id);

      const updated = await service.getArtifact(created.id);
      // Note: mock doesn't update the returned object, but query was called
      const calls = mockDb.getQueryCalls();
      const updateCalls = calls.filter(c => c.query.includes('downloaded_count'));
      expect(updateCalls.length).toBe(2);
    });
  });

  describe('cleanupExpired', () => {
    it('should return 0 when no expired artifacts', async () => {
      const count = await service.cleanupExpired();
      expect(count).toBe(0);
    });

    it('should delete expired artifacts', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      await service.createArtifact({
        name: 'expired-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-expired',
        storagePath: '/path/expired',
        expiresAt: pastDate,
      });

      const count = await service.cleanupExpired();
      expect(count).toBe(1);
    });
  });

  describe('getByRunId', () => {
    beforeEach(async () => {
      await service.createArtifact({
        name: 'run1-artifact-1',
        type: ArtifactType.BINARY,
        runId: 'run-specific',
        storagePath: '/path/run1-1',
      });
      await service.createArtifact({
        name: 'run1-artifact-2',
        type: ArtifactType.BINARY,
        runId: 'run-specific',
        storagePath: '/path/run1-2',
      });
      await service.createArtifact({
        name: 'run2-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-other',
        storagePath: '/path/run2',
      });
    });

    it('should get artifacts by run ID', async () => {
      const artifacts = await service.getByRunId('run-specific');
      expect(artifacts.length).toBe(2);
      expect(artifacts.every(a => a.runId === 'run-specific')).toBe(true);
    });
  });

  describe('getByStageId', () => {
    beforeEach(async () => {
      await service.createArtifact({
        name: 'stage-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-stage',
        stageId: 'stage-specific',
        storagePath: '/path/stage',
      });
    });

    it('should get artifacts by stage ID', async () => {
      const artifacts = await service.getByStageId('stage-specific');
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].stageId).toBe('stage-specific');
    });
  });
});
