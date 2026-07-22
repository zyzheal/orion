/**
 * ProjectRepository Tests - Supplementary coverage
 */

import { ProjectRepository, Project } from '../ProjectRepository';

describe('ProjectRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: ProjectRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new ProjectRepository(mockDb as any);
  });

  describe('findById', () => {
    it('should return project when found', async () => {
      const mockRow: Project = {
        id: 'p1', tenant_id: 't1', name: 'Test', description: null,
        slug: 'test', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
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

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('connection refused'));

      await expect(repository.findById('p1')).rejects.toThrow('connection refused');
    });
  });

  describe('findAll', () => {
    it('should return all projects for a tenant', async () => {
      const mockRows: Project[] = [
        { id: 'p1', tenant_id: 't1', name: 'Project A', description: null, slug: 'project-a', status: 'active', created_at: new Date(), updated_at: new Date() },
        { id: 'p2', tenant_id: 't1', name: 'Project B', description: 'Desc', slug: 'project-b', status: 'active', created_at: new Date(), updated_at: new Date() },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll('t1');

      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM projects WHERE tenant_id = $1', ['t1']);
    });

    it('should return empty array when no projects exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findAll('t1');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('timeout'));

      await expect(repository.findAll('t1')).rejects.toThrow('timeout');
    });
  });

  describe('create', () => {
    it('should insert a new project with generated slug', async () => {
      const mockRow: Project = {
        id: 'p-new', tenant_id: 't1', name: 'My Project', description: 'Description',
        slug: 'my-project', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create('t1', 'My Project', 'Description');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO projects');
      expect(sql).toContain('RETURNING *');
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

    it('should strip leading and trailing dashes from slug', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', '--Leading--Trailing--');

      const params = mockDb.query.mock.calls[0][1];
      // consecutive non-alphanumeric chars are collapsed to single dash
      expect(params[3]).toBe('leading-trailing');
    });

    it('should default description to null when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', 'Project');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toBeNull();
    });

    it('should pass description when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', 'Project', 'My description');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toBe('My description');
    });

    it('should propagate database errors on create', async () => {
      mockDb.query.mockRejectedValue(new Error('unique constraint violation'));

      await expect(repository.create('t1', 'Project'))
        .rejects.toThrow('unique constraint violation');
    });

    it('should handle numbers in project name slug', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.create('t1', 'Project 2026 v2.0');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[3]).toBe('project-2026-v2-0');
    });
  });

  describe('delete', () => {
    it('should return true when project deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('p1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM projects WHERE id = $1', ['p1']);
    });

    it('should return false when no rows affected', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('missing');

      expect(result).toBe(false);
    });

    it('should propagate database errors on delete', async () => {
      mockDb.query.mockRejectedValue(new Error('foreign key constraint'));

      await expect(repository.delete('p1')).rejects.toThrow('foreign key constraint');
    });
  });

  describe('update', () => {
    it('should update project name and slug', async () => {
      const mockRow: Project = {
        id: 'p1', tenant_id: 't1', name: 'New Name', description: null,
        slug: 'new-name', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
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

    it('should update both name and description simultaneously', async () => {
      const mockRow: Project = {
        id: 'p1', tenant_id: 't1', name: 'Updated', description: 'Updated desc',
        slug: 'updated', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.update('p1', { name: 'Updated', description: 'Updated desc' });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('name = $');
      expect(sql).toContain('slug = $');
      expect(sql).toContain('description = $');
    });

    it('should return existing project when no updates provided', async () => {
      const mockRow: Project = {
        id: 'p1', tenant_id: 't1', name: 'Unchanged', description: null,
        slug: 'unchanged', status: 'active', created_at: new Date(), updated_at: new Date(),
      };
      const findSpy = jest.spyOn(repository, 'findById');
      findSpy.mockResolvedValue(mockRow);

      const result = await repository.update('p1', {});

      expect(result).toEqual(mockRow);
      expect(findSpy).toHaveBeenCalledWith('p1');
      findSpy.mockRestore();
    });

    it('should return null when project not found for update', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.update('missing', { name: 'New' });

      expect(result).toBeNull();
    });

    it('should generate correct slug when updating name', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1', slug: 'new-project-name' }] });

      await repository.update('p1', { name: 'New Project Name!' });

      const params = mockDb.query.mock.calls[0][1];
      // slug is the second param when name is updated
      expect(params[1]).toBe('new-project-name');
    });

    it('should propagate database errors on update', async () => {
      mockDb.query.mockRejectedValue(new Error('constraint violation'));

      await expect(repository.update('p1', { name: 'New' }))
        .rejects.toThrow('constraint violation');
    });
  });
});
