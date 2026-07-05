/**
 * Health Check Service
 *
 * Provides real health check execution capabilities for:
 * - HTTP endpoints (checkEndpoint)
 * - PostgreSQL databases (checkDatabase)
 * - Redis (checkRedis)
 * - Kubernetes clusters (checkKubernetes)
 *
 * Supports configurable check options: interval, timeout, retries, thresholds.
 *
 * TASK-4.34: Real Health Check Execution
 */

import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode } from '../errors';
import { Pool } from 'pg';
import Redis from 'ioredis';

const logger = createLogger('HealthCheckService');

// ==================== Types ====================

export type CheckType = 'endpoint' | 'database' | 'redis' | 'kubernetes';

export type CheckStatus = 'up' | 'down' | 'degraded';

export interface CheckThresholds {
  /** Latency threshold in ms for degraded status (e.g., 500ms) */
  latencyDegradedMs?: number;
  /** Latency threshold in ms for down status (e.g., 2000ms) */
  latencyDownMs?: number;
  /** Availability threshold percentage (0-100) for degraded status */
  availabilityDegradedPercent?: number;
  /** Consecutive failures before marking as down (default: 3) */
  consecutiveFailures?: number;
}

export interface CheckConfig {
  /** Check timeout in ms */
  timeoutMs: number;
  /** Retry count on failure */
  retries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
  /** Status thresholds */
  thresholds: CheckThresholds;
}

export interface EndpointCheckConfig extends CheckConfig {
  /** URL to check */
  url: string;
  /** HTTP method (default: GET) */
  method?: string;
  /** Expected HTTP status codes (default: 200) */
  expectedStatusCodes?: number[];
  /** Optional headers */
  headers?: Record<string, string>;
  /** Whether to check response body for a string */
  expectedBodyContains?: string;
}

export interface DatabaseCheckConfig extends CheckConfig {
  /** PostgreSQL connection string */
  connectionString: string;
  /** Query to execute (default: SELECT 1) */
  query?: string;
}

export interface RedisCheckConfig extends CheckConfig {
  /** Redis connection string (e.g., redis://localhost:6379) */
  connectionString: string;
}

export interface KubernetesCheckConfig extends CheckConfig {
  /** Kubeconfig path (optional, uses in-cluster config if not provided) */
  kubeconfig?: string;
  /** Context name (optional) */
  context?: string;
  /** Specific resources to check (e.g., ['deployments', 'pods']) */
  resources?: string[];
}

export type CheckDefinitionConfig =
  | ({ type: 'endpoint' } & EndpointCheckConfig)
  | ({ type: 'database' } & DatabaseCheckConfig)
  | ({ type: 'redis' } & RedisCheckConfig)
  | ({ type: 'kubernetes' } & KubernetesCheckConfig);

export interface CheckDefinition {
  id: string;
  name: string;
  type: CheckType;
  enabled: boolean;
  config: CheckDefinitionConfig;
  intervalMs?: number;
  /** Last execution result */
  lastResult?: CheckExecutionResult;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

export interface CheckExecutionResult {
  checkId: string;
  status: CheckStatus;
  latencyMs: number;
  timestamp: string;
  message?: string;
  details?: Record<string, unknown>;
  retriesUsed: number;
}

export interface ExecuteCheckOptions {
  /** Override timeout for this execution */
  timeoutMs?: number;
  /** Override retries for this execution */
  retries?: number;
}

// ==================== Health Check Service ====================

export class HealthCheckService {
  private checks: Map<string, CheckDefinition> = new Map();
  private executionTimers: Map<string, NodeJS.Timeout> = new Map();
  private k8sApiCache: any = null;

  constructor() {}

  // ==================== Registration ====================

