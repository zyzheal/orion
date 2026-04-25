/**
 * EnvironmentService tests
 */
import { EnvironmentService, EnvironmentServiceError } from '../EnvironmentService';
import { EnvironmentRepository } from '../EnvironmentRepository';

describe('EnvironmentService', () => {
  let service: EnvironmentService;
  let repo: EnvironmentRepository;

  beforeEach(() => {
    repo = new EnvironmentRepository();
    service = new EnvironmentService(repo);
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
