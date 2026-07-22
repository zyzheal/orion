/**
 * HeartbeatWatchdogRepository
 * 心跳守护进程数据访问层 — 基于 heartbeat_watchdog 表
 */

import { OrionError, ErrorCode } from '../errors';

export interface HeartbeatWatchdogEntity {
  id: string;
  tenantId: string;
  serviceName: string;
  lastHeartbeat: Date;
  status: string;
  failureCount: number;
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreateHeartbeatWatchdogPayload {
  id: string;
  tenantId: string;
  serviceName: string;
  lastHeartbeat: Date;
  status?: string;
  failureCount?: number;
  errorMessage?: string | null;
}

export class HeartbeatWatchdogRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async create(payload: CreateHeartbeatWatchdogPayload): Promise<HeartbeatWatchdogEntity> {
    const result = await this.db.query(
      `INSERT INTO heartbeat_watchdog (id, tenant_id, service_name, last_heartbeat, status, failure_count, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        payload.id,
        payload.tenantId,
        payload.serviceName,
        payload.lastHeartbeat,
        payload.status ?? 'healthy',
        payload.failureCount ?? 0,
        payload.errorMessage ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('Failed to create heartbeat_watchdog record', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsert(payload: CreateHeartbeatWatchdogPayload): Promise<HeartbeatWatchdogEntity> {
    const result = await this.db.query(
      `INSERT INTO heartbeat_watchdog (id, tenant_id, service_name, last_heartbeat, status, failure_count, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET last_heartbeat = EXCLUDED.last_heartbeat,
             status = EXCLUDED.status,
             failure_count = EXCLUDED.failure_count,
             error_message = EXCLUDED.error_message,
             updated_at = NOW()
       RETURNING *`,
      [
        payload.id,
        payload.tenantId,
        payload.serviceName,
        payload.lastHeartbeat,
        payload.status ?? 'healthy',
        payload.failureCount ?? 0,
        payload.errorMessage ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('Upsert heartbeat_watchdog returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantAndService(tenantId: string, serviceName: string): Promise<HeartbeatWatchdogEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_watchdog WHERE tenant_id = $1 AND service_name = $2`,
      [tenantId, serviceName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByService(serviceName: string): Promise<HeartbeatWatchdogEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_watchdog WHERE service_name = $1`,
      [serviceName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAllByTenant(tenantId: string): Promise<HeartbeatWatchdogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_watchdog WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<HeartbeatWatchdogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_watchdog WHERE status IN ('healthy', 'warning') ORDER BY last_heartbeat DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findTimedOut(timeoutMs: number): Promise<HeartbeatWatchdogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM heartbeat_watchdog
       WHERE status IN ('healthy', 'warning')
         AND last_heartbeat < (now() - (($1)::bigint * INTERVAL '1 millisecond'))`,
      [timeoutMs],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async recordBeat(serviceName: string, tenantId?: string): Promise<HeartbeatWatchdogEntity> {
    if (tenantId) {
      const result = await this.db.query(
        `INSERT INTO heartbeat_watchdog (id, tenant_id, service_name, last_heartbeat, status, failure_count, error_message)
         VALUES (gen_random_uuid(), $1, $2, now(), 'healthy', 0, NULL)
         ON CONFLICT (tenant_id, service_name) DO UPDATE
           SET last_heartbeat = EXCLUDED.last_heartbeat,
               status = EXCLUDED.status,
               failure_count = EXCLUDED.failure_count,
               error_message = NULL
         RETURNING *`,
        [tenantId, serviceName],
      );
      if (result.rows.length === 0) {
        throw new OrionError(`Record beat for service ${serviceName} failed`, ErrorCode.OPERATION_FAILED);
      }
      return this.mapRowToEntity(result.rows[0]);
    }

    // Without tenant_id — match by service_name only
    const result = await this.db.query(
      `INSERT INTO heartbeat_watchdog (id, tenant_id, service_name, last_heartbeat, status, failure_count, error_message)
       SELECT gen_random_uuid(), tenant_id, $1, now(), 'healthy', 0, NULL
       FROM heartbeat_watchdog WHERE service_name = $1
       LIMIT 1
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [serviceName],
    );

    if (result.rows.length > 0) {
      return this.mapRowToEntity(result.rows[0]);
    }

    // No existing row — create with default tenant
    return this.create({
      id: '', // will be set by gen_random_uuid in INSERT
      tenantId: tenantId || '00000000-0000-0000-0000-000000000000',
      serviceName,
      lastHeartbeat: new Date(),
    });
  }

  async markFailure(serviceName: string, errorMessage: string, tenantId?: string): Promise<HeartbeatWatchdogEntity> {
    if (tenantId) {
      const result = await this.db.query(
        `UPDATE heartbeat_watchdog
         SET status = 'unhealthy',
             failure_count = failure_count + 1,
             error_message = $1,
             last_heartbeat = now()
         WHERE tenant_id = $2 AND service_name = $3
         RETURNING *`,
        [errorMessage, tenantId, serviceName],
      );
      if (result.rows.length === 0) {
        throw new OrionError(`Mark failure for service ${serviceName} in tenant ${tenantId} not found`, ErrorCode.NOT_FOUND);
      }
      return this.mapRowToEntity(result.rows[0]);
    }

    const result = await this.db.query(
      `UPDATE heartbeat_watchdog
       SET status = 'unhealthy',
           failure_count = failure_count + 1,
           error_message = $1,
           last_heartbeat = now()
       WHERE service_name = $2
       RETURNING *`,
      [errorMessage, serviceName],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Mark failure for service ${serviceName} not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async reset(serviceName: string, tenantId?: string): Promise<HeartbeatWatchdogEntity> {
    if (tenantId) {
      const result = await this.db.query(
        `UPDATE heartbeat_watchdog
         SET status = 'healthy',
             failure_count = 0,
             error_message = NULL
         WHERE tenant_id = $1 AND service_name = $2
         RETURNING *`,
        [tenantId, serviceName],
      );
      if (result.rows.length === 0) {
        throw new OrionError(`Reset service ${serviceName} in tenant ${tenantId} not found`, ErrorCode.NOT_FOUND);
      }
      return this.mapRowToEntity(result.rows[0]);
    }

    const result = await this.db.query(
      `UPDATE heartbeat_watchdog
       SET status = 'healthy',
           failure_count = 0,
           error_message = NULL
       WHERE service_name = $1
       RETURNING *`,
      [serviceName],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`Reset service ${serviceName} not found`, ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(serviceName: string, tenantId?: string): Promise<boolean> {
    if (tenantId) {
      const result = await this.db.query(
        `DELETE FROM heartbeat_watchdog WHERE tenant_id = $1 AND service_name = $2`,
        [tenantId, serviceName],
      );
      return (result.rowCount ?? 0) > 0;
    }

    const result = await this.db.query(
      `DELETE FROM heartbeat_watchdog WHERE service_name = $1`,
      [serviceName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): HeartbeatWatchdogEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      serviceName: row.service_name,
      lastHeartbeat: row.last_heartbeat,
      status: row.status,
      failureCount: row.failure_count,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
