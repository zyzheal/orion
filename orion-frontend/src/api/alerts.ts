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
  return api.get('/v1/alert/list', { params });
}

export function getAlert(id: string) {
  return api.get(`/v1/alert/${id}`);
}

export function createAlert(data: CreateAlertInput) {
  return api.post('/v1/alert/ingest', data);
}

export function acknowledgeAlert(id: string, _data?: { acknowledgedBy?: string; reason?: string }) {
  // Backend doesn't have a direct acknowledge endpoint; use suppression maintenance window as workaround
  console.warn('acknowledgeAlert: backend endpoint not available, using suppression as fallback');
  return api.post(`/v1/alert/suppression/maintenance-windows`, {
    name: `ack-${id}`,
    description: _data?.reason,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
  });
}

export function resolveAlert(_id: string, _data?: { resolvedBy?: string; resolution?: string }) {
  // Backend doesn't have a direct resolve endpoint
  console.warn('resolveAlert: backend endpoint not available');
  return api.post(`/v1/alert/correlate`, { alerts: [{ id: _id }] });
}

export function deleteAlert(_id: string) {
  // Backend doesn't have delete endpoint
  console.warn('deleteAlert: backend endpoint not available');
  return Promise.resolve();
}

export function getActiveAlerts() {
  return api.get('/v1/alert/list', { params: { status: 'active' } });
}

// ---- Alert Rules ----
// Note: Backend alert-routes.ts focuses on correlation/deduplication/suppression.
// Alert rule management is handled by monitoring-routes.ts under /monitoring/rules

export function getAlertRules() {
  // Alert rules are managed by /monitoring/rules, not /alert/rules
  console.warn('getAlertRules: rules are managed under /monitoring/rules, not /alert/rules');
  return api.get('/v1/monitoring/rules');
}

export function createAlertRule(data: {
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
}) {
  return api.post('/v1/monitoring/rules', data);
}

export function updateAlertRule(id: string, data: Partial<AlertRule>) {
  return api.put(`/v1/monitoring/rules/${id}`, data);
}

export function deleteAlertRule(id: string) {
  return api.delete(`/v1/monitoring/rules/${id}`);
}

export function toggleAlertRule(id: string) {
  return api.patch(`/v1/monitoring/rules/${id}/toggle`);
}

// ---- Alert Stats ----

export function getAlertStats() {
  return api.get('/v1/alert/deduplication/stats');
}

export function getAlertMetrics(metric: string, startTime?: string, endTime?: string) {
  return api.get(`/v1/alert/groups`, { params: { metric, startTime, endTime } });
}
