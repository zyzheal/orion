import { BaseRepository } from '../db/base-repository';
import { DatabasePool } from '../services/database';

/** Entity for approval templates stored in the approval_templates table */
export interface ApprovalTemplateEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  approval_steps: Record<string, any>[];  // JSONB: approval steps/levels
  is_default: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class ApprovalTemplateRepository extends BaseRepository<ApprovalTemplateEntity> {
  constructor(db: DatabasePool) {
    super(db, 'approval_templates');
  }

  /** Find all templates for a tenant */
  async findByTenant(tenantId: string): Promise<ApprovalTemplateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approval_templates WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Find the default template for a tenant */
  async findDefaultTemplate(tenantId: string): Promise<ApprovalTemplateEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM approval_templates WHERE tenant_id = $1 AND is_default = true LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Create a new template (custom method with explicit parameters) */
  async createTemplate(input: {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    approvalSteps: Record<string, any>[];
    isDefault: boolean;
    createdBy: string;
  }): Promise<ApprovalTemplateEntity> {
    const result = await this.db.query(
      `INSERT INTO approval_templates (id, tenant_id, name, description, approval_steps, is_default, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.name,
        input.description || null,
        JSON.stringify(input.approvalSteps),
        input.isDefault,
        input.createdBy,
        new Date(),
        new Date(),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Update a template (custom method with explicit parameters) */
  async updateTemplate(
    id: string,
    updates: {
      name?: string;
      description?: string;
      approvalSteps?: Record<string, any>[];
      isDefault?: boolean;
    },
  ): Promise<ApprovalTemplateEntity | null> {
    const setClauses: string[] = ['updated_at = $1'];
    const params: any[] = [new Date()];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(updates.name);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(updates.description);
      paramIndex++;
    }
    if (updates.approvalSteps !== undefined) {
      setClauses.push(`approval_steps = $${paramIndex}`);
      params.push(JSON.stringify(updates.approvalSteps));
      paramIndex++;
    }
    if (updates.isDefault !== undefined) {
      setClauses.push(`is_default = $${paramIndex}`);
      params.push(updates.isDefault);
      paramIndex++;
    }

    params.push(id);
    const query = `UPDATE approval_templates SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Unset default for templates of same tenant (excluding this one) */
  async unsetDefault(tenantId: string, excludeId: string): Promise<void> {
    await this.db.query(
      `UPDATE approval_templates SET is_default = false, updated_at = NOW() WHERE tenant_id = $1 AND id != $2 AND is_default = true`,
      [tenantId, excludeId],
    );
  }

  /** Delete a template */
  async deleteTemplate(id: string): Promise<boolean> {
    return this.delete(id);
  }

  protected mapRowToEntity(row: any): ApprovalTemplateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      approval_steps: typeof row.approval_steps === 'string' ? JSON.parse(row.approval_steps) : (row.approval_steps || []),
      is_default: row.is_default ?? false,
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

export default ApprovalTemplateRepository;
