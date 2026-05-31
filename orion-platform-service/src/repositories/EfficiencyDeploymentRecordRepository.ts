/**
 * EfficiencyDeploymentRecordRepository
 * Data access layer for efficiency deployment records.
 * Replaces in-memory Map<string, DeploymentRecord> in EventHandler.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export interface EfficiencyDeploymentRecordEntity {
  id: string;
  tenantId: string;
  deploymentId: string;
  service: string | null;
  environment: string | null;
  status: string;
  version: string | null;
  durationMs: number | null;
  deployedAt: Date;
  syncedToClickhouse: boolean;
  syncedAt: Date | null;
  recoveryTimeMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EfficiencyDeploymentRecordRepository extends BaseRepository<EfficiencyDeploymentRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_deployment_records');
  }

  async create(data: Omit<EfficiencyDeploymentRecordEntity, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<EfficiencyDeploymentRecordEntity, 'id'>>): Promise<EfficiencyDeploymentRecordEntity> {
    const columns = ['tenant_id', 'deployment_id', 'service', 'environment', 'status', 'version', 'duration_ms', 'deployed_at', 'synced_to_clickhouse', 'recovery_time_ms'];
    const values = [data.tenantId, data.deploymentId, data.service, data.environment, data.status, data.version, data.durationMs, data.deployedAt, data.syncedToClickhouse, data.recoveryTimeMs];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `INSERT into ${this.tableName} returned no rows`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, since?: Date): Promise<EfficiencyDeploymentRecordEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    if (since) {
      query += ` AND deployed_at >= $2`;
      params.push(since);
    }
    query += ` ORDER BY deployed_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findUnsynced(limit: number = 100): Promise<EfficiencyDeploymentRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE synced_to_clickhouse = false ORDER BY deployed_at ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markSynced(id: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.tableName} SET synced_to_clickhouse = true, synced_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  protected mapRowToEntity(row: any): EfficiencyDeploymentRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentId: row.deployment_id,
      service: row.service,
      environment: row.environment,
      status: row.status,
      version: row.version,
      durationMs: row.duration_ms,
      deployedAt: row.deployed_at,
      syncedToClickhouse: row.synced_to_clickhouse,
      syncedAt: row.synced_at,
      recoveryTimeMs: row.recovery_time_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
