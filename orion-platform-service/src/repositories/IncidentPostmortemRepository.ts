/**
 * IncidentPostmortemRepository - PostgreSQL persistence for Incident Postmortems
 *
 * Extends BaseRepository for common CRUD operations.
 * Provides postmortem lifecycle management (draft → published → archived).
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface IncidentPostmortemEntity {
  id: string;
  incident_id: string;
  tenant_id: string;
  title: string | null;
  summary: string;
  root_cause: string;
  contributing_factors: string[];
  impact_description: string | null;
  timeline: unknown[];
  timeline_summary: string | null;
  action_items: unknown[];
  lessons_learned: string | null;
  status: string;
  created_by: string | null;
  reviewed_by: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PostmortemCreateInput {
  id?: string;
  incident_id: string;
  tenant_id: string;
  title?: string;
  summary: string;
  root_cause: string;
  contributing_factors?: string[];
  impact_description?: string;
  timeline?: unknown[];
  timeline_summary?: string;
  action_items?: unknown[];
  lessons_learned?: string;
  created_by?: string;
}

export interface PostmortemUpdateInput {
  title?: string;
  summary?: string;
  root_cause?: string;
  contributing_factors?: string[];
  impact_description?: string;
  timeline?: unknown[];
  timeline_summary?: string;
  action_items?: unknown[];
  lessons_learned?: string;
}

export class IncidentPostmortemRepository extends BaseRepository<IncidentPostmortemEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'incident_postmortems');
  }

  /**
   * Create a new postmortem (draft status)
   */
  async createPostmortem(input: PostmortemCreateInput): Promise<IncidentPostmortemEntity> {
    const result = await this.db.query(
      `INSERT INTO incident_postmortems
       (id, incident_id, tenant_id, title, summary, root_cause, contributing_factors,
        impact_description, timeline, timeline_summary, action_items, lessons_learned, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.incident_id,
        input.tenant_id,
        input.title || null,
        input.summary,
        input.root_cause,
        JSON.stringify(input.contributing_factors || []),
        input.impact_description || null,
        JSON.stringify(input.timeline || []),
        input.timeline_summary || null,
        JSON.stringify(input.action_items || []),
        input.lessons_learned || null,
        input.created_by || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find postmortem by incident ID (one-to-one relationship)
   */
  async findByIncident(incidentId: string): Promise<IncidentPostmortemEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM incident_postmortems WHERE incident_id = $1`,
      [incidentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all postmortems for a tenant with filtering
   */
  async findByTenant(tenantId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<FindAllResult<IncidentPostmortemEntity>> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let query = 'SELECT * FROM incident_postmortems WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    // Count query
    const countResult = await this.db.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as count'),
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  /**
   * Update postmortem content (only in draft status)
   */
  async updatePostmortem(id: string, input: PostmortemUpdateInput): Promise<IncidentPostmortemEntity | undefined> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      params.push(input.title);
      updates.push(`title = $${paramIndex++}`);
    }
    if (input.summary !== undefined) {
      params.push(input.summary);
      updates.push(`summary = $${paramIndex++}`);
    }
    if (input.root_cause !== undefined) {
      params.push(input.root_cause);
      updates.push(`root_cause = $${paramIndex++}`);
    }
    if (input.contributing_factors !== undefined) {
      params.push(JSON.stringify(input.contributing_factors));
      updates.push(`contributing_factors = $${paramIndex++}`);
    }
    if (input.impact_description !== undefined) {
      params.push(input.impact_description);
      updates.push(`impact_description = $${paramIndex++}`);
    }
    if (input.timeline !== undefined) {
      params.push(JSON.stringify(input.timeline));
      updates.push(`timeline = $${paramIndex++}`);
    }
    if (input.timeline_summary !== undefined) {
      params.push(input.timeline_summary);
      updates.push(`timeline_summary = $${paramIndex++}`);
    }
    if (input.action_items !== undefined) {
      params.push(JSON.stringify(input.action_items));
      updates.push(`action_items = $${paramIndex++}`);
    }
    if (input.lessons_learned !== undefined) {
      params.push(input.lessons_learned);
      updates.push(`lessons_learned = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      const found = await this.findById(id);
      return found ?? undefined;
    }

    params.push(id);

    const result = await this.db.query(
      `UPDATE incident_postmortems SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Publish a postmortem (draft → published)
   */
  async publish(id: string, reviewedBy?: string): Promise<IncidentPostmortemEntity | undefined> {
    const result = await this.db.query(
      `UPDATE incident_postmortems
       SET status = 'published', published_at = NOW(), reviewed_by = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id, reviewedBy || null],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Archive a postmortem (published → archived)
   */
  async archive(id: string): Promise<IncidentPostmortemEntity | undefined> {
    const result = await this.db.query(
      `UPDATE incident_postmortems
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND status = 'published'
       RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): IncidentPostmortemEntity {
    return {
      id: row.id,
      incident_id: row.incident_id,
      tenant_id: row.tenant_id,
      title: row.title ?? null,
      summary: row.summary,
      root_cause: row.root_cause,
      contributing_factors: typeof row.contributing_factors === 'string'
        ? JSON.parse(row.contributing_factors)
        : (row.contributing_factors ?? []),
      impact_description: row.impact_description ?? null,
      timeline: typeof row.timeline === 'string'
        ? JSON.parse(row.timeline)
        : (row.timeline ?? []),
      timeline_summary: row.timeline_summary ?? null,
      action_items: typeof row.action_items === 'string'
        ? JSON.parse(row.action_items)
        : (row.action_items ?? []),
      lessons_learned: row.lessons_learned ?? null,
      status: row.status ?? 'draft',
      created_by: row.created_by ?? null,
      reviewed_by: row.reviewed_by ?? null,
      published_at: row.published_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
