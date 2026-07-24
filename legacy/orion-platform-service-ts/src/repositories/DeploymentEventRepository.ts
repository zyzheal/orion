/**
 * DeploymentEventRepository - Database layer for deployment event persistence
 *
 * Stores deployment lifecycle events (started, completed, failed, cancelled, rolled back)
 * with multi-tenant isolation via tenant_id.
 *
 * TASK-4.32: Deployment event persistence — replace in-memory Map with PostgreSQL
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface DeploymentEventEntity {
  id: string;
  tenantId: string;
  deploymentId: string;
  eventType: string;
  message: string;
  details: Record<string, any>;
  createdAt: Date;
}

export class DeploymentEventRepository extends BaseRepository<DeploymentEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'deployment_events');
  }

  /**
   * Create a new deployment event.
   */
  async create(data: {
    deploymentId: string;
    eventType: string;
    message: string;
    details?: Record<string, any>;
    tenantId?: string;
  }): Promise<DeploymentEventEntity> {
    const tenantId = data.tenantId || this.getTenantId();
    const result = await this.db.query(
      `INSERT INTO deployment_events (tenant_id, deployment_id, event_type, message, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        tenantId,
        data.deploymentId,
        data.eventType,
        data.message,
        JSON.stringify(data.details ?? {}),
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all events for a specific deployment, ordered by creation time ascending.
   */
  async findByDeploymentId(deploymentId: string): Promise<DeploymentEventEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM deployment_events WHERE deployment_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      [deploymentId, tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find recent events for a tenant, ordered by creation time descending.
   */
  async findByTenantId(tenantId: string, limit: number = 100): Promise<DeploymentEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deployment_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Delete events older than the given date (cleanup utility).
   */
  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM deployment_events WHERE created_at < $1`,
      [before]
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): DeploymentEventEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentId: row.deployment_id,
      eventType: row.event_type,
      message: row.message,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : (row.details ?? {}),
      createdAt: row.created_at,
    };
  }
}
