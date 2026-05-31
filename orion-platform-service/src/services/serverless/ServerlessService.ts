/**
 * Serverless Service (Phase 4 P0 - Serverless Module)
 * Function lifecycle management, event-driven triggers, auto-scaling, log aggregation, metrics collection
 */

import { v4 as uuidv4 } from 'uuid';
import { OrionError, ErrorCode } from '../../errors';

// ============================================================================
// Data Models
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
  handler: string; // e.g., "index.handler"
  memory: number; // MB
  timeout: number; // seconds
  status: FunctionStatus;
  version: number;
  environment: Record<string, string>;
  code: string; // Base64 encoded or source
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
    method?: string; // HTTP
    path?: string; // HTTP
    schedule?: string; // Cron expression
    eventSource?: string; // Event/Queue/Kafka topic
    pattern?: string; // S3 key pattern
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
  period: string; // ISO timestamp
  invocations: number;
  errors: number;
  avgDuration: number; // ms
  p95Duration: number; // ms
  p99Duration: number; // ms;
  avgMemoryUsed: number; // MB
  throttledRequests: number;
  activeConnections: number;
  cpuUtilization: number; // percentage
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
  duration?: number; // ms
  metadata?: Record<string, unknown>;
}

// ============================================================================
// In-memory storage (will be migrated to PostgreSQL via Repository pattern)
// ============================================================================

const functions = new Map<string, ServerlessFunction>();
const triggers = new Map<string, ServerlessTrigger>();
const deployments = new Map<string, ServerlessDeployment>();
const logs = new Map<string, ServerlessLog>();
const metrics = new Map<string, ServerlessMetrics>();

// ============================================================================
// ServerlessService
// ============================================================================

export class ServerlessService {

  // ---- Function CRUD ----

