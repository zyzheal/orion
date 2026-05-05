/**
 * Community Advanced Service - Phase 4
 *
 * 社区生态进阶功能：徽章、激励计划、导师配对
 */

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
    return badge;
  }

  async listUserBadges(userId: string): Promise<Badge[]> {
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
    return program;
  }

  async getIncentivePrograms(tenantId: string): Promise<IncentiveProgram[]> {
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
    return pair;
  }

  async getMentorshipPairs(tenantId?: string): Promise<MentorshipPair[]> {
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
    return Array.from(this.badges.values()).filter((b) => b.userId === userId);
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
