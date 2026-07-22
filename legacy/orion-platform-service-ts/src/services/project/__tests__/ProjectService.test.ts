/**
 * ProjectService Tests
 */

import { ProjectService, ProjectServiceError } from '../ProjectService';
import { ProjectRepository, Project } from '../ProjectRepository';

describe('ProjectService', () => {
  let mockRepository: jest.Mocked<ProjectRepository>;
  let service: ProjectService;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;

    service = new ProjectService(mockRepository);
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const mockProject: Project = {
        id: 'proj-1',
        tenant_id: 't1',
        name: 'My Project',
        description: 'A test project',
        slug: 'my-project',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.create.mockResolvedValue(mockProject);

      const result = await service.createProject('t1', 'My Project', 'A test project');

      expect(result).toEqual(mockProject);
      expect(mockRepository.create).toHaveBeenCalledWith('t1', 'My Project', 'A test project');
    });

    it('should create project without description', async () => {
      mockRepository.create.mockResolvedValue({
        id: 'proj-2', tenant_id: 't1', name: 'Simple', description: null,
        slug: 'simple', status: 'active', created_at: new Date(), updated_at: new Date(),
      });

      await service.createProject('t1', 'Simple');

      expect(mockRepository.create).toHaveBeenCalledWith('t1', 'Simple', undefined);
    });

    it('should throw when tenantId is missing', async () => {
      await expect(service.createProject('', 'Project'))
        .rejects.toThrow(ProjectServiceError);
      await expect(service.createProject('', 'Project'))
        .rejects.toThrow('Tenant ID and name required');
    });

    it('should throw when name is missing', async () => {
      await expect(service.createProject('t1', ''))
        .rejects.toThrow(ProjectServiceError);
    });
  });

  describe('listProjects', () => {
    it('should return all projects for a tenant', async () => {
      const mockProjects: Project[] = [
        { id: 'p1', tenant_id: 't1', name: 'Project A', description: null, slug: 'project-a', status: 'active', created_at: new Date(), updated_at: new Date() },
        { id: 'p2', tenant_id: 't1', name: 'Project B', description: 'Desc', slug: 'project-b', status: 'active', created_at: new Date(), updated_at: new Date() },
      ];
      mockRepository.findAll.mockResolvedValue(mockProjects);

      const result = await service.listProjects('t1');

      expect(result).toEqual(mockProjects);
      expect(mockRepository.findAll).toHaveBeenCalledWith('t1');
    });

    it('should return empty array when no projects', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.listProjects('t1');

      expect(result).toEqual([]);
    });
  });

  describe('getProject', () => {
    it('should return project by id', async () => {
      const mockProject: Project = {
        id: 'p1', tenant_id: 't1', name: 'Project', description: null,
        slug: 'project', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
      mockRepository.findById.mockResolvedValue(mockProject);

      const result = await service.getProject('p1');

      expect(result).toEqual(mockProject);
    });

    it('should throw when project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getProject('non-existent'))
        .rejects.toThrow(ProjectServiceError);
      await expect(service.getProject('non-existent'))
        .rejects.toThrow('Project not found');
    });
  });

  describe('deleteProject', () => {
    it('should delete an existing project', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteProject('p1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('p1');
    });

    it('should return false when project does not exist', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteProject('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('updateProject', () => {
    it('should update project name', async () => {
      const existing: Project = {
        id: 'p1', tenant_id: 't1', name: 'Old', description: null,
        slug: 'old', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
      const updated: Project = { ...existing, name: 'New', slug: 'new' };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateProject('p1', { name: 'New' });

      expect(result.name).toBe('New');
      expect(mockRepository.update).toHaveBeenCalledWith('p1', { name: 'New' });
    });

    it('should update project description', async () => {
      const existing: Project = {
        id: 'p1', tenant_id: 't1', name: 'Project', description: null,
        slug: 'project', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
      const updated: Project = { ...existing, description: 'New description' };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateProject('p1', { description: 'New description' });

      expect(result.description).toBe('New description');
    });

    it('should throw when project not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateProject('non-existent', { name: 'New' }))
        .rejects.toThrow('Project not found');
    });

    it('should throw when update fails', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'p1', tenant_id: 't1', name: 'Project', description: null,
        slug: 'project', status: 'active', created_at: new Date(), updated_at: new Date(),
      });
      mockRepository.update.mockResolvedValue(null);

      await expect(service.updateProject('p1', { name: 'New' }))
        .rejects.toThrow('Failed to update project');
    });
  });
});

describe('ProjectRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: ProjectRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new ProjectRepository(mockDb as any);
  });

  describe('findById', () => {
    it('should return project when found', async () => {
      const mockRow = { id: 'p1', tenant_id: 't1', name: 'Test' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById('p1');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = $1', ['p1']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repository.findById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all projects for a tenant', async () => {
      const mockRows = [
        { id: 'p1', tenant_id: 't1', name: 'Project A' },
        { id: 'p2', tenant_id: 't1', name: 'Project B' },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll('t1');

      expect(result).toEqual(mockRows);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM projects WHERE tenant_id = $1', ['t1']);
    });
  });

  describe('create', () => {
    it('should insert a new project with generated slug', async () => {
      const mockRow = { id: 'p-new', tenant_id: 't1', name: 'My Project', slug: 'my-project', status: 'active' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create('t1', 'My Project', 'Description');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO projects');
    });

    it('should generate slug from name', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', 'My Awesome Project!');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe('my-awesome-project');
    });

    it('should handle special characters in slug generation', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', 'Hello  World---Test!!!');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe('hello-world-test');
    });

    it('should default description to null', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', 'Project');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true when project deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('p1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('missing');

      expect(result).toBe(false);
    });
  });

  describe('update', () => {
    it('should update project name and slug', async () => {
      const mockRow = { id: 'p1', name: 'New Name', slug: 'new-name' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.update('p1', { name: 'New Name' });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('UPDATE projects SET');
      expect(sql).toContain('name = $');
      expect(sql).toContain('slug = $');
    });

    it('should update project description', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.update('p1', { description: 'New desc' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('description = $');
    });

    it('should return existing when no updates provided', async () => {
      const mockRow = { id: 'p1', name: 'Unchanged' };
      const findSpy = jest.spyOn(repository, 'findById');
      findSpy.mockResolvedValue(mockRow);

      const result = await repository.update('p1', {});

      expect(result).toEqual(mockRow);
      expect(findSpy).toHaveBeenCalledWith('p1');
      findSpy.mockRestore();
    });

    it('should return null when update fails', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.update('missing', { name: 'New' });

      expect(result).toBeNull();
    });
  });
});
