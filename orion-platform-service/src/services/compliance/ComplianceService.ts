import pino from 'pino';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  ComplianceReportRepository,
  ComplianceReportEntity,
  ComplianceScheduleRepository,
  ComplianceScheduleEntity,
  ComplianceFinding,
} from './ComplianceRepository';

const logger = pino({ name: 'ComplianceService' });

export interface CreateReportInput {
  name: string;
  description?: string;
  framework: string;
  triggeredBy: string;
  scheduleId?: string;
}

export interface UpdateReportInput {
  name?: string;
  description?: string;
  status?: ComplianceReportEntity['status'];
  score?: number;
  findings?: ComplianceFinding[];
}

export interface CreateScheduleInput {
  name: string;
  framework: string;
  cronExpression: string;
  enabled?: boolean;
}

export interface UpdateScheduleInput {
  name?: string;
  framework?: string;
  cronExpression?: string;
  enabled?: boolean;
}

/**
 * ComplianceService - Manages compliance reports and schedules
 */
export class ComplianceService {
  constructor(
    private readonly reportRepo: ComplianceReportRepository,
    private readonly scheduleRepo: ComplianceScheduleRepository,
  ) {}

  // ==================== Report CRUD ====================

  async createReport(input: CreateReportInput): Promise<ComplianceReportEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, framework: input.framework }, 'Creating compliance report');

    const report = await this.reportRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      framework: input.framework,
      status: 'draft',
      score: null,
      findings: JSON.stringify([]),
      scheduleId: input.scheduleId ?? null,
      triggeredBy: input.triggeredBy,
      startedAt: null,
      completedAt: null,
    });

    logger.info({ reportId: report.id }, 'Compliance report created');
    return report;
  }

  async getReport(id: string): Promise<ComplianceReportEntity> {
    const report = await this.reportRepo.findById(id);
    if (!report) {
      throw new OrionError(`Compliance report not found: ${id}`, 'NOT_FOUND');
    }
    return report;
  }

  async listReports(options?: { framework?: string }): Promise<ComplianceReportEntity[]> {
    const tenantId = getCurrentTenantId();
    if (options?.framework) {
      return this.reportRepo.findByFramework(tenantId, options.framework);
    }
    const result = await this.reportRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updateReport(id: string, input: UpdateReportInput): Promise<ComplianceReportEntity> {
    const existing = await this.reportRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Compliance report not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'running' && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (input.status === 'completed' || input.status === 'failed') {
        updateData.completedAt = new Date();
      }
    }
    if (input.score !== undefined) updateData.score = input.score;
    if (input.findings !== undefined) updateData.findings = JSON.stringify(input.findings);

    const updated = await this.reportRepo.update(id, updateData);
    logger.info({ reportId: id }, 'Compliance report updated');
    return updated;
  }

  async deleteReport(id: string): Promise<void> {
    const existing = await this.reportRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Compliance report not found: ${id}`, 'NOT_FOUND');
    }
    await this.reportRepo.delete(id);
    logger.info({ reportId: id }, 'Compliance report deleted');
  }

  async startReport(id: string): Promise<ComplianceReportEntity> {
    return this.updateReport(id, { status: 'running' });
  }

  async completeReport(id: string, score: number, findings: ComplianceFinding[]): Promise<ComplianceReportEntity> {
    return this.updateReport(id, { status: 'completed', score, findings });
  }

  async failReport(id: string, error: string): Promise<ComplianceReportEntity> {
    const report = await this.updateReport(id, { status: 'failed' });
    logger.error({ reportId: id, error }, 'Compliance report failed');
    return report;
  }

  // ==================== Schedule CRUD ====================

  async createSchedule(input: CreateScheduleInput): Promise<ComplianceScheduleEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, framework: input.framework }, 'Creating compliance schedule');

    const schedule = await this.scheduleRepo.create({
      tenantId,
      name: input.name,
      framework: input.framework,
      cronExpression: input.cronExpression,
      enabled: input.enabled ?? true,
      lastRunAt: null,
      nextRunAt: null,
      createdBy: null,
    });

    logger.info({ scheduleId: schedule.id }, 'Compliance schedule created');
    return schedule;
  }

  async getSchedule(id: string): Promise<ComplianceScheduleEntity> {
    const schedule = await this.scheduleRepo.findById(id);
    if (!schedule) {
      throw new OrionError(`Compliance schedule not found: ${id}`, 'NOT_FOUND');
    }
    return schedule;
  }

  async listSchedules(): Promise<ComplianceScheduleEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.scheduleRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updateSchedule(id: string, input: UpdateScheduleInput): Promise<ComplianceScheduleEntity> {
    const existing = await this.scheduleRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Compliance schedule not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.framework !== undefined) updateData.framework = input.framework;
    if (input.cronExpression !== undefined) updateData.cronExpression = input.cronExpression;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const updated = await this.scheduleRepo.update(id, updateData);
    logger.info({ scheduleId: id }, 'Compliance schedule updated');
    return updated;
  }

  async deleteSchedule(id: string): Promise<void> {
    const existing = await this.scheduleRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Compliance schedule not found: ${id}`, 'NOT_FOUND');
    }
    // Also delete associated reports
    const reports = await this.reportRepo.findByScheduleId(id);
    for (const report of reports) {
      await this.reportRepo.delete(report.id);
    }
    await this.scheduleRepo.delete(id);
    logger.info({ scheduleId: id }, 'Compliance schedule deleted');
  }

  async listEnabledSchedules(): Promise<ComplianceScheduleEntity[]> {
    const tenantId = getCurrentTenantId();
    return this.scheduleRepo.findEnabled(tenantId);
  }
}
