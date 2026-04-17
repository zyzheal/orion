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
  return api.get('/v1/alerts', { params });
}

export function getAlert(id: string) {
  return api.get(`/v1/alerts/${id}`);
}

export function createAlert(data: CreateAlertInput) {
  return api.post('/v1/alerts', data);
}

export function acknowledgeAlert(id: string, data?: { acknowledgedBy?: string; reason?: string }) {
  return api.post(`/v1/alerts/${id}/acknowledge`, data);
}

export function resolveAlert(id: string, data?: { resolvedBy?: string; resolution?: string }) {
  return api.post(`/v1/alerts/${id}/resolve`, data);
}

export function deleteAlert(id: string) {
  return api.delete(`/v1/alerts/${id}`);
}

export function getActiveAlerts() {
  return api.get('/v1/alerts/active');
}

// ---- Alert Rules ----

export function getAlertRules() {
  return api.get('/v1/alerts/rules');
}

export function createAlertRule(data: {
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
}) {
  return api.post('/v1/alerts/rules', data);
}

export function updateAlertRule(id: string, data: Partial<AlertRule>) {
  return api.put(`/v1/alerts/rules/${id}`, data);
}

export function deleteAlertRule(id: string) {
  return api.delete(`/v1/alerts/rules/${id}`);
}

export function toggleAlertRule(id: string) {
  return api.patch(`/v1/alerts/rules/${id}/toggle`);
}

// ---- Alert Stats ----

export function getAlertStats() {
  return api.get('/v1/alerts/stats');
}

export function getAlertMetrics(metric: string, startTime?: string, endTime?: string) {
  return api.get(`/v1/alerts/metrics/${metric}`, { params: { startTime, endTime } });
}
