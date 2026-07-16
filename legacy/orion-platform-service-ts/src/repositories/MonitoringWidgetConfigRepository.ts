import { BaseRepository } from '../db/base-repository';

export interface MonitoringWidgetConfigEntity {
  id: string;
  tenantId: string;
  title: string;
  metrics: string[];
  timeWindow: string;
  tags: Record<string, string>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MonitoringWidgetConfigRepository extends BaseRepository<MonitoringWidgetConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'monitoring_widget_configs');
  }

  async findByTenantId(tenantId: string): Promise<MonitoringWidgetConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM monitoring_widget_configs WHERE tenant_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateSortOrder(id: string, sortOrder: number): Promise<void> {
    await this.db.query(
      `UPDATE monitoring_widget_configs SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
      [sortOrder, id],
    );
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM monitoring_widget_configs WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): MonitoringWidgetConfigEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      metrics: row.metrics || [],
      timeWindow: row.time_window,
      tags: row.tags || {},
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