  async createFunction(input: {
    name: string;
    description?: string;
    runtime: FunctionRuntime;
    handler: string;
    memory?: number;
    timeout?: number;
    environment?: Record<string, string>;
    code: string;
    replicas?: { min?: number; max?: number };
  }, tenantId: string): Promise<ServerlessFunction> {
    const fn: ServerlessFunction = {
      id: uuidv4(),
      tenantId,
      name: input.name,
      description: input.description || '',
      runtime: input.runtime,
      handler: input.handler,
      memory: input.memory || 256,
      timeout: input.timeout || 30,
      status: 'draft',
      version: 1,
      environment: input.environment || {},
      code: input.code,
      triggerIds: [],
      replicas: {
        min: input.replicas?.min ?? 0,
        max: input.replicas?.max ?? 10,
        current: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    functions.set(fn.id, fn);
    return fn;
  }

  async getFunction(id: string, tenantId: string): Promise<ServerlessFunction | undefined> {
    const fn = functions.get(id);
    return fn?.tenantId === tenantId ? fn : undefined;
  }

  async listFunctions(tenantId: string, params?: { status?: FunctionStatus; runtime?: FunctionRuntime }): Promise<ServerlessFunction[]> {
    let result = Array.from(functions.values()).filter((f) => f.tenantId === tenantId);
    if (params?.status) result = result.filter((f) => f.status === params.status);
    if (params?.runtime) result = result.filter((f) => f.runtime === params.runtime);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateFunction(id: string, tenantId: string, input: {
    name?: string;
    description?: string;
    runtime?: FunctionRuntime;
    handler?: string;
    memory?: number;
    timeout?: number;
    environment?: Record<string, string>;
    code?: string;
    replicas?: { min?: number; max?: number };
  }): Promise<ServerlessFunction | undefined> {
    const fn = functions.get(id);
    if (!fn || fn.tenantId !== tenantId) return undefined;

    if (input.name !== undefined) fn.name = input.name;
    if (input.description !== undefined) fn.description = input.description;
    if (input.runtime !== undefined) fn.runtime = input.runtime;
    if (input.handler !== undefined) fn.handler = input.handler;
    if (input.memory !== undefined) fn.memory = input.memory;
    if (input.timeout !== undefined) fn.timeout = input.timeout;
    if (input.environment !== undefined) fn.environment = input.environment;
    if (input.code !== undefined) fn.code = input.code;
    if (input.replicas) {
      fn.replicas.min = input.replicas.min ?? fn.replicas.min;
      fn.replicas.max = input.replicas.max ?? fn.replicas.max;
    }
    fn.updatedAt = new Date().toISOString();
    return fn;
  }

  async deleteFunction(id: string, tenantId: string): Promise<boolean> {
    const fn = functions.get(id);
    if (!fn || fn.tenantId !== tenantId) return false;

    // Delete associated triggers
    for (const triggerId of fn.triggerIds) {
      triggers.delete(triggerId);
    }

    // Delete associated deployments
    for (const [, dep] of deployments.entries()) {
      if (dep.functionId === id && dep.tenantId === tenantId) {
        deployments.delete(dep.id);
      }
    }

    // Delete associated logs
    for (const [, log] of logs.entries()) {
      if (log.functionId === id && log.tenantId === tenantId) {
        logs.delete(log.id);
      }
    }

    functions.delete(id);
    return true;
  }

  // ---- Deployment ----

  async deployFunction(functionId: string, tenantId: string): Promise<ServerlessDeployment> {
    const fn = functions.get(functionId);
    if (!fn || fn.tenantId !== tenantId) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'FUNCTION_NOT_FOUND');
    }

    const deployment: ServerlessDeployment = {
      id: uuidv4(),
      tenantId,
      functionId,
      version: fn.version,
      status: 'deploying',
      codeVersion: uuidv4().slice(0, 8),
      deployedBy: 'system',
      startedAt: new Date().toISOString(),
    };
    deployments.set(deployment.id, deployment);

    // Simulate deployment (in production, this would call K8s/Knative)
    try {
      // Simulate async deployment
      fn.status = 'deployed';
      fn.version += 1;
      fn.lastDeployedAt = new Date().toISOString();
      fn.updatedAt = new Date().toISOString();
      fn.endpoint = `https://${fn.name}.${tenantId}.serverless.orion.dev`;

      // Auto-scale: start replicas based on config
      fn.replicas.current = Math.max(fn.replicas.min, 1);

      deployment.status = 'success';
      deployment.completedAt = new Date().toISOString();

      this.addLog(tenantId, functionId, deployment.id, 'info', `Function ${fn.name} deployed successfully, v${fn.version}`, {
        endpoint: fn.endpoint,
        replicas: fn.replicas.current,
      });

      return deployment;
    } catch (err) {
      deployment.status = 'failed';
      deployment.completedAt = new Date().toISOString();
      deployment.error = err instanceof Error ? err.message : 'Unknown error';

      fn.status = 'error';
      fn.updatedAt = new Date().toISOString();

      this.addLog(tenantId, functionId, deployment.id, 'error', `Deployment failed: ${deployment.error}`);

      return deployment;
    }
  }

  async listDeployments(functionId: string, tenantId: string): Promise<ServerlessDeployment[]> {
    return Array.from(deployments.values())
      .filter((d) => d.functionId === functionId && d.tenantId === tenantId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  // ---- Invocation ----

  async invokeFunction(functionId: string, tenantId: string, payload?: Record<string, unknown>): Promise<{
    requestId: string;
    status: number;
    result: unknown;
    duration: number;
  }> {
    const fn = functions.get(functionId);
    if (!fn || fn.tenantId !== tenantId) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'FUNCTION_NOT_FOUND');
    }

    if (fn.status !== 'deployed') {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'FUNCTION_NOT_DEPLOYED');
    }

    const requestId = uuidv4();
    const startTime = Date.now();

    // Simulate function execution (in production, this would call the actual function endpoint)
    const simulatedDuration = 50 + Math.random() * 200;

    // Update metrics
    await this.recordMetric(functionId, tenantId, {
      invocations: 1,
      errors: 0,
      avgDuration: simulatedDuration,
      p95Duration: simulatedDuration * 1.5,
      p99Duration: simulatedDuration * 2,
      avgMemoryUsed: fn.memory * 0.6,
      throttledRequests: 0,
      activeConnections: fn.replicas.current,
      cpuUtilization: 30 + Math.random() * 40,
    });

    this.addLog(tenantId, functionId, '', 'info', `Function invoked: ${fn.name}`, { requestId, payload });

    return {
      requestId,
      status: 200,
      result: { message: `Function ${fn.name} executed successfully`, input: payload },
      duration: Math.round(simulatedDuration),
    };
  }

