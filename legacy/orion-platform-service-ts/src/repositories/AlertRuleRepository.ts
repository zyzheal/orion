import { BaseRepository } from '../db/base-repository';

export interface AlertRuleEntity {
  id: string;
  name: string;
  budgetId: string | null;
  condition: string;
  threshold: number;
  severity: string;
  recipients: string[];
  status: string;
  lastTriggered: Date | null;
  createdAt: Date;
}

export class AlertRuleRepository extends BaseRepository<AlertRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_rules');
  }

  async findByBudgetId(budgetId: string): Promise<AlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_rules WHERE budget_id = $1 ORDER BY created_at DESC`,
      [budgetId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findActive(): Promise<AlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_rules WHERE status = 'active' ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async updateLastTriggered(id: string, lastTriggered: Date): Promise<void> {
    await this.db.query(
      `UPDATE alert_rules SET last_triggered = $1 WHERE id = $2`,
      [lastTriggered, id],
    );
  }

  protected mapRowToEntity(row: any): AlertRuleEntity {
    return {
      id: row.id,
      name: row.name,
      budgetId: row.budget_id,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      severity: row.severity,
      recipients: row.recipients ?? [],
      status: row.status,
      lastTriggered: row.last_triggered,
      createdAt: row.created_at,
    };
  }
}