/**
 * TeamService - Business logic layer for lightweight Team model
 *
 * Provides:
 * - Team CRUD with tenant isolation
 * - Team membership management
 * - Team role assignment
 * - Permission aggregation from team roles
 * - CODEOWNERS @team-name resolution
 */
import { TeamRepository, Team, TeamMember, TeamWithMembers } from './TeamRepository';
import { RoleRepository } from '../role/RoleRepository';

const VALID_MEMBER_ROLES = ['member', 'lead', 'admin'] as const;

export class TeamServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'TeamServiceError'; }
}

export class TeamService {
  constructor(
    private teamRepo: TeamRepository,
    private roleRepo?: RoleRepository
  ) {}

  // ==================== Team CRUD ====================

  async getTeam(id: string, tenantId: string): Promise<TeamWithMembers | null> {
    const team = await this.teamRepo.findByIdWithMembers(id, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    return team;
  }

  async getTeamBySlug(slug: string, tenantId: string): Promise<Team | null> {
    return this.teamRepo.findBySlug(slug, tenantId);
  }

  async listTeams(tenantId: string, type?: string, limit = 50, offset = 0): Promise<{ teams: Team[]; total: number }> {
    return this.teamRepo.findAll(tenantId, type, limit, offset);
  }

  async createTeam(data: {
    tenant_id: string;
    name: string;
    slug: string;
    description?: string;
    team_type?: string;
    parent_team_id?: string;
    external_id?: string;
    metadata?: Record<string, unknown>;
    created_by?: string;
  }): Promise<Team> {
    // Validate slug format: lowercase, hyphens, no spaces
    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!slugRegex.test(data.slug)) {
      throw new TeamServiceError(
        'Team slug must be lowercase alphanumeric with hyphens (e.g. "platform-sre")',
        'INVALID_SLUG'
      );
    }

    // Check for duplicate slug
    const existing = await this.teamRepo.findBySlug(data.slug, data.tenant_id);
    if (existing) {
      throw new TeamServiceError(`Team with slug "${data.slug}" already exists`, 'DUPLICATE_SLUG');
    }

    // Validate parent_team_id belongs to same tenant
    if (data.parent_team_id) {
      const parent = await this.teamRepo.findById(data.parent_team_id);
      if (!parent || parent.tenant_id !== data.tenant_id) {
        throw new TeamServiceError('Parent team not found in the same tenant', 'INVALID_PARENT_TEAM');
      }
    }

    return this.teamRepo.create(data);
  }

  async updateTeam(id: string, tenantId: string, input: {
    name?: string;
    description?: string;
    team_type?: string;
    parent_team_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Team> {
    const existing = await this.teamRepo.findByIdAndTenant(id, tenantId);
    if (!existing) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }

    // Validate parent_team_id if changed
    if (input.parent_team_id !== undefined && input.parent_team_id !== null) {
      const parent = await this.teamRepo.findById(input.parent_team_id);
      if (!parent || parent.tenant_id !== tenantId) {
        throw new TeamServiceError('Parent team not found in the same tenant', 'INVALID_PARENT_TEAM');
      }
      // Walk parent chain to detect circular references (A->B->C->A)
      const visited = new Set<string>();
      let current: string | null = input.parent_team_id;
      while (current) {
        if (current === id) {
          throw new TeamServiceError('Circular team reference detected', 'CIRCULAR_REFERENCE');
        }
        if (visited.has(current)) break; // safety
        visited.add(current);
        const ancestor = await this.teamRepo.findById(current);
        current = ancestor?.parent_team_id || null;
      }
    }

    const updated = await this.teamRepo.update(id, input);
    if (!updated) {
      throw new TeamServiceError('Failed to update team', 'UPDATE_FAILED');
    }
    return updated;
  }

  async deleteTeam(id: string, tenantId: string): Promise<{ deleted: boolean; orphanedChildren: number }> {
    const existing = await this.teamRepo.findByIdAndTenant(id, tenantId);
    if (!existing) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    const result = await this.teamRepo.delete(id);
    return { deleted: result.success, orphanedChildren: result.orphanedChildren };
  }

  // ==================== Team Membership ====================

  async addMember(teamId: string, userId: string, tenantId: string, role: string = 'member', addedBy?: string): Promise<TeamMember> {
    if (!VALID_MEMBER_ROLES.includes(role as any)) {
      throw new TeamServiceError('Invalid member role', 'INVALID_ROLE');
    }
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }

    return this.teamRepo.addMember(teamId, userId, role, addedBy);
  }

