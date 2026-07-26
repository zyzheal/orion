/**
 * DispatchQueueRepository - PostgreSQL backed repository for the dispatch_queue table.
 *
 * Maps the in-memory DispatchQueueEntry to the dispatch_queue DB table.
 * Additional fields (ticket data, priority, slaDeadline, etc.) are stored as JSONB
 * in the candidates column to avoid schema changes.
 */

import { DatabasePool } from '../utils/database';
import { Ticket, TicketPriority } from '../types/ticketing';

export interface DispatchQueueRow {
  id: string;
  tenant_id: string;
  ticket_id: string;
  strategy: string;
  status: string;
  candidates: Record<string, unknown> | null;
  selected_assignee: string | null;
  dispatched_at: Date | null;
  accepted_at: Date | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  escalation_level: number;
  max_escalation_level: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Internal payload stored in the candidates JSONB column.
 * Holds fields that the in-memory entry has but the DB table lacks.
 */
export interface DispatchQueuePayload {
  ticket: Ticket;
  dispatchPriority: number;
  enqueuedAt: Date;
  slaDeadline?: Date;
  reprioritizeCount: number;
  dispatchAttemptCount: number;
}

export class DispatchQueueRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Insert a new dispatch queue entry.
   */
  async create(entry: {
    id: string;
    tenantId: string;
    ticketId: string;
    strategy?: string;
    status?: string;
    payload: DispatchQueuePayload;
  }): Promise<DispatchQueueRow> {
    const result = await this.pool.query(
      `INSERT INTO dispatch_queue (
        id, tenant_id, ticket_id, strategy, status, candidates,
        escalation_level, max_escalation_level, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        entry.id,
        entry.tenantId,
        entry.ticketId,
        entry.strategy || 'round_robin',
        entry.status || 'pending',
        JSON.stringify(entry.payload),
        0,
        3,
      ]
    );
    return result.rows[0] as DispatchQueueRow;
  }

  /**
   * Delete a dispatch queue entry by ID.
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM dispatch_queue WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find a dispatch queue entry by ID.
   */
  async findById(id: string): Promise<DispatchQueueRow | null> {
    const result = await this.pool.query(
      'SELECT * FROM dispatch_queue WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? (result.rows[0] as DispatchQueueRow) : null;
  }

  /**
   * Find a dispatch queue entry by ticket ID (maps to DQ-{ticketId} key).
   */
  async findByQueueId(queueId: string): Promise<DispatchQueueRow | null> {
    const result = await this.pool.query(
      'SELECT * FROM dispatch_queue WHERE id = $1',
      [queueId]
    );
    return result.rows.length > 0 ? (result.rows[0] as DispatchQueueRow) : null;
  }

  /**
   * Get all pending dispatch queue entries, ordered by dispatchPriority ASC.
   */
  async findAllPending(): Promise<DispatchQueueRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM dispatch_queue
       WHERE status = 'pending'
       ORDER BY (candidates->>'dispatchPriority')::INTEGER ASC, created_at ASC`
    );
    return result.rows as DispatchQueueRow[];
  }

  /**
   * Get all dispatch queue entries (any status).
   */
  async findAll(): Promise<DispatchQueueRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM dispatch_queue ORDER BY (candidates->>'dispatchPriority')::INTEGER ASC, created_at ASC`
    );
    return result.rows as DispatchQueueRow[];
  }

  /**
   * Count pending entries.
   */
  async countPending(): Promise<number> {
    const result = await this.pool.query(
      "SELECT COUNT(*) as count FROM dispatch_queue WHERE status = 'pending'"
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Update the payload (candidates JSONB) for a queue entry.
   * Used for reprioritize, dispatch attempt recording, etc.
   */
  async updatePayload(id: string, payload: DispatchQueuePayload): Promise<void> {
    await this.pool.query(
      `UPDATE dispatch_queue
       SET candidates = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(payload), id]
    );
  }

  /**
   * Update the status of a queue entry.
   */
  async updateStatus(id: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE dispatch_queue
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, id]
    );
  }

  /**
   * Mark an entry as dispatched (sets status, dispatched_at, selected_assignee).
   */
  async markDispatched(id: string, assignee?: string): Promise<void> {
    await this.pool.query(
      `UPDATE dispatch_queue
       SET status = 'dispatched',
           dispatched_at = NOW(),
           selected_assignee = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [assignee || null, id]
    );
  }

  /**
   * Clear all entries (for testing).
   */
  async clearAll(): Promise<void> {
    await this.pool.query('DELETE FROM dispatch_queue');
  }

  /**
   * Parse the candidates JSONB into a DispatchQueuePayload.
   */
  static parsePayload(row: DispatchQueueRow): DispatchQueuePayload | null {
    if (!row.candidates) return null;
    const raw = typeof row.candidates === 'string'
      ? JSON.parse(row.candidates)
      : row.candidates;

    return {
      ticket: raw.ticket as Ticket,
      dispatchPriority: Number(raw.dispatchPriority) ?? 3,
      enqueuedAt: raw.enqueuedAt ? new Date(raw.enqueuedAt) : (row.created_at ? new Date(row.created_at) : new Date()),
      slaDeadline: raw.slaDeadline ? new Date(raw.slaDeadline) : undefined,
      reprioritizeCount: Number(raw.reprioritizeCount) ?? 0,
      dispatchAttemptCount: Number(raw.dispatchAttemptCount) ?? 0,
    };
  }
}
