import { BaseRepository } from '../db/base-repository';

export interface BudgetAlertTriggerEntity {
  id: string;
  tenantId: string | null;
  budgetId: string;
  threshold: number;
  actual: number;
  percentage: number;
  entityType: string;
  entityId: string;
  triggeredAt: Date;
  createdAt: Date;
}

export class BudgetAlertTriggerRepository extends BaseRepository<BudgetAlertTriggerEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'budget_alert_triggers');
  }

  async findByBudgetId(budgetId: string): Promise<BudgetAlertTriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM budget_alert_triggers WHERE budget_id = $1 ORDER BY triggered_at DESC`,
      [budgetId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEntityType(entityType: string): Promise<BudgetAlertTriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM budget_alert_triggers WHERE entity_type = $1 ORDER BY triggered_at DESC`,
      [entityType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEntity(entityType: string, entityId: string): Promise<BudgetAlertTriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM budget_alert_triggers WHERE entity_type = $1 AND entity_id = $2 ORDER BY triggered_at DESC`,
      [entityType, entityId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): BudgetAlertTriggerEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      budgetId: row.budget_id,
      threshold: Number(row.threshold),
      actual: Number(row.actual),
      percentage: Number(row.percentage),
      entityType: row.entity_type,
      entityId: row.entity_id,
      triggeredAt: row.triggered_at,
      createdAt: row.created_at,
    };
  }
}
