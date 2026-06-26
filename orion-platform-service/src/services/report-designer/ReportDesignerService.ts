/**
 * ReportDesignerService
 *
 * Business logic layer for Report Designer module.
 * Combines ReportDefinition, ReportDatasource, ReportSchedule, and ReportExecution repositories.
 */

import pino from 'pino';
import { ReportDefinitionRepository, ReportDefinitionEntity, ReportDefinitionFilters } from './ReportDefinitionRepository';
import { ReportDatasourceRepository, ReportDatasourceEntity } from './ReportDatasourceRepository';
import { ReportScheduleRepository, ReportScheduleEntity } from './ReportScheduleRepository';
import { ReportExecutionRepository, ReportExecutionEntity } from './ReportExecutionRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CreateReportInput {
  name: string;
  description?: string;
  category?: string;
  layout?: Record<string, any>;
  components?: Record<string, any>[];
  datasourceBindings?: Record<string, any>;
  templateId?: string;
  enabled?: boolean;
  createdBy?: string;
}

export interface UpdateReportInput {
  name?: string;
  description?: string;
  category?: string;
  layout?: Record<string, any>;
  components?: Record<string, any>[];
  datasourceBindings?: Record<string, any>;
  templateId?: string;
  enabled?: boolean;
}

export interface CreateDatasourceInput {
  name: string;
  datasourceType: string;
  config: Record<string, any>;
  refreshInterval?: number;
}

export interface UpdateDatasourceInput {
  name?: string;
  datasourceType?: string;
  config?: Record<string, any>;
  refreshInterval?: number;
}

export interface CreateScheduleInput {
  reportId: string;
  cronExpression: string;
  exportFormat: string;
  recipients?: Record<string, any>[];
  enabled?: boolean;
}

export interface UpdateScheduleInput {
  cronExpression?: string;
  exportFormat?: string;
  recipients?: Record<string, any>[];
  enabled?: boolean;
}

export class ReportDesignerService {
  private definitionRepo: ReportDefinitionRepository;
  private datasourceRepo: ReportDatasourceRepository;
  private scheduleRepo: ReportScheduleRepository;
  private executionRepo: ReportExecutionRepository;

  constructor(
    definitionRepo: ReportDefinitionRepository,
    datasourceRepo: ReportDatasourceRepository,
    scheduleRepo: ReportScheduleRepository,
    executionRepo: ReportExecutionRepository,
  ) {
    this.definitionRepo = definitionRepo;
    this.datasourceRepo = datasourceRepo;
    this.scheduleRepo = scheduleRepo;
    this.executionRepo = executionRepo;
  }

  // ==================== Report Definitions ====================

  async listReports(filters?: ReportDefinitionFilters) {
    return this.definitionRepo.list(filters);
  }

  async getReport(id: string): Promise<ReportDefinitionEntity> {
    const report = await this.definitionRepo.getById(id);
    if (!report) {
      throw new OrionError(`Report not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return report;
  }

  async createReport(data: CreateReportInput): Promise<ReportDefinitionEntity> {
    if (!data.name) {
      throw new OrionError('Report name is required', ErrorCode.VALIDATION_ERROR);
    }
    return this.definitionRepo.create({
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      layout: data.layout ?? {},
      components: data.components ?? [],
      datasourceBindings: data.datasourceBindings ?? null,
      templateId: data.templateId ?? null,
      enabled: data.enabled ?? true,
      createdBy: data.createdBy ?? null,
    });
  }

  async updateReport(id: string, data: UpdateReportInput): Promise<ReportDefinitionEntity> {
    // Verify report exists
    await this.getReport(id);
    return this.definitionRepo.updateById(id, data);
  }

  async deleteReport(id: string): Promise<void> {
    const deleted = await this.definitionRepo.deleteById(id);
    if (!deleted) {
      throw new OrionError(`Report not found: ${id}`, ErrorCode.NOT_FOUND);
    }
  }

  async previewReport(id: string, params?: Record<string, any>): Promise<{ report: ReportDefinitionEntity; previewParams: Record<string, any> }> {
    const report = await this.getReport(id);

    return {
      report,
      previewParams: params ?? {},
    };
  }

  async executeReport(
    id: string,
    params?: Record<string, any>,
    triggeredBy?: string,
  ): Promise<ReportExecutionEntity> {
    const report = await this.getReport(id);

    // Create execution record
    const execution = await this.executionRepo.create({
      reportId: report.id,
      scheduleId: null,
      exportFormat: params?.exportFormat ?? 'pdf',
      status: 'running',
      fileUrl: null,
      error: null,
      startedAt: new Date(),
      triggeredBy: triggeredBy ?? 'manual',
    });

    logger.info({ reportId: id, executionId: execution.id }, 'Report execution started');

    // In a real implementation, this would trigger an async job.
    // For now, return the execution record as pending/in-progress.
    return execution;
  }

  // ==================== Datasources ====================

  async listDatasources(): Promise<ReportDatasourceEntity[]> {
    return this.datasourceRepo.list();
  }

  async createDatasource(data: CreateDatasourceInput): Promise<ReportDatasourceEntity> {
    if (!data.name || !data.datasourceType || !data.config) {
      throw new OrionError('name, datasourceType, and config are required', ErrorCode.VALIDATION_ERROR);
    }
    return this.datasourceRepo.create({
      name: data.name,
      datasourceType: data.datasourceType,
      config: data.config,
      refreshInterval: data.refreshInterval ?? null,
    });
  }

  async updateDatasource(id: string, data: UpdateDatasourceInput): Promise<ReportDatasourceEntity> {
    const existing = await this.datasourceRepo.getById(id);
    if (!existing) {
      throw new OrionError(`Datasource not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.datasourceRepo.updateById(id, data);
  }

  async deleteDatasource(id: string): Promise<void> {
    const deleted = await this.datasourceRepo.deleteById(id);
    if (!deleted) {
      throw new OrionError(`Datasource not found: ${id}`, ErrorCode.NOT_FOUND);
    }
  }

  // ==================== Schedules ====================

  async listSchedules(reportId: string): Promise<ReportScheduleEntity[]> {
    return this.scheduleRepo.listByReport(reportId);
  }

  async createSchedule(data: CreateScheduleInput): Promise<ReportScheduleEntity> {
    if (!data.reportId || !data.cronExpression || !data.exportFormat) {
      throw new OrionError('reportId, cronExpression, and exportFormat are required', ErrorCode.VALIDATION_ERROR);
    }

    // Verify report exists
    await this.getReport(data.reportId);

    return this.scheduleRepo.create({
      reportId: data.reportId,
      cronExpression: data.cronExpression,
      exportFormat: data.exportFormat,
      recipients: data.recipients ?? [],
      enabled: data.enabled ?? true,
    });
  }

  async updateSchedule(id: string, data: UpdateScheduleInput): Promise<ReportScheduleEntity> {
    const existing = await this.scheduleRepo.getById(id);
    if (!existing) {
      throw new OrionError(`Schedule not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.scheduleRepo.updateById(id, data);
  }

  async deleteSchedule(id: string): Promise<void> {
    const deleted = await this.scheduleRepo.deleteById(id);
    if (!deleted) {
      throw new OrionError(`Schedule not found: ${id}`, ErrorCode.NOT_FOUND);
    }
  }

  // ==================== Execution History ====================

  async getExecutionHistory(reportId: string, limit?: number): Promise<ReportExecutionEntity[]> {
    return this.executionRepo.listByReport(reportId, limit);
  }
}
