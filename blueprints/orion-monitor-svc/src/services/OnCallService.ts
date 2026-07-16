import type {
  OnCallSchedule,
  OnCallDuty,
  CreateScheduleInput,
} from '../types/monitor.js';
import { OnCallRepository } from '../repositories/OnCallRepository.js';

export class OnCallService {
  constructor(private repo: OnCallRepository) {}

  async createSchedule(
    tenantId: string,
    projectId: string,
    createdBy: string,
    input: CreateScheduleInput,
  ): Promise<OnCallSchedule> {
    return this.repo.create(tenantId, projectId, createdBy, {
      name: input.name,
      description: input.description ?? '',
      rotationType: input.rotationType,
      rotationStart: input.rotationStart,
      rotationDurationHours: input.rotationDurationHours ?? 24,
      layers: input.layers,
      timeZone: input.timeZone ?? 'Asia/Shanghai',
    });
  }

  async listSchedules(tenantId: string, projectId?: string): Promise<OnCallSchedule[]> {
    return this.repo.findByTenant(tenantId, projectId);
  }

  async getCurrentOnCall(tenantId: string, projectId?: string): Promise<OnCallDuty[]> {
    const now = new Date();
    const schedules = await this.repo.findByTenant(tenantId, projectId);
    const result: OnCallDuty[] = [];

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      for (const layer of schedule.layers) {
        if (layer.users.length === 0) continue;
        const userId = layer.users[0];
        result.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          layerId: layer.id,
          escalationLevel: layer.escalationLevel,
          userId,
          userName: '',
          startAt: now.toISOString(),
          endAt: now.toISOString(),
        });
      }
    }
    return result;
  }

  async updateSchedule(
    tenantId: string,
    scheduleId: string,
    input: Partial<CreateScheduleInput>,
  ): Promise<OnCallSchedule | undefined> {
    const existing = await this.repo.findById(scheduleId);
    if (existing?.tenantId !== tenantId) return undefined;
    return (await this.repo.update(scheduleId, { ...input })) ?? undefined;
  }

  async deleteSchedule(tenantId: string, scheduleId: string): Promise<boolean> {
    const existing = await this.repo.findById(scheduleId);
    if (existing?.tenantId !== tenantId) return false;
    return this.repo.delete(scheduleId);
  }
}
