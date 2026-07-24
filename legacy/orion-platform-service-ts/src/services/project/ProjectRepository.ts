import { DatabasePool } from '../database';
/**
 * ProjectRepository - Database layer for Project operations
 */

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
  constructor(private pool: DatabasePool) {}

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

  async update(id: string, input: { name?: string; description?: string }): Promise<Project | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(input.name);
      const slug = (input.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      updates.push(`slug = $${idx++}`);
      params.push(slug);
    }
    if (input.description !== undefined) { updates.push(`description = $${idx++}`); params.push(input.description); }
    if (updates.length === 0) return this.findById(id);
    params.push(id);
    const result = await this.pool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}