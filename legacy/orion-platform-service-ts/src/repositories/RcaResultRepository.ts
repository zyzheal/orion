import { BaseRepository } from '../db/base-repository';

export interface RcaResultEntity {
  id: string;
  tenantId: string;
  status: string;
  affectedServices: Record<string, any>[];
  correlatedAlerts: Record<string, any>[];
  rootCause: Record<string, any> | null;
  topRootCauses: Record<string, any>[];
  topologyPath: string[];
  timeWindowStart: Date;
  timeWindowEnd: Date;
  alertCount: number;
  groupCount: number;
  completedAt: Date;
  createdAt: Date;
}

export class RcaResultRepository extends BaseRepository<RcaResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'rca_results');
  }

  async findByTenantId(tenantId: string, limit: number = 50): Promise<RcaResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rca_results WHERE tenant_id = $1 ORDER BY completed_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(limit: number = 20): Promise<RcaResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rca_results ORDER BY completed_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteOlderThan(before: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM rca_results WHERE completed_at < $1`,
      [before],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): RcaResultEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      status: row.status,
      affectedServices: row.affected_services || [],
      correlatedAlerts: row.correlated_alerts || [],
      rootCause: row.root_cause,
      topRootCauses: row.top_root_causes || [],
      topologyPath: row.topology_path || [],
      timeWindowStart: row.time_window_start,
      timeWindowEnd: row.time_window_end,
      alertCount: row.alert_count,
      groupCount: row.group_count,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}
