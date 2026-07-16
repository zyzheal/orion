/**
 * TeamRepository + TeamService - Team Management Unit Tests
 *
 * Coverage (Repository): findById, findByIdAndTenant, findBySlug, findAll,
 *   findByIdWithMembers, create, update, delete, addMember, removeMember,
 *   getMembers, getUserTeams, isMember, getMemberRole, updateMemberRole,
 *   assignRole, removeRole, getTeamRoles, getUserTeamRoleNames,
 *   findBySlugs, getMemberUserIds, getMemberUserIdsByTeamIds
 *
 * Coverage (Service): getTeam, getTeamBySlug, listTeams, createTeam,
 *   updateTeam, deleteTeam, addMember, removeMember, getTeamMembers,
 *   getUserTeams, isTeamMember, updateMemberRole, assignRole, removeRole,
 *   getTeamRoles, getUserTeamPermissions, resolveCodeOwners, isCodeOwner
 */

import { TeamRepository, Team, TeamMember, TeamRole, TeamWithMembers } from '../TeamRepository';
import { TeamService, TeamServiceError } from '../TeamService';

// ==================== Repository Tests ====================

describe('TeamRepository', () => {
  let repo: TeamRepository;
  let mockPool: { query: jest.Mock };

  const sampleTeam: Team = {
    id: 'team-1',
    tenant_id: 't-1',
    name: 'Platform Team',
    slug: 'platform-team',
    description: 'Core platform team',
    team_type: 'functional',
    parent_team_id: null,
    external_id: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
  };

  const sampleMember: TeamMember = {
    id: 'm-1',
    team_id: 'team-1',
    user_id: 'user-1',
    role: 'member',
    joined_at: '2026-01-01T00:00:00Z',
    added_by: 'admin',
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new TeamRepository(mockPool as any);
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should return team by id', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      const result = await repo.findById('team-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('team-1');
      expect(result!.name).toBe('Platform Team');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findById('non-existent')).toBeNull();
    });
  });

  // ==================== findByIdAndTenant ====================

  describe('findByIdAndTenant', () => {
    it('should return team by id and tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      const result = await repo.findByIdAndTenant('team-1', 't-1');
      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['team-1', 't-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findByIdAndTenant('team-1', 'wrong-tenant')).toBeNull();
    });
  });

  // ==================== findBySlug ====================

  describe('findBySlug', () => {
    it('should return team by slug and tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      const result = await repo.findBySlug('platform-team', 't-1');
      expect(result).toBeDefined();
      expect(result!.slug).toBe('platform-team');
    });

    it('should return null when slug not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findBySlug('unknown', 't-1')).toBeNull();
    });
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should find all teams for tenant', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [sampleTeam, { ...sampleTeam, id: 'team-2' }] });

      const result = await repo.findAll('t-1');
      expect(result.teams).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by team type', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [sampleTeam] });

      await repo.findAll('t-1', 'functional');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('team_type = $2'),
        expect.arrayContaining(['t-1', 'functional'])
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.findAll('t-1', undefined, 10, 5);
      const [, params] = mockPool.query.mock.calls[1];
      expect(params).toContain(10);
      expect(params).toContain(5);
    });
  });

  // ==================== findByIdWithMembers ====================

  describe('findByIdWithMembers', () => {
    it('should return team with members', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleTeam] })
        .mockResolvedValueOnce({ rows: [sampleMember] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findByIdWithMembers('team-1');
      expect(result).toBeDefined();
      expect(result!.members).toHaveLength(1);
      expect(result!.member_count).toBe(1);
    });

    it('should filter by tenantId when provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [sampleTeam] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findByIdWithMembers('team-1', 't-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['team-1', 't-1']
      );
    });

    it('should return null when team not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findByIdWithMembers('non-existent')).toBeNull();
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create team', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      const result = await repo.create({ tenant_id: 't-1', name: 'Platform Team', slug: 'platform-team' });
      expect(result.name).toBe('Platform Team');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO teams'),
        expect.arrayContaining(['t-1', 'Platform Team', 'platform-team'])
      );
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      await repo.create({ tenant_id: 't-1', name: 'Team', slug: 'team' });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('functional'); // default team_type
    });

    it('should pass all optional fields when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      await repo.create({
        tenant_id: 't-1', name: 'Team', slug: 'team',
        description: 'A team', team_type: 'sre', parent_team_id: 'parent-1',
        external_id: 'ext-1', metadata: { key: 'value' }, created_by: 'user-1',
      });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('A team');
      expect(params).toContain('sre');
      expect(params).toContain('parent-1');
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update team name', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...sampleTeam, name: 'Updated' }] });
      const result = await repo.update('team-1', { name: 'Updated' });
      expect(result!.name).toBe('Updated');
    });

    it('should update multiple fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...sampleTeam, name: 'New', description: 'desc', team_type: 'sre' }] });
      const result = await repo.update('team-1', { name: 'New', description: 'desc', team_type: 'sre' });
      expect(result).toBeDefined();
    });

    it('should return existing when no updates', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      const result = await repo.update('team-1', {});
      expect(result!.name).toBe('Platform Team');
    });

    it('should return null when not found after update', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.update('non-existent', { name: 'New' })).toBeNull();
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should delete team and return orphan count', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const result = await repo.delete('team-1');
      expect(result.success).toBe(true);
      expect(result.orphanedChildren).toBe(2);
    });

    it('should return false when team not found', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rowCount: 0 });
      const result = await repo.delete('non-existent');
      expect(result.success).toBe(false);
    });
  });

  // ==================== Members ====================

  describe('addMember', () => {
    it('should add member to team', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMember] });
      const result = await repo.addMember('team-1', 'user-1');
      expect(result.team_id).toBe('team-1');
      expect(result.user_id).toBe('user-1');
    });

    it('should add member with custom role and addedBy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...sampleMember, role: 'lead' }] });
      const result = await repo.addMember('team-1', 'user-1', 'lead', 'admin');
      expect(result.role).toBe('lead');
    });
  });

  describe('removeMember', () => {
    it('should remove member from team', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.removeMember('team-1', 'user-1')).toBe(true);
    });

    it('should return false when member not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.removeMember('team-1', 'non-existent')).toBe(false);
    });
  });

  describe('getMembers', () => {
    it('should get team members', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleMember, { ...sampleMember, id: 'm-2', user_id: 'user-2' }] });
      const result = await repo.getMembers('team-1');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no members', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.getMembers('team-1')).toEqual([]);
    });
  });

  describe('getUserTeams', () => {
    it('should return teams for a user', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam] });
      const result = await repo.getUserTeams('user-1', 't-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Platform Team');
    });
  });

  describe('isMember', () => {
    it('should return true when user is member', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ '1': 1 }] });
      expect(await repo.isMember('team-1', 'user-1')).toBe(true);
    });

    it('should return false when user is not member', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.isMember('team-1', 'user-99')).toBe(false);
    });
  });

  describe('getMemberRole', () => {
    it('should return member role', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ role: 'lead' }] });
      expect(await repo.getMemberRole('team-1', 'user-1')).toBe('lead');
    });

    it('should return null when not a member', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.getMemberRole('team-1', 'user-99')).toBeNull();
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...sampleMember, role: 'admin' }] });
      const result = await repo.updateMemberRole('team-1', 'user-1', 'admin');
      expect(result!.role).toBe('admin');
    });

    it('should return null when member not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.updateMemberRole('team-1', 'user-99', 'admin')).toBeNull();
    });
  });

  // ==================== Roles ====================

  describe('assignRole', () => {
    it('should assign role to team', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'r-1', team_id: 'team-1', role_name: 'deploy:production' }] });
      const result = await repo.assignRole('team-1', 'deploy:production');
      expect(result.role_name).toBe('deploy:production');
    });

    it('should assign role with grantedBy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'r-1', role_name: 'admin', granted_by: 'user-1' }] });
      const result = await repo.assignRole('team-1', 'admin', 'user-1');
      expect(result.granted_by).toBe('user-1');
    });
  });

  describe('removeRole', () => {
    it('should remove role from team', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      expect(await repo.removeRole('team-1', 'admin')).toBe(true);
    });

    it('should return false when role not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      expect(await repo.removeRole('team-1', 'non-existent')).toBe(false);
    });
  });

  describe('getTeamRoles', () => {
    it('should return team role names', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ role_name: 'deploy:production' }, { role_name: 'review:code' }] });
      expect(await repo.getTeamRoles('team-1')).toEqual(['deploy:production', 'review:code']);
    });

    it('should return empty array when no roles', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.getTeamRoles('team-1')).toEqual([]);
    });
  });

  // ==================== Bulk / Permission Helpers ====================

  describe('getUserTeamRoleNames', () => {
    it('should return distinct role names for user', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ role_name: 'deploy:production' }, { role_name: 'review:code' }] });
      expect(await repo.getUserTeamRoleNames('user-1', 't-1')).toEqual(['deploy:production', 'review:code']);
    });

    it('should return empty when user has no roles', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.getUserTeamRoleNames('user-1', 't-1')).toEqual([]);
    });
  });

  describe('findBySlugs', () => {
    it('should find teams by slugs', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleTeam, { ...sampleTeam, id: 'team-2', slug: 'backend-team' }] });
      const result = await repo.findBySlugs(['platform-team', 'backend-team'], 't-1');
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty slugs', async () => {
      const result = await repo.findBySlugs([], 't-1');
      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('getMemberUserIds', () => {
    it('should return member user IDs', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }] });
      expect(await repo.getMemberUserIds('team-1')).toEqual(['user-1', 'user-2']);
    });
  });

  describe('getMemberUserIdsByTeamIds', () => {
    it('should return map of team IDs to user IDs', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { team_id: 'team-1', user_id: 'user-1' },
          { team_id: 'team-1', user_id: 'user-2' },
          { team_id: 'team-2', user_id: 'user-3' },
        ],
      });
      const result = await repo.getMemberUserIdsByTeamIds(['team-1', 'team-2']);
      expect(result.get('team-1')).toEqual(['user-1', 'user-2']);
      expect(result.get('team-2')).toEqual(['user-3']);
    });

    it('should return empty map for empty team IDs', async () => {
      const result = await repo.getMemberUserIdsByTeamIds([]);
      expect(result.size).toBe(0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));
      await expect(repo.findById('team-1')).rejects.toThrow('Connection refused');
    });
  });
});

