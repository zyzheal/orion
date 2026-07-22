/**
 * ReviewRuleRepository
 * Review Rule data access layer (ai-review)
 */

import { BaseRepository } from '../db/base-repository';
import { NotFoundError } from '../errors';

export interface ReviewRuleEntity {
  id: string;
  name: string;
  category: string;
  severity: string;
  pattern: string;
  description: string;
  suggestion: string | null;
  enabled: boolean;
  fileExtensions: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewRuleRepository extends BaseRepository<ReviewRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'review_rules');
  }

  async findByCategory(category: string): Promise<ReviewRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM review_rules WHERE category = $1 ORDER BY created_at DESC`,
      [category],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySeverity(severity: string): Promise<ReviewRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM review_rules WHERE severity = $1 ORDER BY created_at DESC`,
      [severity],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<ReviewRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM review_rules WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsert(rule: Partial<ReviewRuleEntity> & { id: string }): Promise<ReviewRuleEntity> {
    const result = await this.db.query(
      `INSERT INTO review_rules (id, name, category, severity, pattern, description, suggestion, enabled, file_extensions, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         severity = EXCLUDED.severity,
         pattern = EXCLUDED.pattern,
         description = EXCLUDED.description,
         suggestion = EXCLUDED.suggestion,
         enabled = EXCLUDED.enabled,
         file_extensions = EXCLUDED.file_extensions,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        rule.id,
        rule.name,
        rule.category,
        rule.severity,
        rule.pattern,
        rule.description,
        rule.suggestion ?? null,
        rule.enabled ?? true,
        rule.fileExtensions ?? [],
        JSON.stringify(rule.metadata ?? {}),
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('ReviewRule', rule.id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async setEnabled(id: string, enabled: boolean): Promise<ReviewRuleEntity> {
    const result = await this.db.query(
      `UPDATE review_rules SET enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, enabled],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('ReviewRule', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ReviewRuleEntity {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      severity: row.severity,
      pattern: row.pattern,
      description: row.description,
      suggestion: row.suggestion,
      enabled: row.enabled,
      fileExtensions: row.file_extensions || [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
