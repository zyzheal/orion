/**
 * RelationshipService Tests — PostgreSQL-backed version
 */

import { RelationshipService } from '../RelationshipService';

// Mock DatabasePool
function createMockDb() {
  const projectMembers = new Map<string, { user_id: string; role: string }>();
  return {
    projectMembers,
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT role FROM project_members')) {
        const [projectId, userId] = params as [string, string];
        const key = `${projectId}:${userId}`;
        const member = projectMembers.get(key);
        return { rows: member ? [member] : [] };
      }
      if (sql.includes('SELECT 1 FROM project_members')) {
        const [projectId, userId] = params as [string, string];
        const key = `${projectId}:${userId}`;
        const member = projectMembers.get(key);
        return { rows: member ? [{ 1: 1 }] : [] };
      }
      if (sql.includes('SELECT user_id, role FROM project_members')) {
        const [projectId] = params as [string];
        const members = Array.from(projectMembers.entries())
          .filter(([k]) => k.startsWith(`${projectId}:`))
          .map(([, v]) => v);
        return { rows: members };
      }
      if (sql.includes('INSERT INTO project_members')) {
        const [projectId, userId, role] = params as [string, string, string];
        const key = `${projectId}:${userId}`;
        projectMembers.set(key, { user_id: userId, role });
        return { rows: [] };
      }
      if (sql.includes('DELETE FROM project_members')) {
        const [projectId, userId] = params as [string, string];
        const key = `${projectId}:${userId}`;
        projectMembers.delete(key);
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
}

describe('RelationshipService', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: RelationshipService;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new RelationshipService(mockDb as any);
  });

  describe('check - owner check', () => {
    it('should allow when userId matches ownerId', async () => {
      const result = await service.check({
        userId: 'user-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-1',
      });
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('owner');
    });

    it('should deny when userId does not match ownerId', async () => {
      const result = await service.check({
        userId: 'user-unknown',
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-other',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('check - project member', () => {
    it('should allow project member access', async () => {
      await service.addProjectMember('proj-1', 'user-1', 'developer');
      const result = await service.check({
        userId: 'user-1',
        projectId: 'proj-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
      });
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('project_member');
    });

    it('should deny non-project member', async () => {
      await service.addProjectMember('proj-1', 'user-1', 'developer');
      const result = await service.check({
        userId: 'user-2',
        projectId: 'proj-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('addProjectMember / removeProjectMember', () => {
    it('should add and verify project membership', async () => {
      await service.addProjectMember('proj-1', 'user-1', 'developer');
      await service.addProjectMember('proj-1', 'user-2', 'viewer');
      const members = await service.getProjectMembers('proj-1');
      expect(members).toHaveLength(2);
    });

    it('should remove project member', async () => {
      await service.addProjectMember('proj-1', 'user-1', 'developer');
      await service.removeProjectMember('proj-1', 'user-1');
      const members = await service.getProjectMembers('proj-1');
      expect(members).toHaveLength(0);
    });
  });

  describe('isProjectMember', () => {
    it('should return true for project members', async () => {
      await service.addProjectMember('proj-1', 'user-1', 'developer');
      expect(await service.isProjectMember('proj-1', 'user-1')).toBe(true);
    });

    it('should return false for non-members', async () => {
      expect(await service.isProjectMember('proj-1', 'user-1')).toBe(false);
    });
  });
});