// ==================== Service Tests ====================

describe('TeamService', () => {
  let service: TeamService;
  let mockTeamRepo: jest.Mocked<TeamRepository>;
  let mockRoleRepo: any;

  const sampleTeam: Team = {
    id: 'team-1',
    tenant_id: 't-1',
    name: 'Platform Team',
    slug: 'platform-team',
    description: 'Core platform team',
    team_type: 'functional',
    parent_team_id: null,
    external_id: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
  };

  const sampleTeamWithMembers: TeamWithMembers = {
    ...sampleTeam,
    members: [{ id: 'm-1', team_id: 'team-1', user_id: 'user-1', role: 'member', joined_at: '2026-01-01T00:00:00Z', added_by: null }],
    member_count: 1,
  };

  const sampleMember: TeamMember = {
    id: 'm-1',
    team_id: 'team-1',
    user_id: 'user-1',
    role: 'member',
    joined_at: '2026-01-01T00:00:00Z',
    added_by: null,
  };

  beforeEach(() => {
    mockTeamRepo = {
      findById: jest.fn(),
      findByIdAndTenant: jest.fn().mockResolvedValue(sampleTeam),
      findBySlug: jest.fn(),
      findAll: jest.fn().mockResolvedValue({ teams: [sampleTeam], total: 1 }),
      findByIdWithMembers: jest.fn().mockResolvedValue(sampleTeamWithMembers),
      create: jest.fn().mockResolvedValue(sampleTeam),
      update: jest.fn().mockResolvedValue(sampleTeam),
      delete: jest.fn().mockResolvedValue({ success: true, orphanedChildren: 0 }),
      addMember: jest.fn().mockResolvedValue(sampleMember),
      removeMember: jest.fn().mockResolvedValue(true),
      getMembers: jest.fn().mockResolvedValue([sampleMember]),
      getUserTeams: jest.fn().mockResolvedValue([sampleTeam]),
      isMember: jest.fn().mockResolvedValue(true),
      getMemberRole: jest.fn().mockResolvedValue('member'),
      updateMemberRole: jest.fn().mockResolvedValue({ ...sampleMember, role: 'admin' }),
      assignRole: jest.fn().mockResolvedValue({ id: 'r-1', team_id: 'team-1', role_name: 'deploy', granted_at: '', granted_by: null }),
      removeRole: jest.fn().mockResolvedValue(true),
      getTeamRoles: jest.fn().mockResolvedValue(['deploy']),
      getUserTeamRoleNames: jest.fn().mockResolvedValue(['deploy']),
      findBySlugs: jest.fn().mockResolvedValue([sampleTeam]),
      getMemberUserIds: jest.fn().mockResolvedValue(['user-1']),
      getMemberUserIdsByTeamIds: jest.fn().mockResolvedValue(new Map([['team-1', ['user-1']]])),
    } as any;

    mockRoleRepo = {
      findByName: jest.fn().mockResolvedValue({ id: 'role-1', name: 'deploy' }),
      findPermissionsByRoleNames: jest.fn().mockResolvedValue([{ resource: 'deployments', action: 'create' }]),
    };

    service = new TeamService(mockTeamRepo, mockRoleRepo);
  });

  // ==================== getTeam ====================

  describe('getTeam', () => {
    it('should return team with members', async () => {
      const result = await service.getTeam('team-1', 't-1');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Platform Team');
      expect(result!.members).toHaveLength(1);
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdWithMembers.mockResolvedValue(null);
      await expect(service.getTeam('non-existent', 't-1')).rejects.toThrow('Team not found');
    });
  });

  // ==================== getTeamBySlug ====================

  describe('getTeamBySlug', () => {
    it('should return team by slug', async () => {
      mockTeamRepo.findBySlug.mockResolvedValue(sampleTeam);
      const result = await service.getTeamBySlug('platform-team', 't-1');
      expect(result!.slug).toBe('platform-team');
    });

    it('should return null when slug not found', async () => {
      mockTeamRepo.findBySlug.mockResolvedValue(null);
      expect(await service.getTeamBySlug('unknown', 't-1')).toBeNull();
    });
  });

  // ==================== listTeams ====================

  describe('listTeams', () => {
    it('should list teams', async () => {
      const result = await service.listTeams('t-1');
      expect(result.teams).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass type filter', async () => {
      await service.listTeams('t-1', 'sre', 10, 0);
      expect(mockTeamRepo.findAll).toHaveBeenCalledWith('t-1', 'sre', 10, 0);
    });
  });

  // ==================== createTeam ====================

  describe('createTeam', () => {
    it('should create team with valid slug', async () => {
      mockTeamRepo.findBySlug.mockResolvedValue(null);
      const result = await service.createTeam({ tenant_id: 't-1', name: 'Test', slug: 'test-team' });
      expect(result.name).toBe('Platform Team');
    });

    it('should throw on invalid slug format', async () => {
      await expect(
        service.createTeam({ tenant_id: 't-1', name: 'Test', slug: 'Invalid Slug!' })
      ).rejects.toThrow('slug must be lowercase');
    });

    it('should throw on duplicate slug', async () => {
      mockTeamRepo.findBySlug.mockResolvedValue(sampleTeam);
      await expect(
        service.createTeam({ tenant_id: 't-1', name: 'Test', slug: 'platform-team' })
      ).rejects.toThrow('already exists');
    });

    it('should throw on invalid parent team', async () => {
      mockTeamRepo.findBySlug.mockResolvedValue(null);
      mockTeamRepo.findById.mockResolvedValue(null);
      await expect(
        service.createTeam({ tenant_id: 't-1', name: 'Test', slug: 'test', parent_team_id: 'bad-parent' })
      ).rejects.toThrow('Parent team not found');
    });

    it('should throw when parent is in different tenant', async () => {
      mockTeamRepo.findBySlug.mockResolvedValue(null);
      mockTeamRepo.findById.mockResolvedValue({ ...sampleTeam, tenant_id: 'other-tenant' });
      await expect(
        service.createTeam({ tenant_id: 't-1', name: 'Test', slug: 'test', parent_team_id: 'team-x' })
      ).rejects.toThrow('Parent team not found');
    });
  });

  // ==================== updateTeam ====================

  describe('updateTeam', () => {
    it('should update team', async () => {
      const result = await service.updateTeam('team-1', 't-1', { name: 'Updated' });
      expect(result).toBeDefined();
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.updateTeam('non-existent', 't-1', { name: 'New' })).rejects.toThrow('Team not found');
    });

    it('should throw on invalid parent team', async () => {
      mockTeamRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateTeam('team-1', 't-1', { parent_team_id: 'bad-parent' })
      ).rejects.toThrow('Parent team not found');
    });

    it('should detect circular reference', async () => {
      // team-2 wants parent=team-1, but team-1's parent is team-2 → circular
      // findByIdAndTenant returns team-2 (sampleTeam is fine, just needs non-null)
      // findById('team-1') returns team-1 with parent_team_id='team-2'
      mockTeamRepo.findById
        .mockResolvedValueOnce({ ...sampleTeam, id: 'team-1', parent_team_id: 'team-2' }) // parent lookup
        .mockResolvedValueOnce({ ...sampleTeam, id: 'team-1', parent_team_id: 'team-2' }); // ancestor in while loop

      await expect(
        service.updateTeam('team-2', 't-1', { parent_team_id: 'team-1' })
      ).rejects.toThrow('Circular team reference');
    });

    it('should throw when update returns null', async () => {
      mockTeamRepo.update.mockResolvedValue(null);
      await expect(service.updateTeam('team-1', 't-1', { name: 'New' })).rejects.toThrow('Failed to update');
    });
  });

  // ==================== deleteTeam ====================

  describe('deleteTeam', () => {
    it('should delete team', async () => {
      const result = await service.deleteTeam('team-1', 't-1');
      expect(result.deleted).toBe(true);
      expect(result.orphanedChildren).toBe(0);
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.deleteTeam('non-existent', 't-1')).rejects.toThrow('Team not found');
    });
  });

  // ==================== Membership ====================

  describe('addMember', () => {
    it('should add member with valid role', async () => {
      const result = await service.addMember('team-1', 'user-1', 't-1', 'member');
      expect(result.team_id).toBe('team-1');
    });

    it('should throw on invalid role', async () => {
      await expect(
        service.addMember('team-1', 'user-1', 't-1', 'superadmin')
      ).rejects.toThrow('Invalid member role');
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.addMember('team-1', 'user-1', 't-1')).rejects.toThrow('Team not found');
    });
  });

  describe('removeMember', () => {
    it('should remove member', async () => {
      expect(await service.removeMember('team-1', 'user-1', 't-1')).toBe(true);
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.removeMember('team-1', 'user-1', 't-1')).rejects.toThrow('Team not found');
    });
  });

  describe('getTeamMembers', () => {
    it('should return team members', async () => {
      const result = await service.getTeamMembers('team-1', 't-1');
      expect(result).toHaveLength(1);
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.getTeamMembers('team-1', 't-1')).rejects.toThrow('Team not found');
    });
  });

  describe('getUserTeams', () => {
    it('should return user teams', async () => {
      const result = await service.getUserTeams('user-1', 't-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('isTeamMember', () => {
    it('should return true when user is member', async () => {
      expect(await service.isTeamMember('team-1', 'user-1', 't-1')).toBe(true);
    });

    it('should return false when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      expect(await service.isTeamMember('team-1', 'user-1', 't-1')).toBe(false);
    });

    it('should return false when user is not member', async () => {
      mockTeamRepo.isMember.mockResolvedValue(false);
      expect(await service.isTeamMember('team-1', 'user-99', 't-1')).toBe(false);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const result = await service.updateMemberRole('team-1', 'user-1', 't-1', 'admin');
      expect(result.role).toBe('admin');
    });

    it('should throw on invalid role', async () => {
      await expect(
        service.updateMemberRole('team-1', 'user-1', 't-1', 'superadmin')
      ).rejects.toThrow('Invalid member role');
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.updateMemberRole('team-1', 'user-1', 't-1', 'admin')).rejects.toThrow('Team not found');
    });

    it('should throw when member not found', async () => {
      mockTeamRepo.updateMemberRole.mockResolvedValue(null);
      await expect(service.updateMemberRole('team-1', 'user-99', 't-1', 'admin')).rejects.toThrow('Member not found');
    });
  });

  // ==================== Team Roles ====================

  describe('assignRole', () => {
    it('should assign role to team', async () => {
      await service.assignRole('team-1', 'deploy', 't-1');
      expect(mockTeamRepo.assignRole).toHaveBeenCalledWith('team-1', 'deploy', undefined);
    });

    it('should assign role with grantedBy', async () => {
      await service.assignRole('team-1', 'deploy', 't-1', 'admin');
      expect(mockTeamRepo.assignRole).toHaveBeenCalledWith('team-1', 'deploy', 'admin');
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.assignRole('team-1', 'deploy', 't-1')).rejects.toThrow('Team not found');
    });

    it('should throw when role does not exist', async () => {
      mockRoleRepo.findByName.mockResolvedValue(null);
      await expect(service.assignRole('team-1', 'nonexistent', 't-1')).rejects.toThrow('does not exist');
    });

    it('should skip role validation when no roleRepo', async () => {
      const serviceNoRoleRepo = new TeamService(mockTeamRepo);
      await serviceNoRoleRepo.assignRole('team-1', 'any-role', 't-1');
      expect(mockTeamRepo.assignRole).toHaveBeenCalled();
    });
  });

  describe('removeRole', () => {
    it('should remove role from team', async () => {
      expect(await service.removeRole('team-1', 'deploy', 't-1')).toBe(true);
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.removeRole('team-1', 'deploy', 't-1')).rejects.toThrow('Team not found');
    });
  });

  describe('getTeamRoles', () => {
    it('should return team roles', async () => {
      const result = await service.getTeamRoles('team-1', 't-1');
      expect(result).toEqual(['deploy']);
    });

    it('should throw when team not found', async () => {
      mockTeamRepo.findByIdAndTenant.mockResolvedValue(null);
      await expect(service.getTeamRoles('team-1', 't-1')).rejects.toThrow('Team not found');
    });
  });

  // ==================== Permission Aggregation ====================

  describe('getUserTeamPermissions', () => {
    it('should return aggregated permissions', async () => {
      const result = await service.getUserTeamPermissions('user-1', 't-1');
      expect(result).toHaveLength(1);
      expect(result[0].resource).toBe('deployments');
    });

    it('should return empty when no roleRepo', async () => {
      const serviceNoRoleRepo = new TeamService(mockTeamRepo);
      const result = await serviceNoRoleRepo.getUserTeamPermissions('user-1', 't-1');
      expect(result).toEqual([]);
    });

    it('should return empty when user has no team roles', async () => {
      mockTeamRepo.getUserTeamRoleNames.mockResolvedValue([]);
      const result = await service.getUserTeamPermissions('user-1', 't-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== CODEOWNERS Resolution ====================

  describe('resolveCodeOwners', () => {
    it('should resolve team slugs to member IDs', async () => {
      const result = await service.resolveCodeOwners(['platform-team'], 't-1');
      expect(result).toEqual(['user-1']);
    });

    it('should return empty when no teams match', async () => {
      mockTeamRepo.findBySlugs.mockResolvedValue([]);
      const result = await service.resolveCodeOwners(['unknown'], 't-1');
      expect(result).toEqual([]);
    });

    it('should deduplicate member IDs across teams', async () => {
      const team2 = { ...sampleTeam, id: 'team-2', slug: 'backend-team' };
      mockTeamRepo.findBySlugs.mockResolvedValue([sampleTeam, team2]);
      mockTeamRepo.getMemberUserIdsByTeamIds.mockResolvedValue(
        new Map([['team-1', ['user-1', 'user-2']], ['team-2', ['user-2', 'user-3']]])
      );

      const result = await service.resolveCodeOwners(['platform-team', 'backend-team'], 't-1');
      expect(result).toHaveLength(3);
      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });
  });

  describe('isCodeOwner', () => {
    it('should return true when user is member of a codeowner team', async () => {
      expect(await service.isCodeOwner(['platform-team'], 'user-1', 't-1')).toBe(true);
    });

    it('should return false when user is not a member', async () => {
      mockTeamRepo.isMember.mockResolvedValue(false);
      expect(await service.isCodeOwner(['platform-team'], 'user-99', 't-1')).toBe(false);
    });

    it('should return false when no teams match', async () => {
      mockTeamRepo.findBySlugs.mockResolvedValue([]);
      expect(await service.isCodeOwner(['unknown'], 'user-1', 't-1')).toBe(false);
    });
  });
});
