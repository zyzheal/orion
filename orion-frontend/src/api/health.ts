/**
 * Health Dashboard API Service
 * Prefix: /api/service-health
 */

import { api } from './client';

// ==================== Types ====================

export interface HealthScore {
  score: number;        // 0-100
  level: 'healthy' | 'warning' | 'critical';
  updatedAt: string;
}

export interface HealthAlert {
  id: string;
  serviceName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
}

export interface ServiceHealthRow {
  serviceId: string;
  serviceName: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs: number;
  errorRate: number;
  uptimePercent: number;
  lastChecked: string;
}

export interface TrendPoint {
  timestamp: string;
  healthScore: number;
  errorRate: number;
  latencyMs: number;
}

export interface HealthDashboardData {
  score: HealthScore;
  activeAlerts: number;
  avgLatencyMs: number;
  errorRate: number;
  services: ServiceHealthRow[];
  alerts: HealthAlert[];
  trend: TrendPoint[];
}

// ==================== Dashboard API ====================

export function getHealthDashboard(): Promise<HealthDashboardData> {
  return api.get<HealthDashboardData>('/api/service-health/dashboard').then((res) => res.data);
}

export function getHealthScore(): Promise<HealthScore> {
  return api.get<HealthScore>('/api/service-health/score').then((res) => res.data);
}

export function getServiceHealthList(): Promise<ServiceHealthRow[]> {
  return api.get<ServiceHealthRow[]>('/api/service-health/services').then((res) => res.data);
}

export function getHealthAlerts(params?: { status?: string; limit?: number }): Promise<HealthAlert[]> {
  return api.get<HealthAlert[]>('/api/service-health/alerts', { params }).then((res) => res.data);
}

export function getHealthTrend(since?: string): Promise<TrendPoint[]> {
  return api.get<TrendPoint[]>('/api/service-health/trend', { params: { since } }).then((res) => res.data);
}