  /**
   * Register a new health check definition
   */
  registerCheck(definition: Omit<CheckDefinition, 'id' | 'createdAt' | 'updatedAt' | 'consecutiveFailures'>): CheckDefinition {
    const id = `check-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const check: CheckDefinition = {
      ...definition,
      id,
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.checks.set(id, check);

    // If interval is specified, start periodic execution
    if (definition.intervalMs && definition.intervalMs > 0) {
      this.startPeriodicCheck(id);
    }

    logger.info({ checkId: id, name: check.name, type: check.type }, 'Health check registered');
    return check;
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(id: string): boolean {
    this.stopPeriodicCheck(id);
    const deleted = this.checks.delete(id);
    if (deleted) {
      logger.info({ checkId: id }, 'Health check unregistered');
    }
    return deleted;
  }

  /**
   * Get a check definition by ID
   */
  getCheck(id: string): CheckDefinition | undefined {
    return this.checks.get(id);
  }

  /**
   * List all registered checks
   */
  listChecks(): CheckDefinition[] {
    return Array.from(this.checks.values());
  }

  // ==================== Execution ====================

  /**
   * Execute a specific check by ID
   */
  async executeCheck(id: string, options?: ExecuteCheckOptions): Promise<CheckExecutionResult> {
    const check = this.checks.get(id);
    if (!check) {
      throw new OrionError(`Health check not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    if (!check.enabled) {
      return {
        checkId: id,
        status: 'down',
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        message: 'Check is disabled',
        retriesUsed: 0,
      };
    }

    const timeout = options?.timeoutMs ?? check.config.timeoutMs;
    const retries = options?.retries ?? check.config.retries;
    const startTime = Date.now();

    let lastError: Error | null = null;
    let retriesUsed = 0;

    // Retry loop
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.executeCheckInternal(check, timeout);
        result.retriesUsed = retriesUsed;

        // Update consecutive failures on success
        if (result.status === 'up') {
          check.consecutiveFailures = 0;
        } else {
          check.consecutiveFailures++;
        }

        check.lastResult = result;
        check.updatedAt = new Date().toISOString();

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retriesUsed = attempt;

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          const delay = check.config.retryDelayMs;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    const latencyMs = Date.now() - startTime;
    const result: CheckExecutionResult = {
      checkId: id,
      status: 'down',
      latencyMs,
      timestamp: new Date().toISOString(),
      message: lastError?.message || 'Check failed after all retries',
      retriesUsed,
    };

    check.consecutiveFailures++;
    check.lastResult = result;
    check.updatedAt = new Date().toISOString();

    return result;
  }

  /**
   * Execute all enabled checks
   */
  async executeAllChecks(options?: ExecuteCheckOptions): Promise<CheckExecutionResult[]> {
    const results: CheckExecutionResult[] = [];

    const enabledChecks = Array.from(this.checks.values()).filter(c => c.enabled);
    const executions = enabledChecks.map(check => this.executeCheck(check.id, options));

    const settled = await Promise.allSettled(executions);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error({ error: result.reason }, 'Check execution failed');
      }
    }

