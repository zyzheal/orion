/**
 * ServiceHealthRepository - PostgreSQL Repository for health check records
 *
 * Stores and retrieves health check configurations and results.
 * All operations are tenant-isolated via BaseRepository.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ServiceHealthCheckEntity {
  id: string;
  tenantId: string;
  serviceName: string;
  serviceUrl: string;
  checkType: 'http' | 'grpc' | 'tcp' | 'custom';
  intervalSeconds: number;
  timeoutSeconds: number;
  retryCount: number;
  expectedStatusCode: number;
  expectedGrpcStatus: string;
  port: number | null;
  failureThreshold: number;
  consecutiveFailures: number;
  lastStatus: string;
  lastCheckedAt: Date | null;
  lastError: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceHealthResultEntity {
  id: string;
  checkId: string;
  tenantId: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'timeout' | 'error';
  latencyMs: number | null;
  errorMessage: string | null;
  attemptNumber: number;
  responseBody: string | null;
  createdAt: Date;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ServiceHealthCheckRepository extends BaseRepository<ServiceHealthCheckEntity> {
  constructor(
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'service_health_checks');
  }

  protected mapRowToEntity(row: any): ServiceHealthCheckEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      serviceName: row.service_name,
      serviceUrl: row.service_url,
      checkType: row.check_type,
      intervalSeconds: row.interval_seconds,
      timeoutSeconds: row.timeout_seconds,
      retryCount: row.retry_count,
      expectedStatusCode: row.expected_status_code,
      expectedGrpcStatus: row.expected_grpc_status,
      port: row.port,
      failureThreshold: row.failure_threshold,
      consecutiveFailures: row.consecutive_failures,
      lastStatus: row.last_status,
      lastCheckedAt: row.last_checked_at,
      lastError: row.last_error,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Find all active checks for the current tenant */
  async findActiveByTenantId(tenantId: string): Promise<ServiceHealthCheckEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_health_checks WHERE tenant_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Find check by service name + URL + type (within current tenant) */
  async findByServiceConfig(
    serviceName: string,
    serviceUrl: string,
    checkType: string,
  ): Promise<ServiceHealthCheckEntity | undefined> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_health_checks
       WHERE tenant_id = $1 AND service_name = $2 AND service_url = $3 AND check_type = $4`,
      [tenantId, serviceName, serviceUrl, checkType],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Update failure count and last status after a check run */
  async updateStatus(
    id: string,
    status: string,
    error: string | null,
  ): Promise<ServiceHealthCheckEntity> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `UPDATE service_health_checks
       SET last_status = $1,
           last_error = $2,
           last_checked_at = NOW(),
           updated_at = NOW(),
           consecutive_failures = CASE WHEN $1 = 'healthy' THEN 0 ELSE consecutive_failures + 1 END
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [status, error, id, tenantId],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Health check not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Reset consecutive failures after recovery */
  async resetFailures(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await this.db.query(
      `UPDATE service_health_checks
       SET consecutive_failures = 0,
           last_status = 'healthy',
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  /** Deactivate a check */
  async deactivate(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await this.db.query(
      `UPDATE service_health_checks SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }
}

// ─── Results Repository ───────────────────────────────────────────────────────

export class ServiceHealthResultRepository extends BaseRepository<ServiceHealthResultEntity> {
  constructor(
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'service_health_results');
  }

  protected mapRowToEntity(row: any): ServiceHealthResultEntity {
    return {
      id: row.id,
      checkId: row.check_id,
      tenantId: row.tenant_id,
      status: row.status,
      latencyMs: row.latency_ms,
      errorMessage: row.error_message,
      attemptNumber: row.attempt_number,
      responseBody: row.response_body,
      createdAt: row.created_at,
    };
  }

  /** Record a health check result */
  async createResult(data: {
    id: string;
    checkId: string;
    tenantId: string;
    status: ServiceHealthResultEntity['status'];
    latencyMs: number | null;
    errorMessage: string | null;
    attemptNumber: number;
    responseBody?: string | null;
  }): Promise<ServiceHealthResultEntity> {
    const result = await this.db.query(
      `INSERT INTO service_health_results
       (id, check_id, tenant_id, status, latency_ms, error_message, attempt_number, response_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.id,
        data.checkId,
        data.tenantId,
        data.status,
        data.latencyMs,
        data.errorMessage,
        data.attemptNumber,
        data.responseBody ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Get recent results for a check (for trend analysis) */
  async findRecentByCheckId(checkId: string, limit: number = 50): Promise<ServiceHealthResultEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_health_results
       WHERE check_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [checkId, tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Get results within a time range */
  async findByTimeRange(
    checkId: string,
    start: Date,
    end: Date,
    limit: number = 200,
  ): Promise<ServiceHealthResultEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM service_health_results
       WHERE check_id = $1 AND tenant_id = $2 AND created_at >= $3 AND created_at <= $4
       ORDER BY created_at DESC
       LIMIT $5`,
      [checkId, tenantId, start, end, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Calculate uptime percentage for a check over a time range */
  async calculateUptime(checkId: string, start: Date, end: Date): Promise<{ total: number; healthy: number; uptimePercent: number }> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'healthy') as healthy
       FROM service_health_results
       WHERE check_id = $1 AND tenant_id = $2 AND created_at >= $3 AND created_at <= $4`,
      [checkId, tenantId, start, end],
    );
    const row = result.rows[0];
    const total = parseInt(row.total, 10);
    const healthy = parseInt(row.healthy, 10);
    return {
      total,
      healthy,
      uptimePercent: total > 0 ? Math.round((healthy / total) * 10000) / 100 : 100,
    };
  }

  /** Delete results older than the specified date (cleanup) */
  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM service_health_results WHERE created_at < $1`,
      [before],
    );
    return result.rowCount ?? 0;
  }
}
