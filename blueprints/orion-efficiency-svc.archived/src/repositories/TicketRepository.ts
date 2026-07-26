/**
 * Ticket Repository - PostgreSQL data access layer for orion-efficiency-svc
 *
 * Maps camelCase entity fields to snake_case DB columns.
 * Follows the pattern from DeploymentHistoryRepository.
 */

import { Pool } from 'pg';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface TicketEntity {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  assignee: string | null;
  requester: string | null;
  tags: string[];
  slaDeadline: Date | null;
  slaBreached: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolutionTimeMs: number | null;
  metadata: Record<string, unknown> | null;
}

export interface TicketCreateInput {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  requester?: string;
  tags?: string[];
  slaDeadline?: Date;
  metadata?: Record<string, unknown>;
}

export interface TicketStatusUpdate {
  status: string;
  resolvedAt?: Date | null;
  resolutionTimeMs?: number | null;
}

export class TicketRepository {
  private pool: DbClient | null;

  constructor(pool: DbClient | null) {
    this.pool = pool;
  }

  /**
   * Create a new ticket record.
   */
  async create(input: TicketCreateInput): Promise<TicketEntity> {
    const now = new Date();
    const query = `
      INSERT INTO tickets (
        id, title, description, status, priority, category,
        assignee, requester, tags, sla_deadline, sla_breached,
        created_at, updated_at, resolved_at, resolution_time_ms, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const params: unknown[] = [
      input.id,
      input.title,
      input.description ?? null,
      input.status ?? 'open',
      input.priority ?? 'medium',
      input.category ?? 'general',
      input.assignee ?? null,
      input.requester ?? null,
      input.tags ?? [],
      input.slaDeadline ?? null,
      false, // sla_breached
      now,
      now,
      null, // resolved_at
      null, // resolution_time_ms
      input.metadata ? JSON.stringify(input.metadata) : null,
    ];

    const result = await this.pool!.query(query, params);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a ticket by ID.
   */
  async findById(id: string): Promise<TicketEntity | null> {
    const result = await this.pool!.query(
      'SELECT * FROM tickets WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all ticket records with optional filters.
   * Returns entities sorted by created_at DESC.
   */
  async findAll(opts?: { status?: string; category?: string; limit?: number }): Promise<TicketEntity[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (opts?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(opts.status);
      paramIndex++;
    }
    if (opts?.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(opts.category);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts?.limit ?? 100;

    const query = `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool!.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update ticket status and optionally mark as resolved.
   */
  async updateStatus(id: string, update: TicketStatusUpdate): Promise<TicketEntity | null> {
    const setClauses: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [id, update.status];

    if (update.resolvedAt !== undefined) {
      setClauses.push(`resolved_at = $${params.length + 1}`);
      params.push(update.resolvedAt);
    }

    if (update.resolutionTimeMs !== undefined) {
      setClauses.push(`resolution_time_ms = $${params.length + 1}`);
      params.push(update.resolutionTimeMs);
    }

    const query = `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await this.pool!.query(query, params);
    return result.rows.length === 0 ? null : this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Count tickets by status for analytics.
   */
  async countByStatus(status: string): Promise<number> {
    const result = await this.pool!.query(
      'SELECT COUNT(*) as count FROM tickets WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count all tickets.
   */
  async countAll(): Promise<number> {
    const result = await this.pool!.query('SELECT COUNT(*) as count FROM tickets');
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find open tickets that have passed their SLA deadline.
   */
  async findOverdueTickets(): Promise<TicketEntity[]> {
    const result = await this.pool!.query(
      `SELECT * FROM tickets
       WHERE status NOT IN ('resolved', 'closed')
       AND sla_deadline IS NOT NULL
       AND sla_deadline < NOW()
       ORDER BY sla_deadline ASC`
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get resolution time statistics for analytics.
   * Returns array of resolution_time_ms values for resolved tickets.
   */
  async getResolutionTimes(): Promise<number[]> {
    const result = await this.pool!.query(
      `SELECT resolution_time_ms FROM tickets
       WHERE resolved_at IS NOT NULL AND resolution_time_ms IS NOT NULL
       ORDER BY resolution_time_ms ASC`
    );
    return result.rows.map((row) => Number(row.resolution_time_ms));
  }

  /**
   * Get ticket counts grouped by a field (status, priority, category).
   */
  async groupByField(field: 'status' | 'priority' | 'category'): Promise<Record<string, number>> {
    const result = await this.pool!.query(
      `SELECT ${field} as key, COUNT(*) as count FROM tickets GROUP BY ${field}`
    );
    const grouped: Record<string, number> = {};
    for (const row of result.rows) {
      grouped[row.key] = parseInt(row.count, 10);
    }
    return grouped;
  }

  /**
   * Map a database row (snake_case) to the entity (camelCase).
   */
  private mapRowToEntity(row: any): TicketEntity {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      category: row.category,
      assignee: row.assignee,
      requester: row.requester,
      tags: row.tags || [],
      slaDeadline: row.sla_deadline ? new Date(row.sla_deadline) : null,
      slaBreached: row.sla_breached || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
      resolutionTimeMs: row.resolution_time_ms ? Number(row.resolution_time_ms) : null,
      metadata: row.metadata || null,
    };
  }
}
