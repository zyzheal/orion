/**
 * EnvironmentRepository tests (in-memory fallback)
 */
import { EnvironmentRepository } from '../EnvironmentRepository';

describe('EnvironmentRepository (in-memory)', () => {
  let repo: EnvironmentRepository;

  beforeEach(() => {
    // Create repository with undefined pool, then mock isDbAvailable to return false
    repo = new EnvironmentRepository(undefined as any);
    // Override isDbAvailable to use in-memory fallback
    (repo as any).isDbAvailable = () => false;
  });

  describe('create', () => {
    it('should create an environment', async () => {
      const env = await repo.create('proj-1', 'dev', 'dev', { key: 'value' });
      expect(env).toBeDefined();
      expect(env.project_id).toBe('proj-1');
      expect(env.name).toBe('dev');
      expect(env.type).toBe('dev');
      expect(env.status).toBe('active');
    });

    it('should create with cluster and namespace', async () => {
      const env = await repo.create('proj-1', 'staging', 'staging', {}, 'k8s-1', 'ns-staging');
      expect(env.cluster).toBe('k8s-1');
      expect(env.namespace).toBe('ns-staging');
    });
  });

  describe('findById', () => {
    it('should return environment by id', async () => {
      const created = await repo.create('proj-1', 'dev', 'dev', {});
      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByProject', () => {
    it('should return environments for a project', async () => {
      await repo.create('proj-1', 'dev', 'dev', {});
      await repo.create('proj-1', 'staging', 'staging', {});
      await repo.create('proj-2', 'prod', 'prod', {});

      const envs = await repo.findByProject('proj-1');
      expect(envs.length).toBe(2);
    });

    it('should return empty array for project with no environments', async () => {
      const envs = await repo.findByProject('non-existent');
      expect(envs).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all environments', async () => {
      await repo.create('proj-1', 'dev', 'dev', {});
      await repo.create('proj-2', 'prod', 'prod', {});

      const envs = await repo.findAll();
      expect(envs.length).toBe(2);
    });
  });

  describe('update', () => {
    it('should update environment fields', async () => {
      const created = await repo.create('proj-1', 'dev', 'dev', {});
      const updated = await repo.update(created.id, { name: 'development', status: 'maintenance' });
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('development');
      expect(updated?.status).toBe('maintenance');
    });

    it('should return null for non-existent id', async () => {
      const updated = await repo.update('non-existent', { name: 'test' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an environment', async () => {
      const created = await repo.create('proj-1', 'dev', 'dev', {});
      const deleted = await repo.delete(created.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      const deleted = await repo.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });
});
