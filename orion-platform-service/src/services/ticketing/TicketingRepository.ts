/**
 * TicketingRepository - Database layer for Ticketing operations
 */

import { DatabasePool } from '../database';

export interface Ticket {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  assignee_id: string | null;
  reporter_id: string | null;
  source: string | null;
  source_id: string | null;
  tags: string[];
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  content: string;
  is_internal: boolean;
  created_at: Date;
}

export interface CreateTicketInput {
  tenant_id: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  reporter_id?: string;
  source?: string;
  source_id?: string;
  tags?: string[];
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  assignee_id?: string;
}

export class TicketingRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async findById(id: string): Promise<Ticket | null> {
    return (await this.pool.query('SELECT * FROM tickets WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(options?: { tenantId?: string; status?: string; assigneeId?: string; priority?: string; limit?: number; offset?: number }): Promise<Ticket[]> {
    let query = 'SELECT * FROM tickets';
    const params: any[] = [];
    const conditions: string[] = [];
    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
    if (options?.assigneeId) { params.push(options.assigneeId); conditions.push(`assignee_id = $${params.length}`); }
    if (options?.priority) { params.push(options.priority); conditions.push(`priority = $${params.length}`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }
    return (await this.pool.query(query, params)).rows;
  }

  async count(options?: { tenantId?: string; status?: string; assigneeId?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM tickets';
    const params: any[] = [];
    if (options?.tenantId || options?.status || options?.assigneeId) {
      const conditions: string[] = [];
      if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
      if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
      if (options?.assigneeId) { params.push(options.assigneeId); conditions.push(`assignee_id = $${params.length}`); }
      query += ' WHERE ' + conditions.join(' AND ');
    }
    return parseInt((await this.pool.query(query, params)).rows[0].count, 10);
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const { tenant_id, title, description, type, priority, reporter_id, source, source_id, tags } = input;
    const result = await this.pool.query(
      `INSERT INTO tickets (tenant_id, title, description, type, priority, reporter_id, source, source_id, tags, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open') RETURNING *`,
      [tenant_id, title, description || null, type || 'incident', priority || 'medium', reporter_id || null, source || null, source_id || null, tags || []]
    );
    return result.rows[0];
  }

  async update(id: string, input: UpdateTicketInput): Promise<Ticket | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (input.title !== undefined) { params.push(input.title); updates.push(`title = $${paramIndex++}`); }
    if (input.description !== undefined) { params.push(input.description); updates.push(`description = $${paramIndex++}`); }
    if (input.priority !== undefined) { params.push(input.priority); updates.push(`priority = $${paramIndex++}`); }
    if (input.status !== undefined) { 
      params.push(input.status); 
      updates.push(`status = $${paramIndex++}`); 
      if (input.status === 'resolved') {
        params.push(new Date());
        updates.push(`resolved_at = $${paramIndex++}`);
      }
    }
    if (input.assignee_id !== undefined) { params.push(input.assignee_id); updates.push(`assignee_id = $${paramIndex++}`); }
    if (updates.length === 0) return this.findById(id);
    params.push(id);
    const result = await this.pool.query(`UPDATE tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`, params);
    return result.rows[0] || null;
  }

  async addComment(ticketId: string, authorId: string | null, content: string, isInternal: boolean = false): Promise<TicketComment> {
    const result = await this.pool.query(
      `INSERT INTO ticket_comments (ticket_id, author_id, content, is_internal) VALUES ($1, $2, $3, $4) RETURNING *`,
      [ticketId, authorId, content, isInternal]
    );
    return result.rows[0];
  }

  async getComments(ticketId: string): Promise<TicketComment[]> {
    return (await this.pool.query('SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC', [ticketId])).rows;
  }
}