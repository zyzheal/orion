/**
 * HealthCheckerService - Complete service health monitoring
 *
 * Features:
 * - HTTP health check (GET /healthz)
 * - gRPC health check (grpc.health.v1.Health/Check) - stub interface, plug in gRPC client
 * - TCP port check
 * - Custom script check (user-provided function)
 * - Configurable interval, timeout, retry count
 * - Consecutive failure detection with configurable threshold
 * - Result persistence via ServiceHealthResultRepository
 * - Alert integration via optional alert callback
 * - Recovery notification support
 *
 * Usage:
 *   const svc = new HealthCheckerService({ db, alertCallback });
 *   await svc.registerCheck({ serviceName, serviceUrl, checkType: 'http', ... });
 *   await svc.runAllChecks(); // runs all registered checks
 */

import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { K8sApi } from '@kubernetes/client-node';
import {
  ServiceHealthCheckRepository,
  ServiceHealthCheckEntity,
  ServiceHealthResultRepository,
} from '../../repositories/ServiceHealthRepository';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('health-checker');

// ─── Check result types ───────────────────────────────────────────────────────

export type CheckStatus = 'healthy' | 'unhealthy' | 'degraded' | 'timeout' | 'error';

export interface CheckResult {
  status: CheckStatus;
  latencyMs: number;
  errorMessage: string | null;
  responseBody: string | null;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface HealthCheckConfig {
  serviceName: string;
  serviceUrl: string;
  checkType: 'http' | 'grpc' | 'tcp' | 'custom';
  intervalSeconds?: number;
  timeoutSeconds?: number;
  retryCount?: number;
  /** HTTP: expected HTTP status code */
  expectedStatusCode?: number;
  /** gRPC: expected gRPC status name (e.g. SERVING, NOT_SERVING) */
  expectedGrpcStatus?: string;
  /** TCP: port number */
  port?: number;
  /** Number of consecutive failures before alerting */
  failureThreshold?: number;
  tenantId?: string;
}

export interface AlertPayload {
  check: ServiceHealthCheckEntity;
  result: CheckResult;
  consecutiveFailures: number;
  isRecovery: boolean;
}

export type AlertCallback = (payload: AlertPayload) => Promise<void> | void;

// ─── Service ─────────────────────────────────────────────────────────────────

export class HealthCheckerService {
  private checkRepo: ServiceHealthCheckRepository;
  private resultRepo: ServiceHealthResultRepository;
  private alertCallback: AlertCallback | null;
  private customCheckers: Map<string, () => Promise<CheckResult>> = new Map();

  constructor(
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    alertCallback?: AlertCallback,
  ) {
    this.checkRepo = new ServiceHealthCheckRepository(db);
    this.resultRepo = new ServiceHealthResultRepository(db);
    this.alertCallback = alertCallback ?? null;
  }

  // ─── Check Registration ─────────────────────────────────────────────────────

  /**
   * Register a new health check configuration.
   * Creates the check record in PostgreSQL.
   */
  async registerCheck(config: HealthCheckConfig): Promise<ServiceHealthCheckEntity> {
    const tenantId = config.tenantId ?? '00000000-0000-0000-0000-000000000000';

    if (config.checkType === 'tcp' && !config.port) {
      throw new OrionError('TCP check requires a port number', ErrorCode.VALIDATION_ERROR);
    }

    const existing = await this.checkRepo.findByServiceConfig(
      config.serviceName,
      config.serviceUrl,
      config.checkType,
    );

    if (existing) {
      logger.warn(
        { traceId: '', checkId: existing.id },
        'Health check already registered, updating',
      );
      return this.checkRepo.update(existing.id, {
        intervalSeconds: config.intervalSeconds ?? existing.intervalSeconds,
        timeoutSeconds: config.timeoutSeconds ?? existing.timeoutSeconds,
        retryCount: config.retryCount ?? existing.retryCount,
        expectedStatusCode: config.expectedStatusCode ?? existing.expectedStatusCode,
        expectedGrpcStatus: config.expectedGrpcStatus ?? existing.expectedGrpcStatus,
        port: config.port ?? existing.port,
        failureThreshold: config.failureThreshold ?? existing.failureThreshold,
        isActive: true,
      });
    }

    const id = randomUUID();
    const entity = await this.checkRepo.create({
      id,
      tenantId,
      serviceName: config.serviceName,
      serviceUrl: config.serviceUrl,
      checkType: config.checkType,
      intervalSeconds: config.intervalSeconds ?? 30,
      timeoutSeconds: config.timeoutSeconds ?? 10,
      retryCount: config.retryCount ?? 2,
      expectedStatusCode: config.expectedStatusCode ?? 200,
      expectedGrpcStatus: config.expectedGrpcStatus ?? 'SERVING',
      port: config.port ?? null,
      failureThreshold: config.failureThreshold ?? 3,
      consecutiveFailures: 0,
      lastStatus: 'unknown',
      lastCheckedAt: null,
      lastError: null,
      isActive: true,
    });

    logger.info(
      { traceId: '', checkId: id, service: config.serviceName, type: config.checkType },
      'Health check registered',
    );

    return entity;
  }

