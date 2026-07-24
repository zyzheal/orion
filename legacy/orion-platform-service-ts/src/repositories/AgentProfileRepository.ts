import { BaseRepository } from '../db/base-repository';

export interface AgentProfileEntity {
  id: string;
  name: string;
  type: string;
  capabilities: Record<string, any>;
  config: Record<string, any>;
  status: string;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentProfileRepository extends BaseRepository<AgentProfileEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'agent_profiles');
  }

  async findByType(type: string): Promise<AgentProfileEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_profiles WHERE type = $1 ORDER BY created_at DESC`,
      [type],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(): Promise<AgentProfileEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_profiles WHERE status = 'active' ORDER BY last_active_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateCapabilities(id: string, capabilities: Record<string, any>): Promise<void> {
    await this.db.query(
      `UPDATE agent_profiles SET capabilities = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(capabilities), id],
    );
  }

  async updateStatus(id: string, status: string, lastActiveAt?: Date): Promise<void> {
    const query = lastActiveAt
      ? `UPDATE agent_profiles SET status = $1, last_active_at = $2, updated_at = NOW() WHERE id = $3`
      : `UPDATE agent_profiles SET status = $1, updated_at = NOW() WHERE id = $2`;
    const params = lastActiveAt ? [status, lastActiveAt, id] : [status, id];
    await this.db.query(query, params);
  }

  protected mapRowToEntity(row: any): AgentProfileEntity {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      capabilities: row.capabilities ?? {},
      config: row.config ?? {},
      status: row.status ?? 'inactive',
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}