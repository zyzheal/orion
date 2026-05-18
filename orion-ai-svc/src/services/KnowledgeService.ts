// orion-ai-svc/src/services/KnowledgeService.ts

import { getPool } from '../utils/database';

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding?: number[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeSearchResult {
  item: KnowledgeItem;
  similarity: number;
}

export class KnowledgeService {
  async create(item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    const pool = getPool();
    const id = crypto.randomUUID();
    const now = new Date();

    await pool.query(
      `INSERT INTO knowledge_items (id, title, content, category, tags, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, item.title, item.content, item.category, JSON.stringify(item.tags), item.createdBy, now, now]
    );

    return { ...item, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> {
    const pool = getPool();
    const now = new Date();

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.title) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.content) {
      fields.push(`content = $${paramIndex++}`);
      values.push(updates.content);
    }
    if (updates.category) {
      fields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.tags) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    if (fields.length > 0) {
      await pool.query(
        `UPDATE knowledge_items SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const pool = getPool();
    await pool.query('DELETE FROM knowledge_items WHERE id = $1', [id]);
    return true;
  }

  async getById(id: string): Promise<KnowledgeItem | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM knowledge_items WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async list(category?: string, limit = 50, offset = 0): Promise<KnowledgeItem[]> {
    const pool = getPool();
    let query = 'SELECT * FROM knowledge_items';
    const params: unknown[] = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async search(query: string, limit = 10): Promise<KnowledgeSearchResult[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT *,
        (CASE WHEN title ILIKE $1 THEN 1.0 ELSE 0.0 END +
         CASE WHEN content ILIKE $1 THEN 0.5 ELSE 0.0 END) as sim
       FROM knowledge_items
       WHERE title ILIKE $1 OR content ILIKE $1
       ORDER BY sim DESC
       LIMIT $2`,
      [`%${query}%`, limit]
    );

    return result.rows.map((row) => ({
      item: {
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
      similarity: parseFloat(row.sim) || 0,
    }));
  }

  async getCategories(): Promise<string[]> {
    const pool = getPool();
    const result = await pool.query('SELECT DISTINCT category FROM knowledge_items ORDER BY category');
    return result.rows.map((r) => r.category);
  }

  async count(category?: string): Promise<number> {
    const pool = getPool();
    if (category) {
      const result = await pool.query('SELECT COUNT(*) FROM knowledge_items WHERE category = $1', [category]);
      return parseInt(result.rows[0].count);
    }
    const result = await pool.query('SELECT COUNT(*) FROM knowledge_items');
    return parseInt(result.rows[0].count);
  }
}

export const knowledgeService = new KnowledgeService();
