/**
 * CommunityAdvancedService Tests
 *
 * Covers: badge management, incentive programs, mentorship pairing,
 * badge definitions, and edge cases.
 */

import { CommunityAdvancedService } from '../CommunityAdvancedService';

describe('CommunityAdvancedService', () => {
  let service: CommunityAdvancedService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunityAdvancedService();
  });

  // ========== Badge Management ==========

  describe('awardBadge', () => {
    it('should award a known badge type with correct metadata', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-1', 'top-contributor');

      expect(badge.id).toBeDefined();
      expect(badge.id).toMatch(/^badge-/);
      expect(badge.userId).toBe('user-1');
      expect(badge.type).toBe('top-contributor');
      expect(badge.name).toBe('Top Contributor');
      expect(badge.description).toBe('Outstanding community contributions');
      expect(badge.awardedAt).toBeDefined();
      expect(badge.tenantId).toBe('tenant-1');
    });

    it('should award code-reviewer badge with correct metadata', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-2', 'code-reviewer');

      expect(badge.name).toBe('Code Reviewer');
      expect(badge.description).toBe('Excellent code review participation');
    });

    it('should award bug-hunter badge', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-3', 'bug-hunter');

      expect(badge.name).toBe('Bug Hunter');
      expect(badge.description).toBe('Found and fixed critical bugs');
    });

    it('should award mentor badge', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-4', 'mentor');

      expect(badge.name).toBe('Mentor');
      expect(badge.description).toBe('Successfully mentored team members');
    });

    it('should award doc-master badge', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-5', 'doc-master');

      expect(badge.name).toBe('Doc Master');
      expect(badge.description).toBe('Outstanding documentation contributions');
    });

    it('should award early-adopter badge', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-6', 'early-adopter');

      expect(badge.name).toBe('Early Adopter');
      expect(badge.description).toBe('Early adoption of new features');
    });

    it('should handle unknown badge type with fallback metadata', async () => {
      const badge = await service.awardBadge('tenant-1', 'user-7', 'custom-badge');

      expect(badge.name).toBe('custom-badge');
      expect(badge.description).toBe('custom-badge badge');
    });

    it('should generate unique badge ids', async () => {
      const badge1 = await service.awardBadge('tenant-1', 'user-1', 'top-contributor');
      const badge2 = await service.awardBadge('tenant-1', 'user-1', 'top-contributor');

      expect(badge1.id).not.toBe(badge2.id);
    });
  });

  describe('listUserBadges', () => {
    it('should return empty array for user with no badges', async () => {
      const badges = await service.listUserBadges('no-badge-user');
      expect(badges).toEqual([]);
    });

    it('should return all badges for a specific user', async () => {
      await service.awardBadge('tenant-1', 'user-1', 'top-contributor');
      await service.awardBadge('tenant-1', 'user-1', 'code-reviewer');
      await service.awardBadge('tenant-1', 'user-2', 'bug-hunter');

      const badges = await service.listUserBadges('user-1');
      expect(badges).toHaveLength(2);
      expect(badges.every((b) => b.userId === 'user-1')).toBe(true);
    });

    it('should not return badges from other users', async () => {
      await service.awardBadge('tenant-1', 'user-1', 'mentor');
      await service.awardBadge('tenant-1', 'user-2', 'doc-master');

      const badges = await service.listUserBadges('user-1');
      expect(badges).toHaveLength(1);
      expect(badges[0].type).toBe('mentor');
    });
  });

  describe('getUserBadges', () => {
    it('should return empty array for user with no badges', async () => {
      const badges = await service.getUserBadges('unknown-user');
      expect(badges).toEqual([]);
    });

    it('should return badges for a user across tenants', async () => {
      await service.awardBadge('tenant-1', 'user-1', 'top-contributor');
      await service.awardBadge('tenant-2', 'user-1', 'code-reviewer');

      const badges = await service.getUserBadges('user-1');
      expect(badges).toHaveLength(2);
    });
  });

  describe('getBadgeDefinitions', () => {
    it('should return all badge definitions', async () => {
      const definitions = await service.getBadgeDefinitions();

      expect(definitions).toHaveLength(8);
      expect(definitions.map((d) => d.type)).toEqual([
        'top-contributor',
        'code-reviewer',
        'bug-hunter',
        'mentor',
        'doc-master',
        'early-adopter',
        'best-practice-author',
        'community-champion',
      ]);
    });

    it('should include criteria for each definition', async () => {
      const definitions = await service.getBadgeDefinitions();

      for (const def of definitions) {
        expect(def.criteria).toBeDefined();
        expect(def.criteria.length).toBeGreaterThan(0);
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
      }
    });

    it('should include best-practice-author and community-champion definitions', async () => {
      const definitions = await service.getBadgeDefinitions();

      const bpa = definitions.find((d) => d.type === 'best-practice-author');
      expect(bpa).toBeDefined();
      expect(bpa!.criteria).toBe('Best practice with 50+ votes');

      const champion = definitions.find((d) => d.type === 'community-champion');
      expect(champion).toBeDefined();
      expect(champion!.criteria).toBe('5+ badges earned');
    });
  });

  // ========== Incentive Program Management ==========

  describe('setupIncentiveProgram', () => {
    it('should create an incentive program with active status', async () => {
      const program = await service.setupIncentiveProgram('tenant-1', {
        name: 'Q2 Contributor Program',
        description: 'Reward top contributors in Q2',
        targetContributions: 100,
      });

      expect(program.id).toMatch(/^incentive-/);
      expect(program.tenantId).toBe('tenant-1');
      expect(program.name).toBe('Q2 Contributor Program');
      expect(program.description).toBe('Reward top contributors in Q2');
      expect(program.status).toBe('active');
      expect(program.createdAt).toBeDefined();
      expect(program.updatedAt).toBeDefined();
      expect(program.config).toEqual({
        name: 'Q2 Contributor Program',
        description: 'Reward top contributors in Q2',
        targetContributions: 100,
      });
    });

    it('should use default name when config.name is missing', async () => {
      const program = await service.setupIncentiveProgram('tenant-1', {
        description: 'Some description',
      });

      expect(program.name).toBe('Incentive Program');
    });

    it('should use empty description when config.description is missing', async () => {
      const program = await service.setupIncentiveProgram('tenant-1', {
        name: 'Test',
      });

      expect(program.description).toBe('');
    });

    it('should generate unique ids for multiple programs', async () => {
      const p1 = await service.setupIncentiveProgram('tenant-1', { name: 'A' });
      const p2 = await service.setupIncentiveProgram('tenant-1', { name: 'B' });

      expect(p1.id).not.toBe(p2.id);
    });
  });

  describe('getIncentivePrograms', () => {
    it('should return programs filtered by tenantId', async () => {
      await service.setupIncentiveProgram('tenant-1', { name: 'Program A' });
      await service.setupIncentiveProgram('tenant-1', { name: 'Program B' });
      await service.setupIncentiveProgram('tenant-2', { name: 'Program C' });

      const programs = await service.getIncentivePrograms('tenant-1');
      expect(programs).toHaveLength(2);
      expect(programs.every((p) => p.tenantId === 'tenant-1')).toBe(true);
    });

    it('should return empty array when no programs match tenantId', async () => {
      await service.setupIncentiveProgram('tenant-1', { name: 'Program A' });

      const programs = await service.getIncentivePrograms('tenant-999');
      expect(programs).toEqual([]);
    });

    it('should return empty array when no programs exist', async () => {
      const programs = await service.getIncentivePrograms('tenant-1');
      expect(programs).toEqual([]);
    });
  });

  // ========== Mentorship Management ==========

  describe('assignMentor', () => {
    it('should create a mentorship pair with active status', async () => {
      const pair = await service.assignMentor('tenant-1', 'mentor-1', 'mentee-1');

      expect(pair.id).toMatch(/^mentor-/);
      expect(pair.mentorId).toBe('mentor-1');
      expect(pair.menteeId).toBe('mentee-1');
      expect(pair.tenantId).toBe('tenant-1');
      expect(pair.status).toBe('active');
      expect(pair.assignedAt).toBeDefined();
      expect(pair.goals).toBeUndefined();
    });

    it('should create a mentorship pair with goals', async () => {
      const goals = ['Learn TypeScript', 'Code review best practices'];
      const pair = await service.assignMentor('tenant-1', 'mentor-1', 'mentee-1', goals);

      expect(pair.goals).toEqual(goals);
    });

    it('should allow multiple mentorship pairs', async () => {
      const p1 = await service.assignMentor('tenant-1', 'mentor-1', 'mentee-1');
      const p2 = await service.assignMentor('tenant-1', 'mentor-1', 'mentee-2');

      expect(p1.id).not.toBe(p2.id);
      expect(p1.mentorId).toBe(p2.mentorId);
    });
  });

  describe('getMentorshipPairs', () => {
    it('should return all pairs when no tenantId filter', async () => {
      await service.assignMentor('tenant-1', 'm1', 'me1');
      await service.assignMentor('tenant-2', 'm2', 'me2');

      const pairs = await service.getMentorshipPairs();
      expect(pairs).toHaveLength(2);
    });

    it('should filter pairs by tenantId', async () => {
      await service.assignMentor('tenant-1', 'm1', 'me1');
      await service.assignMentor('tenant-2', 'm2', 'me2');

      const pairs = await service.getMentorshipPairs('tenant-1');
      expect(pairs).toHaveLength(1);
      expect(pairs[0].tenantId).toBe('tenant-1');
    });

    it('should return empty array when no pairs exist', async () => {
      const pairs = await service.getMentorshipPairs('tenant-1');
      expect(pairs).toEqual([]);
    });

    it('should return empty array when tenantId has no pairs', async () => {
      await service.assignMentor('tenant-1', 'm1', 'me1');

      const pairs = await service.getMentorshipPairs('tenant-999');
      expect(pairs).toEqual([]);
    });
  });

  // ========== Cross-feature Integration ==========

  describe('cross-feature integration', () => {
    it('should support full user journey: badge + mentorship + incentive', async () => {
      // Award badge
      const badge = await service.awardBadge('tenant-1', 'user-1', 'top-contributor');
      expect(badge.userId).toBe('user-1');

      // Assign mentor
      const pair = await service.assignMentor('tenant-1', 'user-1', 'user-new', ['Learn Orion']);
      expect(pair.mentorId).toBe('user-1');

      // Setup incentive program
      const program = await service.setupIncentiveProgram('tenant-1', {
        name: 'Mentor Incentive',
      });
      expect(program.tenantId).toBe('tenant-1');

      // Verify all data
      const userBadges = await service.getUserBadges('user-1');
      expect(userBadges).toHaveLength(1);

      const pairs = await service.getMentorshipPairs('tenant-1');
      expect(pairs).toHaveLength(1);

      const programs = await service.getIncentivePrograms('tenant-1');
      expect(programs).toHaveLength(1);
    });

    it('should isolate data between tenants', async () => {
      await service.awardBadge('tenant-1', 'user-1', 'mentor');
      await service.awardBadge('tenant-2', 'user-1', 'bug-hunter');
      await service.setupIncentiveProgram('tenant-1', { name: 'T1 Program' });
      await service.setupIncentiveProgram('tenant-2', { name: 'T2 Program' });
      await service.assignMentor('tenant-1', 'm1', 'me1');
      await service.assignMentor('tenant-2', 'm2', 'me2');

      // Badges are user-scoped, not tenant-scoped
      const userBadges = await service.getUserBadges('user-1');
      expect(userBadges).toHaveLength(2);

      // Programs are tenant-scoped
      const t1Programs = await service.getIncentivePrograms('tenant-1');
      expect(t1Programs).toHaveLength(1);
      expect(t1Programs[0].name).toBe('T1 Program');

      // Pairs are tenant-scoped
      const t1Pairs = await service.getMentorshipPairs('tenant-1');
      expect(t1Pairs).toHaveLength(1);
      expect(t1Pairs[0].mentorId).toBe('m1');
    });
  });
});
