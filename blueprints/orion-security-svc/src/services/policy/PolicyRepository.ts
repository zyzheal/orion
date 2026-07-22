/**
 * Policy Repository - PostgreSQL data access layer for OPA policy definitions
 */

export interface PolicyEntity {
  id: string;
  name: string;
  description: string;
  rego: string;
  category: string;
  severity: string;
  enabled: boolean;
  version: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export class PolicyRepository {
  constructor(private db: DbClient) {}

  async findById(id: string): Promise<PolicyEntity | undefined> {
    const result = await this.db.query('SELECT * FROM policies WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<PolicyEntity[]> {
    const result = await this.db.query('SELECT * FROM policies ORDER BY created_at DESC');
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByCategory(category: string): Promise<PolicyEntity[]> {
    const result = await this.db.query('SELECT * FROM policies WHERE category = $1 ORDER BY created_at DESC', [category]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async create(data: Omit<PolicyEntity, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<PolicyEntity> {
    const id = `policy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const result = await this.db.query(
      `INSERT INTO policies (id, name, description, rego, category, severity, enabled, version, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, NOW(), NOW()) RETURNING *`,
      [id, data.name, data.description, data.rego, data.category, data.severity, data.enabled !== false, data.tags || []]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: Partial<PolicyEntity>): Promise<PolicyEntity | undefined> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx}`); params.push(data.name); idx++; }
    if (data.description !== undefined) { sets.push(`description = $${idx}`); params.push(data.description); idx++; }
    if (data.rego !== undefined) { sets.push(`rego = $${idx}`); params.push(data.rego); idx++; }
    if (data.category !== undefined) { sets.push(`category = $${idx}`); params.push(data.category); idx++; }
    if (data.severity !== undefined) { sets.push(`severity = $${idx}`); params.push(data.severity); idx++; }
    if (data.enabled !== undefined) { sets.push(`enabled = $${idx}`); params.push(data.enabled); idx++; }
    if (data.tags !== undefined) { sets.push(`tags = $${idx}`); params.push(data.tags); idx++; }

    if (sets.length === 0) return this.findById(id);

    sets.push(`updated_at = NOW()`);
    sets.push(`version = version + 1`);
    params.push(id);

    const result = await this.db.query(
      `UPDATE policies SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM policies WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async toggle(id: string): Promise<PolicyEntity | undefined> {
    const result = await this.db.query(
      'UPDATE policies SET enabled = NOT enabled, updated_at = NOW(), version = version + 1 WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): PolicyEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      rego: row.rego,
      category: row.category,
      severity: row.severity,
      enabled: row.enabled,
      version: row.version,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