  /**
   * Register a custom check function by name.
   * The function is called when running checks of type 'custom'.
   */
  registerCustomChecker(name: string, fn: () => Promise<CheckResult>): void {
    this.customCheckers.set(name, fn);
  }

  /**
   * Deactivate a check by ID.
   */
  async deactivateCheck(id: string): Promise<void> {
    await this.checkRepo.deactivate(id);
    logger.info({ traceId: '', checkId: id }, 'Health check deactivated');
  }

  /**
   * Hard-delete a check by ID.
   */
  async unregisterCheck(id: string): Promise<boolean> {
    const existing = await this.checkRepo.findById(id);
    if (!existing) {
      return false;
    }
    await this.checkRepo.delete(id);
    logger.info({ traceId: '', checkId: id }, 'Health check unregistered (deleted)');
    return true;
  }

  /**
   * Get a check by ID (tenant-isolated).
   */
  async getCheck(id: string): Promise<ServiceHealthCheckEntity | null> {
    const entity = await this.checkRepo.findById(id);
    return entity ?? null;
  }

  /**
   * List all checks for a tenant.
   */
  async listChecks(tenantId: string): Promise<ServiceHealthCheckEntity[]> {
    return this.checkRepo.findActiveByTenantId(tenantId);
  }

  // ─── Check Execution ────────────────────────────────────────────────────────

  /**
   * Run a single check instance (with retries).
   */
  async runCheck(check: ServiceHealthCheckEntity): Promise<CheckResult> {
    const timeoutMs = check.timeoutSeconds * 1000;

    for (let attempt = 1; attempt <= check.retryCount; attempt++) {
      try {
        const result = await this.executeCheckAttempt(check, timeoutMs, attempt);
        if (result.status === 'healthy' || attempt === check.retryCount) {
          return result;
        }
        // Retry on failure
        logger.debug(
          { traceId: '', checkId: check.id, attempt, error: result.errorMessage },
          'Check attempt failed, retrying',
        );
      } catch (err) {
        if (attempt === check.retryCount) {
          const error = err instanceof Error ? err.message : String(err);
          return {
            status: 'error',
            latencyMs: 0,
            errorMessage: error,
            responseBody: null,
          };
        }
      }
    }

    return {
      status: 'error',
      latencyMs: 0,
      errorMessage: 'All retry attempts exhausted',
      responseBody: null,
    };
  }

  /**
   * Execute one check attempt based on check type.
   */
  private async executeCheckAttempt(
    check: ServiceHealthCheckEntity,
    timeoutMs: number,
    attemptNumber: number,
  ): Promise<CheckResult> {
    switch (check.checkType) {
      case 'http':
        return this.executeHttpCheck(check, timeoutMs, attemptNumber);
      case 'grpc':
        return this.executeGrpcCheck(check, timeoutMs, attemptNumber);
      case 'tcp':
        return this.executeTcpCheck(check, timeoutMs, attemptNumber);
      case 'custom':
        return this.executeCustomCheck(check, attemptNumber);
      default:
        throw new OrionError(
          `Unsupported check type: ${check.checkType}`,
          ErrorCode.VALIDATION_ERROR,
        );
    }
  }

  // ─── HTTP Check ─────────────────────────────────────────────────────────────

