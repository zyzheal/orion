/**
 * scheduler types - runtime compatibility tests
 */

import type {
  OnCallSchedule,
  EscalationRule,
  OnCallAssignment,
  OnCallOverride,
  OnCallCheckResult,
} from '../types';

describe('scheduler types', () => {
  describe('OnCallSchedule', () => {
    it('should accept valid daily schedule', () => {
      const schedule: OnCallSchedule = {
        id: 'sched-1',
        name: 'Primary On-Call',
        timezone: 'Asia/Shanghai',
        rotationType: 'daily',
        rotationStartHour: 9,
        teamMembers: ['user-1', 'user-2'],
        startDate: new Date('2026-01-01'),
        escalations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(schedule.rotationType).toBe('daily');
      expect(schedule.teamMembers).toHaveLength(2);
    });

    it('should accept weekly rotation with optional endDate', () => {
      const schedule: OnCallSchedule = {
        id: 'sched-2',
        name: 'Weekly Rotation',
        timezone: 'UTC',
        rotationType: 'weekly',
        rotationStartHour: 0,
        teamMembers: ['user-1'],
        startDate: new Date(),
        endDate: new Date('2026-12-31'),
        escalations: [{ level: 1, timeoutMinutes: 15, targets: ['manager-1'] }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(schedule.rotationType).toBe('weekly');
      expect(schedule.endDate).toBeDefined();
      expect(schedule.escalations[0].level).toBe(1);
    });

    it('should accept monthly rotation', () => {
      const schedule: OnCallSchedule = {
        id: 'sched-3',
        name: 'Monthly',
        timezone: 'America/New_York',
        rotationType: 'monthly',
        rotationStartHour: 8,
        teamMembers: [],
        startDate: new Date(),
        escalations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(schedule.rotationType).toBe('monthly');
    });
  });

  describe('EscalationRule', () => {
    it('should accept valid escalation rule', () => {
      const rule: EscalationRule = {
        level: 1,
        timeoutMinutes: 30,
        targets: ['team-lead', 'backup'],
      };
      expect(rule.level).toBe(1);
      expect(rule.targets).toHaveLength(2);
    });
  });

  describe('OnCallAssignment', () => {
    it('should accept valid assignment', () => {
      const assignment: OnCallAssignment = {
        id: 'assign-1',
        scheduleId: 'sched-1',
        userId: 'user-1',
        startTime: new Date(),
        endTime: new Date(Date.now() + 8 * 3600 * 1000),
      };
      expect(assignment.scheduleId).toBe('sched-1');
    });
  });

  describe('OnCallOverride', () => {
    it('should accept override with reason', () => {
      const override: OnCallOverride = {
        id: 'override-1',
        scheduleId: 'sched-1',
        originalUserId: 'user-1',
        overrideUserId: 'user-2',
        startTime: new Date(),
        endTime: new Date(Date.now() + 4 * 3600 * 1000),
        reason: 'Personal leave',
      };
      expect(override.reason).toBe('Personal leave');
    });

    it('should accept override without optional reason', () => {
      const override: OnCallOverride = {
        id: 'override-2',
        scheduleId: 'sched-1',
        originalUserId: 'user-1',
        overrideUserId: 'user-3',
        startTime: new Date(),
        endTime: new Date(),
      };
      expect(override.reason).toBeUndefined();
    });
  });

  describe('OnCallCheckResult', () => {
    it('should represent on-call status', () => {
      const result: OnCallCheckResult = {
        isOnCall: true,
        primaryUserId: 'user-1',
        escalationTargets: ['manager-1'],
      };
      expect(result.isOnCall).toBe(true);
      expect(result.primaryUserId).toBe('user-1');
    });

    it('should represent not-on-call status', () => {
      const result: OnCallCheckResult = {
        isOnCall: false,
      };
      expect(result.isOnCall).toBe(false);
      expect(result.primaryUserId).toBeUndefined();
      expect(result.escalationTargets).toBeUndefined();
    });
  });
});
