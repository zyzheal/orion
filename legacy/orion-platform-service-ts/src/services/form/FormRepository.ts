import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface FormDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  version: number;
  layout: string;
  enabled: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FormFieldDefinition {
  id: string;
  tenant_id: string;
  form_id: string;
  field_key: string;
  field_type: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  default_value: unknown;
  options: unknown;
  rules: Record<string, unknown> | null;
  visible_when: Record<string, unknown> | null;
  required_when: Record<string, unknown> | null;
  sort_order: number;
  props: Record<string, unknown> | null;
  created_at: Date;
}

export interface FormInstance {
  id: string;
  tenant_id: string;
  definition_id: string;
  entity_type: string;
  entity_id: string;
  form_data: Record<string, unknown>;
  submitted_by: string | null;
  submitted_at: Date;
  updated_at: Date;
}

export interface CreateFormDefinitionInput {
  name: string;
  description?: string;
  layout?: string;
  enabled?: boolean;
  created_by?: string;
}

export interface CreateFormFieldInput {
  form_id: string;
  field_key: string;
  field_type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  default_value?: unknown;
  options?: unknown;
  rules?: Record<string, unknown>;
  visible_when?: Record<string, unknown>;
  required_when?: Record<string, unknown>;
  sort_order?: number;
  props?: Record<string, unknown>;
}

export interface CreateFormInstanceInput {
  definition_id: string;
  entity_type: string;
  entity_id: string;
  form_data: Record<string, unknown>;
  submitted_by?: string;
}

export class FormRepository {
  constructor(private pool: DatabasePool) {}

  // ---- Definition CRUD ----

  async findDefinitionById(id: string): Promise<FormDefinition | null> {
    const result = await this.pool.query(
      'SELECT * FROM form_definitions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDefinitions(options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: FormDefinition[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.enabled !== undefined) {
      conditions.push(`enabled = $${paramIndex}`);
      params.push(options.enabled);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM form_definitions WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM form_definitions WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async createDefinition(input: CreateFormDefinitionInput): Promise<FormDefinition> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO form_definitions (tenant_id, name, description, layout, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.description ?? null,
        input.layout ?? 'vertical',
        input.enabled ?? true,
        input.created_by ?? null,
      ]
    );
    return result.rows[0];
  }

  async updateDefinition(id: string, data: { name?: string; description?: string; layout?: string; enabled?: boolean }): Promise<FormDefinition | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) { setClauses.push(`name = $${paramIndex}`); params.push(data.name); paramIndex++; }
    if (data.description !== undefined) { setClauses.push(`description = $${paramIndex}`); params.push(data.description); paramIndex++; }
    if (data.layout !== undefined) { setClauses.push(`layout = $${paramIndex}`); params.push(data.layout); paramIndex++; }
    if (data.enabled !== undefined) { setClauses.push(`enabled = $${paramIndex}`); params.push(data.enabled); paramIndex++; }

    if (setClauses.length === 0) return this.findDefinitionById(id);

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE form_definitions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM form_definitions WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ---- Field CRUD ----

  async findFieldsByFormId(formId: string): Promise<FormFieldDefinition[]> {
    const result = await this.pool.query(
      'SELECT * FROM form_field_definitions WHERE form_id = $1 ORDER BY sort_order ASC',
      [formId]
    );
    return result.rows;
  }

  async createField(input: CreateFormFieldInput): Promise<FormFieldDefinition> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO form_field_definitions (tenant_id, form_id, field_key, field_type, label, placeholder, required, default_value, options, rules, visible_when, required_when, sort_order, props)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        tenantId,
        input.form_id,
        input.field_key,
        input.field_type,
        input.label,
        input.placeholder ?? null,
        input.required ?? false,
        input.default_value ? JSON.stringify(input.default_value) : null,
        input.options ? JSON.stringify(input.options) : null,
        input.rules ? JSON.stringify(input.rules) : null,
        input.visible_when ? JSON.stringify(input.visible_when) : null,
        input.required_when ? JSON.stringify(input.required_when) : null,
        input.sort_order ?? 0,
        input.props ? JSON.stringify(input.props) : null,
      ]
    );
    return result.rows[0];
  }

  async deleteFieldsByFormId(formId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM form_field_definitions WHERE form_id = $1',
      [formId]
    );
    return result.rowCount ?? 0;
  }

  // ---- Instance CRUD ----

  async findInstanceById(id: string): Promise<FormInstance | null> {
    const result = await this.pool.query(
      'SELECT * FROM form_instances WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findInstances(options?: {
    definitionId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: FormInstance[]; total: number }> {
    const tenantId = getCurrentTenantId();
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.definitionId) {
      conditions.push(`definition_id = $${paramIndex}`);
      params.push(options.definitionId);
      paramIndex++;
    }
    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }
    if (options?.entityId) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(options.entityId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM form_instances WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM form_instances WHERE ${whereClause} ORDER BY submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async createInstance(input: CreateFormInstanceInput): Promise<FormInstance> {
    const tenantId = getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO form_instances (tenant_id, definition_id, entity_type, entity_id, form_data, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        input.definition_id,
        input.entity_type,
        input.entity_id,
        JSON.stringify(input.form_data),
        input.submitted_by ?? null,
      ]
    );
    return result.rows[0];
  }

  async updateInstance(id: string, data: { form_data?: Record<string, unknown> }): Promise<FormInstance | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.form_data !== undefined) {
      setClauses.push(`form_data = $${paramIndex}`);
      params.push(JSON.stringify(data.form_data));
      paramIndex++;
    }

    if (setClauses.length === 0) return this.findInstanceById(id);

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE form_instances SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}
