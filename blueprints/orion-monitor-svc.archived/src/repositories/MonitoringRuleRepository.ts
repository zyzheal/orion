import type { MonitoringRule } from '../types/monitor.js';
import type { IDbAdapter } from '../db/database.js';

export class MonitoringRuleRepository {
  constructor(private pool: IDbAdapter) {}

  async create(
    tenantId: string,
    projectId: string,
    createdBy: string,
    rule: Omit<MonitoringRule, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'projectId' | 'createdBy'>,
  ): Promise<MonitoringRule> {
    const result = await this.pool.query(
      `INSERT INTO monitoring_rules
       (tenant_id, project_id, name, description, rule_type, metric_name, metric_type, aggregation,
        threshold, comparison, duration, labels, enabled, alert_policy_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [tenantId, projectId, rule.name, rule.description, rule.ruleType, rule.metricName,
       rule.metricType, rule.aggregation, rule.threshold, rule.comparison, rule.duration,
       JSON.stringify(rule.labels), rule.enabled, rule.alertPolicyId || null, createdBy],
    );
    return this.entityToDto(result.rows[0]);
  }

  async findByTenant(tenantId: string, projectId?: string): Promise<MonitoringRule[]> {
    let sql = 'SELECT * FROM monitoring_rules WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (projectId) { sql += ' AND project_id = $2'; params.push(projectId); }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(r => this.entityToDto(r));
  }

  async findById(id: string): Promise<MonitoringRule | null> {
    const result = await this.pool.query('SELECT * FROM monitoring_rules WHERE id = $1', [id]);
    return result.rows[0] ? this.entityToDto(result.rows[0]) : null;
  }

  async update(id: string, updates: Partial<MonitoringRule>): Promise<MonitoringRule | null> {
    const fields = Object.keys(updates).filter(k => !['id', 'createdAt', 'updatedAt'].includes(k));
    if (fields.length === 0) return null;
    const setClauses = fields.map((f, i) => `${f.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${i + 2}`).join(', ');
    const values = fields.map(f => {
      const v = (updates as any)[f];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });
    const result = await this.pool.query(
      `UPDATE monitoring_rules SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    return result.rows[0] ? this.entityToDto(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM monitoring_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private entityToDto(row: any): MonitoringRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      name: row.name,
      description: row.description ?? '',
      ruleType: row.rule_type,
      metricName: row.metric_name,
      metricType: row.metric_type,
      aggregation: row.aggregation,
      threshold: Number(row.threshold),
      comparison: row.comparison,
      duration: row.duration,
      labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : (row.labels ?? {}),
      enabled: row.enabled,
      alertPolicyId: row.alert_policy_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
    };
  }
}