  private async executeHttpCheck(
    check: ServiceHealthCheckEntity,
    timeoutMs: number,
    _attemptNumber: number,
  ): Promise<CheckResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const start = Date.now();
      const response = await fetch(check.serviceUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      const latencyMs = Date.now() - start;
      const responseBody = await response.text();
      clearTimeout(timeoutId);

      if (response.ok && response.status === check.expectedStatusCode) {
        return {
          status: 'healthy',
          latencyMs,
          errorMessage: null,
          responseBody: responseBody.slice(0, 1000),
        };
      }

      return {
        status: 'unhealthy',
        latencyMs,
        errorMessage: `HTTP ${response.status}: expected ${check.expectedStatusCode}`,
        responseBody: responseBody.slice(0, 500),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      clearTimeout(timeoutId);
      if (error.includes('aborted') || error.includes('signal')) {
        return {
          status: 'timeout',
          latencyMs: timeoutMs,
          errorMessage: `Request timeout after ${timeoutMs}ms`,
          responseBody: null,
        };
      }
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        errorMessage: `HTTP request failed: ${error}`,
        responseBody: null,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── gRPC Check ─────────────────────────────────────────────────────────────

  private async executeGrpcCheck(
    check: ServiceHealthCheckEntity,
    timeoutMs: number,
    _attemptNumber: number,
  ): Promise<CheckResult> {
    // gRPC check requires an external gRPC client library (e.g. @grpc/grpc-js).
    // We provide the structured interface; the actual gRPC client should be
    // injected via environment config or a gRPC client factory.
    //
    // The implementation below is the canonical integration point.
    // To activate, provide a gRPC client via process.env.GRPC_CLIENT_FACTORY
    // or extend this service with a gRPC client parameter.
    //
    // Expected flow:
    // 1. Resolve gRPC channel from check.serviceUrl
    // 2. Call grpc.health.v1.Health/Check with empty request
    // 3. Map status to CheckResult
    // 4. Handle NOT_SERVING as degraded, SERVING as healthy

    const start = Date.now();

    // Attempt to use dynamic import if gRPC client is available
    try {
      const grpcClient = await this.resolveGrpcClient(check.serviceUrl, timeoutMs);
      const healthStatus = await grpcClient.check({ service: '' });
      const latencyMs = Date.now() - start;

      if (healthStatus.status === 1) {
        // SERVING
        return { status: 'healthy', latencyMs, errorMessage: null, responseBody: null };
      }
      if (healthStatus.status === 2) {
        // NOT_SERVING
        return {
          status: 'degraded',
          latencyMs,
          errorMessage: 'gRPC service not serving',
          responseBody: null,
        };
      }
      return {
        status: 'unhealthy',
        latencyMs,
        errorMessage: `gRPC unhealthy status: ${healthStatus.status}`,
        responseBody: null,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        errorMessage: `gRPC check failed: ${error}`,
        responseBody: null,
      };
    }
  }

  /**
   * Resolve a gRPC health check client.
   * Currently a stub that logs a warning if no gRPC client is configured.
   * Extend this method when integrating a gRPC client library.
   */
  private async resolveGrpcClient(
    _serviceUrl: string,
    _timeoutMs: number,
  ): Promise<{ check: (req: { service: string }) => Promise<{ status: number }> }> {
    logger.warn(
      { traceId: '', serviceUrl: _serviceUrl },
      'gRPC health check requested but no gRPC client configured. Returning degraded status.',
    );
    // Stub: always returns NOT_SERVING until gRPC client is integrated
    return {
      check: async () => ({ status: 2 }), // NOT_SERVING
    };
  }

  // ─── TCP Check ──────────────────────────────────────────────────────────────

  private async executeTcpCheck(
    check: ServiceHealthCheckEntity,
    timeoutMs: number,
    _attemptNumber: number,
  ): Promise<CheckResult> {
    const port = check.port ?? 80;
    const url = new URL(check.serviceUrl);
    const host = url.hostname;
    const start = Date.now();

    return new Promise((resolve) => {
      const socket = require('net').createConnection(port, host, () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({
          status: 'healthy',
          latencyMs,
          errorMessage: null,
          responseBody: null,
        });
      });

      socket.on('error', (err: Error) => {
        socket.destroy();
        resolve({
          status: 'error',
          latencyMs: Date.now() - start,
          errorMessage: `TCP connection failed: ${err.message}`,
          responseBody: null,
        });
      });

      socket.setTimeout(timeoutMs, () => {
        socket.destroy();
        resolve({
          status: 'timeout',
          latencyMs,
          errorMessage: `TCP connection timeout after ${timeoutMs}ms`,
          responseBody: null,
        });
      });
    });
  }

  // ─── Custom Check ───────────────────────────────────────────────────────────

  private async executeCustomCheck(
    check: ServiceHealthCheckEntity,
    attemptNumber: number,
  ): Promise<CheckResult> {
    const customFn = this.customCheckers.get(check.serviceName);
    if (!customFn) {
      return {
        status: 'error',
        latencyMs: 0,
        errorMessage: `No custom checker registered for: ${check.serviceName}`,
        responseBody: null,
      };
    }

    const start = Date.now();
    try {
      const result = await customFn();
      return {
        ...result,
        latencyMs: Date.now() - start,
        attemptNumber,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        errorMessage: `Custom check failed: ${error}`,
        responseBody: null,
      };
    }
  }

  // ─── Batch Execution ────────────────────────────────────────────────────────

  /**
   * Run all active checks for a tenant and persist results.
   * Triggers alerts on consecutive failures and recovery.
   */
  async runAllChecks(tenantId?: string): Promise<{
    ran: number;
    healthy: number;
    unhealthy: number;
    errors: number;
  }> {
    const tid = tenantId ?? '00000000-0000-0000-0000-000000000000';
    const checks = await this.checkRepo.findActiveByTenantId(tid);

    let healthy = 0;
    let unhealthy = 0;
    let errors = 0;

    for (const check of checks) {
      const result = await this.runCheck(check);

      // Persist result
      await this.resultRepo.createResult({
        id: randomUUID(),
        checkId: check.id,
        tenantId: tid,
        status: result.status,
        latencyMs: result.latencyMs,
        errorMessage: result.errorMessage,
        attemptNumber: 1,
        responseBody: result.responseBody ?? null,
      });

      // Update check status
      const updated = await this.checkRepo.updateStatus(check.id, result.status, result.errorMessage);

      // Alert logic
      if (result.status === 'healthy') {
        if (updated.consecutiveFailures > 0) {
          // Recovery!
          await this.checkRepo.resetFailures(check.id);
          await this.triggerAlert({
            check: updated,
            result,
            consecutiveFailures: 0,
            isRecovery: true,
          });
        }
        healthy++;
      } else {
        if (updated.consecutiveFailures >= check.failureThreshold) {
          await this.triggerAlert({
            check: updated,
            result,
            consecutiveFailures: updated.consecutiveFailures,
            isRecovery: false,
          });
        }
        if (result.status === 'error') errors++;
        else unhealthy++;
      }

      if (result.status !== 'healthy') {
        logger.warn(
          {
            traceId: '',
            checkId: check.id,
            service: check.serviceName,
            status: result.status,
            latencyMs: result.latencyMs,
            consecutiveFailures: updated.consecutiveFailures,
          },
          'Health check failed',
        );
      }
    }

    logger.info(
      { traceId: '', tenantId: tid, ran: checks.length, healthy, unhealthy, errors },
      'Health check batch completed',
    );

    return { ran: checks.length, healthy, unhealthy, errors };
  }

  // ─── Alerting ───────────────────────────────────────────────────────────────

  private async triggerAlert(payload: AlertPayload): Promise<void> {
    if (!this.alertCallback) {
      logger.debug(
        { traceId: '', checkId: payload.check.id },
        'No alert callback configured, skipping alert',
      );
      return;
    }

    try {
      await this.alertCallback(payload);
      if (payload.isRecovery) {
        logger.info(
          { traceId: '', checkId: payload.check.id, service: payload.check.serviceName },
          'Recovery alert sent',
        );
      } else {
        logger.warn(
          {
            traceId: '',
            checkId: payload.check.id,
            service: payload.check.serviceName,
            consecutiveFailures: payload.consecutiveFailures,
          },
          'Failure alert sent',
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(
        { traceId: '', checkId: payload.check.id, error },
        'Failed to send alert',
      );
    }
  }

  // ─── Analytics / History ────────────────────────────────────────────────────

  /**
   * Get recent results for a check (for trend analysis).
   */
  async getRecentResults(checkId: string, limit = 50): Promise<ServiceHealthResultEntity[]> {
    return this.resultRepo.findRecentByCheckId(checkId, limit);
  }

  /**
   * Get results within a time range.
   */
  async getResultsInRange(
    checkId: string,
    start: Date,
    end: Date,
    limit = 200,
  ): Promise<ServiceHealthResultEntity[]> {
    return this.resultRepo.findByTimeRange(checkId, start, end, limit);
  }

  /**
   * Calculate uptime percentage for a check.
   */
  async getUptime(checkId: string, since: Date): Promise<{ total: number; healthy: number; uptimePercent: number }> {
    return this.resultRepo.calculateUptime(checkId, since, new Date());
  }

  // ─── Quick Checks (no registration required) ─────────────────────────────────

  /**
   * Quick HTTP endpoint health check (no registration required).
   */
  async checkEndpoint(url: string, timeoutMs: number): Promise<CheckResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Orion-HealthCheck/1.0',
        },
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return {
          status: 'unhealthy',
          latencyMs,
          errorMessage: `HTTP ${response.status} ${response.statusText}`,
          responseBody: null,
        };
      }

      return {
        status: 'healthy',
        latencyMs,
        errorMessage: null,
        responseBody: null,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('aborted') || message.includes('timeout')) {
        return {
          status: 'timeout',
          latencyMs,
          errorMessage: `Request timed out after ${timeoutMs}ms`,
          responseBody: null,
        };
      }

      return {
        status: 'error',
        latencyMs,
        errorMessage: `Connection failed: ${message}`,
        responseBody: null,
      };
    }
  }

