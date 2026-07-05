import type {
  Contribution,
  ContributionType,
  ContributionStatus,
} from '../types/community';
import type { IDbAdapter } from './IDbAdapter';

export class ContributionRepository {
  constructor(private pool: IDbAdapter) {}

  async create(entity: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt' | 'downloadsCount' | 'starsCount'>): Promise<Contribution> {
    const result = await this.pool.query(
      `INSERT INTO contributions (author_id, author_name, type, title, description, repository_url, documentation_url, version, status, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [entity.authorId, entity.authorName, entity.type, entity.title, entity.description ?? null, entity.repositoryUrl ?? null, entity.documentationUrl ?? null, entity.version, entity.status, JSON.stringify(entity.tags ?? [])],
    );
    return this.rowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Contribution | null> {
    const result = await this.pool.query('SELECT * FROM contributions WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async findByAuthor(authorId: string): Promise<Contribution[]> {
    const result = await this.pool.query(
      'SELECT * FROM contributions WHERE author_id = $1 ORDER BY created_at DESC',
      [authorId],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findAll(_tenantId: string, filters?: { type?: string; status?: string }): Promise<Contribution[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.type) { conditions.push(`type = $${idx++}`); values.push(filters.type); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM contributions ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async update(id: string, updates: Partial<Contribution>): Promise<Contribution | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.type !== undefined) { fields.push(`type = $${idx++}`); values.push(updates.type); }
    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.repositoryUrl !== undefined) { fields.push(`repository_url = $${idx++}`); values.push(updates.repositoryUrl); }
    if (updates.documentationUrl !== undefined) { fields.push(`documentation_url = $${idx++}`); values.push(updates.documentationUrl); }
    if (updates.version !== undefined) { fields.push(`version = $${idx++}`); values.push(updates.version); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(JSON.stringify(updates.tags)); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE contributions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM contributions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToEntity(row: Record<string, unknown>): Contribution {
    return {
      id: row.id as string,
      authorId: row.author_id as string,
      authorName: row.author_name as string,
      type: row.type as ContributionType,
      title: row.title as string,
      description: row.description as string | undefined,
      repositoryUrl: row.repository_url as string | undefined,
      documentationUrl: row.documentation_url as string | undefined,
      version: row.version as string,
      status: row.status as ContributionStatus,
      tags: this.parseTags(row.tags),
      downloadsCount: Number(row.downloads_count ?? 0),
      starsCount: Number(row.stars_count ?? 0),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private parseTags(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return []; }
    }
    return [];
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    return new Date().toISOString();
  }
}
