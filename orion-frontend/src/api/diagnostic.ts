/**
 * Diagnostic API Service
 * Diagnostic sessions, reports, knowledge base patterns
 */
import { api } from './client';

// ==================== Types ====================

export interface DiagnosticSession {
  id: string;
  triggerType: string;
  triggerId: string;
  status: string;
  symptomCount: number;
  startTime: string;
  duration?: number;
}

export interface DiagnosticSymptom {
  type: string;
  source: string;
  description: string;
  severity: string;
}

export interface DiagnosticReport {
  id: string;
  sessionId: string;
  patternMatches: number;
  confidence: number;
  generatedAt: string;
}

export interface DiagnosticPattern {
  id: string;
  name: string;
  category: string;
  symptoms: string[];
  rootCause: string;
  solution: string;
  frequency: number;
}

// ==================== Diagnostic Trigger ====================

export function triggerDiagnostic(data: {
  triggerType: string;
  triggerId: string;
  symptoms?: DiagnosticSymptom[];
}) {
  return api.post<{ sessionId: string; status: string }>('/api/diagnostic/trigger', data);
}

// ==================== Sessions ====================

export function getSessions(params?: {
  status?: string;
  triggerType?: string;
  from?: string;
  to?: string;
}) {
  return api.get<DiagnosticSession[]>('/api/diagnostic/sessions', { params });
}

export function getSession(id: string) {
  return api.get<DiagnosticSession & { symptoms: DiagnosticSymptom[] }>(
    `/api/diagnostic/sessions/${id}`
  );
}

export function addSymptom(id: string, data: DiagnosticSymptom) {
  return api.post<{ symptomCount: number }>(`/api/diagnostic/sessions/${id}/symptoms`, data);
}

export function completeSession(id: string) {
  return api.post<{ completed: boolean; reportId: string }>(
    `/api/diagnostic/sessions/${id}/complete`
  );
}

export function getSessionComplexity(id: string) {
  return api.get<{ complexity: string; factors: string[]; score: number }>(
    `/api/diagnostic/sessions/${id}/complexity`
  );
}

// ==================== Reports ====================

export function getReports(params?: { sessionId?: string; from?: string; to?: string }) {
  return api.get<DiagnosticReport[]>('/api/diagnostic/reports', { params });
}

export function getReport(id: string) {
  return api.get<
    DiagnosticReport & {
      findings: Array<{ pattern: string; confidence: number; description: string }>;
    }
  >(`/api/diagnostic/reports/${id}`);
}

// ==================== Knowledge Base ====================

export function searchPatterns(params?: { category?: string; keyword?: string }) {
  return api.get<DiagnosticPattern[]>('/api/diagnostic/knowledge/patterns', { params });
}

export function getPattern(id: string) {
  return api.get<DiagnosticPattern>(`/api/diagnostic/knowledge/patterns/${id}`);
}

export function addPattern(data: Omit<DiagnosticPattern, 'id' | 'frequency'>) {
  return api.post<DiagnosticPattern>('/api/diagnostic/knowledge/patterns', data);
}

export function getKnowledgeStats() {
  return api.get<{
    totalPatterns: number;
    categories: Record<string, number>;
    avgConfidence: number;
  }>('/api/diagnostic/knowledge/stats');
}

export function recordOutcome(data: { sessionId: string; success: boolean; notes?: string }) {
  return api.post<{ recorded: boolean }>('/api/diagnostic/knowledge/outcomes', data);
}

// ==================== Status ====================

export function getDiagnosticStatus() {
  return api.get<{ status: string; activeSessions: number; totalSessions: number }>(
    '/api/diagnostic/status'
  );
}
