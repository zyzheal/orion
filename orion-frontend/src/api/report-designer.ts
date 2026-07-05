/**
 * ReportDesigner API Service
 * Auto-generated from backend report-designer-routes.ts
 * Prefix: /api/v1/reports
 */
import { api } from './client';
import { API_PATHS } from '@/constants/api-paths';

export interface ReportDesigner {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listReportDesigner = async (params?: Record<string, unknown>): Promise<{ data: ReportDesigner[]; total: number }> => {
  const response = await api.get<{ data: ReportDesigner[]; total: number }>(API_PATHS.REPORTS.LIST, { params });
  return { data: response.data.data, total: response.data.total };
};

export const createReportDesigner = async (data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>(API_PATHS.REPORTS.CREATE, data);
  return response.data;
};

export const createReportDesignerDatasources = async (data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>(API_PATHS.REPORTS.DATASOURCES, data);
  return response.data;
};

export const updateReportDesigner = async (id: string, data: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.put<ReportDesigner>(API_PATHS.REPORTS.DATASOURCE_DETAIL(id), data);
  return response.data;
};

export const deleteReportDesigner = async (id: string): Promise<void> => {
  await api.delete(API_PATHS.REPORTS.DATASOURCE_DETAIL(id));
};

export const getReportDesigner = async (id: string): Promise<ReportDesigner> => {
  const response = await api.get<ReportDesigner>(API_PATHS.REPORTS.DETAIL(id));
  return response.data;
};

export const createReportDesignerPreview = async (id: string, data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>(API_PATHS.REPORTS.PREVIEW(id), data);
  return response.data;
};

export const createReportDesignerExecute = async (id: string, data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>(API_PATHS.REPORTS.EXECUTE(id), data);
  return response.data;
};

export const createReportDesignerSchedules = async (id: string, data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>(API_PATHS.REPORTS.SCHEDULES(id), data);
  return response.data;
};
