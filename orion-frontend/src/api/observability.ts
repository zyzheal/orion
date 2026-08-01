/**
 * Observability API
 * Phase 2 - Custom alert rules, root cause analysis, silence rules
 */
import { api } from './client';

// ---- Types ----

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq';
  threshold: number;
  duration: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  labels: Record<string, string>;
  annotations: {
    summary: string;
    description: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SilenceRule {
  id: string;
  matchers: Array<{
    name: string;
    value: string;
    isRegex: boolean;
  }>;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  comment: string;
  status: 'active' | 'expired';
}

export interface RootCauseAnalysis {
  id: string;
  incidentId: string;
  startTime: string;
  endTime: string | null;
  status: 'analyzing' | 'completed' | 'failed';
  rootCause: {
    service: string;
    component: string;
    description: string;
    confidence: number;
  } | null;
  contributingFactors: Array<{
    service: string;
    metric: string;
    impact: number;
    description: string;
  }>;
  timeline: Array<{
    timestamp: string;
    event: string;
    service: string;
  }>;
  recommendations: string[];
}

export interface TraceData {
  traceId: string;
  serviceName: string;
  operationName: string;
  duration: number;
  status: 'ok' | 'error';
  startTime: string;
  tags: Record<string, string>;
  spans: Array<{
    spanId: string;
    parentSpanId: string | null;
    operationName: string;
    serviceName: string;
    duration: number;
    status: 'ok' | 'error';
    logs: Array<{ timestamp: string; fields: Record<string, string> }>;
  }>;
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  requestRate: number;
  saturation: number;
}

export interface AlertRuleInput {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq';
  threshold: number;
  duration: string;
  severity: 'critical' | 'warning' | 'info';
  labels?: Record<string, string>;
  annotations?: { summary: string; description: string };
}

export interface SilenceRuleInput {
  matchers: Array<{ name: string; value: string; isRegex: boolean }>;
  startsAt: string;
  endsAt: string;
  comment: string;
}

// ---- Alert Rules API ----

export function getAlertRules(params?: { enabled?: boolean }) {
  return api.get<{ rules: AlertRule[] }>('/api/observability/alert-rules', { params });
}

export function createAlertRule(data: AlertRuleInput) {
  return api.post<AlertRule>('/api/observability/alert-rules', data);
}

export function updateAlertRule(ruleId: string, data: Partial<AlertRuleInput>) {
  return api.put<AlertRule>(`/api/observability/alert-rules/${ruleId}`, data);
}

export function deleteAlertRule(ruleId: string) {
  return api.delete(`/api/observability/alert-rules/${ruleId}`);
}

export function toggleAlertRule(ruleId: string) {
  return api.post(`/api/observability/alert-rules/${ruleId}/toggle`);
}

// ---- Silence Rules API ----

export function getSilenceRules(params?: { status?: string }) {
  return api.get<{ rules: SilenceRule[] }>('/api/observability/silence-rules', { params });
}

export function createSilenceRule(data: SilenceRuleInput) {
  return api.post<SilenceRule>('/api/observability/silence-rules', data);
}

export function deleteSilenceRule(ruleId: string) {
  return api.delete(`/api/observability/silence-rules/${ruleId}`);
}

// ---- Root Cause Analysis API ----

export function getRootCauseAnalyses(params?: { incidentId?: string; status?: string }) {
  return api.get<{ analyses: RootCauseAnalysis[] }>('/api/observability/rca', { params });
}

export function getRootCauseAnalysis(analysisId: string) {
  return api.get<RootCauseAnalysis>(`/api/observability/rca/${analysisId}`);
}

export function triggerRCA(data: { incidentId: string; serviceIds?: string[] }) {
  return api.post<RootCauseAnalysis>('/api/observability/rca/trigger', data);
}

// ---- Traces API ----

export function getTraces(params?: {
  serviceName?: string;
  traceId?: string;
  limit?: number;
  startTime?: string;
  endTime?: string;
}) {
  return api.get<{ traces: TraceData[] }>('/api/observability/traces', { params });
}

export function getTrace(traceId: string) {
  return api.get<TraceData>(`/api/observability/traces/${traceId}`);
}

// ---- Service Health API ----

export function getServiceHealth(params?: { serviceName?: string }) {
  return api.get<{ services: ServiceHealth[] }>('/api/observability/health', { params });
}

// ---- Alert Rule Templates API ----

export interface AlertRuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  ruleType: 'threshold' | 'trend' | 'composite';
  severity: 'critical' | 'warning' | 'info';
  suggestedEvaluationIntervalSec: number;
  suggestedCooldownSec: number;
}

export function getAlertRuleTemplates(params?: { category?: string }) {
  return api.get<{ data: AlertRuleTemplate[]; total: number }>(
    '/api/observability/alert-rule-templates',
    { params },
  );
}

export function createAlertRuleFromTemplate(data: {
  templateId: string;
  overrides?: Record<string, unknown>;
}) {
  return api.post('/api/observability/alert-rules/from-template', data);
}

// ---- RCA Timeline API ----

export interface TimelineEvent {
  timestamp: string;
  service: string;
  eventType: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface TimelineReport {
  deploymentId: string;
  events: TimelineEvent[];
  timeWindowStart: string;
  timeWindowEnd: string;
  totalEvents: number;
  criticalEvents: number;
}

export function getRcaTimeline(deploymentId: string, params?: { start?: string; end?: string }) {
  return api.get<{ timeline: TimelineReport }>(
    `/api/observability/rca/${deploymentId}/timeline`,
    { params },
  );
}

// ---- Dependency Graph API ----

export interface ServiceDependency {
  service: string;
  dependsOn: string[];
  dependencyType: 'sync' | 'async' | 'database' | 'cache' | 'external';
}

export function getDependencyGraph() {
  return api.get<{ data: ServiceDependency[] }>('/api/observability/dependency-graph');
}

export function analyzeDependencyRootCause(affectedServices: string[]) {
  return api.post<{ data: string[] }>(
    '/api/observability/dependency-graph/analyze',
    { affectedServices },
  );
}

// ---- Temporal Correlation API ----

export interface TemporalCorrelationResult {
  correlatedAlerts: Array<{
    id: string;
    name: string;
    service: string;
    severity: string;
    correlationReason: string;
  }>;
  timeCluster: { start: string; end: string; alertCount: number };
  burstDetected: boolean;
}

export function analyzeTemporalCorrelation(
  alerts: Array<{
    id: string;
    name: string;
    service: string;
    severity: 'critical' | 'warning' | 'info';
    firedAt: string;
    message: string;
  }>,
  windowMs?: number,
) {
  return api.post<{ data: TemporalCorrelationResult }>(
    '/api/observability/temporal-correlation',
    { alerts, windowMs },
  );
}
