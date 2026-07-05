/**
 * Problem Management Repositories
 *
 * ProblemRepository: ITIL problem records with lifecycle management
 * KnownErrorRepository: Known Error Database (KEDB) with full-text search
 */

import { BaseRepository } from '../db/base-repository';

// ==================== Entity Types ====================

export interface ProblemEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  category: string | null;
  rootCause: string | null;
  workaround: string | null;
  resolution: string | null;
  relatedIncidents: any[];
  relatedChanges: any[];
  assignedTo: string | null;
  createdBy: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnownErrorEntity {
  id: string;
  tenantId: string;
  problemId: string | null;
  title: string;
  symptoms: string;
  rootCause: string;
  workaround: string;
  permanentFix: string | null;
  status: string;
  affectedServices: any[];
  keywords: string[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProblemFilters {
  status?: string;
  severity?: string;
  assignedTo?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface KnownErrorFilters {
  status?: string;
  problemId?: string;
  limit?: number;
  offset?: number;
}

export interface ProblemStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
}

// ==================== ProblemRepository ====================

export class ProblemRepository extends BaseRepository<ProblemEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'problems');
  }

  async findByTenant(tenantId: string, filters: ProblemFilters = {}): Promise<{ entities: ProblemEntity[]; total: number }> {
    const { status, severity, assignedTo, category, limit = 20, offset = 0 } = filters;

    let query = `SELECT * FROM problems WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    if (assignedTo) {
      query += ` AND assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ProblemEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM problems WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, tenantId: string): Promise<ProblemEntity | null> {
    const extraFields: string[] = [];
    if (status === 'resolved') {
      extraFields.push(`resolved_at = NOW()`);
    } else if (status === 'closed') {
      extraFields.push(`closed_at = NOW()`);
    }

    const setClauses = [`status = $1`, `updated_at = NOW()`, ...extraFields];
    const query = `
      UPDATE problems
      SET ${setClauses.join(', ')}
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await this.db.query(query, [status, id, tenantId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async addIncident(problemId: string, incidentId: string, tenantId: string): Promise<ProblemEntity | null> {
    const query = `
      UPDATE problems
      SET related_incidents = related_incidents || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await this.db.query(query, [JSON.stringify(incidentId), problemId, tenantId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async addChange(problemId: string, changeId: string, tenantId: string): Promise<ProblemEntity | null> {
    const query = `
      UPDATE problems
      SET related_changes = related_changes || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await this.db.query(query, [JSON.stringify(changeId), problemId, tenantId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async getStats(tenantId: string): Promise<ProblemStats> {
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM problems WHERE tenant_id = $1`,
      [tenantId],
    );

    const statusResult = await this.db.query(
      `SELECT status, COUNT(*) as count FROM problems WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );

    const severityResult = await this.db.query(
      `SELECT severity, COUNT(*) as count FROM problems WHERE tenant_id = $1 GROUP BY severity`,
      [tenantId],
    );

    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    const bySeverity: Record<string, number> = {};
    for (const row of severityResult.rows) {
      bySeverity[row.severity] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      byStatus,
      bySeverity,
    };
  }

  protected mapRowToEntity(row: any): ProblemEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      status: row.status,
      severity: row.severity,
      category: row.category,
      rootCause: row.root_cause,
      workaround: row.workaround,
      resolution: row.resolution,
      relatedIncidents: row.related_incidents ?? [],
      relatedChanges: row.related_changes ?? [],
      assignedTo: row.assigned_to,
      createdBy: row.created_by,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== KnownErrorRepository ====================

export class KnownErrorRepository extends BaseRepository<KnownErrorEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'known_errors');
  }

  async findByTenant(tenantId: string, filters: KnownErrorFilters = {}): Promise<{ entities: KnownErrorEntity[]; total: number }> {
    const { status, problemId, limit = 20, offset = 0 } = filters;

    let query = `SELECT * FROM known_errors WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (problemId) {
      query += ` AND problem_id = $${paramIndex}`;
      params.push(problemId);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<KnownErrorEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM known_errors WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async search(tenantId: string, query: string): Promise<KnownErrorEntity[]> {
    const searchQuery = `
      SELECT * FROM known_errors
      WHERE tenant_id = $1
        AND (
          symptoms ILIKE $2
          OR root_cause ILIKE $2
          OR workaround ILIKE $2
          OR title ILIKE $2
        )
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const pattern = `%${query}%`;
    const result = await this.db.query(searchQuery, [tenantId, pattern]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByKeywords(tenantId: string, keywords: string[]): Promise<KnownErrorEntity[]> {
    const searchQuery = `
      SELECT * FROM known_errors
      WHERE tenant_id = $1
        AND keywords && $2
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const result = await this.db.query(searchQuery, [tenantId, keywords]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): KnownErrorEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      problemId: row.problem_id,
      title: row.title,
      symptoms: row.symptoms,
      rootCause: row.root_cause,
      workaround: row.workaround,
      permanentFix: row.permanent_fix,
      status: row.status,
      affectedServices: row.affected_services ?? [],
      keywords: row.keywords ?? [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
