/**
 * Monitoring API Service
 * Metrics, alert rules, alerts, notification channels, escalation policies
 */
import { api } from './client';

// ==================== Types ====================

export interface Metric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  lastUpdated: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldownMs?: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack';
  enabled: boolean;
  config: Record<string, string>;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  steps: Array<{ order: number; channel: string; delayMs: number }>;
  enabled: boolean;
}

// ==================== Monitoring Control ====================

export function startMonitoring() {
  return api.post<{ status: string; startedAt: string }>('/api/monitoring/start');
}

export function stopMonitoring() {
  return api.post<{ status: string; stoppedAt: string }>('/api/monitoring/stop');
}

export function getMonitoringHealth() {
  return api.get<{ status: string; uptime: number; metricsCount: number }>('/api/monitoring/health');
}

// ==================== Metrics ====================

export function getMetrics(params?: { tags?: string }) {
  return api.get<Metric[]>('/api/monitoring/metrics', { params });
}

export function recordMetric(data: { name: string; value: number; tags?: Record<string, string> }) {
  return api.post<{ recorded: boolean }>('/api/monitoring/metrics', data);
}

export function registerMetric(data: {
  name: string;
  type: string;
  unit: string;
  tags?: Record<string, string>;
}) {
  return api.post<{ registered: boolean }>('/api/monitoring/metrics/register', data);
}

export function getMetricSeries(
  name: string,
  params?: { from?: string; to?: string; step?: string }
) {
  return api.get<{ points: Array<{ timestamp: string; value: number }> }>(
    `/api/monitoring/metrics/${name}/series`,
    { params }
  );
}

export function getMetricSummary(name: string, params?: { window?: string }) {
  return api.get<{ avg: number; min: number; max: number; p95: number; count: number }>(
    `/api/monitoring/metrics/${name}/summary`,
    { params }
  );
}

// ==================== Alert Rules ====================

export function getAlertRules() {
  return api.get<AlertRule[]>('/api/monitoring/rules');
}

export function createAlertRule(data: Omit<AlertRule, 'id'>) {
  return api.post<AlertRule>('/api/monitoring/rules', data);
}

export function updateAlertRule(id: string, data: Partial<AlertRule>) {
  return api.put<AlertRule>(`/api/monitoring/rules/${id}`, data);
}

export function deleteAlertRule(id: string) {
  return api.delete<{ deleted: boolean }>(`/api/monitoring/rules/${id}`);
}

export function toggleAlertRule(id: string) {
  return api.patch<{ enabled: boolean }>(`/api/monitoring/rules/${id}/toggle`);
}

export function evaluateAlertRule(data: { ruleId: string }) {
  return api.post<{ triggered: boolean; value: number }>(`/api/monitoring/rules/evaluate`, data);
}

export function suppressAlertRule(id: string) {
  return api.post<{ suppressed: boolean }>(`/api/monitoring/rules/${id}/suppress`);
}

export function unsuppressAlertRule(id: string) {
  return api.post<{ suppressed: boolean }>(`/api/monitoring/rules/${id}/unsuppress`);
}

// ==================== Alerts ====================

export function getAlerts(params?: {
  status?: string;
  severity?: string;
  from?: string;
  to?: string;
}) {
  return api.get<Alert[]>('/api/monitoring/alerts', { params });
}

export function getActiveAlerts() {
  return api.get<Alert[]>('/api/monitoring/alerts/active');
}

export function getAlert(id: string) {
  return api.get<Alert>(`/api/monitoring/alerts/${id}`);
}

export function acknowledgeAlert(id: string, data?: { note?: string }) {
  return api.post<{ acknowledged: boolean }>(`/api/monitoring/alerts/${id}/acknowledge`, data);
}

export function resolveAlert(id: string) {
  return api.post<{ resolved: boolean }>(`/api/monitoring/alerts/${id}/resolve`);
}

export function escalateAlert(id: string, data: { reason: string; target?: string }) {
  return api.post<{ escalated: boolean }>(`/api/monitoring/alerts/${id}/escalate`, data);
}

// ==================== Notification Channels ====================

export function getChannels() {
  return api.get<NotificationChannel[]>('/api/monitoring/channels');
}

export function createChannel(data: Omit<NotificationChannel, 'id'>) {
  return api.post<NotificationChannel>('/api/monitoring/channels', data);
}

export function toggleChannel(id: string) {
  return api.patch<{ enabled: boolean }>(`/api/monitoring/channels/${id}/toggle`);
}

// ==================== Escalation Policies ====================

export function getEscalationPolicies() {
  return api.get<EscalationPolicy[]>('/api/monitoring/escalation');
}

export function createEscalationPolicy(data: Omit<EscalationPolicy, 'id'>) {
  return api.post<EscalationPolicy>('/api/monitoring/escalation', data);
}

// ==================== Notifications ====================

export function getNotifications(params?: { channel?: string; from?: string; to?: string }) {
  return api.get<Array<{ id: string; channelId: string; sentAt: string; status: string }>>(
    '/api/monitoring/notifications',
    { params }
  );
}

// ==================== Dashboard & Anomalies ====================

export function getDashboardData() {
  return api.get<{
    alerts: { total: number; active: number; resolved: number };
    rules: { total: number; enabled: number };
    metrics: { total: number; rate: number };
    channels: { total: number; active: number };
  }>('/api/monitoring/dashboard');
}

export function getAnomalySummary(params?: { window?: string }) {
  return api.get<{
    anomalies: Array<{ metric: string; time: string; severity: string }>;
    totalCount: number;
  }>('/api/monitoring/anomalies/summary', { params });
}
