/**
 * BuildService 测试
 *
 * 测试 BuildService 的 CRUD 操作、Repository 交互。
 */

import { BuildService } from '../BuildService';
import { BuildRepository, Build, CreateBuildInput } from '../BuildRepository';

// ==================== Mock Repository ====================

function createMockRepository() {
  const builds: Map<string, Build> = new Map();
  let idCounter = 0;

  const repo: jest.Mocked<BuildRepository> = {
    findById: jest.fn().mockImplementation(async (id: string) => {
      return builds.get(id) ?? null;
    }),
    findAll: jest.fn().mockImplementation(async (options?: any) => {
      let results = Array.from(builds.values());
      if (options?.tenantId) results = results.filter(b => b.tenant_id === options.tenantId);
      if (options?.projectId) results = results.filter(b => b.project_id === options.projectId);
      if (options?.status) results = results.filter(b => b.status === options.status);
      results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      if (options?.offset) results = results.slice(options.offset);
      if (options?.limit) results = results.slice(0, options.limit);
      return results;
    }),
    count: jest.fn().mockImplementation(async (options?: any) => {
      let results = Array.from(builds.values());
      if (options?.tenantId) results = results.filter(b => b.tenant_id === options.tenantId);
      if (options?.status) results = results.filter(b => b.status === options.status);
      return results.length;
    }),
    create: jest.fn().mockImplementation(async (input: CreateBuildInput) => {
      const build: Build = {
        id: `build-${++idCounter}`,
        tenant_id: input.tenant_id,
        project_id: input.project_id ?? null,
        pipeline_run_id: input.pipeline_run_id ?? null,
        image: input.image ?? null,
        tag: input.tag ?? null,
        status: 'pending',
        source_ref: input.source_ref ?? null,
        build_args: input.build_args ?? {},
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        created_at: new Date(),
      };
      builds.set(build.id, build);
      return build;
    }),
    update: jest.fn().mockImplementation(async (id: string, input: any) => {
      const build = builds.get(id);
      if (!build) return null;
      if (input.status !== undefined) build.status = input.status;
      if (input.image !== undefined) build.image = input.image;
      if (input.tag !== undefined) build.tag = input.tag;
      if (input.error_message !== undefined) build.error_message = input.error_message;
      return build;
    }),
    startBuild: jest.fn().mockImplementation(async (id: string) => {
      const build = builds.get(id);
      if (!build) return null;
      build.status = 'running';
      build.started_at = new Date();
      return build;
    }),
    completeBuild: jest.fn().mockImplementation(async (id: string, status: string, errorMessage?: string) => {
      const build = builds.get(id);
      if (!build) return null;
      build.status = status;
      build.completed_at = new Date();
      build.error_message = errorMessage ?? null;
      if (build.started_at) {
        build.duration_ms = build.completed_at.getTime() - build.started_at.getTime();
      }
      return build;
    }),
    findByPipelineRun: jest.fn().mockImplementation(async (pipelineRunId: string) => {
      for (const build of builds.values()) {
        if (build.pipeline_run_id === pipelineRunId) return build;
      }
      return null;
    }),
    getBuildStats: jest.fn().mockImplementation(async (tenantId?: string) => {
      let results = Array.from(builds.values());
      if (tenantId) results = results.filter(b => b.tenant_id === tenantId);
      return {
        total: results.length,
        success: results.filter(b => b.status === 'success').length,
        failed: results.filter(b => b.status === 'failed').length,
        running: results.filter(b => b.status === 'running').length,
        pending: results.filter(b => b.status === 'pending').length,
        avgDuration: 0,
      };
    }),
    findEnvironmentById: jest.fn(),
    findAllEnvironments: jest.fn(),
    createEnvironment: jest.fn(),
    updateEnvironment: jest.fn(),
    deleteEnvironment: jest.fn(),
  } as unknown as jest.Mocked<BuildRepository>;

  return { repo, builds };
}

// ==================== Tests ====================

