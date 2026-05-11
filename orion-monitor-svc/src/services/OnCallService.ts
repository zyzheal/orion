import type {
  OnCallSchedule,
  OnCallDuty,
  CreateScheduleInput,
  ScheduleLayer,
  EscalationLevel,
} from '../types/monitor.js';

/**
 * In-memory store (stub — replace with database in production).
 */
const schedules: Map<string, OnCallSchedule> = new Map();

export class OnCallService {
  /**
   * Create an on-call schedule.
   */
  async createSchedule(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: CreateScheduleInput,
  ): Promise<OnCallSchedule> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const schedule: OnCallSchedule = {
      id,
      tenantId,
      projectId,
      name: input.name,
      description: input.description ?? '',
      rotationType: input.rotationType,
      rotationStart: input.rotationStart,
      rotationDurationHours: input.rotationDurationHours ?? 24,
      layers: input.layers,
      timeZone: input.timeZone ?? 'Asia/Shanghai',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    schedules.set(id, schedule);
    return schedule;
  }

  /**
   * List on-call schedules.
   */
  async listSchedules(
    tenantId: string,
    projectId?: string,
  ): Promise<OnCallSchedule[]> {
    return Array.from(schedules.values()).filter(
      (s) =>
        s.tenantId === tenantId &&
        (projectId === undefined || s.projectId === projectId),
    );
  }

  /**
   * Get current on-call duty holders.
   *
   * TODO: Implement proper rotation logic based on rotationStart,
   * rotationDurationHours, and layer restrictions.
   */
  async getCurrentOnCall(
    tenantId: string,
    projectId?: string,
  ): Promise<OnCallDuty[]> {
    const now = new Date();
    const result: OnCallDuty[] = [];

    for (const schedule of schedules.values()) {
      if (schedule.tenantId !== tenantId) continue;
      if (projectId && schedule.projectId !== projectId) continue;
      if (!schedule.enabled) continue;

      for (const layer of schedule.layers) {
        if (layer.users.length === 0) continue;

        // Stub: pick first user in rotation
        // TODO: Calculate actual rotation based on time window
        const userId = layer.users[0];
        result.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          layerId: layer.id,
          escalationLevel: layer.escalationLevel,
          userId,
          userName: '', // TODO: Resolve from orion-platform-core
          startAt: now.toISOString(),
          endAt: now.toISOString(),
        });
      }
    }

    return result;
  }

  /**
   * Update a schedule.
   */
  async updateSchedule(
    tenantId: string,
    scheduleId: string,
    input: Partial<CreateScheduleInput>,
  ): Promise<OnCallSchedule | undefined> {
    const existing = schedules.get(scheduleId);
    if (existing?.tenantId !== tenantId) return undefined;

    const updated: OnCallSchedule = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    schedules.set(scheduleId, updated);
    return updated;
  }

  /**
   * Delete a schedule.
   */
  async deleteSchedule(
    tenantId: string,
    scheduleId: string,
  ): Promise<boolean> {
    const existing = schedules.get(scheduleId);
    if (existing?.tenantId !== tenantId) return false;
    schedules.delete(scheduleId);
    return true;
  }
}
