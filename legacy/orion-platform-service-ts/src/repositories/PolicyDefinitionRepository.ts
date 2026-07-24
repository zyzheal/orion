/**
 * PolicyDefinitionRepository - Data access layer for policy definitions
 */
import { BaseRepository, FindAllOptions } from '../db/base-repository';
import { v4 as uuidv4 } from 'uuid';

// ==================== Entity Interfaces ====================

export interface PolicyDefinitionEntity {
  id: string;
  name: string;
  description: string | null;
  category: string;
  regoPath: string;
  gateId: string | null;
  severity: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDefinitionCreateInput {
  name: string;
  description?: string;
  category: string;
  regoPath: string;
  gateId?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

export interface PolicyDefinitionUpdateInput {
  description?: string;
  category?: string;
  regoPath?: string;
  gateId?: string;
  severity?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

// ==================== PolicyDefinitionRepository ====================

export class PolicyDefinitionRepository extends BaseRepository<PolicyDefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'policy_definitions');
  }

  /**
   * Find by name
   */
  async findByName(name: string): Promise<PolicyDefinitionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM policy_definitions WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find by category
   */
  async findByCategory(category: string, options?: { limit?: number; offset?: number }): Promise<PolicyDefinitionEntity[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM policy_definitions WHERE category = $1 ORDER BY name LIMIT $2 OFFSET $3`,
      [category, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find enabled policies
   */
  async findEnabled(): Promise<PolicyDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_definitions WHERE enabled = true ORDER BY name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find by gate ID
   */
  async findByGateId(gateId: string): Promise<PolicyDefinitionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_definitions WHERE gate_id = $1 ORDER BY name`,
      [gateId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create a new policy definition
   */
  async createPolicy(input: PolicyDefinitionCreateInput): Promise<PolicyDefinitionEntity> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO policy_definitions (id, name, description, category, rego_path, gate_id, severity, enabled, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        id,
        input.name,
        input.description ?? null,
        input.category,
        input.regoPath,
        input.gateId ?? null,
        input.severity ?? 'warning',
        true,
        JSON.stringify(input.metadata ?? {}),
        now,
        now,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a policy definition
   */
  async updatePolicy(id: string, input: PolicyDefinitionUpdateInput): Promise<PolicyDefinitionEntity | undefined> {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(input.category);
    }
    if (input.regoPath !== undefined) {
      updates.push(`rego_path = $${paramIndex++}`);
      params.push(input.regoPath);
    }
    if (input.gateId !== undefined) {
      updates.push(`gate_id = $${paramIndex++}`);
      params.push(input.gateId);
    }
    if (input.severity !== undefined) {
      updates.push(`severity = $${paramIndex++}`);
      params.push(input.severity);
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      params.push(input.enabled);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }

    params.push(id);
    const result = await this.db.query(
      `UPDATE policy_definitions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete a policy definition
   */
  async deletePolicy(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM policy_definitions WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): PolicyDefinitionEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      regoPath: row.rego_path,
      gateId: row.gate_id,
      severity: row.severity,
      enabled: row.enabled ?? true,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== PolicyBundleRepository ====================

export interface PolicyBundleEntity {
  id: string;
  bundleName: string;
  gitRef: string;
  regoContent: Record<string, string>;
  testResults: Record<string, unknown> | null;
  deployedAt: Date;
  deployedBy: string | null;
  status: string;
}

export class PolicyBundleRepository extends BaseRepository<PolicyBundleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'policy_bundles');
  }

  async findByName(name: string): Promise<PolicyBundleEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM policy_bundles WHERE bundle_name = $1 ORDER BY deployed_at DESC LIMIT 1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findActive(): Promise<PolicyBundleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM policy_bundles WHERE status = 'active' ORDER BY bundle_name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PolicyBundleEntity {
    return {
      id: row.id,
      bundleName: row.bundle_name,
      gitRef: row.git_ref,
      regoContent: row.rego_content ?? {},
      testResults: row.test_results,
      deployedAt: row.deployed_at,
      deployedBy: row.deployed_by,
      status: row.status,
    };
  }
}