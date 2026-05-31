/**
 * AbacPolicyRepository - PostgreSQL data access for ABAC policies
 *
 * Works with the existing abac_policies table (migration 050).
 * Provides CRUD operations for attribute-based access control policies.
 */

export interface AbacPolicyEntity {
  id: string;
  tenantId: string | null;
  name: string;
  description: string | null;
  effect: 'allow' | 'deny';
  resourceType: string;
  actionType: string;
  subjectConditions: Record<string, unknown>;
  resourceConditions: Record<string, unknown>;
  environmentConditions: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAbacPolicyInput {
  tenantId?: string;
  name: string;
  description?: string;
  effect: 'allow' | 'deny';
  resourceType: string;
  actionType: string;
  subjectConditions?: Record<string, unknown>;
  resourceConditions?: Record<string, unknown>;
  environmentConditions?: Record<string, unknown>;
  priority?: number;
  enabled?: boolean;
  createdBy?: string;
}

export interface UpdateAbacPolicyInput {
  name?: string;
  description?: string;
  effect?: 'allow' | 'deny';
  resourceType?: string;
  actionType?: string;
  subjectConditions?: Record<string, unknown>;
  resourceConditions?: Record<string, unknown>;
  environmentConditions?: Record<string, unknown>;
  priority?: number;
  enabled?: boolean;
}

export class AbacPolicyRepository {
  constructor(
    private db: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    },
  ) {}

  /** Find a policy by ID */
  async findById(id: string): Promise<AbacPolicyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM abac_policies WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Find all policies, optionally filtered by tenant */
  async findAll(tenantId?: string): Promise<AbacPolicyEntity[]> {
    let query = `SELECT * FROM abac_policies`;
    const params: unknown[] = [];

    if (tenantId) {
      query += ` WHERE tenant_id = $1`;
      params.push(tenantId);
    }

    query += ` ORDER BY priority DESC, created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /** Find enabled policies for a given resource type */
  async findByResourceType(resourceType: string, tenantId?: string): Promise<AbacPolicyEntity[]> {
    let query = `SELECT * FROM abac_policies
       WHERE enabled = true AND (resource_type = $1 OR resource_type = '*')`;
    const params: unknown[] = [resourceType];

    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }

    query += ` ORDER BY priority DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /** Create a new policy */
  async create(input: CreateAbacPolicyInput): Promise<AbacPolicyEntity> {
    const result = await this.db.query(
      `INSERT INTO abac_policies (
        tenant_id, name, description, effect, resource_type, action_type,
        subject_conditions, resource_conditions, environment_conditions,
        priority, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.tenantId ?? null,
        input.name,
        input.description ?? null,
        input.effect,
        input.resourceType,
        input.actionType,
        JSON.stringify(input.subjectConditions ?? {}),
        JSON.stringify(input.resourceConditions ?? {}),
        JSON.stringify(input.environmentConditions ?? {}),
        input.priority ?? 0,
        input.enabled ?? true,
        input.createdBy ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new Error('INSERT into abac_policies returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Update a policy by ID */
  async update(id: string, input: UpdateAbacPolicyInput): Promise<AbacPolicyEntity | undefined> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.effect !== undefined) {
      setClauses.push(`effect = $${paramIndex++}`);
      values.push(input.effect);
    }
    if (input.resourceType !== undefined) {
      setClauses.push(`resource_type = $${paramIndex++}`);
      values.push(input.resourceType);
    }
    if (input.actionType !== undefined) {
      setClauses.push(`action_type = $${paramIndex++}`);
      values.push(input.actionType);
    }
    if (input.subjectConditions !== undefined) {
      setClauses.push(`subject_conditions = $${paramIndex++}`);
      values.push(JSON.stringify(input.subjectConditions));
    }
    if (input.resourceConditions !== undefined) {
      setClauses.push(`resource_conditions = $${paramIndex++}`);
      values.push(JSON.stringify(input.resourceConditions));
    }
    if (input.environmentConditions !== undefined) {
      setClauses.push(`environment_conditions = $${paramIndex++}`);
      values.push(JSON.stringify(input.environmentConditions));
    }
    if (input.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE abac_policies SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Delete a policy by ID */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM abac_policies WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Delete all policies for a tenant */
  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM abac_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): AbacPolicyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      effect: row.effect,
      resourceType: row.resource_type,
      actionType: row.action_type,
      subjectConditions: row.subject_conditions ?? {},
      resourceConditions: row.resource_conditions ?? {},
      environmentConditions: row.environment_conditions ?? {},
      priority: row.priority,
      enabled: row.enabled,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
