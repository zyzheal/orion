/**
 * Serverless Service (Phase 4 P0 - Serverless Module)
 * Function lifecycle management, event-driven triggers, auto-scaling, log aggregation, metrics collection
 *
 * Uses PostgreSQL Repository with graceful degradation to in-memory Map.
 */

import { v4 as uuidv4 } from 'uuid';
import { OrionError, ErrorCode } from '../../errors';
import {
  ServerlessFunctionRepository,
  ServerlessTriggerRepository,
  ServerlessDeploymentRepository,
  ServerlessLogRepository,
  ServerlessMetricRepository,
  type ServerlessFunctionEntity,
  type ServerlessTriggerEntity,
  type ServerlessDeploymentEntity,
  type ServerlessLogEntity,
  type ServerlessMetricEntity,
} from '../../repositories/ServerlessRepository';

// ============================================================================
// Data Models (API types — preserved for backward compatibility)
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
  replicas: { min: number; max: number; current: number };
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
    method?: string; path?: string; schedule?: string;
    eventSource?: string; pattern?: string;
    maxBatchSize?: number; retryPolicy?: { maxRetries: number; backoffMs: number };
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

// ============================================================================
// Entity-to-API converters
// ============================================================================

function entityToFunction(e: ServerlessFunctionEntity): ServerlessFunction {
  return {
    id: e.id, tenantId: e.tenantId, name: e.name, description: e.description,
    runtime: e.runtime as FunctionRuntime, handler: e.handler,
    memory: e.memory, timeout: e.timeout, status: e.status as FunctionStatus,
    version: e.version, environment: e.environment, code: e.code,
    triggerIds: e.triggerIds, endpoint: e.endpoint,
    replicas: { min: e.replicasMin, max: e.replicasMax, current: e.replicasCurrent },
    lastDeployedAt: e.lastDeployedAt?.toISOString(),
    createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
  };
}

