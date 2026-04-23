/**
 * OnCall Scheduling Service
 * Schedule CRUD + rotation assignment + override + escalation
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { OnCallSchedule, OnCallAssignment, OnCallOverride, OnCallCheckResult, EscalationRule } from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class OnCallService {
  private schedules: Map<string, OnCallSchedule> = new Map();
  private assignments: Map<string, OnCallAssignment> = new Map();
  private overrides: Map<string, OnCallOverride> = new Map();

  /**
   * Create on-call schedule
   */
  async createSchedule(
    name: string,
    timezone: string,
    rotationType: 'daily' | 'weekly' | 'monthly',
    teamMembers: string[],
    rotationStartHour: number = 9,
    escalations: EscalationRule[] = [],
  ): Promise<OnCallSchedule> {
    if (!name || teamMembers.length === 0) throw new Error('Name and team members required');

    const schedule: OnCallSchedule = {
      id: `schedule_${uuidv4()}`,
      name,
      timezone,
      rotationType,
      rotationStartHour,
      teamMembers,
      startDate: new Date(),
      escalations,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.schedules.set(schedule.id, schedule);
    this.generateAssignments(schedule);
    logger.info({ scheduleId: schedule.id }, 'OnCall schedule created');
    return schedule;
  }

  /**
   * Generate rotation assignments
   */
  private generateAssignments(schedule: OnCallSchedule): void {
    const now = new Date();
    let current = new Date(now);

    for (let i = 0; i < schedule.teamMembers.length; i++) {
      const userId = schedule.teamMembers[i % schedule.teamMembers.length];
      const assignment: OnCallAssignment = {
        id: `assign_${uuidv4()}`,
        scheduleId: schedule.id,
        userId,
        startTime: new Date(current),
        endTime: this.getEndOfRotation(schedule.rotationType, current),
      };
      this.assignments.set(assignment.id, assignment);
      current = this.getEndOfRotation(schedule.rotationType, current);
    }
  }

  private getEndOfRotation(rotationType: string, start: Date): Date {
    const end = new Date(start);
    switch (rotationType) {
      case 'daily': end.setDate(end.getDate() + 1); break;
      case 'weekly': end.setDate(end.getDate() + 7); break;
      case 'monthly': end.setMonth(end.getMonth() + 1); break;
    }
    return end;
  }

  /**
   * Get current on-call person
   */
  getCurrentOnCall(scheduleId: string): OnCallCheckResult {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return { isOnCall: false };

    // For simplicity, return first team member as current (production would use time-based rotation)
    const now = new Date();
    const activeOverride = this.getOverride(scheduleId, now);
    if (activeOverride) {
      return {
        isOnCall: true,
        primaryUserId: activeOverride.overrideUserId,
        escalationTargets: this.getEscalationTargets(schedule, activeOverride.overrideUserId),
      };
    }

    // Find assignment covering current time
    for (const [, assignment] of this.assignments) {
      if (assignment.scheduleId === scheduleId &&
          assignment.startTime <= now && assignment.endTime > now) {
        return {
          isOnCall: true,
          primaryUserId: assignment.userId,
          escalationTargets: this.getEscalationTargets(schedule, assignment.userId),
        };
      }
    }

    // Fallback: return first member
    return {
      isOnCall: true,
      primaryUserId: schedule.teamMembers[0],
      escalationTargets: this.getEscalationTargets(schedule, schedule.teamMembers[0]),
    };
  }

  /**
   * Get active override
   */
  getOverride(scheduleId: string, time: Date): OnCallOverride | undefined {
    for (const [, o] of this.overrides) {
      if (o.scheduleId === scheduleId && o.startTime <= time && o.endTime > time) {
        return o;
      }
    }
    return undefined;
  }

  /**
   * Create override
   */
  async createOverride(
    scheduleId: string,
    originalUserId: string,
    overrideUserId: string,
    startTime: Date,
    endTime: Date,
    reason?: string,
  ): Promise<OnCallOverride> {
    const override: OnCallOverride = {
      id: `override_${uuidv4()}`,
      scheduleId,
      originalUserId,
      overrideUserId,
      startTime,
      endTime,
      reason,
    };
    this.overrides.set(override.id, override);
    logger.info({ overrideId: override.id }, 'OnCall override created');
    return override;
  }

  /**
   * Get escalation targets
   */
  private getEscalationTargets(schedule: OnCallSchedule, excludeUserId: string): string[] {
    return schedule.teamMembers.filter(id => id !== excludeUserId);
  }

  /**
   * List all schedules
   */
  listSchedules(): OnCallSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedule by ID
   */
  getSchedule(id: string): OnCallSchedule | undefined {
    return this.schedules.get(id);
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id: string): Promise<boolean> {
    const deleted = this.schedules.delete(id);
    if (deleted) {
      for (const [key, assign] of this.assignments) {
        if (assign.scheduleId === id) this.assignments.delete(key);
      }
    }
    return deleted;
  }
}
