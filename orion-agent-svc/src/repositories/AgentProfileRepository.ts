/**
 * AgentProfileRepository - PostgreSQL data access for AgentProfile
 */

export interface AgentProfileEntity {
  id: string;
  name: string;
  type: string;
  capabilities: Record<string, unknown>;
  config: Record<string, unknown>;
  status: string;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindAllResult {
  entities: AgentProfileEntity[];
  total: number;
}

export class AgentProfileRepository {
  private db: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async create(data: Omit<AgentProfileEntity, 'id'>): Promise<AgentProfileEntity> {
    const result = await this.db.query(
      `INSERT INTO agent_profiles (name, type, capabilities, config, status, last_active_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.name, data.type, JSON.stringify(data.capabilities), JSON.stringify(data.config), data.status, data.lastActiveAt, data.createdAt, data.updatedAt],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<AgentProfileEntity | null> {
    const result = await this.db.query('SELECT * FROM agent_profiles WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<FindAllResult> {
    const result = await this.db.query('SELECT * FROM agent_profiles ORDER BY created_at DESC');
    return {
      entities: result.rows.map((row: any) => this.mapRow(row)),
      total: result.rowCount ?? result.rows.length,
    };
  }

  async update(id: string, updates: Partial<AgentProfileEntity>): Promise<AgentProfileEntity | null> {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return this.findById(id);

    const setClauses = fields.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(key => {
      const val = updates[key as keyof AgentProfileEntity];
      return typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
    });

    const result = await this.db.query(
      `UPDATE agent_profiles SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM agent_profiles WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): AgentProfileEntity {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities || {},
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config || {},
      status: row.status,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
