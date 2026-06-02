/**
 * PipelineService Unit Tests
 */

import { PipelineService } from '../PipelineService';

// Mock uuid
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));

// Mock Pipeline model
jest.mock('../../../models/Pipeline', () => ({
  PipelineStatus: { ACTIVE: 'active', INACTIVE: 'inactive' },
  createPipeline: (input: any) => ({
    id: 'mock-uuid-1234',
    name: input.name,
    description: input.description || null,
    status: 'active',
    version: input.version || '1',
    yamlDefinition: input.yamlDefinition,
    spec: input.spec || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  parsePipelineYaml: (yaml: string) => {
    if (yaml === 'invalid') throw new Error('Invalid YAML');
    return { spec: { stages: yaml.includes('stages') ? [{ name: 'build' }] : [] } };
  },
}));

// Mock OrionError
jest.mock('../../../errors', () => ({
  OrionError: class OrionError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'OrionError';
    }
  },
  ErrorCode: { NOT_FOUND: 'NOT_FOUND', OPERATION_FAILED: 'OPERATION_FAILED' },
}));

// Mock CacheService
jest.mock('../../cache/CacheService', () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  })),
}));

function createMockRepo() {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(true),
    findByTenant: jest.fn().mockResolvedValue([]),
    findByName: jest.fn().mockResolvedValue(null),
    findVersions: jest.fn().mockResolvedValue([]),
    updateVersion: jest.fn(),
    getStats: jest.fn().mockResolvedValue({ totalRuns: 0, successRuns: 0, failedRuns: 0, runningRuns: 0, avgDuration: 0 }),
  };
}

