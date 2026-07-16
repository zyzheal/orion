/**
 * IncidentTimelineRepository - PostgreSQL persistence for Incident Timeline Events
 *
 * Extends BaseRepository for common CRUD operations.
 * Provides incident-specific queries for timeline event management.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface IncidentTimelineEntity {
  id: string;
  incident_id: string;
  tenant_id: string;
  event_type: string;
  actor_id: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface TimelineEventCreateInput {
  id?: string;
  incident_id: string;
  tenant_id: string;
  event_type: string;
  actor_id?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
}

export class IncidentTimelineRepository extends BaseRepository<IncidentTimelineEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'incident_timeline');
  }

  /**
   * Create a new timeline event
   */
  async createEvent(input: TimelineEventCreateInput): Promise<IncidentTimelineEntity> {
    const result = await this.db.query(
      `INSERT INTO incident_timeline (id, incident_id, tenant_id, event_type, actor_id, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.incident_id,
        input.tenant_id,
        input.event_type,
        input.actor_id || null,
        input.content,
        JSON.stringify(input.metadata || {}),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all timeline events for an incident, ordered chronologically
   */
  async findByIncident(incidentId: string, options?: { limit?: number; offset?: number }): Promise<IncidentTimelineEntity[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const result = await this.db.query(
      `SELECT * FROM incident_timeline
       WHERE incident_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [incidentId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Count timeline events for an incident
   */
  async countByIncident(incidentId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM incident_timeline WHERE incident_id = $1`,
      [incidentId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find timeline events by type for an incident
   */
  async findByType(incidentId: string, eventType: string): Promise<IncidentTimelineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM incident_timeline
       WHERE incident_id = $1 AND event_type = $2
       ORDER BY created_at ASC`,
      [incidentId, eventType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all timeline events for a tenant with filtering
   */
  async findByTenant(tenantId: string, options?: {
    eventType?: string;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<IncidentTimelineEntity[]> {
    let query = 'SELECT * FROM incident_timeline WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(options.eventType);
      paramIndex++;
    }

    if (options?.since) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.since);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): IncidentTimelineEntity {
    return {
      id: row.id,
      incident_id: row.incident_id,
      tenant_id: row.tenant_id,
      event_type: row.event_type,
      actor_id: row.actor_id ?? null,
      content: row.content,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      created_at: row.created_at,
    };
  }
}
