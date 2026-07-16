/**
 * TeamService - Comprehensive Tests
 *
 * Tests for team CRUD, membership management, role assignment,
 * permission aggregation, and CODEOWNERS resolution.
 */

import { TeamService, TeamServiceError } from '../TeamService';
import { TeamRepository, Team, TeamMember, TeamWithMembers } from '../TeamRepository';
import { RoleRepository } from '../../role/RoleRepository';

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockTeamRepo(): jest.Mocked<TeamRepository> {
  return {
    findById: jest.fn(),
    findByIdAndTenant: jest.fn(),
    findByIdWithMembers: jest.fn(),
    findBySlug: jest.fn(),
    findBySlugs: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    getMembers: jest.fn(),
    getUserTeams: jest.fn(),
    isMember: jest.fn(),
    updateMemberRole: jest.fn(),
    assignRole: jest.fn(),
    removeRole: jest.fn(),
    getTeamRoles: jest.fn(),
    getUserTeamRoleNames: jest.fn(),
    getMemberUserIdsByTeamIds: jest.fn(),
  } as any;
}

function createMockRoleRepo(): jest.Mocked<RoleRepository> {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findByName: jest.fn(),
    update: jest.fn(),
    findRolePermission: jest.fn(),
    addRolePermission: jest.fn(),
    findPermissionsByRoleNames: jest.fn(),
    findUserRoles: jest.fn(),
  } as any;
}

function createTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-001',
    tenant_id: 'tenant-1',
    name: 'Platform Team',
    slug: 'platform-team',
    description: 'Platform engineering team',
    team_type: 'engineering',
    parent_team_id: null,
    external_id: null,
    metadata: {},
    status: 'active',
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TeamService', () => {
  let service: TeamService;
  let teamRepo: ReturnType<typeof createMockTeamRepo>;
  let roleRepo: ReturnType<typeof createMockRoleRepo>;

  beforeEach(() => {
    teamRepo = createMockTeamRepo();
    roleRepo = createMockRoleRepo();
    service = new TeamService(teamRepo, roleRepo);
  });

  // ─── getTeam ─────────────────────────────────────────────────────────────

  describe('getTeam', () => {
    it('should return team with members', async () => {
      const team = createTeam();
      teamRepo.findByIdWithMembers.mockResolvedValue({ ...team, members: [] } as any);

      const result = await service.getTeam('team-001', 'tenant-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('team-001');
    });

    it('should throw when team not found', async () => {
      teamRepo.findByIdWithMembers.mockResolvedValue(null);
      await expect(service.getTeam('non-existent', 'tenant-1')).rejects.toThrow('Team not found');
    });
  });

  // ─── getTeamBySlug ───────────────────────────────────────────────────────

  describe('getTeamBySlug', () => {
    it('should return team by slug', async () => {
      const team = createTeam();
      teamRepo.findBySlug.mockResolvedValue(team);

      const result = await service.getTeamBySlug('platform-team', 'tenant-1');
      expect(result?.slug).toBe('platform-team');
    });

    it('should return null for non-existent slug', async () => {
      teamRepo.findBySlug.mockResolvedValue(null);
      const result = await service.getTeamBySlug('non-existent', 'tenant-1');
      expect(result).toBeNull();
    });
  });

  // ─── listTeams ───────────────────────────────────────────────────────────

  describe('listTeams', () => {
    it('should list teams for tenant', async () => {
      teamRepo.findAll.mockResolvedValue({ teams: [createTeam()], total: 1 });

      const result = await service.listTeams('tenant-1');
      expect(result.teams.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should filter by type', async () => {
      teamRepo.findAll.mockResolvedValue({ teams: [], total: 0 });

      await service.listTeams('tenant-1', 'design');
      expect(teamRepo.findAll).toHaveBeenCalledWith('tenant-1', 'design', 50, 0);
    });
  });

  // ─── createTeam ──────────────────────────────────────────────────────────

  describe('createTeam', () => {
    it('should create a team with valid slug', async () => {
      teamRepo.findBySlug.mockResolvedValue(null);
      teamRepo.create.mockResolvedValue(createTeam());

      const result = await service.createTeam({
        tenant_id: 'tenant-1',
        name: 'Platform Team',
        slug: 'platform-team',
      });

      expect(result.name).toBe('Platform Team');
    });

    it('should reject invalid slug format', async () => {
      await expect(
        service.createTeam({ tenant_id: 'tenant-1', name: 'Test', slug: 'Invalid Slug!' })
      ).rejects.toThrow('slug must be lowercase');
    });

    it('should reject duplicate slug', async () => {
      teamRepo.findBySlug.mockResolvedValue(createTeam());

      await expect(
        service.createTeam({ tenant_id: 'tenant-1', name: 'Test', slug: 'platform-team' })
      ).rejects.toThrow('already exists');
    });

    it('should validate parent team belongs to same tenant', async () => {
      teamRepo.findBySlug.mockResolvedValue(null);
      teamRepo.findById.mockResolvedValue(null);

      await expect(
        service.createTeam({
          tenant_id: 'tenant-1',
          name: 'Child',
          slug: 'child-team',
          parent_team_id: 'parent-001',
        })
      ).rejects.toThrow('Parent team not found');
    });

    it('should accept valid parent team', async () => {
      teamRepo.findBySlug.mockResolvedValue(null);
      teamRepo.findById.mockResolvedValue(createTeam({ id: 'parent-001', tenant_id: 'tenant-1' }));
      teamRepo.create.mockResolvedValue(createTeam({ parent_team_id: 'parent-001' }));

      const result = await service.createTeam({
        tenant_id: 'tenant-1',
        name: 'Child',
        slug: 'child-team',
        parent_team_id: 'parent-001',
      });

      expect(result).toBeDefined();
    });
  });

  // ─── updateTeam ──────────────────────────────────────────────────────────

  describe('updateTeam', () => {
    it('should update team name', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.update.mockResolvedValue(createTeam({ name: 'Updated' }));

      const result = await service.updateTeam('team-001', 'tenant-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw when team not found', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(null);

      await expect(
        service.updateTeam('non-existent', 'tenant-1', { name: 'New' })
      ).rejects.toThrow('Team not found');
    });

    it('should detect circular parent references', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.findById.mockResolvedValue(createTeam({ id: 'team-001', parent_team_id: 'team-001' }));

      await expect(
        service.updateTeam('team-001', 'tenant-1', { parent_team_id: 'team-001' })
      ).rejects.toThrow('Circular');
    });
  });

  // ─── deleteTeam ──────────────────────────────────────────────────────────

  describe('deleteTeam', () => {
    it('should delete team', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.delete.mockResolvedValue({ success: true, orphanedChildren: 0 });

      const result = await service.deleteTeam('team-001', 'tenant-1');
      expect(result.deleted).toBe(true);
    });

    it('should throw when team not found', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(null);

      await expect(service.deleteTeam('non-existent', 'tenant-1')).rejects.toThrow('Team not found');
    });
  });

  // ─── addMember ───────────────────────────────────────────────────────────

  describe('addMember', () => {
    it('should add member to team', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.addMember.mockResolvedValue({
        id: 'member-001',
        team_id: 'team-001',
        user_id: 'user-1',
        role: 'member',
      } as any);

      const result = await service.addMember('team-001', 'user-1', 'tenant-1');
      expect(result.user_id).toBe('user-1');
    });

    it('should reject invalid role', async () => {
      await expect(
        service.addMember('team-001', 'user-1', 'tenant-1', 'invalid-role')
      ).rejects.toThrow('Invalid member role');
    });

    it('should accept lead role', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.addMember.mockResolvedValue({ id: 'm1', role: 'lead' } as any);

      const result = await service.addMember('team-001', 'user-1', 'tenant-1', 'lead');
      expect(result.role).toBe('lead');
    });
  });

  // ─── removeMember ────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('should remove member from team', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.removeMember.mockResolvedValue(true);

      const result = await service.removeMember('team-001', 'user-1', 'tenant-1');
      expect(result).toBe(true);
    });
  });

  // ─── updateMemberRole ────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.updateMemberRole.mockResolvedValue({ id: 'm1', role: 'lead' } as any);

      const result = await service.updateMemberRole('team-001', 'user-1', 'tenant-1', 'lead');
      expect(result.role).toBe('lead');
    });

    it('should throw when member not found', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.updateMemberRole.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('team-001', 'user-1', 'tenant-1', 'lead')
      ).rejects.toThrow('Member not found');
    });
  });

  // ─── assignRole ──────────────────────────────────────────────────────────

  describe('assignRole', () => {
    it('should assign role to team', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      roleRepo.findByName.mockResolvedValue({ id: 'role-1', name: 'admin' } as any);

      await service.assignRole('team-001', 'admin', 'tenant-1');
      expect(teamRepo.assignRole).toHaveBeenCalledWith('team-001', 'admin', undefined);
    });

    it('should throw when role does not exist', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      roleRepo.findByName.mockResolvedValue(null);

      await expect(
        service.assignRole('team-001', 'non-existent', 'tenant-1')
      ).rejects.toThrow('does not exist');
    });
  });

  // ─── getTeamRoles ────────────────────────────────────────────────────────

  describe('getTeamRoles', () => {
    it('should return team roles', async () => {
      teamRepo.findByIdAndTenant.mockResolvedValue(createTeam());
      teamRepo.getTeamRoles.mockResolvedValue(['admin', 'developer']);

      const roles = await service.getTeamRoles('team-001', 'tenant-1');
      expect(roles).toEqual(['admin', 'developer']);
    });
  });

  // ─── getUserTeamPermissions ──────────────────────────────────────────────

  describe('getUserTeamPermissions', () => {
    it('should aggregate permissions from team roles', async () => {
      teamRepo.getUserTeamRoleNames.mockResolvedValue(['admin', 'developer']);
      roleRepo.findPermissionsByRoleNames.mockResolvedValue([
        { resource: 'pipelines', action: 'read' },
        { resource: 'pipelines', action: 'write' },
      ]);

      const perms = await service.getUserTeamPermissions('user-1', 'tenant-1');
      expect(perms.length).toBe(2);
    });

    it('should return empty when no roleRepo', async () => {
      const noRoleService = new TeamService(teamRepo);
      const perms = await noRoleService.getUserTeamPermissions('user-1', 'tenant-1');
      expect(perms).toEqual([]);
    });
  });

  // ─── resolveCodeOwners ───────────────────────────────────────────────────

  describe('resolveCodeOwners', () => {
    it('should resolve team slugs to member IDs', async () => {
      teamRepo.findBySlugs.mockResolvedValue([createTeam()]);
      const memberMap = new Map([['team-001', ['user-1', 'user-2']]]);
      teamRepo.getMemberUserIdsByTeamIds.mockResolvedValue(memberMap);

      const members = await service.resolveCodeOwners(['platform-team'], 'tenant-1');
      expect(members).toContain('user-1');
      expect(members).toContain('user-2');
    });

    it('should return empty for non-existent teams', async () => {
      teamRepo.findBySlugs.mockResolvedValue([]);
      const members = await service.resolveCodeOwners(['non-existent'], 'tenant-1');
      expect(members).toEqual([]);
    });
  });

  // ─── isCodeOwner ─────────────────────────────────────────────────────────

  describe('isCodeOwner', () => {
    it('should return true when user is member of code owner team', async () => {
      teamRepo.findBySlugs.mockResolvedValue([createTeam()]);
      teamRepo.isMember.mockResolvedValue(true);

      const result = await service.isCodeOwner(['platform-team'], 'user-1', 'tenant-1');
      expect(result).toBe(true);
    });

    it('should return false when user is not a member', async () => {
      teamRepo.findBySlugs.mockResolvedValue([createTeam()]);
      teamRepo.isMember.mockResolvedValue(false);

      const result = await service.isCodeOwner(['platform-team'], 'user-99', 'tenant-1');
      expect(result).toBe(false);
    });
  });

  // ─── Error class ─────────────────────────────────────────────────────────

  describe('TeamServiceError', () => {
    it('should have correct name and code', () => {
      const error = new TeamServiceError('test', 'TEST_CODE');
      expect(error.name).toBe('TeamServiceError');
      expect(error.code).toBe('TEST_CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
