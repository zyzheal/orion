import { BaseRepository } from '../db/base-repository';

export interface TimelineEventEntity {
  id: string;
  tenantId: string;
  deploymentId: string;
  eventTimestamp: Date;
  service: string;
  eventType: string;
  severity: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class TimelineEventRepository extends BaseRepository<TimelineEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'rca_timeline_events');
  }

  async findByDeploymentId(deploymentId: string): Promise<TimelineEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rca_timeline_events WHERE deployment_id = $1 ORDER BY event_timestamp ASC`,
      [deploymentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByDeploymentInRange(deploymentId: string, startTime: Date, endTime: Date): Promise<TimelineEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rca_timeline_events
       WHERE deployment_id = $1 AND event_timestamp >= $2 AND event_timestamp <= $3
       ORDER BY event_timestamp ASC`,
      [deploymentId, startTime, endTime],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<TimelineEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rca_timeline_events WHERE tenant_id = $1 ORDER BY event_timestamp DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM rca_timeline_events WHERE event_timestamp < $1`,
      [before],
    );
    return result.rowCount ?? 0;
  }

  async deleteByDeploymentId(deploymentId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM rca_timeline_events WHERE deployment_id = $1`,
      [deploymentId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): TimelineEventEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentId: row.deployment_id,
      eventTimestamp: row.event_timestamp,
      service: row.service,
      eventType: row.event_type,
      severity: row.severity,
      description: row.description,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }
}
