/**
 * EnvironmentService tests
 */
import { EnvironmentService, EnvironmentServiceError } from '../EnvironmentService';
import { EnvironmentRepository, Environment } from '../EnvironmentRepository';

// In-memory store for mock repository
const store: Map<string, Environment> = new Map();

// Mock repository that uses in-memory storage
const mockRepo: Partial<EnvironmentRepository> = {
  async findById(id: string): Promise<Environment | null> {
    return store.get(id) || null;
  },
  async findByProject(projectId: string): Promise<Environment[]> {
    return Array.from(store.values()).filter(e => e.project_id === projectId);
  },
  async findAll(): Promise<Environment[]> {
    return Array.from(store.values());
  },
  async create(projectId: string, name: string, type: string, config: Record<string, any>, cluster?: string, namespace?: string): Promise<Environment> {
    const env: Environment = {
      id: `env-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      tenant_id: 'mock-tenant',
      project_id: projectId,
      name,
      type,
      cluster,
      namespace,
      config: config || {},
      status: 'active',
    };
    store.set(env.id, env);
    return env;
  },
  async update(id: string, updates: Record<string, any>): Promise<Environment | null> {
    const existing = store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updated_at: new Date() };
    store.set(id, updated);
    return updated;
  },
  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  },
};

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(() => {
    store.clear();
    service = new EnvironmentService(mockRepo as EnvironmentRepository);
  });

  describe('createEnvironment', () => {
    it('should create a valid environment', async () => {
      const env = await service.createEnvironment({
        projectId: 'proj-1',
        name: 'dev',
        type: 'dev',
      });
      expect(env.name).toBe('dev');
      expect(env.type).toBe('dev');
      expect(env.status).toBe('active');
    });

    it('should reject missing projectId', async () => {
      await expect(
        service.createEnvironment({ projectId: '', name: 'dev', type: 'dev' })
      ).rejects.toThrow(EnvironmentServiceError);
    });

    it('should reject invalid environment type', async () => {
      await expect(
        service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'invalid' })
      ).rejects.toThrow(EnvironmentServiceError);
    });
  });

  describe('listByProject', () => {
    it('should list environments for a project', async () => {
      await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      await service.createEnvironment({ projectId: 'proj-1', name: 'staging', type: 'staging' });

      const envs = await service.listByProject('proj-1');
      expect(envs.length).toBe(2);
    });

    it('should reject empty projectId', async () => {
      await expect(service.listByProject('')).rejects.toThrow(EnvironmentServiceError);
    });
  });

  describe('listAll', () => {
    it('should list all environments', async () => {
      await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      await service.createEnvironment({ projectId: 'proj-2', name: 'prod', type: 'prod' });

      const envs = await service.listAll();
      expect(envs.length).toBe(2);
    });
  });

  describe('getEnvironment', () => {
    it('should return environment by id', async () => {
      const created = await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      const found = await service.getEnvironment(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw NOT_FOUND for non-existent id', async () => {
      await expect(service.getEnvironment('non-existent')).rejects.toThrow(EnvironmentServiceError);
    });
  });

  describe('updateEnvironment', () => {
    it('should update environment', async () => {
      const created = await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      const updated = await service.updateEnvironment(created.id, { name: 'development' });
      expect(updated.name).toBe('development');
    });

    it('should throw NOT_FOUND for non-existent id', async () => {
      await expect(
        service.updateEnvironment('non-existent', { name: 'test' })
      ).rejects.toThrow(EnvironmentServiceError);
    });

    it('should reject invalid type on update', async () => {
      const created = await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      await expect(
        service.updateEnvironment(created.id, { type: 'invalid' })
      ).rejects.toThrow(EnvironmentServiceError);
    });
  });

  describe('deleteEnvironment', () => {
    it('should delete environment', async () => {
      const created = await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      await service.deleteEnvironment(created.id);
      await expect(service.getEnvironment(created.id)).rejects.toThrow(EnvironmentServiceError);
    });

    it('should throw NOT_FOUND for non-existent id', async () => {
      await expect(service.deleteEnvironment('non-existent')).rejects.toThrow(EnvironmentServiceError);
    });
  });

  describe('updateStatus', () => {
    it('should update status to maintenance', async () => {
      const created = await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      const updated = await service.updateStatus(created.id, 'maintenance');
      expect(updated.status).toBe('maintenance');
    });

    it('should reject invalid status', async () => {
      const created = await service.createEnvironment({ projectId: 'proj-1', name: 'dev', type: 'dev' });
      await expect(service.updateStatus(created.id, 'invalid')).rejects.toThrow(EnvironmentServiceError);
    });
  });
});
