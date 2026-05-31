/**
 * DiagnosticPatternRepository
 * Data access layer for diagnostic patterns (knowledge base).
 * Replaces in-memory Map<string, DiagnosticPattern> in DiagnosticKnowledgeBase.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';
import { DiagnosticPattern, SymptomPattern, DiagnosticCategory } from '../services/diagnostic/types';

export interface DiagnosticPatternEntity {
  id: string;
  tenantId: string;
  name: string;
  symptoms: SymptomPattern[];
  rootCause: string;
  solution: string;
  frequency: number;
  lastMatched?: Date;
  category: DiagnosticCategory;
  averageConfidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DiagnosticPatternRepository extends BaseRepository<DiagnosticPatternEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'diagnostic_patterns');
  }

  async create(data: any): Promise<DiagnosticPatternEntity> {
    const columns = ['id', 'tenant_id', 'name', 'symptoms', 'root_cause', 'solution', 'frequency', 'category', 'average_confidence'];
    const values = [
      data.id,
      data.tenantId || 'default',
      data.name,
      JSON.stringify(data.symptoms || []),
      data.rootCause || '',
      data.solution || '',
      data.frequency || 0,
      data.category || 'infrastructure',
      data.averageConfidence || 0,
    ];

    if (data.lastMatched) {
      columns.push('last_matched');
      values.push(data.lastMatched);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByCategory(category: string, tenantId?: string): Promise<DiagnosticPatternEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE category = $1`;
    const params: any[] = [category];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY frequency DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, limit: number = 100): Promise<DiagnosticPatternEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY frequency DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async searchByKeyword(keyword: string, tenantId?: string): Promise<DiagnosticPatternEntity[]> {
    const lowerKeyword = `%${keyword.toLowerCase()}%`;
    let query = `SELECT * FROM ${this.tableName} WHERE (LOWER(name) LIKE $1 OR LOWER(root_cause) LIKE $1 OR LOWER(solution) LIKE $1)`;
    const params: any[] = [lowerKeyword];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY frequency DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async incrementFrequency(id: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.tableName} SET frequency = frequency + 1, last_matched = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async updateConfidence(id: string, averageConfidence: number): Promise<void> {
    await this.db.query(
      `UPDATE ${this.tableName} SET average_confidence = $1, updated_at = NOW() WHERE id = $2`,
      [averageConfidence, id],
    );
  }

  protected mapRowToEntity(row: any): DiagnosticPatternEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      symptoms: (row.symptoms || []) as SymptomPattern[],
      rootCause: row.root_cause,
      solution: row.solution,
      frequency: parseInt(row.frequency, 10),
      lastMatched: row.last_matched ? new Date(row.last_matched) : undefined,
      category: row.category,
      averageConfidence: parseInt(row.average_confidence, 10),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
