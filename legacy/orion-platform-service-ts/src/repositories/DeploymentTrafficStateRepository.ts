import { BaseRepository } from '../db/base-repository';

export interface DeploymentTrafficStateEntity {
  id: string;
  tenantId: string;
  appName: string;
  environment: string;
  activePercent: number;
  newPercent: number;
  switched: boolean;
  strategy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DeploymentTrafficStateRepository extends BaseRepository<DeploymentTrafficStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'deployment_traffic_state');
  }

  async findByAppAndEnvironment(appName: string, environment: string, tenantId: string): Promise<DeploymentTrafficStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM deployment_traffic_state WHERE app_name = $1 AND environment = $2 AND tenant_id = $3 LIMIT 1`,
      [appName, environment, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, limit?: number): Promise<DeploymentTrafficStateEntity[]> {
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM deployment_traffic_state WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [tenantId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByAppEnvironment(
    id: string,
    tenantId: string,
    appName: string,
    environment: string,
    updates: {
      activePercent: number;
      newPercent: number;
      switched: boolean;
      strategy?: string;
    }
  ): Promise<DeploymentTrafficStateEntity> {
    const result = await this.db.query(
      `INSERT INTO deployment_traffic_state (id, tenant_id, app_name, environment, active_percent, new_percent, switched, strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         active_percent = EXCLUDED.active_percent,
         new_percent = EXCLUDED.new_percent,
         switched = EXCLUDED.switched,
         strategy = EXCLUDED.strategy,
         updated_at = NOW()
       RETURNING *`,
      [id, tenantId, appName, environment, updates.activePercent, updates.newPercent, updates.switched, updates.strategy ?? null],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByAppAndEnvironment(appName: string, environment: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM deployment_traffic_state WHERE app_name = $1 AND environment = $2 AND tenant_id = $3`,
      [appName, environment, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): DeploymentTrafficStateEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      appName: row.app_name,
      environment: row.environment,
      activePercent: parseFloat(row.active_percent) ?? 100,
      newPercent: parseFloat(row.new_percent) ?? 0,
      switched: row.switched ?? false,
      strategy: row.strategy ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
