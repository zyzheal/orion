/**
 * OnCall Scheduling Service
 * Schedule CRUD + rotation assignment + override + escalation
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { OnCallSchedule, OnCallAssignment, OnCallOverride, OnCallCheckResult, EscalationRule } from './types';
import { OnCallScheduleRepository, OnCallScheduleEntity } from '../../repositories/OnCallScheduleRepository';

/**
 * Raw escalation format stored in OnCallScheduleEntity
 */
interface RawEntityEscalation {
  userId: string;
  delay: number;
}
import { OnCallAssignmentRepository, OnCallAssignmentEntity } from '../../repositories/OnCallAssignmentRepository';
import { OnCallOverrideRepository, OnCallOverrideEntity } from '../../repositories/OnCallOverrideRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class OnCallService {
  private scheduleRepository?: OnCallScheduleRepository;
  private assignmentRepository?: OnCallAssignmentRepository;
  private overrideRepository?: OnCallOverrideRepository;
  // in-memory fallback for tests and environments without DB
  private assignments: Map<string, OnCallAssignment> = new Map();
  private overrides: Map<string, OnCallOverride> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.scheduleRepository = new OnCallScheduleRepository(db);
      this.assignmentRepository = new OnCallAssignmentRepository(db);
      this.overrideRepository = new OnCallOverrideRepository(db);
    }
  }

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

    const id = `schedule_${uuidv4()}`;
    const now = new Date();

    if (this.scheduleRepository) {
      const entity = await this.scheduleRepository.create({
        id,
        name,
        timezone,
        rotationType,
        rotationStartHour,
        teamMembers,
        startDate: now,
        escalations: escalations.map(e => ({ userId: e.targets?.[0] ?? '', delay: e.timeoutMinutes })),
        createdAt: now,
        updatedAt: now,
      });
      const schedule = this.mapEntityToSchedule(entity, escalations);
      await this.generateAssignments(schedule);
      logger.info({ scheduleId: schedule.id }, 'OnCall schedule created');
      return schedule;
    }

    // Fallback for memory-only usage
    const schedule: OnCallSchedule = {
      id,
      name,
      timezone,
      rotationType,
      rotationStartHour,
      teamMembers,
      startDate: now,
      escalations,
      createdAt: now,
      updatedAt: now,
    };
    await this.generateAssignments(schedule);
    logger.info({ scheduleId: schedule.id }, 'OnCall schedule created');
    return schedule;
  }

  /**
   * Generate rotation assignments
   */
  private async generateAssignments(schedule: OnCallSchedule): Promise<void> {
    const now = new Date();
    let current = new Date(now);

    for (let i = 0; i < schedule.teamMembers.length; i++) {
      const userId = schedule.teamMembers[i % schedule.teamMembers.length];
      const endTime = this.getEndOfRotation(schedule.rotationType, current);
      const assignment: OnCallAssignment = {
        id: `assign_${uuidv4()}`,
        scheduleId: schedule.id,
        userId,
        startTime: new Date(current),
        endTime,
      };

      if (this.assignmentRepository) {
        try {
          await this.assignmentRepository.create({
            id: assignment.id,
            scheduleId: assignment.scheduleId,
            userId: assignment.userId,
            startTime: assignment.startTime,
            endTime: assignment.endTime,
          });
        } catch (err) {
          logger.warn({ err }, 'Failed to persist assignment, falling back to in-memory');
        }
      }
      this.assignments.set(assignment.id, assignment);
      current = endTime;
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
  async getCurrentOnCall(scheduleId: string): Promise<OnCallCheckResult> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) return { isOnCall: false };

    // For simplicity, return first team member as current (production would use time-based rotation)
    const now = new Date();
    const activeOverride = await this.getOverride(scheduleId, now);
    if (activeOverride) {
      return {
        isOnCall: true,
        primaryUserId: activeOverride.overrideUserId,
        escalationTargets: this.getEscalationTargets(schedule, activeOverride.overrideUserId),
      };
    }

    // Find assignment covering current time
    if (this.assignmentRepository) {
      const dbAssignment = await this.assignmentRepository.findByScheduleAndTime(scheduleId, now);
      if (dbAssignment) {
        return {
          isOnCall: true,
          primaryUserId: dbAssignment.userId,
          escalationTargets: this.getEscalationTargets(schedule, dbAssignment.userId),
        };
      }
    }

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

    // No assignment covers current time - use fallback but flag it
    logger.warn({ scheduleId, scheduleName: schedule.name }, 'No active assignment found, using fallback');
    return {
      isOnCall: false,
      primaryUserId: schedule.teamMembers[0],
      escalationTargets: this.getEscalationTargets(schedule, schedule.teamMembers[0]),
    };
  }

  /**
   * Get active override
   */
  async getOverride(scheduleId: string, time: Date): Promise<OnCallOverride | undefined> {
    if (this.overrideRepository) {
      const dbOverride = await this.overrideRepository.findActiveAtTime(scheduleId, time);
      if (dbOverride) return this.mapOverrideEntityToDomain(dbOverride);
    }
    // in-memory fallback
    for (const [, o] of this.overrides) {
      if (o.scheduleId === scheduleId && o.startTime <= time && o.endTime > time) {
        return o;
      }
    }
    return undefined;
  }

  private mapOverrideEntityToDomain(entity: OnCallOverrideEntity): OnCallOverride {
    return {
      id: entity.id,
      scheduleId: entity.scheduleId,
      originalUserId: entity.originalUserId,
      overrideUserId: entity.overrideUserId,
      startTime: entity.startTime,
      endTime: entity.endTime,
      reason: entity.reason,
    };
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

    if (this.overrideRepository) {
      try {
        await this.overrideRepository.create({
          id: override.id,
          scheduleId,
          originalUserId,
          overrideUserId,
          startTime,
          endTime,
          reason,
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to persist override, falling back to in-memory');
      }
    }
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
  async listSchedules(): Promise<OnCallSchedule[]> {
    if (this.scheduleRepository) {
      const result = await this.scheduleRepository.findAll();
      return result.entities.map(e => this.mapEntityToSchedule(e));
    }
    return [];
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(id: string): Promise<OnCallSchedule | undefined> {
    if (this.scheduleRepository) {
      const entity = await this.scheduleRepository.findById(id);
      return entity ? this.mapEntityToSchedule(entity) : undefined;
    }
    return undefined;
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id: string): Promise<boolean> {
    if (this.scheduleRepository) {
      const deleted = await this.scheduleRepository.delete(id);
      if (deleted) {
        // Clean up DB
        if (this.assignmentRepository) {
          await this.assignmentRepository.deleteByScheduleId(id);
        }
        if (this.overrideRepository) {
          await this.overrideRepository.deleteByScheduleId(id);
        }
        // Clean up in-memory
        for (const [key, assign] of this.assignments) {
          if (assign.scheduleId === id) this.assignments.delete(key);
        }
        for (const [key, override] of this.overrides) {
          if (override.scheduleId === id) this.overrides.delete(key);
        }
      }
      return deleted;
    }
    return false;
  }

  private mapEntityToSchedule(entity: OnCallScheduleEntity, escalations?: EscalationRule[]): OnCallSchedule {
    return {
      id: entity.id,
      name: entity.name,
      timezone: entity.timezone,
      rotationType: entity.rotationType as 'daily' | 'weekly' | 'monthly',
      rotationStartHour: entity.rotationStartHour,
      teamMembers: entity.teamMembers,
      startDate: entity.startDate,
      escalations: escalations ?? entity.escalations.map((e: RawEntityEscalation) => ({
        level: 0,
        timeoutMinutes: e.delay ?? 0,
        targets: e.userId ? [e.userId] : [],
      })),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
