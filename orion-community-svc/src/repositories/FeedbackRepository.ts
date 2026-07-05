import type { Feedback, FeedbackStatus, FeedbackSeverity } from '../types/community';
import type { IDbAdapter } from './IDbAdapter';

export class FeedbackRepository {
  constructor(private pool: IDbAdapter) {}

  async create(entity: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt'>): Promise<Feedback> {
    const result = await this.pool.query(
      `INSERT INTO feedback (target_id, target_type, user_id, user_name, type, content, severity, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [entity.targetId, entity.targetType, entity.userId, entity.userName, entity.type, entity.content, entity.severity, entity.status],
    );
    return this.rowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Feedback | null> {
    const result = await this.pool.query('SELECT * FROM feedback WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async findByTarget(targetId: string): Promise<Feedback[]> {
    const result = await this.pool.query(
      'SELECT * FROM feedback WHERE target_id = $1 ORDER BY created_at DESC',
      [targetId],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findByUser(userId: string): Promise<Feedback[]> {
    const result = await this.pool.query(
      'SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findAll(filters?: { targetId?: string; status?: string; severity?: string }): Promise<Feedback[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.targetId) { conditions.push(`target_id = $${idx++}`); values.push(filters.targetId); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }
    if (filters?.severity) { conditions.push(`severity = $${idx++}`); values.push(filters.severity); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM feedback ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async update(id: string, updates: Partial<Feedback>): Promise<Feedback | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.type !== undefined) { fields.push(`type = $${idx++}`); values.push(updates.type); }
    if (updates.content !== undefined) { fields.push(`content = $${idx++}`); values.push(updates.content); }
    if (updates.severity !== undefined) { fields.push(`severity = $${idx++}`); values.push(updates.severity); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.resolution !== undefined) { fields.push(`resolution = $${idx++}`); values.push(updates.resolution); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE feedback SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: FeedbackStatus, resolution?: string): Promise<Feedback | null> {
    if (resolution) {
      const result = await this.pool.query(
        'UPDATE feedback SET status = $1, resolution = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [status, resolution, id],
      );
      return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
    }
    const result = await this.pool.query(
      'UPDATE feedback SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    );
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM feedback WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToEntity(row: Record<string, unknown>): Feedback {
    return {
      id: row.id as string,
      targetId: row.target_id as string,
      targetType: row.target_type as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      type: row.type as string,
      content: row.content as string,
      severity: row.severity as FeedbackSeverity,
      status: row.status as FeedbackStatus,
      resolution: row.resolution as string | undefined,
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
