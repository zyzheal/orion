/**
 * Report & Dashboard API Client
 *
 * 仪表盘、报表、模板、定时报表、权限和分享链接 API
 * 后端前缀: /api/report-dashboard
 */

import apiClient from './client';

// ============ Types ============

export type WidgetType =
  | 'metric-card'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'table'
  | 'gauge'
  | 'trend'
  | 'log-stream'
  | 'iframe'
  | 'markdown';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  layout: WidgetLayout;
  config: Record<string, unknown>;
  dataSource: DataSourceRef;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceRef {
  type: 'api' | 'metrics' | 'pipeline' | 'static' | 'promql';
  endpoint?: string;
  query?: string;
  params?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  layout: WidgetLayout[];
  widgets: Widget[];
  isPublic: boolean;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  reportType: 'dashboard' | 'custom' | 'template';
  designerConfig: Record<string, unknown>;
  templateId: string | null;
  dashboardId: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  designerConfig: Record<string, unknown>;
  useCount: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReport {
  id: string;
  tenantId: string;
  reportId: string;
  name: string;
  cronExpression: string;
  exportFormat: 'pdf' | 'excel' | 'csv' | 'html';
  recipients: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReportRecord {
  id: string;
  scheduledReportId: string;
  reportId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  exportFormat: string;
  fileUrl: string | null;
  error: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

export interface ReportPermission {
  id: string;
  tenantId: string;
  resourceId: string;
  resourceType: 'dashboard' | 'report' | 'template';
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
}

export interface ShareLink {
  id: string;
  tenantId: string;
  resourceId: string;
  resourceType: 'dashboard' | 'report';
  token: string;
  expiresAt: string | null;
  password: string | null;
  maxViews: number | null;
  viewCount: number;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

// ============ API Endpoints ============

const BASE = '/report-dashboard';

// Dashboard
export async function listDashboards(params?: { category?: string; enabled?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
  return apiClient.get(`${BASE}/dashboards${qs.toString() ? `?${qs}` : ''}`);
}

export async function getDashboard(id: string) {
  return apiClient.get(`${BASE}/dashboards/${id}`);
}

export async function createDashboard(data: { name: string; description?: string; category?: string; isPublic?: boolean }) {
  return apiClient.post(`${BASE}/dashboards`, data);
}

export async function updateDashboard(id: string, data: Partial<Dashboard>) {
  return apiClient.put(`${BASE}/dashboards/${id}`, data);
}

export async function deleteDashboard(id: string) {
  return apiClient.delete(`${BASE}/dashboards/${id}`);
}

// Widget
export async function addWidget(dashboardId: string, data: { type: string; title: string; layout: WidgetLayout; config?: Record<string, unknown>; dataSource?: DataSourceRef }) {
  return apiClient.post(`${BASE}/dashboards/${dashboardId}/widgets`, data);
}

export async function updateWidget(dashboardId: string, widgetId: string, data: Partial<Widget>) {
  return apiClient.put(`${BASE}/dashboards/${dashboardId}/widgets/${widgetId}`, data);
}

export async function deleteWidget(dashboardId: string, widgetId: string) {
  return apiClient.delete(`${BASE}/dashboards/${dashboardId}/widgets/${widgetId}`);
}

// Report
export async function listReports(params?: { category?: string; reportType?: string; enabled?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.reportType) qs.set('reportType', params.reportType);
  if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
  return apiClient.get(`${BASE}/reports${qs.toString() ? `?${qs}` : ''}`);
}

export async function getReport(id: string) {
  return apiClient.get(`${BASE}/reports/${id}`);
}

export async function createReport(data: { name: string; description?: string; category?: string; reportType?: string; templateId?: string; dashboardId?: string }) {
  return apiClient.post(`${BASE}/reports`, data);
}

export async function updateReport(id: string, data: Partial<Report>) {
  return apiClient.put(`${BASE}/reports/${id}`, data);
}

export async function deleteReport(id: string) {
  return apiClient.delete(`${BASE}/reports/${id}`);
}

// Template
export async function listTemplates(params?: { category?: string; isPublic?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.isPublic !== undefined) qs.set('isPublic', String(params.isPublic));
  return apiClient.get(`${BASE}/templates${qs.toString() ? `?${qs}` : ''}`);
}

export async function getTemplate(id: string) {
  return apiClient.get(`${BASE}/templates/${id}`);
}

export async function createTemplate(data: { name: string; description?: string; category?: string; isPublic?: boolean }) {
  return apiClient.post(`${BASE}/templates`, data);
}

export async function updateTemplate(id: string, data: Partial<ReportTemplate>) {
  return apiClient.put(`${BASE}/templates/${id}`, data);
}

export async function deleteTemplate(id: string) {
  return apiClient.delete(`${BASE}/templates/${id}`);
}

// Scheduled Report
export async function listScheduledReports(params?: { enabled?: boolean; reportId?: string }) {
  const qs = new URLSearchParams();
  if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
  if (params?.reportId) qs.set('reportId', params.reportId);
  return apiClient.get(`${BASE}/scheduled-reports${qs.toString() ? `?${qs}` : ''}`);
}

export async function createScheduledReport(data: { reportId: string; name: string; cronExpression: string; exportFormat: string; recipients: string[] }) {
  return apiClient.post(`${BASE}/scheduled-reports`, data);
}

export async function updateScheduledReport(id: string, data: Partial<ScheduledReport>) {
  return apiClient.put(`${BASE}/scheduled-reports/${id}`, data);
}

export async function deleteScheduledReport(id: string) {
  return apiClient.delete(`${BASE}/scheduled-reports/${id}`);
}

export async function triggerScheduledReport(id: string) {
  return apiClient.post(`${BASE}/scheduled-reports/${id}/trigger`, {});
}

export async function listScheduledRecords(params?: { scheduledReportId?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.scheduledReportId) qs.set('scheduledReportId', params.scheduledReportId);
  if (params?.status) qs.set('status', params.status);
  return apiClient.get(`${BASE}/scheduled-reports/records${qs.toString() ? `?${qs}` : ''}`);
}

// Permission
export async function grantPermission(data: { resourceId: string; resourceType: string; userId: string; role: string }) {
  return apiClient.post(`${BASE}/permissions`, data);
}

export async function listPermissions(params?: { resourceId?: string; resourceType?: string; userId?: string }) {
  const qs = new URLSearchParams();
  if (params?.resourceId) qs.set('resourceId', params.resourceId);
  if (params?.resourceType) qs.set('resourceType', params.resourceType);
  if (params?.userId) qs.set('userId', params.userId);
  return apiClient.get(`${BASE}/permissions${qs.toString() ? `?${qs}` : ''}`);
}

export async function revokePermission(id: string) {
  return apiClient.delete(`${BASE}/permissions/${id}`);
}

// Share Link
export async function createShareLink(data: { resourceId: string; resourceType: string; expiresAt?: string; password?: string; maxViews?: number }) {
  return apiClient.post(`${BASE}/share-links`, data);
}

export async function listShareLinks(params?: { resourceId?: string; enabled?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.resourceId) qs.set('resourceId', params.resourceId);
  if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
  return apiClient.get(`${BASE}/share-links${qs.toString() ? `?${qs}` : ''}`);
}

export async function updateShareLink(id: string, data: Partial<ShareLink>) {
  return apiClient.put(`${BASE}/share-links/${id}`, data);
}

export async function deleteShareLink(id: string) {
  return apiClient.delete(`${BASE}/share-links/${id}`);
}

export async function regenerateShareLink(id: string) {
  return apiClient.post(`${BASE}/share-links/${id}/regenerate`, {});
}

export async function getShareByToken(token: string) {
  return apiClient.get(`${BASE}/share-links/token/${token}`);
}
