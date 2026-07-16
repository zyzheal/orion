/**
 * SelfServiceRepository - PostgreSQL persistence for ITSM Self-Service Portal tickets
 *
 * Task 4.41: ITSM Self-Service portal
 *
 * Manages self_service_tickets table with CRUD and query operations.
 * Extends BaseRepository for common CRUD with automatic tenant isolation.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface SelfServiceTicketEntity {
  id: string;
  tenant_id: string;
  requester_id: string;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string;
  assigned_to: string | null;
  resolution: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSelfServiceTicketInput {
  tenantId: string;
  requesterId: string;
  type: string;
  title: string;
  description?: string;
  priority?: string;
  category: string;
  assignedTo?: string;
}

export interface UpdateSelfServiceTicketInput {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  category?: string;
  assignedTo?: string;
  resolution?: string;
}

export class SelfServiceRepository extends BaseRepository<SelfServiceTicketEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'self_service_tickets');
  }

  // ==================== Custom Queries ====================

  /**
   * Find tickets by requester (for "my tickets" queries)
   */
  async findByRequester(requesterId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<FindAllResult<SelfServiceTicketEntity>> {
    const tenantId = this.getTenantId();
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const conditions = ['tenant_id = $1', 'requester_id = $2'];
    const params: unknown[] = [tenantId, requesterId];
    let paramIndex = 3;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = conditions.join(' AND ');
    const countResult = await this.db.query(`SELECT COUNT(*) as count FROM self_service_tickets WHERE ${whereClause}`, params);
    const result = await this.db.query(
      `SELECT * FROM self_service_tickets WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Count tickets by requester
   */
  async countByRequester(requesterId: string, status?: string): Promise<number> {
    const tenantId = this.getTenantId();
    const conditions = ['tenant_id = $1', 'requester_id = $2'];
    const params: unknown[] = [tenantId, requesterId];
    let paramIndex = 3;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const result = await this.db.query(`SELECT COUNT(*) as count FROM self_service_tickets WHERE ${conditions.join(' AND ')}`, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find ticket by ID with requester validation
   */
  async findByIdForRequester(id: string, requesterId: string): Promise<SelfServiceTicketEntity | null> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT * FROM self_service_tickets WHERE id = $1 AND tenant_id = $2 AND requester_id = $3',
      [id, tenantId, requesterId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  // ==================== Row Mapping ====================

  protected mapRowToEntity(row: any): SelfServiceTicketEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      requester_id: row.requester_id,
      type: row.type,
      title: row.title,
      description: row.description,
      priority: row.priority ?? 'medium',
      status: row.status ?? 'pending',
      category: row.category,
      assigned_to: row.assigned_to,
      resolution: row.resolution,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
