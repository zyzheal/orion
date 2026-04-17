/**
 * AI Gateway API Service
 * AI model routing, degradation handling, and rule engine
 */
import { api } from './client';

export interface AIRequest {
  scenario: AIScenario;
  input: Record<string, unknown>;
  options?: {
    timeout?: number;
    priority?: 'high' | 'medium' | 'low';
    requireConfidence?: number;
    fallbackEnabled?: boolean;
  };
  context?: {
    userId?: string;
    tenantId?: string;
    traceId?: string;
  };
}

export interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  confidence?: number;
  source: 'llm' | 'degraded' | 'cache' | 'fallback';
  degradationReason?: string;
  latency: number;
  error?: string;
}

export type AIScenario =
  | 'aegis-risk-assessment'
  | 'auto-scheduling'
  | 'root-cause-diagnosis'
  | 'code-review'
  | 'test-selection'
  | 'changelog-generation'
  | 'incident-summary'
  | 'runbook-suggestion'
  | 'metric-anomaly-detection'
  | 'log-pattern-analysis'
  | 'dependency-analysis'
  | 'capacity-forecast'
  | 'sla-prediction'
  | 'knowledge-extraction'
  | 'alert-correlation'
  | 'automation-suggestion';

export interface AIGatewayHealth {
  scenario: string;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  isHealthy: boolean;
  metrics: AIMetrics;
  lastCheckTime: string;
  degradationActive: boolean;
}

export interface AIMetrics {
  scenario: string;
  totalRequests: number;
  failedRequests: number;
  totalLatency: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
  lastError?: string;
  lastErrorTime?: string;
}

export interface RuleSet {
  id: string;
  name: string;
  scenario: AIScenario;
  description: string;
  enabled: boolean;
  rules: Rule[];
}

export interface Rule {
  id: string;
  name: string;
  scenario: AIScenario;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface RuleCondition {
  field: string;
  operator: 'contains' | 'in' | 'equals' | 'greater_than' | 'less_than';
  value: any;
}

export interface RuleAction {
  type: 'set' | 'block' | 'route';
  field: string;
  value: any;
}

// ==================== AI Gateway Execution ====================

export function executeAIRequest(request: AIRequest) {
  return api.post<AIResponse>('/v1/ai-gateway/execute', request);
}

// ==================== Health Monitoring ====================

export function getScenarioHealth(scenario: AIScenario) {
  return api.get<AIGatewayHealth>(`/v1/ai-gateway/health/${scenario}`);
}

export function getAllHealth() {
  return api.get<{ health: AIGatewayHealth[] }>('/v1/ai-gateway/health/all');
}

export function getGatewayStatus() {
  return api.get<{ status: string }>('/v1/ai-gateway/status');
}

// ==================== Rule Engine ====================

export function getRules() {
  return api.get<{ rules: any }>('/v1/ai-gateway/rules');
}

export function getEngineStatus() {
  return api.get<{ cacheEnabled: boolean; auditEnabled: boolean }>('/v1/ai-gateway/engine/status');
}

// ==================== Configuration ====================

export function getConfig() {
  return api.get<{ config: any }>('/v1/ai-gateway/config');
}

export function updateConfig(config: any) {
  return api.put('/v1/ai-gateway/config', config);
}