  async removeMember(teamId: string, userId: string, tenantId: string): Promise<boolean> {
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    return this.teamRepo.removeMember(teamId, userId);
  }

  async getTeamMembers(teamId: string, tenantId: string): Promise<TeamMember[]> {
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    return this.teamRepo.getMembers(teamId);
  }

  async getUserTeams(userId: string, tenantId: string): Promise<Team[]> {
    return this.teamRepo.getUserTeams(userId, tenantId);
  }

  async isTeamMember(teamId: string, userId: string, tenantId: string): Promise<boolean> {
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) return false;
    return this.teamRepo.isMember(teamId, userId);
  }

  async updateMemberRole(teamId: string, userId: string, tenantId: string, newRole: string): Promise<TeamMember> {
    if (!VALID_MEMBER_ROLES.includes(newRole as any)) {
      throw new TeamServiceError('Invalid member role', 'INVALID_ROLE');
    }
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    const updated = await this.teamRepo.updateMemberRole(teamId, userId, newRole);
    if (!updated) {
      throw new TeamServiceError('Member not found in team', 'MEMBER_NOT_FOUND');
    }
    return updated;
  }

  // ==================== Team Roles ====================

  async assignRole(teamId: string, roleName: string, tenantId: string, grantedBy?: string): Promise<void> {
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }

    // Validate role exists
    if (this.roleRepo) {
      const role = await this.roleRepo.findByName(roleName);
      if (!role) {
        throw new TeamServiceError(`Role "${roleName}" does not exist`, 'INVALID_ROLE');
      }
    }

    await this.teamRepo.assignRole(teamId, roleName, grantedBy);
  }

  async removeRole(teamId: string, roleName: string, tenantId: string): Promise<boolean> {
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    return this.teamRepo.removeRole(teamId, roleName);
  }

  async getTeamRoles(teamId: string, tenantId: string): Promise<string[]> {
    const team = await this.teamRepo.findByIdAndTenant(teamId, tenantId);
    if (!team) {
      throw new TeamServiceError('Team not found', 'TEAM_NOT_FOUND');
    }
    return this.teamRepo.getTeamRoles(teamId);
  }

  // ==================== Permission Aggregation ====================

  /**
   * Get all permissions for a user through their team memberships.
   * Aggregates permissions from all roles assigned to teams the user belongs to.
   */
  async getUserTeamPermissions(userId: string, tenantId: string): Promise<{ resource: string; action: string }[]> {
    if (!this.roleRepo) return [];

    const teamRoleNames = await this.teamRepo.getUserTeamRoleNames(userId, tenantId);
    if (teamRoleNames.length === 0) return [];

    return this.roleRepo.findPermissionsByRoleNames(teamRoleNames);
  }

  // ==================== CODEOWNERS Resolution ====================

  /**
   * Resolve @team-name strings from CODEOWNERS to actual team members.
   * Returns user IDs of team members.
   */
  async resolveCodeOwners(teamsSlugs: string[], tenantId: string): Promise<string[]> {
    const teams = await this.teamRepo.findBySlugs(teamsSlugs, tenantId);
    if (teams.length === 0) return [];

    // Batch query all member IDs in one query (avoids N+1)
    const teamIds = teams.map(t => t.id);
    const memberMap = await this.teamRepo.getMemberUserIdsByTeamIds(teamIds);

    const memberIds = new Set<string>();
    for (const ids of memberMap.values()) {
      ids.forEach(id => memberIds.add(id));
    }

    return Array.from(memberIds);
  }

  /**
   * Check if a user is a code owner for a given path.
   * Parses CODEOWNERS patterns and checks team membership.
   */
  async isCodeOwner(teamsSlugs: string[], userId: string, tenantId: string): Promise<boolean> {
    const teams = await this.teamRepo.findBySlugs(teamsSlugs, tenantId);
    for (const team of teams) {
      if (await this.teamRepo.isMember(team.id, userId)) {
        return true;
      }
    }
    return false;
  }
}
