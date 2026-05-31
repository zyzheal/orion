/**
 * AssignmentRuleRepository
 * Ticket assignment rule data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface AssignmentRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  categories: string[];
  assignee: string;
  priorities: string[] | null;
  enabled: boolean;
  ruleOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AssignmentRuleRepository extends BaseRepository<AssignmentRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ticket_assignment_rules');
  }

  async findEnabled(): Promise<AssignmentRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_assignment_rules WHERE enabled = true ORDER BY rule_order ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string): Promise<AssignmentRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_assignment_rules WHERE tenant_id = $1 ORDER BY rule_order ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabledByTenantId(tenantId: string): Promise<AssignmentRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ticket_assignment_rules WHERE tenant_id = $1 AND enabled = true ORDER BY rule_order ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `UPDATE ticket_assignment_rules SET enabled = $2, updated_at = NOW() WHERE id = $1`,
      [id, enabled],
    );
  }

  async updateOrder(id: string, ruleOrder: number): Promise<void> {
    await this.db.query(
      `UPDATE ticket_assignment_rules SET rule_order = $2, updated_at = NOW() WHERE id = $1`,
      [id, ruleOrder],
    );
  }

  protected mapRowToEntity(row: any): AssignmentRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      categories: Array.isArray(row.categories) ? row.categories : (typeof row.categories === 'string' ? JSON.parse(row.categories) : []),
      assignee: row.assignee,
      priorities: row.priorities ? (Array.isArray(row.priorities) ? row.priorities : JSON.parse(row.priorities)) : null,
      enabled: row.enabled ?? true,
      ruleOrder: row.rule_order ?? 0,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
