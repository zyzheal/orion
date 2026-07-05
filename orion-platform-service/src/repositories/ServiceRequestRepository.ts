/**
 * ServiceRequestRepository - PostgreSQL persistence for Service Requests
 *
 * Manages catalog_requests table with CRUD, query, and SLA breach detection.
 * Extends BaseRepository for common CRUD operations.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface CatalogRequestEntity {
  id: string;
  tenant_id: string;
  service_id: string;
  requester_id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  fulfilled_at: Date | null;
  sla_breach: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CatalogRequestCreateInput {
  id?: string;
  tenantId: string;
  serviceId: string;
  requesterId: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
}

export interface CatalogRequestUpdateInput {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  approvedBy?: string;
  approvedAt?: Date;
  fulfilledAt?: Date;
  slaBreach?: boolean;
}

export interface CatalogTimelineEntity {
  id: string;
  request_id: string;
  tenant_id: string;
  event_type: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  metadata: Record<string, unknown>;
}

export interface CatalogTimelineCreateInput {
  id?: string;
  requestId: string;
  tenantId: string;
  eventType: string;
  description?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export class ServiceRequestRepository extends BaseRepository<CatalogRequestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'catalog_requests');
  }

  /**
   * Create a new service request
   */
  async createRequest(input: CatalogRequestCreateInput): Promise<CatalogRequestEntity> {
    const result = await this.db.query(
      `INSERT INTO catalog_requests (id, tenant_id, service_id, requester_id, title, description, priority, status, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.tenantId,
        input.serviceId,
        input.requesterId,
        input.title,
        input.description || null,
        input.priority || 'medium',
        input.status || 'pending',
        input.assignedTo || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a service request
   */
  async updateRequest(id: string, input: CatalogRequestUpdateInput): Promise<CatalogRequestEntity | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.assignedTo !== undefined) {
      fields.push(`assigned_to = $${paramIndex++}`);
      values.push(input.assignedTo);
    }
    if (input.approvedBy !== undefined) {
      fields.push(`approved_by = $${paramIndex++}`);
      values.push(input.approvedBy);
    }
    if (input.approvedAt !== undefined) {
      fields.push(`approved_at = $${paramIndex++}`);
      values.push(input.approvedAt);
    }
    if (input.fulfilledAt !== undefined) {
      fields.push(`fulfilled_at = $${paramIndex++}`);
      values.push(input.fulfilledAt);
    }
    if (input.slaBreach !== undefined) {
      fields.push(`sla_breach = $${paramIndex++}`);
      values.push(input.slaBreach);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE catalog_requests SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find requests by tenant
   */
  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<FindAllResult<CatalogRequestEntity>> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM catalog_requests WHERE tenant_id = $1`,
      [tenantId],
    );

    const result = await this.db.query(
      `SELECT * FROM catalog_requests WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Find requests by service ID
   */
  async findByService(serviceId: string, options?: { limit?: number; offset?: number }): Promise<FindAllResult<CatalogRequestEntity>> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM catalog_requests WHERE service_id = $1`,
      [serviceId],
    );

    const result = await this.db.query(
      `SELECT * FROM catalog_requests WHERE service_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [serviceId, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Find requests by requester ID
   */
  async findByRequester(tenantId: string, requesterId: string): Promise<CatalogRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_requests WHERE tenant_id = $1 AND requester_id = $2 ORDER BY created_at DESC`,
      [tenantId, requesterId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find requests by status
   */
  async findByStatus(tenantId: string, status: string): Promise<CatalogRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_requests WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC`,
      [tenantId, status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find requests with SLA breach
   */
  async findSlaBreaches(tenantId: string): Promise<CatalogRequestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_requests WHERE tenant_id = $1 AND sla_breach = true ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Mark requests as SLA breach based on service SLA tier
   */
  async detectSlaBreaches(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE catalog_requests cr
       SET sla_breach = true, updated_at = NOW()
       FROM catalog_services cs
       WHERE cr.service_id = cs.id
         AND cr.tenant_id = $1
         AND cr.sla_breach = false
         AND cr.status NOT IN ('fulfilled', 'rejected', 'cancelled')
         AND cs.sla_tier IS NOT NULL
         AND (
           (cs.sla_tier = 'gold' AND cr.created_at < NOW() - INTERVAL '4 hours')
           OR (cs.sla_tier = 'silver' AND cr.created_at < NOW() - INTERVAL '8 hours')
           OR (cs.sla_tier = 'bronze' AND cr.created_at < NOW() - INTERVAL '24 hours')
         )
       RETURNING cr.id`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get request statistics for a tenant
   */
  async getStats(tenantId: string): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT status, COUNT(*)::int as count FROM catalog_requests WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );
    const stats: Record<string, number> = {
      total: 0,
      pending: 0,
      approved: 0,
      in_progress: 0,
      fulfilled: 0,
      rejected: 0,
      cancelled: 0,
    };
    for (const row of result.rows) {
      stats[row.status] = row.count;
      stats.total += row.count;
    }
    return stats;
  }

  protected mapRowToEntity(row: any): CatalogRequestEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      service_id: row.service_id,
      requester_id: row.requester_id,
      title: row.title,
      description: row.description,
      priority: row.priority ?? 'medium',
      status: row.status ?? 'pending',
      assigned_to: row.assigned_to,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      fulfilled_at: row.fulfilled_at,
      sla_breach: row.sla_breach ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Timeline Repository ====================

export class CatalogTimelineRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  /**
   * Create a timeline event
   */
  async createEvent(input: CatalogTimelineCreateInput): Promise<CatalogTimelineEntity> {
    const result = await this.db.query(
      `INSERT INTO catalog_request_timeline (id, request_id, tenant_id, event_type, description, created_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.requestId,
        input.tenantId,
        input.eventType,
        input.description || null,
        input.createdBy || null,
        JSON.stringify(input.metadata || {}),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find timeline events by request ID
   */
  async findByRequestId(requestId: string): Promise<CatalogTimelineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM catalog_request_timeline WHERE request_id = $1 ORDER BY created_at ASC`,
      [requestId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find timeline events by tenant
   */
  async findByTenant(tenantId: string, options?: { limit?: number; offset?: number }): Promise<CatalogTimelineEntity[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const result = await this.db.query(
      `SELECT * FROM catalog_request_timeline WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  private mapRowToEntity(row: any): CatalogTimelineEntity {
    return {
      id: row.id,
      request_id: row.request_id,
      tenant_id: row.tenant_id,
      event_type: row.event_type,
      description: row.description,
      created_by: row.created_by,
      created_at: row.created_at,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    };
  }
}
