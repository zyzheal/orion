/**
 * ProjectRepository - Database layer for Project operations
 */
import { DatabasePool } from '../database';

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  slug: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class ProjectRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async findById(id: string): Promise<Project | null> {
    return (await this.pool.query('SELECT * FROM projects WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(tenantId: string): Promise<Project[]> {
    return (await this.pool.query('SELECT * FROM projects WHERE tenant_id = $1', [tenantId])).rows;
  }

  async create(tenantId: string, name: string, description?: string): Promise<Project> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const result = await this.pool.query(
      'INSERT INTO projects (tenant_id, name, description, slug, status) VALUES ($1, $2, $3, $4, \'active\') RETURNING *',
      [tenantId, name, description || null, slug]
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM projects WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
}