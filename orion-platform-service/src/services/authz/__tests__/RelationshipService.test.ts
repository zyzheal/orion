/**
 * RelationshipService Tests
 */

import {
  RelationshipService,
  RelationshipCheckRequest,
  ResourceOwnerRecord,
} from '../RelationshipService';

describe('RelationshipService', () => {
  let service: RelationshipService;

  beforeEach(() => {
    service = new RelationshipService();
  });

  describe('registerOwnership / removeOwnership', () => {
    it('should register and look up ownership', () => {
      const record: ResourceOwnerRecord = {
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-1',
        ownerType: 'user',
      };
      service.registerOwnership(record);
      const owned = service.getUserOwnedResources('user-1');
      expect(owned).toHaveLength(1);
      expect(owned[0].resourceId).toBe('res-1');
    });

    it('should remove ownership', () => {
      service.registerOwnership({
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-1',
        ownerType: 'user',
      });
      service.removeOwnership('pipeline', 'res-1');
      expect(service.getUserOwnedResources('user-1')).toHaveLength(0);
    });
  });

  describe('addProjectMember / removeProjectMember', () => {
    it('should add and verify project membership', () => {
      service.addProjectMember('proj-1', 'user-1');
      service.addProjectMember('proj-1', 'user-2');
      expect(service.getProjectMembers('proj-1')).toContain('user-1');
      expect(service.getProjectMembers('proj-1')).toContain('user-2');
    });

    it('should remove project member', () => {
      service.addProjectMember('proj-1', 'user-1');
      service.removeProjectMember('proj-1', 'user-1');
      expect(service.getProjectMembers('proj-1')).not.toContain('user-1');
    });
  });

  describe('check - owner check', () => {
    it('should allow when userId matches ownerId', async () => {
      const req: RelationshipCheckRequest = {
        userId: 'user-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-1',
      };
      const result = await service.check(req);
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('owner');
    });

    it('should allow when user is registered owner', async () => {
      service.registerOwnership({
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-1',
        ownerType: 'user',
      });
      const req: RelationshipCheckRequest = {
        userId: 'user-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
      };
      const result = await service.check(req);
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('owner');
    });
  });

  describe('check - project member', () => {
    it('should allow project member access', async () => {
      service.addProjectMember('proj-1', 'user-1');
      const req: RelationshipCheckRequest = {
        userId: 'user-1',
        projectId: 'proj-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
      };
      const result = await service.check(req);
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('project_member');
    });
  });

  describe('check - team member', () => {
    it('should allow team member access when team owns resource', async () => {
      service.addTeamMember('team-1', 'user-1');
      service.registerOwnership({
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'team-1',
        ownerType: 'team',
      });
      const req: RelationshipCheckRequest = {
        userId: 'user-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
      };
      const result = await service.check(req);
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('team_member');
    });
  });

  describe('check - collaborator', () => {
    it('should allow collaborator access', async () => {
      service.addCollaborator('res-1', 'user-1');
      const req: RelationshipCheckRequest = {
        userId: 'user-1',
        resourceId: 'res-1',
        resourceType: 'pipeline',
      };
      const result = await service.check(req);
      expect(result.allowed).toBe(true);
      expect(result.relationshipType).toBe('collaborator');
    });
  });

  describe('check - denial', () => {
    it('should deny when no relationship exists', async () => {
      const req: RelationshipCheckRequest = {
        userId: 'user-unknown',
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-other',
      };
      const result = await service.check(req);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No ownership');
    });
  });

  describe('clearAll', () => {
    it('should clear all relationship data', () => {
      service.addProjectMember('proj-1', 'user-1');
      service.addTeamMember('team-1', 'user-1');
      service.addCollaborator('res-1', 'user-1');
      service.registerOwnership({
        resourceId: 'res-1',
        resourceType: 'pipeline',
        ownerId: 'user-1',
        ownerType: 'user',
      });
      service.clearAll();
      expect(service.getProjectMembers('proj-1')).toEqual([]);
      expect(service.getUserOwnedResources('user-1')).toEqual([]);
    });
  });
});
