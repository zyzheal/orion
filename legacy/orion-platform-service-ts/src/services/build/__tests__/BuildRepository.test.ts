/**
 * BuildRepository 测试
 *
 * 测试 PostgreSQL Repository 的 Build 和 BuildEnvironment CRUD 操作。
 * 使用 mock DatabasePool 模拟数据库交互。
 */

import { BuildRepository, Build, BuildEnvironment, CreateBuildInput, CreateBuildEnvironmentInput } from '../BuildRepository';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const builds = new Map<string, any>();
  const environments = new Map<string, any>();
  let buildIdCounter = 0;
  let envIdCounter = 0;

  return {
    builds,
    environments,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      // ---- Build Environments ----

      // Create environment
      if (text.includes('INSERT INTO build_environments')) {
        const id = `env-${++envIdCounter}`;
        const row = {
          id,
          tenant_id: params?.[0],
          name: params?.[1],
          type: params?.[2],
          image: params?.[3],
          description: params?.[4] || null,
          config: params?.[5] || {},
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        environments.set(id, row);
        return { rows: [row], rowCount: 1 };
      }

      // Update environment
      if (text.includes('UPDATE build_environments SET') && text.includes('RETURNING *')) {
        const id = params?.[params.length - 1];
        const env = environments.get(id);
        if (!env) return { rows: [], rowCount: 0 };

        // Parse SET clause
        if (text.includes('name = $')) {
          const match = text.match(/name = \$(\d+)/);
          if (match) env.name = params[parseInt(match[1]) - 1];
        }
        if (text.includes('image = $')) {
          const match = text.match(/image = \$(\d+)/);
          if (match) env.image = params[parseInt(match[1]) - 1];
        }
        if (text.includes('description = $')) {
          const match = text.match(/description = \$(\d+)/);
          if (match) env.description = params[parseInt(match[1]) - 1];
        }
        if (text.includes('config = $')) {
          const match = text.match(/config = \$(\d+)/);
          if (match) {
            const rawConfig = params[parseInt(match[1]) - 1];
            // Source code JSON.stringifies the config, so parse it back
            env.config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
          }
        }
        if (text.includes('status = $')) {
          const match = text.match(/status = \$(\d+)/);
          if (match) env.status = params[parseInt(match[1]) - 1];
        }
        env.updated_at = new Date().toISOString();

        return { rows: [env], rowCount: 1 };
      }

      // Soft delete environment
      if (text.includes("UPDATE build_environments SET status = 'deleted'")) {
        const id = params?.[0];
        const env = environments.get(id);
        if (!env) return { rows: [], rowCount: 0 };
        env.status = 'deleted';
        env.updated_at = new Date().toISOString();
        return { rows: [], rowCount: 1 };
      }

      // Select environment by ID
      if (text.includes('SELECT * FROM build_environments WHERE id = $1')) {
        const id = params?.[0];
        const env = environments.get(id);
        return { rows: env ? [env] : [], rowCount: env ? 1 : 0 };
      }

      // Select all environments
      if (text.includes('SELECT * FROM build_environments')) {
        let results = Array.from(environments.values());
        if (text.includes('WHERE tenant_id = $1') && params?.[0]) {
          results = results.filter(e => e.tenant_id === params[0]);
        }
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results, rowCount: results.length };
      }

      // ---- Builds ----

      // Create build
      if (text.includes('INSERT INTO builds')) {
        const id = `build-${++buildIdCounter}`;
        const now = new Date().toISOString();
        const row = {
          id,
          tenant_id: params?.[0],
          project_id: params?.[1] || null,
          pipeline_run_id: params?.[2] || null,
          image: params?.[3] || null,
          tag: params?.[4] || null,
          source_ref: params?.[5] || null,
          build_args: params?.[6] || {},
          status: 'pending',
          started_at: null,
          completed_at: null,
          duration_ms: null,
          error_message: null,
          created_at: now,
        };
        builds.set(id, row);
        return { rows: [row], rowCount: 1 };
      }

      // Start build
      if (text.includes("UPDATE builds SET status = 'running'")) {
        const id = params?.[0];
        const build = builds.get(id);
        if (!build) return { rows: [], rowCount: 0 };
        build.status = 'running';
        build.started_at = new Date().toISOString();
        return { rows: [build], rowCount: 1 };
      }

      // Complete build
      if (text.includes('UPDATE builds SET') && text.includes('completed_at = NOW()')) {
        const buildId = params?.[2];
        const build = builds.get(buildId);
        if (!build) return { rows: [], rowCount: 0 };
        build.status = params?.[0];
        build.error_message = params?.[1] || null;
        build.completed_at = new Date().toISOString();
        build.duration_ms = 5000;
        return { rows: [build], rowCount: 1 };
      }

      // Update build
      if (text.includes('UPDATE builds SET') && text.includes('RETURNING *')) {
        const id = params?.[params.length - 1];
        const build = builds.get(id);
        if (!build) return { rows: [], rowCount: 0 };
        if (text.includes('status = $')) {
          const match = text.match(/status = \$(\d+)/);
          if (match) build.status = params[parseInt(match[1]) - 1];
        }
        if (text.includes('image = $')) {
          const match = text.match(/image = \$(\d+)/);
          if (match) build.image = params[parseInt(match[1]) - 1];
        }
        if (text.includes('tag = $')) {
          const match = text.match(/tag = \$(\d+)/);
          if (match) build.tag = params[parseInt(match[1]) - 1];
        }
        if (text.includes('error_message = $')) {
          const match = text.match(/error_message = \$(\d+)/);
          if (match) build.error_message = params[parseInt(match[1]) - 1];
        }
        return { rows: [build], rowCount: 1 };
      }

      // Find by pipeline run
      if (text.includes('WHERE pipeline_run_id = $1')) {
        const prId = params?.[0];
        const results = Array.from(builds.values())
          .filter(b => b.pipeline_run_id === prId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: results.length > 0 ? [results[0]] : [], rowCount: results.length > 0 ? 1 : 0 };
      }

      // Build stats
      if (text.includes('COUNT(*)') && text.includes('SUM(CASE WHEN')) {
        let results = Array.from(builds.values());
        if (text.includes('WHERE tenant_id = $1') && params?.[0]) {
          results = results.filter(b => b.tenant_id === params[0]);
        }
        const total = results.length;
        const success = results.filter(b => b.status === 'success').length;
        const failed = results.filter(b => b.status === 'failed').length;
        const running = results.filter(b => b.status === 'running').length;
        const pending = results.filter(b => b.status === 'pending').length;
        const avgDuration = 5000;
        return {
          rows: [{
            total: String(total),
            success: String(success),
            failed: String(failed),
            running: String(running),
            pending: String(pending),
            avg_duration: String(avgDuration),
          }],
          rowCount: 1,
        };
      }

      // Count builds
      if (text.includes('SELECT COUNT(*) as count FROM builds')) {
        let results = Array.from(builds.values());
        if (params?.length === 2) {
          results = results.filter(b => b.tenant_id === params[0] && b.status === params[1]);
        } else if (params?.length === 1) {
          if (text.includes('tenant_id = $1')) {
            results = results.filter(b => b.tenant_id === params[0]);
          } else if (text.includes('status = $1')) {
            results = results.filter(b => b.status === params[0]);
          }
        }
        return { rows: [{ count: String(results.length) }], rowCount: 1 };
      }

      // Find by ID
      if (text.includes('SELECT * FROM builds WHERE id = $1')) {
        const id = params?.[0];
        const build = builds.get(id);
        return { rows: build ? [build] : [], rowCount: build ? 1 : 0 };
      }

      // Find all builds
      if (text.includes('SELECT * FROM builds')) {
        let results = Array.from(builds.values());

        if (params) {
          const tenantMatch = text.match(/tenant_id = \$(\d+)/);
          const projectMatch = text.match(/project_id = \$(\d+)/);
          const statusMatch = text.match(/status = \$(\d+)/);

          if (tenantMatch) {
            results = results.filter(b => b.tenant_id === params[parseInt(tenantMatch[1]) - 1]);
          }
          if (projectMatch) {
            results = results.filter(b => b.project_id === params[parseInt(projectMatch[1]) - 1]);
          }
          if (statusMatch) {
            results = results.filter(b => b.status === params[parseInt(statusMatch[1]) - 1]);
          }
        }

        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (text.includes('LIMIT')) {
          const limitMatch = text.match(/LIMIT \$(\d+)/);
          const offsetMatch = text.match(/OFFSET \$(\d+)/);
          const limit = limitMatch ? parseInt(params![parseInt(limitMatch[1]) - 1]) : undefined;
          const offset = offsetMatch ? parseInt(params![parseInt(offsetMatch[1]) - 1]) : 0;
          if (limit) {
            results = results.slice(offset, offset + limit);
          }
        }

        return { rows: results, rowCount: results.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('BuildRepository', () => {
  let repo: BuildRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new BuildRepository(mockDb as any);
  });

  // ==================== Build Environments ====================

  describe('Build Environments', () => {
    describe('createEnvironment', () => {
      it('should create environment with all fields', async () => {
        const input: CreateBuildEnvironmentInput = {
          tenant_id: 'tenant-1',
          name: 'node-18',
          type: 'docker',
          image: 'node:18',
          description: 'Node.js 18 environment',
          config: { NODE_ENV: 'production' },
        };

        const result = await repo.createEnvironment(input);

        expect(result.id).toBeDefined();
        expect(result.name).toBe('node-18');
        expect(result.type).toBe('docker');
        expect(result.image).toBe('node:18');
        expect(result.description).toBe('Node.js 18 environment');
        expect(result.config).toEqual({ NODE_ENV: 'production' });
        expect(result.status).toBe('active');
      });

      it('should create environment with defaults for optional fields', async () => {
        const input: CreateBuildEnvironmentInput = {
          tenant_id: 'tenant-1',
          name: 'minimal-env',
          type: 'docker',
          image: 'alpine:latest',
        };

        const result = await repo.createEnvironment(input);

        expect(result.description).toBeNull();
        expect(result.config).toEqual({});
      });
    });

    describe('findEnvironmentById', () => {
      it('should find existing environment', async () => {
        const created = await repo.createEnvironment({
          tenant_id: 't1',
          name: 'findable-env',
          type: 'docker',
          image: 'node:18',
        });

        const found = await repo.findEnvironmentById(created.id);

        expect(found).toBeDefined();
        expect(found!.name).toBe('findable-env');
      });

      it('should return null for non-existent environment', async () => {
        const found = await repo.findEnvironmentById('non-existent');
        expect(found).toBeNull();
      });
    });

    describe('findAllEnvironments', () => {
      it('should return all environments', async () => {
        await repo.createEnvironment({ tenant_id: 't1', name: 'env-1', type: 'docker', image: 'node:18' });
        await repo.createEnvironment({ tenant_id: 't1', name: 'env-2', type: 'docker', image: 'python:3' });

        const results = await repo.findAllEnvironments();
        expect(results).toHaveLength(2);
      });

      it('should filter by tenant ID', async () => {
        await repo.createEnvironment({ tenant_id: 't1', name: 'env-1', type: 'docker', image: 'node:18' });
        await repo.createEnvironment({ tenant_id: 't2', name: 'env-2', type: 'docker', image: 'python:3' });

        const results = await repo.findAllEnvironments('t1');
        expect(results).toHaveLength(1);
        expect(results[0].tenant_id).toBe('t1');
      });
    });

    describe('updateEnvironment', () => {
      it('should update environment fields', async () => {
        const created = await repo.createEnvironment({
          tenant_id: 't1',
          name: 'old-name',
          type: 'docker',
          image: 'node:16',
        });

        const updated = await repo.updateEnvironment(created.id, {
          name: 'new-name',
          image: 'node:18',
        });

        expect(updated).toBeDefined();
        expect(updated!.name).toBe('new-name');
        expect(updated!.image).toBe('node:18');
      });

      it('should update description and config', async () => {
        const created = await repo.createEnvironment({
          tenant_id: 't1',
          name: 'env-config',
          type: 'docker',
          image: 'node:18',
        });

        const updated = await repo.updateEnvironment(created.id, {
          description: 'Updated description',
          config: { KEY: 'value' },
        });

        expect(updated!.description).toBe('Updated description');
        expect(updated!.config).toEqual({ KEY: 'value' });
      });

      it('should update status', async () => {
        const created = await repo.createEnvironment({
          tenant_id: 't1',
          name: 'status-env',
          type: 'docker',
          image: 'node:18',
        });

        const updated = await repo.updateEnvironment(created.id, { status: 'disabled' });
        expect(updated!.status).toBe('disabled');
      });

      it('should return existing environment when no fields to update', async () => {
        const created = await repo.createEnvironment({
          tenant_id: 't1',
          name: 'noop-env',
          type: 'docker',
          image: 'node:18',
        });

        const result = await repo.updateEnvironment(created.id, {});
        expect(result).toBeDefined();
        expect(result!.name).toBe('noop-env');
      });

      it('should return null for non-existent environment', async () => {
        const result = await repo.updateEnvironment('non-existent', { name: 'new' });
        expect(result).toBeNull();
      });
    });

    describe('deleteEnvironment', () => {
      it('should soft delete environment', async () => {
        const created = await repo.createEnvironment({
          tenant_id: 't1',
          name: 'to-delete',
          type: 'docker',
          image: 'node:18',
        });

        const deleted = await repo.deleteEnvironment(created.id);
        expect(deleted).toBe(true);
      });

      it('should return false for non-existent environment', async () => {
        const deleted = await repo.deleteEnvironment('non-existent');
        expect(deleted).toBe(false);
      });
    });
  });

  // ==================== Builds ====================

  describe('Builds', () => {
    describe('create', () => {
      it('should create build with all fields', async () => {
        const input: CreateBuildInput = {
          tenant_id: 'tenant-1',
          project_id: 'proj-1',
          pipeline_run_id: 'pr-1',
          image: 'myapp',
          tag: 'v1.0.0',
          source_ref: 'main',
          build_args: { NODE_ENV: 'production' },
        };

        const build = await repo.create(input);

        expect(build.id).toBeDefined();
        expect(build.status).toBe('pending');
        expect(build.tenant_id).toBe('tenant-1');
        expect(build.project_id).toBe('proj-1');
        expect(build.pipeline_run_id).toBe('pr-1');
        expect(build.image).toBe('myapp');
        expect(build.tag).toBe('v1.0.0');
        expect(build.source_ref).toBe('main');
        expect(build.build_args).toEqual({ NODE_ENV: 'production' });
        expect(build.started_at).toBeNull();
        expect(build.completed_at).toBeNull();
      });

      it('should create build with minimal fields', async () => {
        const build = await repo.create({ tenant_id: 'tenant-1' });

        expect(build.project_id).toBeNull();
        expect(build.pipeline_run_id).toBeNull();
        expect(build.image).toBeNull();
        expect(build.tag).toBeNull();
        expect(build.source_ref).toBeNull();
        expect(build.build_args).toEqual({});
      });
    });

    describe('findById', () => {
      it('should find build by ID', async () => {
        const created = await repo.create({ tenant_id: 't1', image: 'myapp' });
        const found = await repo.findById(created.id);

        expect(found).toBeDefined();
        expect(found!.image).toBe('myapp');
      });

      it('should return null for non-existent build', async () => {
        const found = await repo.findById('non-existent');
        expect(found).toBeNull();
      });
    });

    describe('findAll', () => {
      it('should return all builds', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't1' });

        const results = await repo.findAll();
        expect(results).toHaveLength(2);
      });

      it('should filter by tenant ID', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't2' });

        const results = await repo.findAll({ tenantId: 't1' });
        expect(results).toHaveLength(1);
      });

      it('should filter by project ID', async () => {
        await repo.create({ tenant_id: 't1', project_id: 'p1' });
        await repo.create({ tenant_id: 't1', project_id: 'p2' });

        const results = await repo.findAll({ projectId: 'p1' });
        expect(results).toHaveLength(1);
      });

      it('should filter by status', async () => {
        await repo.create({ tenant_id: 't1' });
        // Manually set one to running
        const builds = Array.from(mockDb.builds.values());
        builds[0].status = 'running';

        const results = await repo.findAll({ status: 'running' });
        expect(results).toHaveLength(1);
      });

      it('should respect limit and offset', async () => {
        for (let i = 0; i < 5; i++) {
          await repo.create({ tenant_id: 't1' });
        }

        const page1 = await repo.findAll({ limit: 2 });
        const page2 = await repo.findAll({ limit: 2, offset: 2 });

        expect(page1).toHaveLength(2);
        expect(page2).toHaveLength(2);
      });
    });

    describe('count', () => {
      it('should count all builds', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't2' });

        const count = await repo.count();
        expect(count).toBe(2);
      });

      it('should count by tenant ID', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't2' });

        const count = await repo.count({ tenantId: 't1' });
        expect(count).toBe(2);
      });

      it('should count by status', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't1' });
        const builds = Array.from(mockDb.builds.values());
        builds[0].status = 'success';

        const count = await repo.count({ status: 'success' });
        expect(count).toBe(1);
      });

      it('should count by tenant ID and status', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't2' });
        const builds = Array.from(mockDb.builds.values());
        builds[0].status = 'success';

        const count = await repo.count({ tenantId: 't1', status: 'success' });
        expect(count).toBe(1);
      });
    });

    describe('update', () => {
      it('should update build fields', async () => {
        const build = await repo.create({ tenant_id: 't1' });

        const updated = await repo.update(build.id, {
          status: 'running',
          image: 'updated-image',
          tag: 'v2.0.0',
        });

        expect(updated).toBeDefined();
        expect(updated!.status).toBe('running');
        expect(updated!.image).toBe('updated-image');
        expect(updated!.tag).toBe('v2.0.0');
      });

      it('should update error message', async () => {
        const build = await repo.create({ tenant_id: 't1' });

        const updated = await repo.update(build.id, {
          status: 'failed',
          error_message: 'Build failed: compilation error',
        });

        expect(updated!.status).toBe('failed');
        expect(updated!.error_message).toBe('Build failed: compilation error');
      });

      it('should return existing build when no fields to update', async () => {
        const build = await repo.create({ tenant_id: 't1' });

        const result = await repo.update(build.id, {});
        expect(result).toBeDefined();
        expect(result!.id).toBe(build.id);
      });

      it('should return null for non-existent build', async () => {
        const result = await repo.update('non-existent', { status: 'running' });
        expect(result).toBeNull();
      });
    });

    describe('startBuild', () => {
      it('should set build status to running', async () => {
        const build = await repo.create({ tenant_id: 't1' });

        const started = await repo.startBuild(build.id);

        expect(started).toBeDefined();
        expect(started!.status).toBe('running');
        expect(started!.started_at).toBeDefined();
      });

      it('should return null for non-existent build', async () => {
        const result = await repo.startBuild('non-existent');
        expect(result).toBeNull();
      });
    });

    describe('completeBuild', () => {
      it('should complete build as success', async () => {
        const build = await repo.create({ tenant_id: 't1' });
        await repo.startBuild(build.id);

        const completed = await repo.completeBuild(build.id, 'success');

        expect(completed).toBeDefined();
        expect(completed!.status).toBe('success');
        expect(completed!.completed_at).toBeDefined();
        expect(completed!.duration_ms).toBeDefined();
      });

      it('should complete build as failure with error message', async () => {
        const build = await repo.create({ tenant_id: 't1' });
        await repo.startBuild(build.id);

        const completed = await repo.completeBuild(build.id, 'failed', 'Compilation error');

        expect(completed!.status).toBe('failed');
        expect(completed!.error_message).toBe('Compilation error');
      });

      it('should return null for non-existent build', async () => {
        const result = await repo.completeBuild('non-existent', 'success');
        expect(result).toBeNull();
      });
    });

    describe('findByPipelineRun', () => {
      it('should find build by pipeline run ID', async () => {
        await repo.create({ tenant_id: 't1', pipeline_run_id: 'pr-123' });

        const found = await repo.findByPipelineRun('pr-123');

        expect(found).toBeDefined();
        expect(found!.pipeline_run_id).toBe('pr-123');
      });

      it('should return null for non-existent pipeline run', async () => {
        const found = await repo.findByPipelineRun('non-existent');
        expect(found).toBeNull();
      });
    });

    describe('getBuildStats', () => {
      it('should return build statistics', async () => {
        // Create builds with different statuses
        const b1 = await repo.create({ tenant_id: 't1' });
        const b2 = await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't1' });

        // Set different statuses
        mockDb.builds.get(b1.id)!.status = 'success';
        mockDb.builds.get(b2.id)!.status = 'failed';

        const stats = await repo.getBuildStats();

        expect(stats.total).toBe(3);
        expect(stats.success).toBe(1);
        expect(stats.failed).toBe(1);
        expect(stats.running).toBe(0);
        expect(stats.pending).toBe(1);
        expect(stats.avgDuration).toBe(5000);
      });

      it('should filter stats by tenant ID', async () => {
        await repo.create({ tenant_id: 't1' });
        await repo.create({ tenant_id: 't2' });

        const stats = await repo.getBuildStats('t1');

        expect(stats.total).toBe(1);
      });
    });
  });
});
