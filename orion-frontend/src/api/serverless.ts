/**
 * Serverless API Service (Phase 4 P0 - Serverless Module)
 * Function lifecycle, triggers, deployment, invocation, logs, metrics, auto-scaling
 */
import { api } from './client';

// ============================================================================
// Types (mirrored from backend for frontend use)
// ============================================================================

export type FunctionStatus = 'draft' | 'deployed' | 'stopped' | 'error';
export type TriggerType = 'http' | 'cron' | 'event' | 'queue' | 'kafka' | 's3';
export type FunctionRuntime = 'nodejs18' | 'nodejs20' | 'python3.9' | 'python3.11' | 'go1.21' | 'java17';

export interface ServerlessFunction {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  runtime: FunctionRuntime;
  handler: string;
  memory: number;
  timeout: number;
  status: FunctionStatus;
  version: number;
  environment: Record<string, string>;
  code: string;
  triggerIds: string[];
  endpoint?: string;
  replicas: {
    min: number;
    max: number;
    current: number;
  };
  lastDeployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerlessTrigger {
  id: string;
  tenantId: string;
  functionId: string;
  type: TriggerType;
  name: string;
  config: {
    method?: string;
    path?: string;
    schedule?: string;
    eventSource?: string;
    pattern?: string;
    maxBatchSize?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffMs: number;
    };
  };
  enabled: boolean;
  invocationCount: number;
  lastInvokedAt?: string;
  createdAt: string;
}

export interface ServerlessDeployment {
  id: string;
  tenantId: string;
  functionId: string;
  version: number;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  codeVersion: string;
  deployedBy: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  rollbackTo?: number;
}

export interface ServerlessMetrics {
  functionId: string;
  tenantId: string;
  period: string;
  invocations: number;
  errors: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  avgMemoryUsed: number;
  throttledRequests: number;
  activeConnections: number;
  cpuUtilization: number;
}

export interface ServerlessLog {
  id: string;
  tenantId: string;
  functionId: string;
  deploymentId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  requestId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface AutoScalingRecommendation {
  functionId: string;
  functionName: string;
  currentReplicas: number;
  suggestedReplicas: number;
  reason: string;
  action: 'scale_up' | 'scale_down' | 'no_change';
}

export interface AggregateMetrics {
  totalFunctions: number;
  deployedFunctions: number;
  totalInvocations: number;
  totalErrors: number;
  avgDuration: number;
  errorRate: number;
}

// ============================================================================
// API Functions
// ============================================================================

// ---- Functions CRUD ----

export function createServerlessFunction(data: {
  name: string;
  description?: string;
  runtime: FunctionRuntime;
  handler: string;
  memory?: number;
  timeout?: number;
  environment?: Record<string, string>;
  code: string;
  replicas?: { min?: number; max?: number };
}) {
  return api.post('/api/serverless/functions', data);
}

export function listServerlessFunctions(params?: { status?: FunctionStatus; runtime?: FunctionRuntime }) {
  return api.get<{ data: ServerlessFunction[] }>('/api/serverless/functions', { params });
}

export function getServerlessFunction(id: string) {
  return api.get<{ data: ServerlessFunction }>(`/api/serverless/functions/${id}`);
}

export function updateServerlessFunction(id: string, data: {
  name?: string;
  description?: string;
  runtime?: FunctionRuntime;
  handler?: string;
  memory?: number;
  timeout?: number;
  environment?: Record<string, string>;
  code?: string;
  replicas?: { min?: number; max?: number };
}) {
  return api.put(`/api/serverless/functions/${id}`, data);
}

export function deleteServerlessFunction(id: string) {
  return api.delete(`/api/serverless/functions/${id}`);
}

// ---- Deployment ----

export function deployServerlessFunction(id: string) {
  return api.post(`/api/serverless/functions/${id}/deploy`);
}

export function listDeployments(id: string) {
  return api.get<{ data: ServerlessDeployment[] }>(`/api/serverless/functions/${id}/deployments`);
}

// ---- Invocation ----

export function invokeServerlessFunction(id: string, payload?: Record<string, unknown>) {
  return api.post(`/api/serverless/functions/${id}/invoke`, payload);
}

// ---- Logs ----

export function getFunctionLogs(id: string, params?: { level?: string; limit?: number }) {
  return api.get<{ data: ServerlessLog[] }>(`/api/serverless/functions/${id}/logs`, { params });
}

// ---- Metrics ----

export function getFunctionMetrics(id: string) {
  return api.get<{ data: ServerlessMetrics[] }>(`/api/serverless/functions/${id}/metrics`);
}

export function getAggregateMetrics() {
  return api.get<{ data: AggregateMetrics }>('/api/serverless/metrics');
}

// ---- Triggers ----

export function createTrigger(data: {
  functionId: string;
  type: TriggerType;
  name: string;
  config: ServerlessTrigger['config'];
}) {
  return api.post('/api/serverless/triggers', data);
}

export function listTriggers(params?: { functionId?: string; type?: TriggerType }) {
  return api.get<{ data: ServerlessTrigger[] }>('/api/serverless/triggers', { params });
}

export function deleteTrigger(id: string) {
  return api.delete(`/api/serverless/triggers/${id}`);
}

// ---- Auto-scaling ----

export function getAutoScalingRecommendations() {
  return api.get<{ data: AutoScalingRecommendation[] }>('/api/serverless/autoscaling');
}
