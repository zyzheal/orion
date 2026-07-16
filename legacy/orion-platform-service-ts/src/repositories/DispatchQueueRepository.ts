/**
 * DispatchQueueRepository
 * Dispatch queue, SLA targets, and SLA alerts data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface DispatchQueueEntryEntity {
  id: string;
  ticketId: string;
  ticketData: Record<string, any>;
  dispatchPriority: number;
  enqueuedAt: Date;
  slaDeadline: Date | null;
  reprioritizeCount: number;
  dispatchAttemptCount: number;
  lastDispatchAttempt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLATargetEntity {
  id: string;
  name: string;
  priority: string;
  targetResponseTimeMs: number;
  targetResolutionTimeMs: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAAlertEntity {
  id: string;
  queueEntryId: string;
  ticketId: string;
  alertType: string;
  timeRemainingMs: number | null;
  message: string | null;
  generatedAt: Date;
  createdAt: Date;
}

export class DispatchQueueEntryRepository extends BaseRepository<DispatchQueueEntryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dispatch_queue_entries');
  }

  async findByTicketId(ticketId: string): Promise<DispatchQueueEntryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_queue_entries WHERE ticket_id = $1`,
      [ticketId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTicketId(ticketId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM dispatch_queue_entries WHERE ticket_id = $1`,
      [ticketId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findHighestPriority(): Promise<DispatchQueueEntryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_queue_entries ORDER BY dispatch_priority DESC LIMIT 1`,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAllSorted(): Promise<DispatchQueueEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_queue_entries ORDER BY dispatch_priority DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updatePriority(id: string, priority: number, reprioritizeCount: number): Promise<void> {
    await this.db.query(
      `UPDATE dispatch_queue_entries SET dispatch_priority = $2, reprioritize_count = $3, updated_at = NOW() WHERE id = $1`,
      [id, priority, reprioritizeCount],
    );
  }

  async recordDispatchAttempt(id: string): Promise<void> {
    await this.db.query(
      `UPDATE dispatch_queue_entries SET dispatch_attempt_count = dispatch_attempt_count + 1, last_dispatch_attempt = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async countAll(): Promise<number> {
    const result = await this.db.query(`SELECT COUNT(*) as count FROM dispatch_queue_entries`);
    return parseInt(result.rows[0].count, 10);
  }

  async existsByTicketId(ticketId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM dispatch_queue_entries WHERE ticket_id = $1 LIMIT 1`,
      [ticketId],
    );
    return result.rows.length > 0;
  }

  protected mapRowToEntity(row: any): DispatchQueueEntryEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      ticketData: row.ticket_data ?? {},
      dispatchPriority: row.dispatch_priority ?? 0,
      enqueuedAt: row.enqueued_at,
      slaDeadline: row.sla_deadline,
      reprioritizeCount: row.reprioritize_count ?? 0,
      dispatchAttemptCount: row.dispatch_attempt_count ?? 0,
      lastDispatchAttempt: row.last_dispatch_attempt,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class SLATargetRepository extends BaseRepository<SLATargetEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dispatch_sla_targets');
  }

  async findByPriority(priority: string): Promise<SLATargetEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_sla_targets WHERE priority = $1 AND enabled = true`,
      [priority],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findEnabled(): Promise<SLATargetEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_sla_targets WHERE enabled = true ORDER BY priority`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): SLATargetEntity {
    return {
      id: row.id,
      name: row.name,
      priority: row.priority,
      targetResponseTimeMs: row.target_response_time_ms ?? 0,
      targetResolutionTimeMs: row.target_resolution_time_ms ?? 0,
      enabled: row.enabled ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class SLAAlertRepository extends BaseRepository<SLAAlertEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dispatch_sla_alerts');
  }

  async findByTicketId(ticketId: string): Promise<SLAAlertEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_sla_alerts WHERE ticket_id = $1 ORDER BY generated_at DESC`,
      [ticketId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByType(alertType: string, limit: number = 50): Promise<SLAAlertEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_sla_alerts WHERE alert_type = $1 ORDER BY generated_at DESC LIMIT $2`,
      [alertType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTicketId(ticketId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM dispatch_sla_alerts WHERE ticket_id = $1`,
      [ticketId],
    );
    return result.rowCount ?? 0;
  }

  async deleteByQueueEntryId(queueEntryId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM dispatch_sla_alerts WHERE queue_entry_id = $1`,
      [queueEntryId],
    );
    return result.rowCount ?? 0;
  }

  async findAlertForQueueEntry(queueEntryId: string): Promise<SLAAlertEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM dispatch_sla_alerts WHERE queue_entry_id = $1 LIMIT 1`,
      [queueEntryId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async countAll(): Promise<number> {
    const result = await this.db.query(`SELECT COUNT(*) as count FROM dispatch_sla_alerts`);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): SLAAlertEntity {
    return {
      id: row.id,
      queueEntryId: row.queue_entry_id,
      ticketId: row.ticket_id,
      alertType: row.alert_type,
      timeRemainingMs: row.time_remaining_ms,
      message: row.message,
      generatedAt: row.generated_at,
      createdAt: row.created_at,
    };
  }
}
