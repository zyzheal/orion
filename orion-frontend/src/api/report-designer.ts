/**
 * ReportDesigner API Service
 * Auto-generated from backend report-designer-routes.ts
 * Prefix: /v1/reports
 */
import { api } from './client';

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
  const response = await api.get<{ data: ReportDesigner[]; total: number }>('/v1/reports/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createReportDesigner = async (data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>('/v1/reports/', data);
  return response.data;
};

export const createReportDesignerDatasources = async (data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>('/v1/reports/datasources', data);
  return response.data;
};

export const updateReportDesigner = async (id: string, data: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.put<ReportDesigner>('/v1/reports/datasources/' + id, data);
  return response.data;
};

export const deleteReportDesigner = async (id: string): Promise<void> => {
  await api.delete('/v1/reports/datasources/' + id);
};

export const getReportDesigner = async (id: string): Promise<ReportDesigner> => {
  const response = await api.get<ReportDesigner>('/v1/reports/' + id);
  return response.data;
};

export const createReportDesignerPreview = async (id: string, data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>('/v1/reports/' + id + '/preview', data);
  return response.data;
};

export const createReportDesignerExecute = async (id: string, data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>('/v1/reports/' + id + '/execute', data);
  return response.data;
};

export const createReportDesignerSchedules = async (id: string, data?: Partial<ReportDesigner>): Promise<ReportDesigner> => {
  const response = await api.post<ReportDesigner>('/v1/reports/' + id + '/schedules', data);
  return response.data;
};