function entityToTrigger(e: ServerlessTriggerEntity): ServerlessTrigger {
  return {
    id: e.id, tenantId: e.tenantId, functionId: e.functionId,
    type: e.type as TriggerType, name: e.name,
    config: e.config as ServerlessTrigger['config'],
    enabled: e.enabled, invocationCount: e.invocationCount,
    lastInvokedAt: e.lastInvokedAt?.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

function entityToDeployment(e: ServerlessDeploymentEntity): ServerlessDeployment {
  return {
    id: e.id, tenantId: e.tenantId, functionId: e.functionId,
    version: e.version, status: e.status as ServerlessDeployment['status'],
    codeVersion: e.codeVersion, deployedBy: e.deployedBy,
    startedAt: e.startedAt.toISOString(),
    completedAt: e.completedAt?.toISOString(),
    error: e.error, rollbackTo: e.rollbackTo,
  };
}

function entityToLog(e: ServerlessLogEntity): ServerlessLog {
  return {
    id: e.id, tenantId: e.tenantId, functionId: e.functionId,
    deploymentId: e.deploymentId, level: e.level as ServerlessLog['level'],
    message: e.message, timestamp: e.timestamp.toISOString(),
    requestId: e.requestId, metadata: e.metadata,
  };
}

function entityToMetric(e: ServerlessMetricEntity): ServerlessMetrics {
  return {
    functionId: e.functionId, tenantId: e.tenantId,
    period: e.period.toISOString(), invocations: e.invocations,
    errors: e.errors, avgDuration: e.avgDuration,
    p95Duration: e.p95Duration, p99Duration: e.p99Duration,
    avgMemoryUsed: e.avgMemoryUsed, throttledRequests: e.throttledRequests,
    activeConnections: e.activeConnections, cpuUtilization: e.cpuUtilization,
  };
}

// ============================================================================
// In-memory fallback storage
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
  private fnRepo?: ServerlessFunctionRepository;
  private triggerRepo?: ServerlessTriggerRepository;
  private deploymentRepo?: ServerlessDeploymentRepository;
  private logRepo?: ServerlessLogRepository;
  private metricRepo?: ServerlessMetricRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.fnRepo = new ServerlessFunctionRepository(db);
      this.triggerRepo = new ServerlessTriggerRepository(db);
      this.deploymentRepo = new ServerlessDeploymentRepository(db);
      this.logRepo = new ServerlessLogRepository(db);
      this.metricRepo = new ServerlessMetricRepository(db);
    }
  }

  // ---- Function CRUD ----

  async createFunction(input: {
    name: string; description?: string; runtime: FunctionRuntime;
    handler: string; memory?: number; timeout?: number;
    environment?: Record<string, string>; code: string;
    replicas?: { min?: number; max?: number };
  }, tenantId: string): Promise<ServerlessFunction> {
    if (this.fnRepo) {
      const now = new Date();
      const saved = await this.fnRepo.create({
        id: uuidv4(), tenantId, name: input.name,
        description: input.description || '', runtime: input.runtime,
        handler: input.handler, memory: input.memory || 256,
        timeout: input.timeout || 30, status: 'draft', version: 1,
        environment: input.environment || {}, code: input.code,
        triggerIds: [], replicasMin: input.replicas?.min ?? 0,
        replicasMax: input.replicas?.max ?? 10, replicasCurrent: 0,
        createdAt: now, updatedAt: now,
      });
      return entityToFunction(saved);
    }

    const fn: ServerlessFunction = {
      id: uuidv4(), tenantId, name: input.name,
      description: input.description || '', runtime: input.runtime,
      handler: input.handler, memory: input.memory || 256,
      timeout: input.timeout || 30, status: 'draft', version: 1,
      environment: input.environment || {}, code: input.code,
      triggerIds: [], replicas: {
        min: input.replicas?.min ?? 0, max: input.replicas?.max ?? 10, current: 0,
      },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    functions.set(fn.id, fn);
    return fn;
  }

  async getFunction(id: string, tenantId: string): Promise<ServerlessFunction | undefined> {
    if (this.fnRepo) {
      const entity = await this.fnRepo.findById(id);
      return entity && entity.tenantId === tenantId ? entityToFunction(entity) : undefined;
    }
    const fn = functions.get(id);
    return fn?.tenantId === tenantId ? fn : undefined;
  }

  async listFunctions(tenantId: string, params?: { status?: FunctionStatus; runtime?: FunctionRuntime }): Promise<ServerlessFunction[]> {
    if (this.fnRepo) {
      const entities = await this.fnRepo.findByTenant(tenantId, params);
      return entities.map(entityToFunction);
    }
    let result = Array.from(functions.values()).filter((f) => f.tenantId === tenantId);
    if (params?.status) result = result.filter((f) => f.status === params.status);
    if (params?.runtime) result = result.filter((f) => f.runtime === params.runtime);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateFunction(id: string, tenantId: string, input: {
    name?: string; description?: string; runtime?: FunctionRuntime;
    handler?: string; memory?: number; timeout?: number;
    environment?: Record<string, string>; code?: string;
    replicas?: { min?: number; max?: number };
  }): Promise<ServerlessFunction | undefined> {
    if (this.fnRepo) {
      const current = await this.fnRepo.findById(id);
      if (!current || current.tenantId !== tenantId) return undefined;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.runtime !== undefined) updateData.runtime = input.runtime;
      if (input.handler !== undefined) updateData.handler = input.handler;
      if (input.memory !== undefined) updateData.memory = input.memory;
      if (input.timeout !== undefined) updateData.timeout = input.timeout;
      if (input.environment !== undefined) updateData.environment = input.environment;
      if (input.code !== undefined) updateData.code = input.code;
      if (input.replicas) {
        if (input.replicas.min !== undefined) updateData.replicasMin = input.replicas.min;
        if (input.replicas.max !== undefined) updateData.replicasMax = input.replicas.max;
      }

      const saved = await this.fnRepo.update(id, updateData);
      if (!saved) {
        throw new OrionError(`Function not found: ${id}`, ErrorCode.NOT_FOUND);
      }
      return entityToFunction(saved);
    }

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
    if (this.fnRepo && this.triggerRepo && this.deploymentRepo && this.logRepo) {
      const fn = await this.fnRepo.findById(id);
      if (!fn || fn.tenantId !== tenantId) return false;
      // Delete associated data
      await this.triggerRepo.deleteByFunctionId(id);
      await this.deploymentRepo.deleteByFunctionId(id, tenantId);
      await this.logRepo.deleteByFunctionId(id, tenantId);
      return await this.fnRepo.delete(id);
    }

    const fn = functions.get(id);
    if (!fn || fn.tenantId !== tenantId) return false;
    for (const triggerId of fn.triggerIds) triggers.delete(triggerId);
    for (const [, dep] of deployments.entries()) {
      if (dep.functionId === id && dep.tenantId === tenantId) deployments.delete(dep.id);
    }
    for (const [, log] of logs.entries()) {
      if (log.functionId === id && log.tenantId === tenantId) logs.delete(log.id);
    }
    functions.delete(id);
    return true;
  }

  // ---- Deployment ----

  async deployFunction(functionId: string, tenantId: string): Promise<ServerlessDeployment> {
    if (this.fnRepo && this.deploymentRepo && this.logRepo) {
      const fn = await this.fnRepo.findById(functionId);
      if (!fn || fn.tenantId !== tenantId) {
        throw new OrionError('FUNCTION_NOT_FOUND', ErrorCode.OPERATION_FAILED);
      }

      const now = new Date();
      const deployment = await this.deploymentRepo.create({
        id: uuidv4(), tenantId, functionId, version: fn.version,
        status: 'deploying', codeVersion: uuidv4().slice(0, 8),
        deployedBy: 'system', startedAt: now,
      });

      // Simulate deployment
      try {
        const newVersion = fn.version + 1;
        const endpoint = `https://${fn.name}.${tenantId}.serverless.orion.dev`;
        const replicasCurrent = Math.max(fn.replicasMin, 1);

        await this.fnRepo.updateStatus(functionId, 'deployed', {
          version: newVersion, endpoint, replicasCurrent, lastDeployedAt: now,
        });

        await this.deploymentRepo.updateStatus(deployment.id, 'success', {
          completedAt: new Date(),
        });

        await this.logRepo.create({
          id: uuidv4(), tenantId, functionId, deploymentId: deployment.id,
          level: 'info', message: `Function ${fn.name} deployed successfully, v${newVersion}`,
          metadata: { endpoint, replicas: replicasCurrent }, timestamp: new Date(),
        });

        // Re-fetch deployment for final state
        const finalDep = await this.deploymentRepo.findById(deployment.id);
        return entityToDeployment(finalDep!);
      } catch (err) {
        await this.deploymentRepo.updateStatus(deployment.id, 'failed', {
          completedAt: new Date(), error: err instanceof Error ? err.message : 'Unknown error',
        });
        await this.fnRepo.updateStatus(functionId, 'error');
        const finalDep = await this.deploymentRepo.findById(deployment.id);
        return entityToDeployment(finalDep!);
      }
    }

    // In-memory fallback
    const fn = functions.get(functionId);
    if (!fn || fn.tenantId !== tenantId) {
      throw new OrionError('FUNCTION_NOT_FOUND', ErrorCode.OPERATION_FAILED);
    }

    const deployment: ServerlessDeployment = {
      id: uuidv4(), tenantId, functionId, version: fn.version,
      status: 'deploying', codeVersion: uuidv4().slice(0, 8),
      deployedBy: 'system', startedAt: new Date().toISOString(),
    };
    deployments.set(deployment.id, deployment);

    try {
      fn.status = 'deployed';
      fn.version += 1;
      fn.lastDeployedAt = new Date().toISOString();
      fn.updatedAt = new Date().toISOString();
      fn.endpoint = `https://${fn.name}.${tenantId}.serverless.orion.dev`;
      fn.replicas.current = Math.max(fn.replicas.min, 1);

      deployment.status = 'success';
      deployment.completedAt = new Date().toISOString();

      this.addLog(tenantId, functionId, deployment.id, 'info', `Function ${fn.name} deployed successfully, v${fn.version}`, {
        endpoint: fn.endpoint, replicas: fn.replicas.current,
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
    if (this.deploymentRepo) {
      const entities = await this.deploymentRepo.findByFunction(functionId, tenantId);
      return entities.map(entityToDeployment);
    }
    return Array.from(deployments.values())
      .filter((d) => d.functionId === functionId && d.tenantId === tenantId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  // ---- Invocation ----

  async invokeFunction(functionId: string, tenantId: string, payload?: Record<string, unknown>): Promise<{
    requestId: string; status: number; result: unknown; duration: number;
  }> {
    if (this.fnRepo) {
      const fn = await this.fnRepo.findById(functionId);
      if (!fn || fn.tenantId !== tenantId) {
        throw new OrionError('FUNCTION_NOT_FOUND', ErrorCode.OPERATION_FAILED);
      }
      if (fn.status !== 'deployed') {
        throw new OrionError('FUNCTION_NOT_DEPLOYED', ErrorCode.OPERATION_FAILED);
      }

      const requestId = uuidv4();
      const simulatedDuration = 50 + Math.random() * 200;

      await this.recordMetric(functionId, tenantId, {
        invocations: 1, errors: 0, avgDuration: simulatedDuration,
        p95Duration: simulatedDuration * 1.5, p99Duration: simulatedDuration * 2,
        avgMemoryUsed: fn.memory * 0.6, throttledRequests: 0,
        activeConnections: fn.replicasCurrent, cpuUtilization: 30 + Math.random() * 40,
      });

      if (this.logRepo) {
        await this.logRepo.create({
          id: uuidv4(), tenantId, functionId, deploymentId: '',
          level: 'info', message: `Function invoked: ${fn.name}`,
          requestId, metadata: { payload }, timestamp: new Date(),
        });
      }

      return {
        requestId, status: 200,
        result: { message: `Function ${fn.name} executed successfully`, input: payload },
        duration: Math.round(simulatedDuration),
      };
    }

    // In-memory fallback
    const fn = functions.get(functionId);
    if (!fn || fn.tenantId !== tenantId) {
      throw new OrionError('FUNCTION_NOT_FOUND', ErrorCode.OPERATION_FAILED);
    }
    if (fn.status !== 'deployed') {
      throw new OrionError('FUNCTION_NOT_DEPLOYED', ErrorCode.OPERATION_FAILED);
    }

    const requestId = uuidv4();
    const simulatedDuration = 50 + Math.random() * 200;

    await this.recordMetric(functionId, tenantId, {
      invocations: 1, errors: 0, avgDuration: simulatedDuration,
      p95Duration: simulatedDuration * 1.5, p99Duration: simulatedDuration * 2,
      avgMemoryUsed: fn.memory * 0.6, throttledRequests: 0,
      activeConnections: fn.replicas.current, cpuUtilization: 30 + Math.random() * 40,
    });

    this.addLog(tenantId, functionId, '', 'info', `Function invoked: ${fn.name}`, { requestId, payload });

    return {
      requestId, status: 200,
      result: { message: `Function ${fn.name} executed successfully`, input: payload },
      duration: Math.round(simulatedDuration),
    };
  }

  // ---- Triggers ----

  async createTrigger(input: {
    functionId: string; type: TriggerType; name: string;
    config: ServerlessTrigger['config'];
  }, tenantId: string): Promise<ServerlessTrigger> {
    if (this.fnRepo && this.triggerRepo) {
      const fn = await this.fnRepo.findById(input.functionId);
      if (!fn || fn.tenantId !== tenantId) {
        throw new OrionError('FUNCTION_NOT_FOUND', ErrorCode.OPERATION_FAILED);
      }

      const trigger = await this.triggerRepo.create({
        id: uuidv4(), tenantId, functionId: input.functionId,
        type: input.type, name: input.name, config: input.config as Record<string, unknown>,
        enabled: true, invocationCount: 0, createdAt: new Date(),
      });

      // Link trigger to function
      await this.fnRepo.addTriggerId(input.functionId, trigger.id);

      return entityToTrigger(trigger);
    }

    // In-memory fallback
    const fn = functions.get(input.functionId);
    if (!fn || fn.tenantId !== tenantId) {
      throw new OrionError('FUNCTION_NOT_FOUND', ErrorCode.OPERATION_FAILED);
    }

    const trigger: ServerlessTrigger = {
      id: uuidv4(), tenantId, functionId: input.functionId,
      type: input.type, name: input.name, config: input.config,
      enabled: true, invocationCount: 0, createdAt: new Date().toISOString(),
    };
    triggers.set(trigger.id, trigger);
    fn.triggerIds.push(trigger.id);
    fn.updatedAt = new Date().toISOString();
    return trigger;
  }

  async listTriggers(tenantId: string, params?: { functionId?: string; type?: TriggerType }): Promise<ServerlessTrigger[]> {
    if (this.triggerRepo) {
      const entities = await this.triggerRepo.findByTenant(tenantId, params);
      return entities.map(entityToTrigger);
    }
    let result = Array.from(triggers.values()).filter((t) => t.tenantId === tenantId);
    if (params?.functionId) result = result.filter((t) => t.functionId === params.functionId);
    if (params?.type) result = result.filter((t) => t.type === params.type);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTrigger(id: string, tenantId: string): Promise<ServerlessTrigger | undefined> {
    if (this.triggerRepo) {
      const entity = await this.triggerRepo.findById(id);
      return entity && entity.tenantId === tenantId ? entityToTrigger(entity) : undefined;
    }
    const trigger = triggers.get(id);
    return trigger?.tenantId === tenantId ? trigger : undefined;
  }

  async deleteTrigger(id: string, tenantId: string): Promise<boolean> {
    if (this.triggerRepo && this.fnRepo) {
      const trigger = await this.triggerRepo.findById(id);
      if (!trigger || trigger.tenantId !== tenantId) return false;
      await this.fnRepo.removeTriggerId(trigger.functionId, id);
      return await this.triggerRepo.delete(id);
    }

    const trigger = triggers.get(id);
    if (!trigger || trigger.tenantId !== tenantId) return false;
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
    if (this.logRepo) {
      const entities = await this.logRepo.findByFunction(functionId, tenantId, params);
      return entities.map(entityToLog);
    }
    let result = Array.from(logs.values()).filter(
      (l) => l.functionId === functionId && l.tenantId === tenantId,
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
      id: uuidv4(), tenantId, functionId, deploymentId, level, message,
      timestamp: new Date().toISOString(), metadata,
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
    if (this.metricRepo) {
      const saved = await this.metricRepo.create({
        id: uuidv4(), functionId, tenantId, period: new Date(),
        invocations: data.invocations, errors: data.errors,
        avgDuration: data.avgDuration, p95Duration: data.p95Duration,
        p99Duration: data.p99Duration, avgMemoryUsed: data.avgMemoryUsed,
        throttledRequests: data.throttledRequests,
        activeConnections: data.activeConnections,
        cpuUtilization: data.cpuUtilization,
      });
      return entityToMetric(saved);
    }

    const key = `${functionId}-${Date.now()}`;
    const metric: ServerlessMetrics = {
      functionId, tenantId, period: new Date().toISOString(),
      invocations: data.invocations, errors: data.errors,
      avgDuration: data.avgDuration, p95Duration: data.p95Duration,
      p99Duration: data.p99Duration, avgMemoryUsed: data.avgMemoryUsed,
      throttledRequests: data.throttledRequests,
      activeConnections: data.activeConnections, cpuUtilization: data.cpuUtilization,
    };
    metrics.set(key, metric);
    return metric;
  }

  async getFunctionMetrics(functionId: string, tenantId: string): Promise<ServerlessMetrics[]> {
    if (this.metricRepo) {
      const entities = await this.metricRepo.findByFunction(functionId, tenantId);
      return entities.map(entityToMetric);
    }
    return Array.from(metrics.values())
      .filter((m) => m.functionId === functionId && m.tenantId === tenantId)
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  async getAggregateMetrics(tenantId: string): Promise<{
    totalFunctions: number; deployedFunctions: number;
    totalInvocations: number; totalErrors: number;
    avgDuration: number; errorRate: number;
  }> {
    if (this.fnRepo && this.metricRepo) {
      const tenantFunctions = await this.fnRepo.findByTenant(tenantId);
      const tenantMetrics = await this.metricRepo.findByTenant(tenantId);

      const totalInvocations = tenantMetrics.reduce((sum, m) => sum + m.invocations, 0);
      const totalErrors = tenantMetrics.reduce((sum, m) => sum + m.errors, 0);
      const avgDuration = tenantMetrics.length > 0
        ? Math.round(tenantMetrics.reduce((sum, m) => sum + m.avgDuration, 0) / tenantMetrics.length)
        : 0;

      return {
        totalFunctions: tenantFunctions.length,
        deployedFunctions: tenantFunctions.filter(f => f.status === 'deployed').length,
        totalInvocations, totalErrors, avgDuration,
        errorRate: totalInvocations > 0 ? Math.round((totalErrors / totalInvocations) * 10000) / 100 : 0,
      };
    }

    // In-memory fallback
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
      totalInvocations, totalErrors, avgDuration,
      errorRate: totalInvocations > 0 ? Math.round((totalErrors / totalInvocations) * 10000) / 100 : 0,
    };
  }

  // ---- Auto-scaling ----

  async evaluateAutoScaling(tenantId: string): Promise<Array<{
    functionId: string; functionName: string; currentReplicas: number;
    suggestedReplicas: number; reason: string;
    action: 'scale_up' | 'scale_down' | 'no_change';
  }>> {
    if (this.fnRepo && this.metricRepo) {
      const tenantFunctions = await this.fnRepo.findDeployedByTenant(tenantId);

      const results: Array<{
        functionId: string; functionName: string; currentReplicas: number;
        suggestedReplicas: number; reason: string;
        action: 'scale_up' | 'scale_down' | 'no_change';
      }> = [];

      for (const fn of tenantFunctions) {
        const fnMetrics = await this.metricRepo.findByFunction(fn.id, tenantId);

        if (fnMetrics.length === 0) {
          results.push({
            functionId: fn.id, functionName: fn.name,
            currentReplicas: fn.replicasCurrent, suggestedReplicas: fn.replicasMin,
            reason: '无指标数据，建议缩容到最小值', action: 'scale_down',
          });
          continue;
        }

        const latest = fnMetrics[0]; // Already sorted DESC
        let suggested = fn.replicasCurrent;
        let reason = '';
        let action: 'scale_up' | 'scale_down' | 'no_change' = 'no_change';

        if (latest.cpuUtilization > 70) {
          suggested = Math.min(fn.replicasMax, fn.replicasCurrent + 1);
          reason = `CPU 使用率 ${latest.cpuUtilization.toFixed(1)}%，需要扩容`;
          action = suggested > fn.replicasCurrent ? 'scale_up' : 'no_change';
        } else if (latest.cpuUtilization < 20 && fn.replicasCurrent > fn.replicasMin) {
          suggested = Math.max(fn.replicasMin, fn.replicasCurrent - 1);
          reason = `CPU 使用率 ${latest.cpuUtilization.toFixed(1)}%，可以缩容`;
          action = 'scale_down';
        }

        results.push({
          functionId: fn.id, functionName: fn.name,
          currentReplicas: fn.replicasCurrent, suggestedReplicas: suggested,
          reason, action,
        });
      }

      return results;
    }

    // In-memory fallback
    const tenantFunctions = Array.from(functions.values())
      .filter((f) => f.tenantId === tenantId && f.status === 'deployed');

    const results: Array<{
      functionId: string; functionName: string; currentReplicas: number;
      suggestedReplicas: number; reason: string;
      action: 'scale_up' | 'scale_down' | 'no_change';
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

      if (latest.cpuUtilization > 70) {
        suggested = Math.min(fn.replicas.max, fn.replicas.current + 1);
        reason = `CPU 使用率 ${latest.cpuUtilization.toFixed(1)}%，需要扩容`;
        action = suggested > fn.replicas.current ? 'scale_up' : 'no_change';
      } else if (latest.cpuUtilization < 20 && fn.replicas.current > fn.replicas.min) {
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
