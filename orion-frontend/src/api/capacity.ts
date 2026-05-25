/**
 * Capacity Planning API Service (Phase 4 - Capacity Planning)
 * Resource capacity tracking, forecasting, bottleneck analysis
 */
import { api } from './client';

export interface CapacityMetric {
  id: string;
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentValue: number;
  maxValue: number;
  unit: string;
  utilizationPercent: number;
  timestamp: string;
}

export interface CapacityForecast {
  id: string;
  resourceType: string;
  resourceId: string;
  metricName: string;
  currentUtilization: number;
  forecast30Days: number;
  forecast90Days: number;
  estimatedExhaustDate?: string;
  recommendedAction?: string;
  generatedAt: string;
}

export interface CapacityAlert {
  id: string;
  resourceId: string;
  resourceType: string;
  metricName: string;
  currentUtilization: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  createdAt: string;
}

export interface CapacityReport {
  id: string;
  title: string;
  summary: {
    totalResources: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
    overallScore: number;
  };
  alerts: CapacityAlert[];
  forecasts: CapacityForecast[];
  generatedAt: string;
}

export interface Bottleneck {
  resourceId: string;
  resourceType: string;
  metricName: string;
  utilization: number;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

// Metrics
export function recordCapacityMetric(data: {
  resourceType: string; resourceId: string; metricName: string;
  currentValue: number; maxValue: number; unit: string;
}) {
  return api.post('/capacity/metrics', data);
}

export function listCapacityMetrics(params?: { resourceType?: string; metricName?: string }) {
  return api.get<{ data: CapacityMetric[] }>('/capacity/metrics', { params });
}

// Forecast
export function generateCapacityForecast() {
  return api.post('/capacity/forecast');
}

export function listCapacityForecasts(params?: { resourceType?: string }) {
  return api.get<{ data: CapacityForecast[] }>('/capacity/forecast', { params });
}

// Alerts
export function listCapacityAlerts(params?: { severity?: string }) {
  return api.get<{ data: CapacityAlert[] }>('/capacity/alerts', { params });
}

export function deleteCapacityAlert(id: string) {
  return api.delete(`/capacity/alerts/${id}`);
}

// Reports
export function generateCapacityReport(data?: { title?: string }) {
  return api.post('/capacity/reports', data || {});
}

export function listCapacityReports() {
  return api.get<{ data: CapacityReport[] }>('/capacity/reports');
}

export function getCapacityReport(id: string) {
  return api.get<{ data: CapacityReport }>(`/capacity/reports/${id}`);
}

// Bottleneck
export function analyzeBottlenecks() {
  return api.get<{ data: Bottleneck[] }>('/capacity/bottlenecks');
}