  // ---- Triggers ----

  async createTrigger(input: {
    functionId: string;
    type: TriggerType;
    name: string;
    config: ServerlessTrigger['config'];
  }, tenantId: string): Promise<ServerlessTrigger> {
    const fn = functions.get(input.functionId);
    if (!fn || fn.tenantId !== tenantId) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'FUNCTION_NOT_FOUND');
    }

    const trigger: ServerlessTrigger = {
      id: uuidv4(),
      tenantId,
      functionId: input.functionId,
      type: input.type,
      name: input.name,
      config: input.config,
      enabled: true,
      invocationCount: 0,
      createdAt: new Date().toISOString(),
    };

    triggers.set(trigger.id, trigger);

    // Link trigger to function
    fn.triggerIds.push(trigger.id);
    fn.updatedAt = new Date().toISOString();

    return trigger;
  }

  async listTriggers(tenantId: string, params?: { functionId?: string; type?: TriggerType }): Promise<ServerlessTrigger[]> {
    let result = Array.from(triggers.values()).filter((t) => t.tenantId === tenantId);
    if (params?.functionId) result = result.filter((t) => t.functionId === params.functionId);
    if (params?.type) result = result.filter((t) => t.type === params.type);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTrigger(id: string, tenantId: string): Promise<ServerlessTrigger | undefined> {
    const trigger = triggers.get(id);
    return trigger?.tenantId === tenantId ? trigger : undefined;
  }

  async deleteTrigger(id: string, tenantId: string): Promise<boolean> {
    const trigger = triggers.get(id);
    if (!trigger || trigger.tenantId !== tenantId) return false;

    // Unlink from function
    const fn = functions.get(trigger.functionId);
    if (fn) {
      fn.triggerIds = fn.triggerIds.filter((tid) => tid !== id);
      fn.updatedAt = new Date().toISOString();
    }

    triggers.delete(id);
    return true;
  }

  // ---- Logs ----

  async getFunctionLogs(functionId: string, tenantId: string, params?: {
    level?: string; limit?: number;
  }): Promise<ServerlessLog[]> {
    let result = Array.from(logs.values()).filter(
      (l) => l.functionId === functionId && l.tenantId === tenantId
    );
    if (params?.level) result = result.filter((l) => l.level === params.level);
    const limit = params?.limit || 100;
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  private addLog(
    tenantId: string, functionId: string, deploymentId: string,
    level: ServerlessLog['level'], message: string, metadata?: Record<string, unknown>,
  ): ServerlessLog {
    const log: ServerlessLog = {
      id: uuidv4(),
      tenantId,
      functionId,
      deploymentId,
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    logs.set(log.id, log);
    return log;
  }

  // ---- Metrics ----

  async recordMetric(functionId: string, tenantId: string, data: {
    invocations: number; errors: number; avgDuration: number;
    p95Duration: number; p99Duration: number; avgMemoryUsed: number;
    throttledRequests: number; activeConnections: number; cpuUtilization: number;
  }): Promise<ServerlessMetrics> {
    const key = `${functionId}-${Date.now()}`;
    const metric: ServerlessMetrics = {
      functionId,
      tenantId,
      period: new Date().toISOString(),
      invocations: data.invocations,
      errors: data.errors,
      avgDuration: data.avgDuration,
      p95Duration: data.p95Duration,
      p99Duration: data.p99Duration,
      avgMemoryUsed: data.avgMemoryUsed,
      throttledRequests: data.throttledRequests,
      activeConnections: data.activeConnections,
      cpuUtilization: data.cpuUtilization,
    };
    metrics.set(key, metric);
    return metric;
  }

  async getFunctionMetrics(functionId: string, tenantId: string): Promise<ServerlessMetrics[]> {
    return Array.from(metrics.values())
      .filter((m) => m.functionId === functionId && m.tenantId === tenantId)
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  async getAggregateMetrics(tenantId: string): Promise<{
    totalFunctions: number;
    deployedFunctions: number;
    totalInvocations: number;
    totalErrors: number;
    avgDuration: number;
    errorRate: number;
  }> {
    const tenantFunctions = Array.from(functions.values()).filter((f) => f.tenantId === tenantId);
    const tenantMetrics = Array.from(metrics.values()).filter((m) => m.tenantId === tenantId);

    const totalInvocations = tenantMetrics.reduce((sum, m) => sum + m.invocations, 0);
    const totalErrors = tenantMetrics.reduce((sum, m) => sum + m.errors, 0);
    const avgDuration = tenantMetrics.length > 0
      ? Math.round(tenantMetrics.reduce((sum, m) => sum + m.avgDuration, 0) / tenantMetrics.length)
      : 0;

    return {
      totalFunctions: tenantFunctions.length,
      deployedFunctions: tenantFunctions.filter((f) => f.status === 'deployed').length,
      totalInvocations,
      totalErrors,
      avgDuration,
      errorRate: totalInvocations > 0 ? Math.round((totalErrors / totalInvocations) * 10000) / 100 : 0,
    };
  }

  // ---- Auto-scaling ----

  async evaluateAutoScaling(tenantId: string): Promise<Array<{
    functionId: string;
    functionName: string;
    currentReplicas: number;
    suggestedReplicas: number;
    reason: string;
    action: 'scale_up' | 'scale_down' | 'no_change';
  }>> {
    const tenantFunctions = Array.from(functions.values())
      .filter((f) => f.tenantId === tenantId && f.status === 'deployed');

    const results: Array<{
      functionId: string; functionName: string; currentReplicas: number;
      suggestedReplicas: number; reason: string; action: 'scale_up' | 'scale_down' | 'no_change';
    }> = [];

    for (const fn of tenantFunctions) {
      const fnMetrics = Array.from(metrics.values())
        .filter((m) => m.functionId === fn.id && m.tenantId === tenantId);

      if (fnMetrics.length === 0) {
        results.push({
          functionId: fn.id, functionName: fn.name,
          currentReplicas: fn.replicas.current, suggestedReplicas: fn.replicas.min,
          reason: '无指标数据，建议缩容到最小值', action: 'scale_down',
        });
        continue;
      }

      const latest = fnMetrics[fnMetrics.length - 1];
      let suggested = fn.replicas.current;
      let reason = '';
      let action: 'scale_up' | 'scale_down' | 'no_change' = 'no_change';

      // Scale up if CPU utilization > 70%
      if (latest.cpuUtilization > 70) {
        suggested = Math.min(fn.replicas.max, fn.replicas.current + 1);
        reason = `CPU 使用率 ${latest.cpuUtilization.toFixed(1)}%，需要扩容`;
        action = suggested > fn.replicas.current ? 'scale_up' : 'no_change';
      }
      // Scale down if CPU utilization < 20% and replicas > min
      else if (latest.cpuUtilization < 20 && fn.replicas.current > fn.replicas.min) {
        suggested = Math.max(fn.replicas.min, fn.replicas.current - 1);
        reason = `CPU 使用率 ${latest.cpuUtilization.toFixed(1)}%，可以缩容`;
        action = 'scale_down';
      }

      results.push({
        functionId: fn.id, functionName: fn.name,
        currentReplicas: fn.replicas.current, suggestedReplicas: suggested,
        reason, action,
      });
    }

    return results;
  }
}