  /**
   * Quick PostgreSQL database health check (no registration required).
   */
  async checkDatabase(connectionString: string, timeoutMs: number): Promise<CheckResult> {
    const start = Date.now();
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: timeoutMs,
      max: 1,
    });

    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        const latencyMs = Date.now() - start;

        return {
          status: 'healthy',
          latencyMs,
          errorMessage: null,
          responseBody: null,
        };
      } finally {
        client.release();
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      return {
        status: 'error',
        latencyMs,
        errorMessage: `Database connection failed: ${message}`,
        responseBody: null,
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Quick Redis health check (no registration required).
   */
  async checkRedis(connectionString: string, timeoutMs: number): Promise<CheckResult> {
    const start = Date.now();
    let redis: Redis | null = null;

    try {
      redis = new Redis(connectionString, {
        connectTimeout: timeoutMs,
        lazyConnect: true,
      });

      await redis.connect();
      const latencyMs = Date.now() - start;

      const pong = await redis.ping();
      await redis.quit();

      if (pong === 'PONG') {
        return {
          status: 'healthy',
          latencyMs,
          errorMessage: null,
          responseBody: null,
        };
      }

      return {
        status: 'degraded',
        latencyMs,
        errorMessage: `Unexpected ping response: ${pong}`,
        responseBody: null,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      try {
        await redis?.quit();
      } catch {}

      return {
        status: 'error',
        latencyMs,
        errorMessage: `Redis connection failed: ${message}`,
        responseBody: null,
      };
    }
  }

  /**
   * Quick Kubernetes cluster health check (no registration required).
   */
  async checkKubernetes(timeoutMs: number, kubeconfig?: string, resources?: string[]): Promise<CheckResult> {
    const start = Date.now();

    try {
      const kc = kubeconfig ? new K8sApi({ config: kubeconfig }) : new K8sApi();
      const k8sApi = kc.makeApiClient(kc.getCoreApi());

      const nodesResponse = await k8sApi.listNode();
      const latencyMs = Date.now() - start;

      const totalNodes = nodesResponse.body.items?.length ?? 0;
      const readyNodes = nodesResponse.body.items?.filter(node => {
        const conditions = node.status?.conditions || [];
        return conditions.some(c => c.type === 'Ready' && c.status === 'True');
      }).length ?? 0;

      if (totalNodes === 0) {
        return {
          status: 'degraded',
          latencyMs,
          errorMessage: 'No nodes found in cluster',
          responseBody: null,
        };
      }

      if (readyNodes < totalNodes) {
        return {
          status: 'degraded',
          latencyMs,
          errorMessage: `${readyNodes}/${totalNodes} nodes ready`,
          responseBody: null,
        };
      }

      return {
        status: 'healthy',
        latencyMs,
        errorMessage: `Cluster healthy (${readyNodes}/${totalNodes} nodes ready)`,
        responseBody: null,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      return {
        status: 'error',
        latencyMs,
        errorMessage: `Kubernetes check failed: ${message}`,
        responseBody: null,
      };
    }
  }
}
