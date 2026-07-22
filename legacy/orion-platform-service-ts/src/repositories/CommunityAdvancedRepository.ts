/**
 * CommunityAdvancedRepository - PostgreSQL persistence for community advanced features
 *
 * Persists badges, incentive programs, and mentorship pairs.
 * Writes are fire-and-forget; reads try DB first then fall back to memory.
 */

import { BaseRepository } from '../db/base-repository';

export interface CommunityBadgeEntity {
  id: string;
  userId: string;
  type: string;
  name: string;
  description: string;
  awardedAt: Date;
  tenantId: string;
  createdAt: Date;
}

export interface IncentiveProgramEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MentorshipPairEntity {
  id: string;
  mentorId: string;
  menteeId: string;
  tenantId: string;
  status: string;
  assignedAt: Date;
  goals: string[];
  createdAt: Date;
}

export class CommunityAdvancedRepository extends BaseRepository<CommunityBadgeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'community_badges');
  }

  // ========== Badges ==========

  async saveBadge(badge: Omit<CommunityBadgeEntity, 'createdAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO community_badges (id, user_id, type, name, description, awarded_at, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [badge.id, badge.userId, badge.type, badge.name, badge.description, badge.awardedAt, badge.tenantId],
    );
  }

  async findBadgesByUser(userId: string): Promise<CommunityBadgeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM community_badges WHERE user_id = $1 ORDER BY awarded_at DESC`,
      [userId],
    );
    return result.rows.map(r => this.mapBadgeRow(r));
  }

  async findBadgesByTenant(tenantId: string): Promise<CommunityBadgeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM community_badges WHERE tenant_id = $1 ORDER BY awarded_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapBadgeRow(r));
  }

  // ========== Incentive Programs ==========

  async saveIncentiveProgram(program: Omit<IncentiveProgramEntity, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO community_incentive_programs (id, tenant_id, name, description, config, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, config = EXCLUDED.config`,
      [program.id, program.tenantId, program.name, program.description, JSON.stringify(program.config), program.status],
    );
  }

  async findIncentiveProgramsByTenant(tenantId: string): Promise<IncentiveProgramEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM community_incentive_programs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapIncentiveProgramRow(r));
  }

  // ========== Mentorship Pairs ==========

  async saveMentorshipPair(pair: Omit<MentorshipPairEntity, 'createdAt'>): Promise<void> {
    await this.db.query(
      `INSERT INTO community_mentorship_pairs (id, mentor_id, mentee_id, tenant_id, status, assigned_at, goals)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [pair.id, pair.mentorId, pair.menteeId, pair.tenantId, pair.status, pair.assignedAt, pair.goals || []],
    );
  }

  async findMentorshipPairsByTenant(tenantId: string): Promise<MentorshipPairEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM community_mentorship_pairs WHERE tenant_id = $1 ORDER BY assigned_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapMentorshipPairRow(r));
  }

  async findAllMentorshipPairs(): Promise<MentorshipPairEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM community_mentorship_pairs ORDER BY assigned_at DESC`,
    );
    return result.rows.map(r => this.mapMentorshipPairRow(r));
  }

  // ========== Row Mappers ==========

  private mapBadgeRow(row: any): CommunityBadgeEntity {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      name: row.name,
      description: row.description,
      awardedAt: row.awarded_at ? new Date(row.awarded_at) : new Date(),
      tenantId: row.tenant_id,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  private mapIncentiveProgramRow(row: any): IncentiveProgramEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapMentorshipPairRow(row: any): MentorshipPairEntity {
    return {
      id: row.id,
      mentorId: row.mentor_id,
      menteeId: row.mentee_id,
      tenantId: row.tenant_id,
      status: row.status,
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : new Date(),
      goals: row.goals || [],
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  protected mapRowToEntity(row: any): CommunityBadgeEntity {
    return this.mapBadgeRow(row);
  }
}
