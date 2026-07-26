import type { Review, ReviewStatus } from '../types/community';
import type { IDbAdapter } from './IDbAdapter';

export class ReviewRepository {
  constructor(private pool: IDbAdapter) {}

  async create(entity: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<Review> {
    const result = await this.pool.query(
      `INSERT INTO reviews (target_id, target_type, reviewer_id, reviewer_name, rating, title, content, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [entity.targetId, entity.targetType, entity.reviewerId, entity.reviewerName, entity.rating, entity.title ?? null, entity.content ?? null, entity.status ?? 'published'],
    );
    return this.rowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Review | null> {
    const result = await this.pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async findByTarget(targetId: string): Promise<Review[]> {
    const result = await this.pool.query(
      'SELECT * FROM reviews WHERE target_id = $1 ORDER BY created_at DESC',
      [targetId],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findByTargetAndType(targetId: string, targetType: string): Promise<Review[]> {
    const result = await this.pool.query(
      'SELECT * FROM reviews WHERE target_id = $1 AND target_type = $2 ORDER BY created_at DESC',
      [targetId, targetType],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findByReviewer(reviewerId: string): Promise<Review[]> {
    const result = await this.pool.query(
      'SELECT * FROM reviews WHERE reviewer_id = $1 ORDER BY created_at DESC',
      [reviewerId],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findAll(filters?: { targetId?: string; targetType?: string; reviewerId?: string; status?: string }): Promise<Review[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.targetId) { conditions.push(`target_id = $${idx++}`); values.push(filters.targetId); }
    if (filters?.targetType) { conditions.push(`target_type = $${idx++}`); values.push(filters.targetType); }
    if (filters?.reviewerId) { conditions.push(`reviewer_id = $${idx++}`); values.push(filters.reviewerId); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM reviews ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async update(id: string, updates: Partial<Review>): Promise<Review | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.rating !== undefined) { fields.push(`rating = $${idx++}`); values.push(updates.rating); }
    if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.content !== undefined) { fields.push(`content = $${idx++}`); values.push(updates.content); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE reviews SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToEntity(row: Record<string, unknown>): Review {
    return {
      id: row.id as string,
      targetId: row.target_id as string,
      targetType: row.target_type as string,
      reviewerId: row.reviewer_id as string,
      reviewerName: row.reviewer_name as string,
      rating: Number(row.rating),
      title: row.title as string | undefined,
      content: row.content as string | undefined,
      status: row.status as ReviewStatus,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    return new Date().toISOString();
  }
}
