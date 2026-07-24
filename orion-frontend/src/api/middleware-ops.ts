/**
 * Middleware Operations API Service (Phase 4 - Middleware Operations)
 * Middleware health monitoring, connection pool management, message queue tracking
 */
import { api } from './client';

export interface MiddlewareInstance {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  status: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MiddlewareMetric {
  id: string;
  middlewareId: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface ConnectionPool {
  id: string;
  middlewareId: string;
  poolName: string;
  active: number;
  idle: number;
  max: number;
  waiting: number;
  timestamp: string;
}

export interface MessageQueueStats {
  id: string;
  middlewareId: string;
  queueName: string;
  messageCount: number;
  consumerCount: number;
  messagesPerSecond: number;
  avgLatencyMs: number;
  deadLetterCount: number;
  timestamp: string;
}

export interface MiddlewareAlert {
  id: string;
  middlewareId: string;
  middlewareName: string;
  alertType: string;
  severity: string;
  message: string;
  value: number;
  threshold: number;
  createdAt: string;
}

// Instances
export function createMiddlewareInstance(data: {
  name: string; type: string; host: string; port: number;
  version?: string; config?: Record<string, unknown>;
}) {
  return api.post('/middleware/instances', data);
}

export function listMiddlewareInstances(params?: { type?: string; status?: string }) {
  return api.get<{ data: MiddlewareInstance[] }>('/middleware/instances', { params });
}

export function getMiddlewareInstance(id: string) {
  return api.get<{ data: MiddlewareInstance }>(`/middleware/instances/${id}`);
}

export function updateMiddlewareInstance(id: string, data: Partial<MiddlewareInstance>) {
  return api.put(`/middleware/instances/${id}`, data);
}

export function deleteMiddlewareInstance(id: string) {
  return api.delete(`/middleware/instances/${id}`);
}

// Metrics
export function recordMiddlewareMetric(data: {
  middlewareId: string; metricName: string; value: number; unit: string;
}) {
  return api.post('/middleware/metrics', data);
}

export function listMiddlewareMetrics(params?: { middlewareId?: string; metricName?: string }) {
  return api.get<{ data: MiddlewareMetric[] }>('/middleware/metrics', { params });
}

// Connection Pools
export function recordConnectionPool(data: {
  middlewareId: string; poolName: string; active: number; idle: number; max: number; waiting: number;
}) {
  return api.post('/middleware/connection-pools', data);
}

export function listConnectionPools(params?: { middlewareId?: string }) {
  return api.get<{ data: ConnectionPool[] }>('/middleware/connection-pools', { params });
}

// MQ Stats
export function recordMqStats(data: {
  middlewareId: string; queueName: string; messageCount: number; consumerCount: number;
  messagesPerSecond: number; avgLatencyMs: number; deadLetterCount: number;
}) {
  return api.post('/middleware/mq-stats', data);
}

export function listMqStats(params?: { middlewareId?: string }) {
  return api.get<{ data: MessageQueueStats[] }>('/middleware/mq-stats', { params });
}

// Alerts
export function listMiddlewareAlerts(params?: { severity?: string; alertType?: string }) {
  return api.get<{ data: MiddlewareAlert[] }>('/middleware/alerts', { params });
}

export function deleteMiddlewareAlert(id: string) {
  return api.delete(`/middleware/alerts/${id}`);
}

// Health
export function getMiddlewareHealthSummary() {
  return api.get<{ data: { totalInstances: number; healthyCount: number; degradedCount: number; unhealthyCount: number; totalAlerts: number; criticalAlerts: number; healthScore: number } }>('/middleware/health-summary');
}
