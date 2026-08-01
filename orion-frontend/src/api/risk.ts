/**
 * Risk Assessment API Service
 * Risk scoring, health checks, and risk event subscription
 */
import { api } from './client';

export interface RiskAssessment {
  id: string;
  targetType: 'deployment' | 'change' | 'pipeline' | 'infrastructure';
  targetId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
  status: 'pending' | 'completed' | 'failed';
  assessedBy: string;
  assessedAt: string;
}

export interface RiskFactor {
  name: string;
  category: string;
  score: number;
  weight: number;
  description: string;
  status: 'pass' | 'warning' | 'fail';
}

export interface HealthCheckResult {
  id: string;
  checkType: 'pre-deployment' | 'basic' | 'comprehensive';
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckItem[];
  executedAt: string;
  duration: number;
}

export interface HealthCheckItem {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message?: string;
  duration?: number;
}

export interface RiskEvent {
  id: string;
  eventType: 'risk_detected' | 'risk_escalated' | 'risk_mitigated';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  targetType: string;
  targetId: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface RiskAssessmentInput {
  targetType: 'deployment' | 'change' | 'pipeline' | 'infrastructure';
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface RiskFilters {
  targetType?: string;
  riskLevel?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

// ==================== Risk Assessment ====================

export function assessDeploymentRisk(deploymentId: string, params?: Record<string, unknown>) {
  return api.post<RiskAssessment>('/api/risk/assess/deployment', { deploymentId, ...params });
}

export function assessChangeRisk(changeId: string) {
  return api.post<RiskAssessment>('/api/risk/assess/change', { changeId });
}

export function getRiskAssessments(filters?: RiskFilters) {
  return api.get<{ assessments: RiskAssessment[]; total: number }>('/api/risk/assessments', {
    params: filters,
  });
}

export function getRiskAssessment(id: string) {
  return api.get<RiskAssessment>(`/api/risk/assessments/${id}`);
}

// ==================== Health Checks ====================

export function runHealthCheck(checkType?: 'pre-deployment' | 'basic' | 'comprehensive') {
  return api.post<HealthCheckResult>('/api/risk/health-check', { checkType });
}

export function runBasicHealthCheck() {
  return api.post<HealthCheckResult>('/api/risk/health-check/basic');
}

export function getHealthCheckHistory() {
  return api.get<{ checks: HealthCheckResult[] }>('/api/risk/health-check/history');
}

export interface RiskReport {
  id: string;
  assessmentId: string;
  type: string;
  generatedAt: string;
  summary: string;
  [key: string]: unknown;
}

// ==================== Risk Reports ====================

export function generateRiskReport(assessmentId: string) {
  return api.post<{ report: RiskReport }>(`/api/risk/reports/generate/${assessmentId}`);
}

export function getRiskReports() {
  return api.get<{ reports: RiskReport[] }>('/api/risk/reports');
}

// ==================== Risk Events ====================

export function getRiskEvents(status?: 'all' | 'acknowledged' | 'unacknowledged') {
  return api.get<{ events: RiskEvent[] }>('/api/risk/events', { params: { status } });
}

export function acknowledgeRiskEvent(id: string) {
  return api.post<{ acknowledged: boolean }>(`/api/risk/events/${id}/acknowledge`);
}

// ==================== Status ====================

export function getRiskStatus() {
  return api.get<{
    status: string;
    totalAssessments: number;
    pendingAssessments: number;
    highRiskCount: number;
  }>('/api/risk/status');
}
