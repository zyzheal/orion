/**
 * EfficiencyMetricSnapshotRepository
 * Data access layer for DORA metric snapshots.
 * Replaces in-memory Map<string, MetricSnapshot[]> in DORACalculator.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface EfficiencyMetricSnapshotEntity {
  id: string;
  tenantId: string;
  timeWindow: string;
  deploymentFrequency: number;
  leadTimeMs: number;
  changeFailureRate: number;
  mttrMs: number;
  capturedAt: Date;
  createdAt: Date;
}

export class EfficiencyMetricSnapshotRepository extends BaseRepository<EfficiencyMetricSnapshotEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_metric_snapshots');
  }

  async create(data: any): Promise<EfficiencyMetricSnapshotEntity> {
    const columns = ['tenant_id', 'time_window', 'deployment_frequency', 'lead_time_ms', 'change_failure_rate', 'mttr_ms', 'captured_at'];
    const values = [data.tenantId, data.timeWindow, data.deploymentFrequency, data.leadTimeMs, data.changeFailureRate, data.mttrMs, data.capturedAt];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, limit: number = 100): Promise<EfficiencyMetricSnapshotEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY captured_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async pruneOld(tenantId: string, keepCount: number = 100): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id NOT IN (
        SELECT id FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY captured_at DESC LIMIT $2
      ) AND tenant_id = $1`,
      [tenantId, keepCount],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): EfficiencyMetricSnapshotEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      timeWindow: row.time_window,
      deploymentFrequency: parseFloat(row.deployment_frequency),
      leadTimeMs: parseFloat(row.lead_time_ms),
      changeFailureRate: parseFloat(row.change_failure_rate),
      mttrMs: parseFloat(row.mttr_ms),
      capturedAt: row.captured_at,
      createdAt: row.created_at,
    };
  }
}