describe('BuildService - PostgreSQL Repository', () => {
  let service: BuildService;
  let mockRepo: jest.Mocked<BuildRepository>;

  beforeEach(() => {
    const { repo } = createMockRepository();
    mockRepo = repo;
    service = new BuildService(mockRepo);
  });

  describe('createBuild', () => {
    it('should create a build with required fields', async () => {
      const build = await service.createBuild({ tenant_id: 'tenant-1' });

      expect(build.id).toBeDefined();
      expect(build.tenant_id).toBe('tenant-1');
      expect(build.status).toBe('pending');
      expect(build.project_id).toBeNull();
      expect(build.pipeline_run_id).toBeNull();
      expect(build.build_args).toEqual({});
      expect(build.created_at).toBeDefined();
    });

    it('should create a build with all fields', async () => {
      const build = await service.createBuild({
        tenant_id: 'tenant-1',
        project_id: 'proj-1',
        pipeline_run_id: 'run-1',
        image: 'my-app',
        tag: 'v1.0.0',
        source_ref: 'refs/heads/main',
        build_args: { NODE_ENV: 'production' },
      });

      expect(build.project_id).toBe('proj-1');
      expect(build.pipeline_run_id).toBe('run-1');
      expect(build.image).toBe('my-app');
      expect(build.tag).toBe('v1.0.0');
      expect(build.source_ref).toBe('refs/heads/main');
      expect(build.build_args).toEqual({ NODE_ENV: 'production' });
    });

    it('should throw error when tenant_id is missing', async () => {
      await expect(service.createBuild({ tenant_id: '' })).rejects.toThrow('Tenant ID is required');
    });
  });

  describe('getBuild', () => {
    it('should return build by ID', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1', image: 'test-app' });
      const found = await service.getBuild(created.id);

      expect(found.id).toBe(created.id);
      expect(found.image).toBe('test-app');
    });

    it('should throw for non-existent ID', async () => {
      await expect(service.getBuild('non-existent')).rejects.toThrow('Build not found');
    });
  });

  describe('listBuilds', () => {
    beforeEach(async () => {
      await service.createBuild({ tenant_id: 'tenant-1', project_id: 'proj-1' });
      await service.createBuild({ tenant_id: 'tenant-1', project_id: 'proj-2' });
      await service.createBuild({ tenant_id: 'tenant-2', project_id: 'proj-1' });
    });

    it('should list all builds with pagination', async () => {
      const result = await service.listBuilds();
      expect(result.data.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('should filter by tenant', async () => {
      const result = await service.listBuilds({ tenantId: 'tenant-1' });
      expect(result.data.length).toBe(2);
    });

    it('should filter by project', async () => {
      const result = await service.listBuilds({ projectId: 'proj-1' });
      expect(result.data.length).toBe(2);
    });

    it('should support pagination', async () => {
      const result = await service.listBuilds({ limit: 1, page: 1 });
      expect(result.data.length).toBe(1);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('startBuild', () => {
    it('should start a pending build', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });
      const started = await service.startBuild(created.id);

      expect(started.status).toBe('running');
      expect(started.started_at).toBeDefined();
    });

    it('should throw for non-existent build', async () => {
      await expect(service.startBuild('non-existent')).rejects.toThrow('Build not found');
    });

    it('should throw for non-pending build', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });
      await service.startBuild(created.id);
      await expect(service.startBuild(created.id)).rejects.toThrow('Can only start pending builds');
    });
  });

  describe('cancelBuild', () => {
    it('should cancel a pending build', async () => {
      const created = await service.createBuild({ tenant_id: 'tenant-1' });
      const cancelled = await service.cancelBuild(created.id);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.error_message).toBe('Cancelled by user');
    });

    it('should throw for non-existent build', async () => {
      await expect(service.cancelBuild('non-existent')).rejects.toThrow('Build not found');
    });
  });

  describe('getBuildByPipelineRun', () => {
    it('should return build by pipeline run ID', async () => {
      await service.createBuild({ tenant_id: 'tenant-1', pipeline_run_id: 'run-1' });
      const found = await service.getBuildByPipelineRun('run-1');

      expect(found).not.toBeNull();
      expect(found!.pipeline_run_id).toBe('run-1');
    });

    it('should return null for non-existent pipeline run', async () => {
      const found = await service.getBuildByPipelineRun('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getBuildStats', () => {
    it('should return build statistics', async () => {
      await service.createBuild({ tenant_id: 'tenant-1' });
      await service.createBuild({ tenant_id: 'tenant-1' });
      const build3 = await service.createBuild({ tenant_id: 'tenant-1' });
      await service.startBuild(build3.id);

      const stats = await service.getBuildStats('tenant-1');
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(2);
      expect(stats.running).toBe(1);
    });

    it('should return zero stats for empty tenant', async () => {
      const stats = await service.getBuildStats('tenant-empty');
      expect(stats.total).toBe(0);
      expect(stats.success).toBe(0);
    });
  });

  describe('environments', () => {
    it('should create and get environment', async () => {
      mockRepo.createEnvironment.mockResolvedValue({
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'node-build',
        type: 'docker',
        image: 'node:18',
        description: 'Node.js build env',
        config: {},
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
      mockRepo.findEnvironmentById.mockResolvedValue({
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'node-build',
        type: 'docker',
        image: 'node:18',
        description: 'Node.js build env',
        config: {},
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const env = await service.createEnvironment({
        tenant_id: 'tenant-1',
        name: 'node-build',
        type: 'docker',
        image: 'node:18',
      });

      expect(env.id).toBeDefined();
      expect(env.name).toBe('node-build');

      const found = await service.getEnvironment('env-1');
      expect(found.name).toBe('node-build');
    });

    it('should list environments', async () => {
      mockRepo.findAllEnvironments.mockResolvedValue([
        { id: 'env-1', tenant_id: 't1', name: 'env1', type: 'docker', image: 'img', description: null, config: {}, status: 'active', created_at: new Date(), updated_at: new Date() },
      ]);

      const envs = await service.listEnvironments({ tenantId: 't1' });
      expect(envs.length).toBe(1);
    });

    it('should throw for missing tenant_id', async () => {
      await expect(service.createEnvironment({ tenant_id: '', name: 'test', type: 'docker', image: 'img' })).rejects.toThrow('Tenant ID is required');
    });

    it('should throw for missing name', async () => {
      await expect(service.createEnvironment({ tenant_id: 't1', name: '', type: 'docker', image: 'img' })).rejects.toThrow('Environment name is required');
    });

    it('should throw for missing image', async () => {
      await expect(service.createEnvironment({ tenant_id: 't1', name: 'test', type: 'docker', image: '' })).rejects.toThrow('Environment image is required');
    });

    it('should throw for non-existent environment', async () => {
      mockRepo.findEnvironmentById.mockResolvedValue(null);
      await expect(service.getEnvironment('non-existent')).rejects.toThrow('Build environment not found');
    });
  });
});
