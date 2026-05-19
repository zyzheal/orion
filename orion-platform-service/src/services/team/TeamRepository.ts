import { DatabasePool } from '../database';

/**
 * Team data interface
 */
export interface Team {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  team_type: 'functional' | 'project' | 'sre' | 'dba' | 'security';
  parent_team_id: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Team member data interface
 */
export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'member' | 'lead' | 'admin';
  joined_at: string;
  added_by: string | null;
}

/**
 * Team with members (for detail queries)
 */
export interface TeamWithMembers extends Team {
  members: TeamMember[];
  member_count: number;
}

/**
 * Team role assignment
 */
export interface TeamRole {
  id: string;
  team_id: string;
  role_name: string;
  granted_at: string;
  granted_by: string | null;
}

/**
 * TeamRepository - Database layer for Team operations
 */
export class TeamRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Team CRUD ====================

  async findById(id: string): Promise<Team | null> {
    const result = await this.pool.query('SELECT * FROM teams WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<Team | null> {
    const result = await this.pool.query(
      'SELECT * FROM teams WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  async findBySlug(slug: string, tenantId: string): Promise<Team | null> {
    const result = await this.pool.query(
      'SELECT * FROM teams WHERE slug = $1 AND tenant_id = $2',
      [slug, tenantId]
    );
    return result.rows[0] || null;
  }

  async findAll(tenantId: string, type?: string, limit = 50, offset = 0): Promise<{ teams: Team[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (type) {
      conditions.push(`team_type = $${paramIdx++}`);
      params.push(type);
    }

    const where = conditions.join(' AND ');
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM teams WHERE ${where}`,
      params
    );

    params.push(limit, offset);
    const result = await this.pool.query(
      `SELECT * FROM teams WHERE ${where} ORDER BY name LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    return {
      teams: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findByIdWithMembers(id: string, tenantId?: string): Promise<TeamWithMembers | null> {
    const query = tenantId
      ? 'SELECT * FROM teams WHERE id = $1 AND tenant_id = $2'
      : 'SELECT * FROM teams WHERE id = $1';
    const params = tenantId ? [id, tenantId] : [id];
    const teamResult = await this.pool.query(query, params);
    const team = teamResult.rows[0];
    if (!team) return null;

    const membersResult = await this.pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 ORDER BY joined_at',
      [id]
    );

    const countResult = await this.pool.query(
      'SELECT COUNT(*) FROM team_members WHERE team_id = $1',
      [id]
    );

    return {
      ...team,
      members: membersResult.rows,
      member_count: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  async create(data: {
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
    const result = await this.pool.query(
      `INSERT INTO teams (tenant_id, name, slug, description, team_type, parent_team_id, external_id, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.tenant_id,
        data.name,
        data.slug,
        data.description || null,
        data.team_type || 'functional',
        data.parent_team_id || null,
        data.external_id || null,
        data.metadata || {},
        data.created_by || null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: {
    name?: string;
    description?: string;
    team_type?: string;
    parent_team_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Team | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { updates.push(`name = $${idx++}`); params.push(input.name); }
    if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
    if (input.team_type !== undefined) { updates.push(`team_type = $${idx++}`); params.push(input.team_type); }
    if (input.parent_team_id !== undefined) { updates.push(`parent_team_id = $${idx++}`); params.push(input.parent_team_id); }
    if (input.metadata !== undefined) { updates.push(`metadata = $${idx++}`); params.push(input.metadata); }

    if (updates.length === 0) return this.findById(id);
    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<{ success: boolean; orphanedChildren: number }> {
    // Count child teams that will be orphaned (parent_team_id SET NULL on delete)
    const childResult = await this.pool.query(
      'SELECT COUNT(*) FROM teams WHERE parent_team_id = $1',
      [id]
    );
    const orphanedChildren = parseInt(childResult.rows[0].count, 10);

    const result = await this.pool.query('DELETE FROM teams WHERE id = $1', [id]);
    return { success: (result.rowCount || 0) > 0, orphanedChildren };
  }

  // ==================== Team Members ====================

  async addMember(teamId: string, userId: string, role: string = 'member', addedBy?: string): Promise<TeamMember> {
    const result = await this.pool.query(
      `INSERT INTO team_members (team_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [teamId, userId, role, addedBy || null]
    );
    return result.rows[0];
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    const result = await this.pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 ORDER BY role DESC, joined_at',
      [teamId]
    );
    return result.rows;
  }

  async getUserTeams(userId: string, tenantId: string): Promise<Team[]> {
    const result = await this.pool.query(
      `SELECT t.* FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND t.tenant_id = $2
       ORDER BY t.name`,
      [userId, tenantId]
    );
    return result.rows;
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return result.rows.length > 0;
  }

  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return result.rows[0]?.role || null;
  }

  async updateMemberRole(teamId: string, userId: string, newRole: string): Promise<TeamMember | null> {
    const result = await this.pool.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3 RETURNING *',
      [newRole, teamId, userId]
    );
    return result.rows[0] || null;
  }

  // ==================== Team Roles ====================

  async assignRole(teamId: string, roleName: string, grantedBy?: string): Promise<TeamRole> {
    const result = await this.pool.query(
      `INSERT INTO team_roles (team_id, role_name, granted_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, role_name) DO NOTHING
       RETURNING *`,
      [teamId, roleName, grantedBy || null]
    );
    return result.rows[0];
  }

  async removeRole(teamId: string, roleName: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM team_roles WHERE team_id = $1 AND role_name = $2',
      [teamId, roleName]
    );
    return (result.rowCount || 0) > 0;
  }

  async getTeamRoles(teamId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT role_name FROM team_roles WHERE team_id = $1',
      [teamId]
    );
    return result.rows.map(r => r.role_name);
  }

  // ==================== Bulk / Permission Helpers ====================

  /** Get all role names for a user across all their teams (for permission aggregation) */
  async getUserTeamRoleNames(userId: string, tenantId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT tr.role_name FROM team_roles tr
       JOIN team_members tm ON tm.team_id = tr.team_id
       JOIN teams t ON t.id = tr.team_id
       WHERE tm.user_id = $1 AND t.tenant_id = $2`,
      [userId, tenantId]
    );
    return result.rows.map(r => r.role_name);
  }

  /** Find teams by slug pattern (for CODEOWNERS @team-name resolution) */
  async findBySlugs(slugs: string[], tenantId: string): Promise<Team[]> {
    if (slugs.length === 0) return [];
    const result = await this.pool.query(
      'SELECT * FROM teams WHERE slug = ANY($1) AND tenant_id = $2',
      [slugs, tenantId]
    );
    return result.rows;
  }

  /** Get member IDs for a team (for CODEOWNERS resolution) */
  async getMemberUserIds(teamId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT user_id FROM team_members WHERE team_id = $1',
      [teamId]
    );
    return result.rows.map(r => r.user_id);
  }

  /** Batch get member user IDs for multiple teams (avoids N+1 queries) */
  async getMemberUserIdsByTeamIds(teamIds: string[]): Promise<Map<string, string[]>> {
    if (teamIds.length === 0) return new Map();
    const result = await this.pool.query(
      'SELECT team_id, user_id FROM team_members WHERE team_id = ANY($1)',
      [teamIds]
    );
    const map = new Map<string, string[]>();
    for (const row of result.rows) {
      const existing = map.get(row.team_id) || [];
      existing.push(row.user_id);
      map.set(row.team_id, existing);
    }
    return map;
  }
}
