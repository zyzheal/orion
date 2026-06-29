/**
 * Community Advanced Service - Phase 4
 *
 * 社区生态进阶功能：徽章、激励计划、导师配对
 *
 * Persistence strategy:
 * - Writes: fire-and-forget to PostgreSQL (non-blocking), always update in-memory Map
 * - Reads: try DB first, fall back to in-memory Map on DB failure
 * - Startup: load from DB to hydrate in-memory Maps
 */

import pino from 'pino';
import { CommunityAdvancedRepository } from '../../repositories/CommunityAdvancedRepository';

const logger = pino({ name: 'CommunityAdvancedService' });

export interface Badge {
  id: string;
  userId: string;
  type: string;
  name: string;
  description: string;
  awardedAt: string;
  tenantId: string;
}

export interface IncentiveProgram {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  status: 'active' | 'paused' | 'ended';
  createdAt: string;
  updatedAt: string;
}

export interface MentorshipPair {
  id: string;
  mentorId: string;
  menteeId: string;
  tenantId: string;
  status: 'active' | 'completed' | 'cancelled';
  assignedAt: string;
  goals?: string[];
}

export class CommunityAdvancedService {
  private badges = new Map<string, Badge>();
  private incentivePrograms = new Map<string, IncentiveProgram>();
  private mentorshipPairs = new Map<string, MentorshipPair>();
  private repo?: CommunityAdvancedRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new CommunityAdvancedRepository(db);
      this.loadFromDb().catch(err => {
        logger.warn({ err }, 'Failed to load community data from DB on startup');
      });
    }
  }

  private async loadFromDb(): Promise<void> {
    if (!this.repo) return;
    try {
      // Load badges
      // Note: loadFromDb loads all tenants' data — acceptable for startup hydration
      const badgeRows = await this.repo.findBadgesByTenant('all');
      // Since findBadgesByTenant filters by tenant, we use a raw query for initial load
      const badgeResult = await this.repo['db'].query(
        `SELECT * FROM community_badges ORDER BY awarded_at ASC`,
      );
      for (const row of badgeResult.rows) {
        const badge: Badge = {
          id: row.id,
          userId: row.user_id,
          type: row.type,
          name: row.name,
          description: row.description,
          awardedAt: row.awarded_at instanceof Date ? row.awarded_at.toISOString() : row.awarded_at,
          tenantId: row.tenant_id,
        };
        this.badges.set(badge.id, badge);
      }

      const programResult = await this.repo['db'].query(
        `SELECT * FROM community_incentive_programs ORDER BY created_at ASC`,
      );
      for (const row of programResult.rows) {
        const program: IncentiveProgram = {
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          description: row.description,
          config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
          status: row.status,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
        this.incentivePrograms.set(program.id, program);
      }

      const pairResult = await this.repo['db'].query(
        `SELECT * FROM community_mentorship_pairs ORDER BY assigned_at ASC`,
      );
      for (const row of pairResult.rows) {
        const pair: MentorshipPair = {
          id: row.id,
          mentorId: row.mentor_id,
          menteeId: row.mentee_id,
          tenantId: row.tenant_id,
          status: row.status,
          assignedAt: row.assigned_at instanceof Date ? row.assigned_at.toISOString() : row.assigned_at,
          goals: row.goals || [],
        };
        this.mentorshipPairs.set(pair.id, pair);
      }

      logger.info({
        badges: this.badges.size,
        programs: this.incentivePrograms.size,
        pairs: this.mentorshipPairs.size,
      }, 'Loaded community advanced data from DB');
    } catch (err) {
      logger.warn({ err }, 'Failed to load community data from DB');
    }
  }

  // ========== Badge Management ==========

  async awardBadge(
    tenantId: string,
    userId: string,
    badgeType: string,
  ): Promise<Badge> {
    const id = `badge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const badgeMeta = this.getBadgeMeta(badgeType);
    const badge: Badge = {
      id,
      userId,
      type: badgeType,
      name: badgeMeta.name,
      description: badgeMeta.description,
      awardedAt: new Date().toISOString(),
      tenantId,
    };
    this.badges.set(id, badge);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveBadge({
        id: badge.id,
        userId: badge.userId,
        type: badge.type,
        name: badge.name,
        description: badge.description,
        awardedAt: new Date(badge.awardedAt),
        tenantId: badge.tenantId,
      }).catch(err => {
        logger.warn({ err, badgeId: id }, 'Failed to persist badge to DB');
      });
    }

    return badge;
  }

  async listUserBadges(userId: string): Promise<Badge[]> {
    // Try DB first, fall back to memory
    if (this.repo) {
      try {
        const rows = await this.repo.findBadgesByUser(userId);
        return rows.map(r => ({
          id: r.id,
          userId: r.userId,
          type: r.type,
          name: r.name,
          description: r.description,
          awardedAt: r.awardedAt instanceof Date ? r.awardedAt.toISOString() : r.awardedAt,
          tenantId: r.tenantId,
        }));
      } catch (err) {
        logger.warn({ err, userId }, 'DB listUserBadges failed, falling back to memory');
      }
    }
    return Array.from(this.badges.values()).filter((b) => b.userId === userId);
  }

  private getBadgeMeta(type: string): { name: string; description: string } {
    const metas: Record<string, { name: string; description: string }> = {
      'top-contributor': {
        name: 'Top Contributor',
        description: 'Outstanding community contributions',
      },
      'code-reviewer': {
        name: 'Code Reviewer',
        description: 'Excellent code review participation',
      },
      'bug-hunter': {
        name: 'Bug Hunter',
        description: 'Found and fixed critical bugs',
      },
      'mentor': {
        name: 'Mentor',
        description: 'Successfully mentored team members',
      },
      'doc-master': {
        name: 'Doc Master',
        description: 'Outstanding documentation contributions',
      },
      'early-adopter': {
        name: 'Early Adopter',
        description: 'Early adoption of new features',
      },
    };
    return (
      metas[type] ?? {
        name: type,
        description: `${type} badge`,
      }
    );
  }

  // ========== Incentive Program Management ==========

  async setupIncentiveProgram(
    tenantId: string,
    config: Record<string, unknown>,
  ): Promise<IncentiveProgram> {
    const id = `incentive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const program: IncentiveProgram = {
      id,
      tenantId,
      name: (config.name as string) || 'Incentive Program',
      description: (config.description as string) || '',
      config,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.incentivePrograms.set(id, program);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveIncentiveProgram({
        id: program.id,
        tenantId: program.tenantId,
        name: program.name,
        description: program.description,
        config: program.config,
        status: program.status,
      }).catch(err => {
        logger.warn({ err, programId: id }, 'Failed to persist incentive program to DB');
      });
    }

    return program;
  }

  async getIncentivePrograms(tenantId: string): Promise<IncentiveProgram[]> {
    if (this.repo) {
      try {
        const rows = await this.repo.findIncentiveProgramsByTenant(tenantId);
        return rows.map(r => ({
          id: r.id,
          tenantId: r.tenantId,
          name: r.name,
          description: r.description,
          config: r.config,
          status: r.status as IncentiveProgram['status'],
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        }));
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB getIncentivePrograms failed, falling back to memory');
      }
    }
    return Array.from(this.incentivePrograms.values()).filter(
      (p) => p.tenantId === tenantId,
    );
  }

  // ========== Mentorship Management ==========

  async assignMentor(
    tenantId: string,
    mentorId: string,
    menteeId: string,
    goals?: string[],
  ): Promise<MentorshipPair> {
    const id = `mentor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pair: MentorshipPair = {
      id,
      mentorId,
      menteeId,
      tenantId,
      status: 'active',
      assignedAt: new Date().toISOString(),
      goals,
    };
    this.mentorshipPairs.set(id, pair);

    // Fire-and-forget to PostgreSQL
    if (this.repo) {
      this.repo.saveMentorshipPair({
        id: pair.id,
        mentorId: pair.mentorId,
        menteeId: pair.menteeId,
        tenantId: pair.tenantId,
        status: pair.status,
        assignedAt: new Date(pair.assignedAt),
        goals: pair.goals || [],
      }).catch(err => {
        logger.warn({ err, pairId: id }, 'Failed to persist mentorship pair to DB');
      });
    }

    return pair;
  }

  async getMentorshipPairs(tenantId?: string): Promise<MentorshipPair[]> {
    if (this.repo) {
      try {
        if (tenantId) {
          const rows = await this.repo.findMentorshipPairsByTenant(tenantId);
          return rows.map(r => ({
            id: r.id,
            mentorId: r.mentorId,
            menteeId: r.menteeId,
            tenantId: r.tenantId,
            status: r.status as MentorshipPair['status'],
            assignedAt: r.assignedAt instanceof Date ? r.assignedAt.toISOString() : r.assignedAt,
            goals: r.goals,
          }));
        }
        const rows = await this.repo.findAllMentorshipPairs();
        return rows.map(r => ({
          id: r.id,
          mentorId: r.mentorId,
          menteeId: r.menteeId,
          tenantId: r.tenantId,
          status: r.status as MentorshipPair['status'],
          assignedAt: r.assignedAt instanceof Date ? r.assignedAt.toISOString() : r.assignedAt,
          goals: r.goals,
        }));
      } catch (err) {
        logger.warn({ err, tenantId }, 'DB getMentorshipPairs failed, falling back to memory');
      }
    }
    let pairs = Array.from(this.mentorshipPairs.values());
    if (tenantId) {
      pairs = pairs.filter((p) => p.tenantId === tenantId);
    }
    return pairs;
  }

  // ========== User Badges ==========

  /**
   * Get all badges for a specific user
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    return this.listUserBadges(userId);
  }

  /**
   * Get badge definitions (available badge types)
   */
  async getBadgeDefinitions(): Promise<{ type: string; name: string; description: string; criteria: string }[]> {
    const definitions = [
      { type: 'top-contributor', name: 'Top Contributor', description: 'Outstanding community contributions', criteria: '10+ approved contributions' },
      { type: 'code-reviewer', name: 'Code Reviewer', description: 'Excellent code review participation', criteria: '50+ code reviews completed' },
      { type: 'bug-hunter', name: 'Bug Hunter', description: 'Found and fixed critical bugs', criteria: '5+ critical bugs identified' },
      { type: 'mentor', name: 'Mentor', description: 'Successfully mentored team members', criteria: '3+ successful mentorships' },
      { type: 'doc-master', name: 'Doc Master', description: 'Outstanding documentation contributions', criteria: '20+ documentation contributions' },
      { type: 'early-adopter', name: 'Early Adopter', description: 'Early adoption of new features', criteria: 'First to use 3+ new features' },
      { type: 'best-practice-author', name: 'Best Practice Author', description: 'Created highly-voted best practices', criteria: 'Best practice with 50+ votes' },
      { type: 'community-champion', name: 'Community Champion', description: 'Overall community excellence', criteria: '5+ badges earned' },
    ];
    return definitions;
  }
}