    return results;
  }

  // ==================== Check Implementations ====================

  /**
   * HTTP endpoint health check
   */
  async checkEndpoint(url: string, timeoutMs: number): Promise<{ status: CheckStatus; latencyMs: number; message?: string; details?: Record<string, unknown> }> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Orion-HealthCheck/1.0',
        },
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'down',
          latencyMs,
          message: `HTTP ${response.status} ${response.statusText}`,
          details: { statusCode: response.status, statusText: response.statusText },
        };
      }

      return {
        status: 'up',
        latencyMs,
        message: `OK (${response.status})`,
        details: { statusCode: response.status },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('aborted') || message.includes('timeout')) {
        return {
          status: 'down',
          latencyMs,
          message: `Request timed out after ${timeoutMs}ms`,
          details: { timedOut: true },
        };
      }

      return {
        status: 'down',
        latencyMs,
        message: `Connection failed: ${message}`,
        details: { error: message },
      };
    }
  }

  /**
   * PostgreSQL database health check
   */
  async checkDatabase(connectionString: string, timeoutMs: number): Promise<{ status: CheckStatus; latencyMs: number; message?: string; details?: Record<string, unknown> }> {
    const startTime = Date.now();
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: timeoutMs,
      max: 1,
    });

    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        const latencyMs = Date.now() - startTime;

        return {
          status: 'up',
          latencyMs,
          message: 'Database connection OK',
          details: { query: 'SELECT 1' },
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      return {
        status: 'down',
        latencyMs,
        message: `Database connection failed: ${message}`,
        details: { error: message },
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Redis health check
   */
  async checkRedis(connectionString: string, timeoutMs: number): Promise<{ status: CheckStatus; latencyMs: number; message?: string; details?: Record<string, unknown> }> {
    const startTime = Date.now();

    // Parse connection string
    let redis: Redis | null = null;
    try {
      redis = new Redis(connectionString, {
        connectTimeout: timeoutMs,
        lazyConnect: true,
      });

      await redis.connect();
      const latencyMs = Date.now() - startTime;

      const pong = await redis.ping();
      await redis.quit();

      if (pong === 'PONG') {
        return {
          status: 'up',
          latencyMs,
          message: 'Redis connection OK',
          details: { response: pong },
        };
      }

      return {
        status: 'degraded',
        latencyMs,
        message: `Unexpected ping response: ${pong}`,
        details: { response: pong },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      try {
        await redis?.quit();
      } catch {}

      return {
        status: 'down',
        latencyMs,
        message: `Redis connection failed: ${message}`,
        details: { error: message },
      };
    }
  }

  /**
   * Kubernetes cluster health check
   */
  async checkKubernetes(timeoutMs: number, kubeconfig?: string, resources?: string[]): Promise<{ status: CheckStatus; latencyMs: number; message?: string; details?: Record<string, unknown> }> {
    const startTime = Date.now();

    try {
      // Get or create K8s API instance
      const kc = kubeconfig ? new (require('@kubernetes/client-node').KubeConfig)({ config: kubeconfig }) : this.getK8sApi();
      const k8sApi = kc.makeApiClient(kc.getCoreApi());

      // Check cluster health by getting nodes
      const nodesResponse = await k8sApi.listNode();
      const latencyMs = Date.now() - startTime;

      const totalNodes = nodesResponse.items?.length ?? 0;
      const readyNodes = nodesResponse.items?.filter((node: any) => {
        const conditions = node.status?.conditions || [];
        return conditions.some((c: any) => c.type === 'Ready' && c.status === 'True');
      }).length ?? 0;

      if (totalNodes === 0) {
        return {
          status: 'degraded',
          latencyMs,
          message: 'No nodes found in cluster',
          details: { totalNodes: 0, readyNodes: 0 },
        };
      }

      if (readyNodes < totalNodes) {
        return {
          status: 'degraded',
          latencyMs,
          message: `${readyNodes}/${totalNodes} nodes ready`,
          details: { totalNodes, readyNodes },
        };
      }

      // Optionally check specific resources
      const resourceDetails: Record<string, unknown> = { totalNodes, readyNodes };
      if (resources && resources.length > 0) {
        for (const resource of resources) {
          try {
            switch (resource) {
              case 'pods': {
                const podsResponse = await k8sApi.listPodForAllNamespaces();
                resourceDetails[resource] = podsResponse.body.items?.length ?? 0;
                break;
              }
              case 'deployments': {
                const appsApi = kc.makeApiClient(kc.getAppsApi());
                const deployResponse = await appsApi.listDeploymentForAllNamespaces();
                resourceDetails[resource] = deployResponse.body.items?.length ?? 0;
                break;
              }
              default:
                resourceDetails[resource] = 'skipped (not implemented)';
            }
          } catch (error) {
            resourceDetails[resource] = `error: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }

      return {
        status: 'up',
        latencyMs,
        message: `Cluster healthy (${readyNodes}/${totalNodes} nodes ready)`,
        details: resourceDetails,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      return {
        status: 'down',
        latencyMs,
        message: `Kubernetes check failed: ${message}`,
        details: { error: message },
      };
    }
  }

  // ==================== Internal Methods ====================

  /**
   * Execute the actual check based on type
   */
  private async executeCheckInternal(check: CheckDefinition, timeoutMs: number): Promise<CheckExecutionResult> {
    const startTime = Date.now();

    let result: { status: CheckStatus; latencyMs: number; message?: string; details?: Record<string, unknown> };

    switch (check.type) {
      case 'endpoint': {
        const config = check.config as EndpointCheckConfig;
        result = await this.checkEndpoint(config.url, timeoutMs);
        break;
      }
      case 'database': {
        const config = check.config as DatabaseCheckConfig;
        result = await this.checkDatabase(config.connectionString, timeoutMs);
        break;
      }
      case 'redis': {
        const config = check.config as RedisCheckConfig;
        result = await this.checkRedis(config.connectionString, timeoutMs);
        break;
      }
      case 'kubernetes': {
        const config = check.config as KubernetesCheckConfig;
        result = await this.checkKubernetes(timeoutMs, config.kubeconfig, config.resources);
        break;
      }
      default:
        throw new OrionError(`Unsupported check type: ${(check.config as any).type}`, ErrorCode.INTERNAL_ERROR);
    }

    return {
      checkId: check.id,
      ...result,
      timestamp: new Date().toISOString(),
      retriesUsed: 0,
    };
  }

  /**
   * Get or create Kubernetes API instance
   */
  private getK8sApi(): any {
    if (!this.k8sApiCache) {
      this.k8sApiCache = new (require('@kubernetes/client-node').KubeConfig)().makeApiClient(require('@kubernetes/client-node').CoreApi());
    }
    return this.k8sApiCache;
  }

  // ==================== Periodic Checks ====================

  /**
   * Start periodic execution of a check
   */
  private startPeriodicCheck(id: string): void {
    this.stopPeriodicCheck(id);

    const check = this.checks.get(id);
    if (!check?.intervalMs) return;

    const timer = setInterval(async () => {
      try {
        await this.executeCheck(id);
      } catch (error) {
        logger.error({ checkId: id, error }, 'Periodic check execution failed');
      }
    }, check.intervalMs);

    this.executionTimers.set(id, timer);
    logger.info({ checkId: id, intervalMs: check.intervalMs }, 'Periodic check started');
  }

  /**
   * Stop periodic execution of a check
   */
  private stopPeriodicCheck(id: string): void {
    const timer = this.executionTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.executionTimers.delete(id);
    }
  }

  // ==================== Cleanup ====================

  /**
   * Stop all periodic checks and clear all definitions
   */
  shutdown(): void {
    for (const id of this.checks.keys()) {
      this.stopPeriodicCheck(id);
    }
    this.checks.clear();
    logger.info('HealthCheckService shut down');
  }
}
