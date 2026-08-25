/**
 * Alert API Service
 * Alert CRUD operations and management
 */
import { api } from './client';

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  message: string;
  source: string;
  createdAt: string;
  updatedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  firstTriggered?: string;
  lastUpdated?: string;
}

export interface AlertListParams {
  severity?: string;
  status?: string;
  metric?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateAlertInput {
  severity: string;
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  cooldown?: number;
}

// ---- Alert CRUD ----

export function getAlerts(params?: AlertListParams) {
  return api.get('/alert/list', { params });
}

export function getAlert(id: string) {
  return api.get(`/alert/${id}`);
}

/** AI explanation for a single alert (GET /alert/:id/explain). */
export interface AlertExplanation {
  alertId: string;
  summary: string;
  severity: string;
  likelyCause: string;
  relation?: string;
  evidence?: string[];
  suggestions?: { title: string; description?: string; priority?: number }[];
  generatedAt: string;
}

export function getAlertExplain(id: string) {
  return api.get(`/alert/${id}/explain`);
}

export function createAlert(data: CreateAlertInput) {
  return api.post('/alert/ingest', data);
}

export function acknowledgeAlert(id: string, _data?: { acknowledgedBy?: string; reason?: string }) {
  // Backend doesn't have a direct acknowledge endpoint; use suppression maintenance window as workaround
  console.warn('acknowledgeAlert: backend endpoint not available, using suppression as fallback');
  return api.post(`/alert/suppression/maintenance-windows`, {
    name: `ack-${id}`,
    description: _data?.reason,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
  });
}

export function resolveAlert(_id: string, _data?: { resolvedBy?: string; resolution?: string }) {
  // Backend doesn't have a direct resolve endpoint
  console.warn('resolveAlert: backend endpoint not available');
  return api.post(`/alert/correlate`, { alerts: [{ id: _id }] });
}

export function deleteAlert(id: string) {
  return api.delete(`/alert/${id}`);
}

export function getActiveAlerts() {
  return api.get('/alert/list', { params: { status: 'active' } });
}

// ---- Alert Rules ----
// Note: Backend alert-routes.ts focuses on correlation/deduplication/suppression.
// Alert rule management is handled by monitoring-routes.ts under /monitoring/rules

export function getAlertRules() {
  // Alert rules are managed by /monitoring/rules, not /alert/rules
  console.warn('getAlertRules: rules are managed under /monitoring/rules, not /alert/rules');
  return api.get('/monitoring/rules');
}

export function createAlertRule(data: {
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
}) {
  return api.post('/monitoring/rules', data);
}

export function updateAlertRule(id: string, data: Partial<AlertRule>) {
  return api.put(`/monitoring/rules/${id}`, data);
}

export function deleteAlertRule(id: string) {
  return api.delete(`/monitoring/rules/${id}`);
}

export function toggleAlertRule(id: string) {
  return api.patch(`/monitoring/rules/${id}/toggle`);
}

// ---- Alert Stats ----

export function getAlertStats() {
  return api.get('/alert/deduplication/stats');
}

export function getAlertMetrics(metric: string, startTime?: string, endTime?: string) {
  return api.get(`/alert/groups`, { params: { metric, startTime, endTime } });
}
