/**
 * Intelligent Inspection API Service (Phase 4 - Intelligent Inspection)
 * Automated health checks, inspection rules, reports
 */
import { api } from './client';

export interface InspectionRule {
  id: string;
  name: string;
  description?: string;
  target: string;
  checkType: string;
  threshold: number;
  operator: string;
  enabled: boolean;
  schedule: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionTask {
  id: string;
  ruleId: string;
  status: string;
  result?: {
    id: string;
    passed: boolean;
    actualValue: number;
    expectedValue: number;
    message: string;
  };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface InspectionReport {
  id: string;
  title: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warning: number;
    score: number;
  };
  results: Array<{
    passed: boolean;
    actualValue: number;
    expectedValue: number;
    message: string;
  }>;
  generatedAt: string;
}

export interface HealthScore {
  score: number;
  details: Record<string, number>;
}

// Rules
export function createInspectionRule(data: {
  name: string; description?: string; target: string; checkType: string;
  threshold: number; operator: string; schedule: string;
}) {
  return api.post('/inspection/rules', data);
}

export function listInspectionRules(params?: { target?: string; enabled?: boolean }) {
  return api.get<{ data: InspectionRule[] }>('/inspection/rules', { params });
}

export function getInspectionRule(id: string) {
  return api.get<{ data: InspectionRule }>(`/inspection/rules/${id}`);
}

export function updateInspectionRule(id: string, data: Partial<InspectionRule>) {
  return api.put(`/inspection/rules/${id}`, data);
}

export function deleteInspectionRule(id: string) {
  return api.delete(`/inspection/rules/${id}`);
}

// Tasks
export function createInspectionTask(data: { ruleId: string }) {
  return api.post('/inspection/tasks', data);
}

export function listInspectionTasks(params?: { ruleId?: string; status?: string }) {
  return api.get<{ data: InspectionTask[] }>('/inspection/tasks', { params });
}

export function getInspectionTask(id: string) {
  return api.get<{ data: InspectionTask }>(`/inspection/tasks/${id}`);
}

// Reports
export function generateInspectionReport(data?: { title?: string; ruleIds?: string[] }) {
  return api.post('/inspection/reports', data || {});
}

export function listInspectionReports() {
  return api.get<{ data: InspectionReport[] }>('/inspection/reports');
}

export function getInspectionReport(id: string) {
  return api.get<{ data: InspectionReport }>(`/inspection/reports/${id}`);
}

// Health Score
export function getHealthScore() {
  return api.get<{ data: HealthScore }>('/inspection/health-score');
}