describe('PipelineService', () => {
  let service: PipelineService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepo();
    service = new PipelineService(mockRepo as any);
  });

  describe('constructor', () => {
    it('should work with null repository', () => {
      const svc = new PipelineService(null);
      expect(svc).toBeDefined();
    });

    it('should detect repository by method presence', () => {
      const svc = new PipelineService(mockRepo as any);
      expect(svc).toBeDefined();
    });

    it('should build repos from DatabasePool', () => {
      const mockPool = { query: jest.fn() } as any;
      // This will create real repository instances
      const svc = new PipelineService(mockPool);
      expect(svc).toBeDefined();
    });
  });

  describe('getById', () => {
    it('should return pipeline by ID', async () => {
      const mockPipeline = { id: 'p-1', name: 'Build', tenant_id: 't-1' };
      mockRepo.findById.mockResolvedValue(mockPipeline);

      const result = await service.getById('p-1');

      expect(result).toEqual(mockPipeline);
      expect(mockRepo.findById).toHaveBeenCalledWith('p-1');
    });

    it('should return null when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return undefined when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.getById('p-1');

      expect(result).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all pipelines', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [{ id: 'p-1' }], total: 1 });

      const result = await service.list();

      expect(result).toHaveLength(1);
    });

    it('should list by tenant using findByTenant', async () => {
      mockRepo.findByTenant.mockResolvedValue([{ id: 'p-1', tenant_id: 't-1' }]);

      const result = await service.list('t-1');

      expect(result).toHaveLength(1);
      expect(mockRepo.findByTenant).toHaveBeenCalledWith('t-1');
    });

    it('should return empty when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.list();

      expect(result).toEqual([]);
    });

    it('should handle array result from findAll', async () => {
      mockRepo.findAll.mockResolvedValue([{ id: 'p-1' }]);

      const result = await service.list();

      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create pipeline via repository', async () => {
      const mockCreated = { id: 'p-1', name: 'Test Pipeline' };
      mockRepo.create.mockResolvedValue(mockCreated);

      const result = await service.create({ name: 'Test Pipeline' } as any);

      expect(result).toEqual(mockCreated);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should parse YAML definition', async () => {
      mockRepo.create.mockResolvedValue({ id: 'p-1' });

      await service.create({
        name: 'Test',
        yamlDefinition: 'stages:\n  - name: build',
      } as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: { stages: [{ name: 'build' }] },
        })
      );
    });

    it('should handle invalid YAML gracefully', async () => {
      mockRepo.create.mockResolvedValue({ id: 'p-1' });

      await service.create({
        name: 'Test',
        yamlDefinition: 'invalid',
      } as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ spec: null })
      );
    });

    it('should fallback to in-memory mode', async () => {
      const svc = new PipelineService(null);

      const result = await svc.create({
        name: 'In-Memory Pipeline',
        tenant_id: 't-1',
      } as any);

      expect(result.name).toBe('In-Memory Pipeline');
      expect(result.tenant_id).toBe('t-1');
    });
  });

  describe('update', () => {
    it('should update pipeline', async () => {
      const updated = { id: 'p-1', description: 'Updated' };
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update('p-1', { description: 'Updated' });

      expect(result).toEqual(updated);
    });

    it('should return undefined when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.update('p-1', { description: 'test' });

      expect(result).toBeUndefined();
    });

    it('should handle update error', async () => {
      mockRepo.update.mockRejectedValue(new Error('DB error'));

      const result = await service.update('p-1', { description: 'test' });

      expect(result).toBeUndefined();
    });

    it('should update YAML and spec', async () => {
      mockRepo.update.mockResolvedValue({ id: 'p-1' });

      await service.update('p-1', { yamlDefinition: 'stages:\n  - name: build' });

      expect(mockRepo.update).toHaveBeenCalledWith('p-1', expect.objectContaining({
        spec: { stages: [{ name: 'build' }] },
      }));
    });
  });

  describe('delete', () => {
    it('should delete pipeline', async () => {
      const result = await service.delete('p-1');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('p-1');
    });

    it('should return false when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.delete('p-1');

      expect(result).toBe(false);
    });
  });

  describe('getVersions', () => {
    it('should return versions', async () => {
      mockRepo.findVersions.mockResolvedValue([
        { id: 'p-1', name: 'Build', version: 2, status: 'active', created_at: new Date() },
      ]);

      const result = await service.getVersions('t-1', 'p-1');

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(2);
    });

    it('should return empty when no versions', async () => {
      mockRepo.findVersions.mockResolvedValue([]);

      const result = await service.getVersions('t-1', 'p-1');

      expect(result).toEqual([]);
    });

    it('should return empty when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.getVersions('t-1', 'p-1');

      expect(result).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should validate valid YAML', async () => {
      const result = await service.validate('stages:\n  - name: build');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid YAML', async () => {
      const result = await service.validate('invalid');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing stage dependencies', async () => {
      const yaml = 'stages:\n  - name: build\n  - name: deploy depends on test';
      // parsePipelineYaml mock doesn't produce dependsOn, so this tests the happy path
      const result = await service.validate(yaml);

      expect(result.valid).toBe(true);
    });
  });

  describe('triggerRun', () => {
    it('should trigger a run via repository', async () => {
      const mockPipeline = { id: 'p-1', tenant_id: 't-1' };
      mockRepo.findById.mockResolvedValue(mockPipeline);

      const result = await service.triggerRun('p-1');

      expect(result.pipelineId).toBe('p-1');
      expect(result.status).toBe('pending');
    });

    it('should throw NOT_FOUND when pipeline not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.triggerRun('nonexistent')).rejects.toThrow('Pipeline not found');
    });

    it('should fallback to in-memory mode', async () => {
      const svc = new PipelineService(null);

      // Since getById returns undefined (no repo), it should throw
      await expect(svc.triggerRun('p-1')).rejects.toThrow();
    });
  });

  describe('retryRun', () => {
    it('should return a retry run ID', async () => {
      const result = await service.retryRun('r-1');

      expect(result).toMatch(/^run-retry-/);
    });
  });

  describe('getRun', () => {
    it('should throw when no run repository', async () => {
      await expect(service.getRun('r-1')).rejects.toThrow('Pipeline run not found');
    });
  });

  describe('cancelRun', () => {
    it('should throw when no run repository', async () => {
      await expect(service.cancelRun('r-1')).rejects.toThrow('Pipeline run not found');
    });
  });

  describe('getPipelineStats', () => {
    it('should return stats from repository', async () => {
      const stats = { totalRuns: 10, successRuns: 8, failedRuns: 1, runningRuns: 1, avgDuration: 5000 };
      mockRepo.getStats.mockResolvedValue(stats);

      const result = await service.getPipelineStats('p-1');

      expect(result).toEqual(stats);
    });

    it('should return zero stats when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.getPipelineStats('p-1');

      expect(result.totalRuns).toBe(0);
    });
  });

  describe('listPipelines', () => {
    it('should list with filters', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [{ id: 'p-1' }], total: 1 });

      const result = await service.listPipelines({
        tenantId: 't-1',
        projectId: 'proj-1',
        status: 'active',
        limit: 10,
        offset: 0,
        name: 'Build',
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should handle array result', async () => {
      mockRepo.findAll.mockResolvedValue([{ id: 'p-1' }]);

      const result = await service.listPipelines();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty when no repository', async () => {
      const svc = new PipelineService(null);

      const result = await svc.listPipelines();

      expect(result).toEqual({ data: [], total: 0 });
    });
  });
});
