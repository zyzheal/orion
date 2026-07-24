/**
 * Report Designer API
 * Phase 2 - Report definition, datasource, and scheduling
 */
import apiClient from './client';

export interface ReportDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string | null;
  layout: Record<string, unknown>;
  components: Record<string, unknown>[];
  datasourceBindings: Record<string, unknown>[];
  templateId: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDatasource {
  id: string;
  tenantId: string;
  name: string;
  type: 'sql' | 'api' | 'promql';
  connectionConfig: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSchedule {
  id: string;
  tenantId: string;
  reportId: string;
  cronExpression: string;
  exportFormat: 'pdf' | 'excel' | 'csv';
  recipients: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportExecution {
  id: string;
  tenantId: string;
  reportId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  exportFormat: string | null;
  fileUrl: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface CreateReportInput {
  name: string;
  description?: string;
  category?: string;
  layout?: Record<string, unknown>;
  components?: Record<string, unknown>[];
  datasourceBindings?: Record<string, unknown>[];
  templateId?: string;
}

export interface UpdateReportInput {
  name?: string;
  description?: string;
  category?: string;
  layout?: Record<string, unknown>;
  components?: Record<string, unknown>[];
  datasourceBindings?: Record<string, unknown>[];
  enabled?: boolean;
}

export interface CreateDatasourceInput {
  name: string;
  type: 'sql' | 'api' | 'promql';
  connectionConfig: Record<string, unknown>;
}

export interface CreateScheduleInput {
  reportId: string;
  cronExpression: string;
  exportFormat: 'pdf' | 'excel' | 'csv';
  recipients: string[];
  enabled?: boolean;
}

// Reports
export const listReports = (params?: { category?: string; enabled?: boolean }) =>
  apiClient.get<ReportDefinition[]>('/reports', { params });

export const getReport = (id: string) =>
  apiClient.get<ReportDefinition>(`/reports/${id}`);

export const createReport = (data: CreateReportInput) =>
  apiClient.post<ReportDefinition>('/reports', data);

export const updateReport = (id: string, data: UpdateReportInput) =>
  apiClient.put<ReportDefinition>(`/reports/${id}`, data);

export const deleteReport = (id: string) =>
  apiClient.delete(`/reports/${id}`);

export const previewReport = (id: string, params?: Record<string, unknown>) =>
  apiClient.post<Record<string, unknown>>(`/reports/${id}/preview`, params);

export const executeReport = (id: string, params?: Record<string, unknown>) =>
  apiClient.post<ReportExecution>(`/reports/${id}/execute`, params);

export const getReportExecutions = (reportId?: string, limit?: number) =>
  reportId
    ? apiClient.get<ReportExecution[]>(`/reports/${reportId}/executions`, { params: { limit } })
    : apiClient.get<ReportExecution[]>('/reports/executions', { params: { limit } });

// Datasources
export const listDatasources = () =>
  apiClient.get<ReportDatasource[]>('/reports/datasources');

export const createDatasource = (data: CreateDatasourceInput) =>
  apiClient.post<ReportDatasource>('/reports/datasources', data);

export const updateDatasource = (id: string, data: Partial<CreateDatasourceInput>) =>
  apiClient.put<ReportDatasource>(`/reports/datasources/${id}`, data);

export const deleteDatasource = (id: string) =>
  apiClient.delete(`/reports/datasources/${id}`);

// Schedules
export const listSchedules = (reportId?: string) =>
  reportId
    ? apiClient.get<ReportSchedule[]>(`/reports/${reportId}/schedules`)
    : apiClient.get<ReportSchedule[]>('/reports/schedules');

export const createSchedule = (data: CreateScheduleInput) =>
  apiClient.post<ReportSchedule>('/reports/schedules', data);

export const updateSchedule = (id: string, data: Partial<CreateScheduleInput>) =>
  apiClient.put<ReportSchedule>(`/reports/schedules/${id}`, data);

export const deleteSchedule = (id: string) =>
  apiClient.delete(`/reports/schedules/${id}`);
