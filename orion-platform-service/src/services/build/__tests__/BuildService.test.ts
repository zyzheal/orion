/**
 * BuildService 测试
 *
 * 测试 BuildService 的 CRUD 操作、Repository 交互、内存降级模式。
 */

import { BuildService } from '../BuildService';
import { BuildRepository } from '../BuildRepository';
import { BuildStatus, BuildCreateInput, Build } from '../../../models/Build';

// ==================== Mock Database ====================

class MockDatabasePool {
  private builds: Map<string, any> = new Map();
  private queryCalls: Array<{ query: string; params: unknown[] }> = [];

  async query(text: string, params?: unknown[]) {
    this.queryCalls.push({ query: text, params: params || [] });

    // INSERT ... RETURNING
    if (text.includes('INSERT INTO builds') && text.includes('RETURNING')) {
      const id = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const record: any = {
        id,
        tenant_id: (params as any[])[0],
        project_id: (params as any[])[1] || null,
        pipeline_run_id: (params as any[])[2] || null,
        image: (params as any[])[3] || null,
        tag: (params as any[])[4] || null,
        status: (params as any[])[7] || 'pending',
        source_ref: (params as any[])[5] || null,
        build_args: (params as any[])[6] || {},
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        created_at: new Date(),
      };
      this.builds.set(id, record);
      return { rows: [record], rowCount: 1 };
    }

    // SELECT ... WHERE id = $1
    if (text.includes('SELECT * FROM builds WHERE id = $1')) {
      const id = (params as any[])[0];
      const record = this.builds.get(id);
      return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
    }

    // SELECT with filters and pagination
    if (text.includes('SELECT * FROM builds WHERE') && text.includes('ORDER BY')) {
      let results = Array.from(this.builds.values());

      // Filter by tenant_id
      if (text.includes('tenant_id = $1')) {
        const tenantId = (params as any[])[0];
        results = results.filter(r => r.tenant_id === tenantId);
      }

      // Filter by project_id
      if (text.includes('project_id = $')) {
        const projectIndex = text.split('project_id = $')[1]?.split(' ')[0];
        if (projectIndex) {
          const projectId = (params as any[])[parseInt(projectIndex) - 1];
          if (projectId) results = results.filter(r => r.project_id === projectId);
        }
      }

      // Filter by pipeline_run_id
      if (text.includes('pipeline_run_id = $')) {
        const prIndex = text.split('pipeline_run_id = $')[1]?.split(' ')[0];
        if (prIndex) {
          const pipelineRunId = (params as any[])[parseInt(prIndex) - 1];
          if (pipelineRunId) results = results.filter(r => r.pipeline_run_id === pipelineRunId);
        }
      }

      // Filter by status
      if (text.includes('status = $')) {
        const statusIndex = text.split('status = $')[1]?.split(' ')[0];
        if (statusIndex) {
          const status = (params as any[])[parseInt(statusIndex) - 1];
          if (status) results = results.filter(r => r.status === status);
        }
      }

      // Apply LIMIT/OFFSET
      const limitIndex = text.lastIndexOf('LIMIT $');
      if (limitIndex !== -1) {
        const limitParamIndex = text.substring(limitIndex + 7).split(' ')[0];
        const limit = (params as any[])[parseInt(limitParamIndex) - 1] || 100;
        const offsetParamIndex = text.lastIndexOf('OFFSET $');
        const offset = offsetParamIndex !== -1
          ? (params as any[])[parseInt(text.substring(offsetParamIndex + 8).split(' ')[0]) - 1] || 0
          : 0;
        results = results.slice(offset, offset + limit);
      }

      return { rows: results, rowCount: results.length };
    }

    // SELECT for COUNT
    if (text.includes('SELECT COUNT(*)') && text.includes('builds')) {
      const total = this.builds.size;
      return { rows: [{ count: total.toString() }], rowCount: 1 };
    }

    // UPDATE status
    if (text.includes('UPDATE builds SET') && text.includes('status = $1')) {
      const id = (params as any[])[4];
      const record = this.builds.get(id);
      if (record) {
        record.status = (params as any[])[0];
        record.started_at = (params as any[])[1];
        record.completed_at = (params as any[])[2];
        record.error_message = (params as any[])[3];
        if ((params as any[])[1] && (params as any[])[2]) {
          record.duration_ms = ((params as any[])[2].getTime() - (params as any[])[1].getTime());
        }
      }
      return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
    }

    // UPDATE (partial)
    if (text.includes('UPDATE builds SET') && text.includes('WHERE id = $')) {
      // Extract the SET clause columns to know the param order
      const setStart = text.indexOf('SET ') + 4;
      const setEnd = text.indexOf(' WHERE');
      const setClause = text.substring(setStart, setEnd);
      const columns = setClause.split(',').map(c => c.split('=')[0].trim());

      // Extract the id from the last param
      const idIndex = text.lastIndexOf('id = $');
      const idParamIndex = parseInt(text.substring(idIndex + 5).split(' ')[0]);
      const id = (params as any[])[idParamIndex - 1];
      const record = this.builds.get(id);
      if (record) {
        // Apply values in the order they appear in the SET clause
        columns.forEach((col, idx) => {
          record[col] = (params as any[])[idx];
        });
      }
      return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
    }

    // DELETE
    if (text.includes('DELETE FROM builds WHERE id = $1')) {
      const id = (params as any[])[0];
      const deleted = this.builds.delete(id);
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }

    // DELETE by pipeline_run_id
    if (text.includes('DELETE FROM builds WHERE pipeline_run_id = $1')) {
      const pipelineRunId = (params as any[])[0];
      let count = 0;
      for (const [id, record] of this.builds.entries()) {
        if (record.pipeline_run_id === pipelineRunId) {
          this.builds.delete(id);
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

  getBuilds() {
    return this.builds;
  }
}

// ==================== Tests ====================

describe('BuildService - PostgreSQL Repository', () => {
  let mockDb: MockDatabasePool;
  let service: BuildService;

  beforeEach(async () => {
    mockDb = new MockDatabasePool();
    service = new BuildService(mockDb as any);
  });

  describe('createBuild', () => {
    it('should create a build with required fields', async () => {
      const input: BuildCreateInput = {
        tenant_id: 'tenant-1',
      };

      const build = await service.createBuild(input);

      expect(build.id).toBeDefined();
      expect(build.tenant_id).toBe('tenant-1');
      expect(build.status).toBe(BuildStatus.PENDING);
      expect(build.projectId).toBeNull();
      expect(build.pipelineRunId).toBeNull();
      expect(build.buildArgs).toEqual({});
      expect(build.createdAt).toBeDefined();
    });

    it('should create a build with all fields', async () => {
      const input: BuildCreateInput = {
        tenant_id: 'tenant-1',
        projectId: 'proj-1',
        pipelineRunId: 'run-1',
        image: 'my-app',
        tag: 'v1.0.0',
        sourceRef: 'refs/heads/main',
        buildArgs: { NODE_ENV: 'production' },
      };

      const build = await service.createBuild(input);

      expect(build.projectId).toBe('proj-1');
      expect(build.pipelineRunId).toBe('run-1');
      expect(build.image).toBe('my-app');
      expect(build.tag).toBe('v1.0.0');
      expect(build.sourceRef).toBe('refs/heads/main');
      expect(build.buildArgs).toEqual({ NODE_ENV: 'production' });
    });
  });

  describe('findBuildById', () => {
    it('should return build by ID', async () => {
      const created = await service.createBuild({
        tenant_id: 'tenant-1',
        image: 'test-app',
        tag: 'latest',
      });

      const found = await service.findBuildById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.image).toBe('test-app');
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.findBuildById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('findBuildsByTenant', () => {
    beforeEach(async () => {
      await service.createBuild({ tenant_id: 'tenant-1', image: 'app1' });
      await service.createBuild({ tenant_id: 'tenant-1', image: 'app2' });
      await service.createBuild({ tenant_id: 'tenant-2', image: 'app3' });
    });

    it('should filter builds by tenant', async () => {
      const builds = await service.findBuildsByTenant('tenant-1');
      expect(builds.length).toBe(2);
      expect(builds.every(b => b.tenantId === 'tenant-1')).toBe(true);
    });

    it('should support pagination', async () => {
      const builds = await service.findBuildsByTenant('tenant-1', { limit: 1, offset: 0 });
      expect(builds.length).toBe(1);
    });
  });

  describe('findBuildsByArtifact', () => {
    beforeEach(async () => {
      await service.createBuild({ tenant_id: 'tenant-1', pipelineRunId: 'run-1' });
      await service.createBuild({ tenant_id: 'tenant-1', pipelineRunId: 'run-1' });
      await service.createBuild({ tenant_id: 'tenant-1', pipelineRunId: 'run-2' });
    });

    it('should filter builds by pipeline run ID', async () => {
      const builds = await service.findBuildsByArtifact('run-1');
      expect(builds.length).toBe(2);
      expect(builds.every(b => b.pipelineRunId === 'run-1')).toBe(true);
    });
  });

  describe('findBuildsByProject', () => {
    beforeEach(async () => {
      await service.createBuild({ tenant_id: 'tenant-1', projectId: 'proj-1' });
      await service.createBuild({ tenant_id: 'tenant-1', projectId: 'proj-1' });
      await service.createBuild({ tenant_id: 'tenant-1', projectId: 'proj-2' });
    });

    it('should filter builds by project', async () => {
      const builds = await service.findBuildsByProject('proj-1');
      expect(builds.length).toBe(2);
    });
  });

  describe('findBuildsByStatus', () => {
    it('should filter builds by status', async () => {
      await service.createBuild({ tenant_id: 'tenant-1' });
      await service.createBuild({ tenant_id: 'tenant-1' });
      await service.createBuild({ tenant_id: 'tenant-1' });

      const pending = await service.findBuildsByStatus(BuildStatus.PENDING);
      expect(pending.length).toBe(3);
    });
  });

  describe('listBuilds', () => {
    beforeEach(async () => {
      await service.createBuild({ tenant_id: 'tenant-1', projectId: 'proj-1' });
      await service.createBuild({ tenant_id: 'tenant-1', projectId: 'proj-2' });
      await service.createBuild({ tenant_id: 'tenant-2', projectId: 'proj-1' });
    });

    it('should list all builds', async () => {
      const result = await service.listBuilds();
      expect(result.builds.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should filter by tenant', async () => {
      const result = await service.listBuilds({ tenant_id: 'tenant-1' });
      expect(result.builds.length).toBe(2);
    });

    it('should filter by project', async () => {
      const result = await service.listBuilds({ projectId: 'proj-1' });
      expect(result.builds.length).toBe(2);
    });

    it('should support pagination', async () => {
      const result = await service.listBuilds({ limit: 1, offset: 0 });
      expect(result.builds.length).toBe(1);
    });
  });

  describe('updateBuild', () => {
    it('should update build fields', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });

      const updated = await service.updateBuild(created.id, {
        image: 'updated-app',
        tag: 'v2.0.0',
      });

      expect(updated).toBeDefined();
      expect(updated?.image).toBe('updated-app');
      expect(updated?.tag).toBe('v2.0.0');
    });

    it('should return undefined for non-existent ID', async () => {
      const updated = await service.updateBuild('non-existent', { image: 'test' });
      expect(updated).toBeUndefined();
    });
  });

  describe('updateBuildStatus', () => {
    it('should update status to running', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });
      const startedAt = new Date();

      const updated = await service.updateBuildStatus(
        created.id,
        BuildStatus.RUNNING,
        startedAt,
      );

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(BuildStatus.RUNNING);
      expect(updated?.startedAt).toEqual(startedAt);
    });

    it('should update status to success with duration', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });
      const startedAt = new Date(Date.now() - 5000);
      const completedAt = new Date();

      const updated = await service.updateBuildStatus(
        created.id,
        BuildStatus.SUCCESS,
        startedAt,
        completedAt,
      );

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(BuildStatus.SUCCESS);
      expect(updated?.startedAt).toEqual(startedAt);
      expect(updated?.completedAt).toEqual(completedAt);
      expect(updated?.durationMs).toBeGreaterThan(0);
    });

    it('should update status to failed with error message', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });

      const updated = await service.updateBuildStatus(
        created.id,
        BuildStatus.FAILED,
        new Date(),
        new Date(),
        'Build failed due to compilation error',
      );

      expect(updated?.status).toBe(BuildStatus.FAILED);
      expect(updated?.errorMessage).toBe('Build failed due to compilation error');
    });
  });

  describe('deleteBuild', () => {
    it('should delete existing build', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });

      const deleted = await service.deleteBuild(created.id);
      expect(deleted).toBe(true);

      const found = await service.findBuildById(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await service.deleteBuild('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('cleanupByPipelineRun', () => {
    it('should delete builds by pipeline run ID', async () => {
      await service.createBuild({ tenant_id: 'tenant-1', pipelineRunId: 'run-1' });
      await service.createBuild({ tenant_id: 'tenant-1', pipelineRunId: 'run-1' });
      await service.createBuild({ tenant_id: 'tenant-1', pipelineRunId: 'run-2' });

      const count = await service.cleanupByPipelineRun('run-1');
      expect(count).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return build statistics', async () => {
      await service.createBuild({ tenant_id: 'tenant-1' });
      await service.createBuild({ tenant_id: 'tenant-1' });
      await service.createBuild({ tenant_id: 'tenant-1' });

      // Update one to success
      const builds = await service.listBuilds({ tenant_id: 'tenant-1' });
      if (builds.builds.length > 0) {
        await service.updateBuildStatus(builds.builds[0].id, BuildStatus.SUCCESS);
      }

      const stats = await service.getStats('tenant-1');
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(1);
    });
  });
});
