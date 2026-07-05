/**
 * SlaRepository - SLA Policy and Tracking Data Access Layer
 *
 * Manages sla_targets (SLA policies) and ticket_sla (SLA tracking per ticket)
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';
import {
  SLATarget,
  TicketSLA,
  TicketSLAStatus,
  SLAViolation,
  CreateSLAPolicyInput,
  UpdateSLAPolicyInput,
} from '../services/ticketing/types';

export interface SLAPolicyEntity {
  id: string;
  tenantId: string;
  name: string;
  priority: string;
  targetResponseTimeMs: number;
  targetResolutionTimeMs: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketSLAEntity {
  id: string;
  ticketId: string;
  slaTargetId: string;
  targetResolutionTimeMs: number;
  actualResolutionTimeMs?: number;
  breached: boolean;
  breachedAt?: Date;
  resolvedAt?: Date;
  firstResponseAt?: Date;
  responseBreached: boolean;
  createdAt: Date;
}

export class SlaRepository extends BaseRepository<SLAPolicyEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sla_targets');
  }

  // ==================== SLA Policy CRUD ====================

  async createPolicy(input: CreateSLAPolicyInput): Promise<SLAPolicyEntity> {
    const id = `SLA-POL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO sla_targets (id, tenant_id, name, priority, target_response_time_ms, target_resolution_time_ms, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [
        id,
        input.tenantId,
        input.name,
        input.priority,
        input.targetResponseTimeMs,
        input.targetResolutionTimeMs,
        input.enabled ?? true,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findPolicyById(id: string): Promise<SLAPolicyEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM sla_targets WHERE id = $1',
      [id],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAllPolicies(tenantId: string, options?: { enabled?: boolean; priority?: string }): Promise<SLAPolicyEntity[]> {
    let query = 'SELECT * FROM sla_targets WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.enabled !== undefined) {
      params.push(options.enabled);
      query += ` AND enabled = $${paramIndex++}`;
    }
    if (options?.priority) {
      params.push(options.priority);
      query += ` AND priority = $${paramIndex++}`;
    }

    query += ' ORDER BY priority ASC, created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updatePolicy(id: string, input: UpdateSLAPolicyInput, tenantId: string): Promise<SLAPolicyEntity | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${idx++}`); }
    if (input.priority !== undefined) { params.push(input.priority); sets.push(`priority = $${idx++}`); }
    if (input.targetResponseTimeMs !== undefined) { params.push(input.targetResponseTimeMs); sets.push(`target_response_time_ms = $${idx++}`); }
    if (input.targetResolutionTimeMs !== undefined) { params.push(input.targetResolutionTimeMs); sets.push(`target_resolution_time_ms = $${idx++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); sets.push(`enabled = $${idx++}`); }

    if (sets.length === 0) return this.findPolicyById(id);
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const result = await this.db.query(
      `UPDATE sla_targets SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async deletePolicy(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM sla_targets WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Ticket SLA Tracking ====================

  async createTicketSLA(ticketId: string, priority: string, targetResolutionTimeMs: number, tenantId: string): Promise<TicketSLAEntity> {
    // Verify ticket belongs to tenant
    const ticketResult = await this.db.query('SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2', [ticketId, tenantId]);
    if (ticketResult.rows.length === 0) {
      throw new OrionError(`Ticket not found or access denied: ${ticketId}`, ErrorCode.NOT_FOUND);
    }

    const id = `TKT-SLA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const responseTimeMs = Math.round(targetResolutionTimeMs * 0.25);
    const result = await this.db.query(
      `INSERT INTO ticket_sla (id, ticket_id, priority, target_response_time_ms, target_resolution_time_ms, response_breached, resolution_breached, created_at)
       VALUES ($1, $2, $3, $4, $5, false, false, NOW()) RETURNING *`,
      [id, ticketId, priority, responseTimeMs, targetResolutionTimeMs],
    );
    return this.mapTicketSLARow(result.rows[0]);
  }

  async getTicketSLA(ticketId: string, tenantId: string): Promise<TicketSLAEntity | null> {
    // Verify ticket belongs to tenant
    const ticketResult = await this.db.query('SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2', [ticketId, tenantId]);
    if (ticketResult.rows.length === 0) return null;

    const result = await this.db.query('SELECT * FROM ticket_sla WHERE ticket_id = $1', [ticketId]);
    return result.rows.length > 0 ? this.mapTicketSLARow(result.rows[0]) : null;
  }

  async getAllTicketSLAs(tenantId: string): Promise<TicketSLAEntity[]> {
    const result = await this.db.query(
      `SELECT s.* FROM ticket_sla s JOIN tickets t ON s.ticket_id = t.id WHERE t.tenant_id = $1`,
      [tenantId],
    );
    return result.rows.map(row => this.mapTicketSLARow(row));
  }

  async updateTicketSLA(ticketId: string, updates: {
    resolvedAt?: Date;
    responseBreached?: boolean;
    resolutionBreached?: boolean;
    firstResponseAt?: Date;
  }, tenantId: string): Promise<void> {
    // Verify ticket belongs to tenant
    const ticketResult = await this.db.query('SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2', [ticketId, tenantId]);
    if (ticketResult.rows.length === 0) return;

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.resolvedAt !== undefined) { params.push(updates.resolvedAt); sets.push(`resolved_at = $${idx++}`); }
    if (updates.responseBreached !== undefined) { params.push(updates.responseBreached); sets.push(`response_breached = $${idx++}`); }
    if (updates.resolutionBreached !== undefined) { params.push(updates.resolutionBreached); sets.push(`resolution_breached = $${idx++}`); }
    if (updates.firstResponseAt !== undefined) { params.push(updates.firstResponseAt); sets.push(`first_response_at = $${idx++}`); }

    if (sets.length === 0) return;
    params.push(ticketId);
    await this.db.query(`UPDATE ticket_sla SET ${sets.join(', ')} WHERE ticket_id = $${idx}`, params);
  }

  async getSLAViolations(tenantId: string, periodStart: Date, periodEnd: Date): Promise<SLAViolation[]> {
    const result = await this.db.query(
      `SELECT s.*, t.title as ticket_title, t.priority as ticket_priority, t.status as ticket_status
       FROM ticket_sla s
       JOIN tickets t ON s.ticket_id = t.id
       WHERE t.tenant_id = $1
       AND t.created_at >= $2
       AND t.created_at <= $3
       AND (s.resolution_breached = true OR s.response_breached = true)
       ORDER BY t.created_at DESC`,
      [tenantId, periodStart, periodEnd],
    );
    return result.rows.map(row => ({
      id: row.id,
      ticketId: row.ticket_id,
      slaTargetId: row.sla_target_id,
      targetResolutionTimeMs: (row.resolution_time_minutes || 0) * 60000,
      actualResolutionTimeMs: row.resolved_at ? row.resolved_at.getTime() - new Date(row.created_at).getTime() : undefined,
      breached: row.resolution_breached || row.response_breached,
      breachedAt: row.resolution_breached ? row.resolved_at : undefined,
      resolvedAt: row.resolved_at,
      firstResponseAt: row.first_response_at,
      responseBreached: row.response_breached,
      ticketTitle: row.ticket_title,
      ticketPriority: row.ticket_priority,
      ticketStatus: row.ticket_status,
    }));
  }

  async getSLAComplianceStats(tenantId: string, periodStart: Date, periodEnd: Date): Promise<{ total: number; compliant: number; breached: number; rate: number }> {
    const result = await this.db.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE s.resolution_breached = false AND s.response_breached = false) as compliant,
              COUNT(*) FILTER (WHERE s.resolution_breached = true OR s.response_breached = true) as breached
       FROM ticket_sla s
       JOIN tickets t ON s.ticket_id = t.id
       WHERE t.tenant_id = $1
       AND t.created_at >= $2
       AND t.created_at <= $3`,
      [tenantId, periodStart, periodEnd],
    );
    const row = result.rows[0];
    const total = parseInt(row.total, 10);
    const compliant = parseInt(row.compliant, 10);
    const breached = parseInt(row.breached, 10);
    return {
      total,
      compliant,
      breached,
      rate: total > 0 ? Math.round((compliant / total) * 100) : 0,
    };
  }

  async getTicketSLAStatus(ticketId: string, tenantId: string): Promise<TicketSLAStatus | null> {
    const ticketResult = await this.db.query(
      'SELECT id, created_at FROM tickets WHERE id = $1 AND tenant_id = $2',
      [ticketId, tenantId],
    );
    if (ticketResult.rows.length === 0) return null;

    const ticket = ticketResult.rows[0];
    const slaResult = await this.db.query('SELECT * FROM ticket_sla WHERE ticket_id = $1', [ticketId]);
    if (slaResult.rows.length === 0) return null;

    const sla = slaResult.rows[0];
    const now = new Date();
    const createdAt = new Date(ticket.created_at);
    const elapsedTimeMs = now.getTime() - createdAt.getTime();
    const targetResolutionTimeMs = (sla.resolution_time_minutes || 0) * 60000;
    const remainingTimeMs = targetResolutionTimeMs - elapsedTimeMs;
    const percentUsed = targetResolutionTimeMs > 0 ? Math.round((elapsedTimeMs / targetResolutionTimeMs) * 100) : 0;

    const warningThreshold = 0.8;
    const resolutionBreached = remainingTimeMs < 0 || sla.resolution_breached;
    const responseBreached = sla.response_breached;

    let status: 'normal' | 'warning' | 'breached' = 'normal';
    if (resolutionBreached || responseBreached) {
      status = 'breached';
    } else if (percentUsed >= warningThreshold * 100) {
      status = 'warning';
    }

    return {
      ticketId,
      status,
      targetResolutionTimeMs,
      targetResponseTimeMs: (sla.target_response_time_ms || 0),
      elapsedTimeMs,
      remainingTimeMs: Math.max(0, remainingTimeMs),
      percentUsed: Math.min(100, percentUsed),
      responseBreached,
      resolutionBreached,
      firstResponseAt: sla.first_response_at,
      resolvedAt: sla.resolved_at,
      breachAt: resolutionBreached ? new Date(createdAt.getTime() + targetResolutionTimeMs) : undefined,
      warningThreshold,
    };
  }

  // ==================== Row Mapping ====================

  protected mapRowToEntity(row: any): SLAPolicyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      priority: row.priority,
      targetResponseTimeMs: row.target_response_time_ms || 0,
      targetResolutionTimeMs: row.target_resolution_time_ms || 0,
      enabled: row.enabled ?? true,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapTicketSLARow(row: any): TicketSLAEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      slaTargetId: row.sla_target_id || row.id,
      targetResolutionTimeMs: (row.resolution_time_minutes || 0) * 60000,
      actualResolutionTimeMs: row.resolved_at ? row.resolved_at.getTime() - new Date(row.created_at).getTime() : undefined,
      breached: row.resolution_breached || false,
      breachedAt: row.resolution_breached ? row.resolved_at : undefined,
      resolvedAt: row.resolved_at,
      firstResponseAt: row.first_response_at,
      responseBreached: row.response_breached || false,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
