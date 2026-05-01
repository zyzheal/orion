/**
 * TicketingRepository - Extended Database layer for all Ticketing operations
 *
 * Covers: tickets, ticket_comments, ticket_assignments, ticket_relations,
 * dispatch_rules, ticket_transfers, engineer_suspensions
 */

import { DatabasePool } from '../database';
import {
  WorkflowHistory,
  TicketAssignment,
  TicketSLA,
  TicketRelation,
  TicketRelationType,
  DispatchRule,
  TicketTransfer,
  TransferType,
  EngineerSuspend,
  SuspendStatus,
  SuspendReason,
  EngineerProfile,
  EngineerAvailability,
  EngineerResolutionStats,
  TicketCategory,
  TicketPriority,
} from './types';

export interface TicketRecord {
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

export interface TicketCommentRecord {
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

export interface CreateAssignmentInput {
  ticketId: string;
  assignee: string;
  assignedBy: string;
  reason?: string;
  matchScore?: number;
}

export interface CreateRelationInput {
  ticketId: string;
  relatedTicketId: string;
  relationType: TicketRelationType;
  createdBy: string;
  description?: string;
  confidence?: number;
}

export interface CreateDispatchRuleInput {
  name: string;
  conditions: Record<string, any>;
  assignee: string;
  priority?: number;
  enabled?: boolean;
}

export interface CreateTransferInput {
  ticketId: string;
  fromEngineer: string;
  toEngineer: string;
  transferType: TransferType;
  reason: string;
  initiatedBy: string;
  holdDurationMs?: number;
}

export interface CreateSuspendInput {
  engineerId: string;
  reason: SuspendReason;
  startTime: Date;
  endTime: Date;
  backupEngineerId?: string;
  autoReassignPending?: boolean;
  pauseSLAForPending?: boolean;
  notes?: string;
  createdBy: string;
}

export interface CreateEngineerProfileInput {
  id: string;
  name: string;
  expertise?: TicketCategory[];
  currentLoad?: number;
  maxCapacity?: number;
  availability?: EngineerAvailability;
  team?: string;
  onCall?: boolean;
}

export interface UpdateEngineerProfileInput {
  name?: string;
  expertise?: TicketCategory[];
  currentLoad?: number;
  maxCapacity?: number;
  availability?: EngineerAvailability;
  team?: string;
  onCall?: boolean;
  skills?: Record<string, number>;
}

export class TicketingRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  // ==================== Ticket CRUD ====================

  async findById(id: string): Promise<TicketRecord | null> {
    return (await this.pool.query('SELECT * FROM tickets WHERE id = $1', [id])).rows[0] || null;
  }

  async findAll(options?: { tenantId?: string; status?: string; assigneeId?: string; priority?: string; limit?: number; offset?: number }): Promise<TicketRecord[]> {
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

  async create(input: CreateTicketInput): Promise<TicketRecord> {
    const { tenant_id, title, description, type, priority, reporter_id, source, source_id, tags } = input;
    const result = await this.pool.query(
      `INSERT INTO tickets (tenant_id, title, description, type, priority, reporter_id, source, source_id, tags, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open') RETURNING *`,
      [tenant_id, title, description || null, type || 'incident', priority || 'medium', reporter_id || null, source || null, source_id || null, tags || []]
    );
    return result.rows[0];
  }

  async update(id: string, input: UpdateTicketInput): Promise<TicketRecord | null> {
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

  async addComment(ticketId: string, authorId: string | null, content: string, isInternal: boolean = false): Promise<TicketCommentRecord> {
    const result = await this.pool.query(
      `INSERT INTO ticket_comments (ticket_id, author_id, content, is_internal) VALUES ($1, $2, $3, $4) RETURNING *`,
      [ticketId, authorId, content, isInternal]
    );
    return result.rows[0];
  }

  async getComments(ticketId: string): Promise<TicketCommentRecord[]> {
    return (await this.pool.query('SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC', [ticketId])).rows;
  }

  // ==================== Ticket Assignments ====================

  async createAssignment(input: CreateAssignmentInput): Promise<TicketAssignment> {
    const id = `ASGN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_assignments (id, ticket_id, assignee_id, assigned_by, assigned_at, reason, match_score)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6) RETURNING *`,
      [id, input.ticketId, input.assignee, input.assignedBy, input.reason || 'Manual assignment', input.matchScore || null]
    );
    return this.mapAssignmentRow(result.rows[0]);
  }

  async getAssignmentsByTicket(ticketId: string): Promise<TicketAssignment[]> {
    const result = await this.pool.query(
      'SELECT * FROM ticket_assignments WHERE ticket_id = $1 ORDER BY assigned_at ASC',
      [ticketId]
    );
    return result.rows.map(r => this.mapAssignmentRow(r));
  }

  async getAssignmentsByAssignee(assignee: string, limit: number = 50): Promise<TicketAssignment[]> {
    const result = await this.pool.query(
      'SELECT * FROM ticket_assignments WHERE assignee_id = $1 ORDER BY assigned_at DESC LIMIT $2',
      [assignee, limit]
    );
    return result.rows.map(r => this.mapAssignmentRow(r));
  }

  // ==================== Ticket Relations ====================

  async createRelation(input: CreateRelationInput): Promise<TicketRelation> {
    const id = `REL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_relations (id, ticket_id, related_ticket_id, relation_type, confidence, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [id, input.ticketId, input.relatedTicketId, input.relationType, input.confidence || null, input.description || null, input.createdBy]
    );
    return this.mapRelationRow(result.rows[0]);
  }

  async getRelationsByTicket(ticketId: string): Promise<TicketRelation[]> {
    const result = await this.pool.query(
      `SELECT * FROM ticket_relations WHERE ticket_id = $1 OR related_ticket_id = $1 ORDER BY created_at DESC`,
      [ticketId]
    );
    return result.rows.map(r => this.mapRelationRow(r));
  }

  async getAllRelations(): Promise<TicketRelation[]> {
    const result = await this.pool.query('SELECT * FROM ticket_relations ORDER BY created_at DESC');
    return result.rows.map(r => this.mapRelationRow(r));
  }

  async deleteRelation(relationId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM ticket_relations WHERE id = $1', [relationId]);
    return (result.rowCount ?? 0) > 0;
  }

  async findExistingRelation(ticketId: string, relatedTicketId: string): Promise<TicketRelation | null> {
    const result = await this.pool.query(
      `SELECT * FROM ticket_relations
       WHERE (ticket_id = $1 AND related_ticket_id = $2) OR (ticket_id = $2 AND related_ticket_id = $1)`,
      [ticketId, relatedTicketId]
    );
    return result.rows.length > 0 ? this.mapRelationRow(result.rows[0]) : null;
  }

  // ==================== Dispatch Rules ====================

  async createDispatchRule(input: CreateDispatchRuleInput): Promise<DispatchRule> {
    const id = `DR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO dispatch_rules (id, name, conditions, assignee_id, rule_priority, enabled)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, input.name, JSON.stringify(input.conditions), input.assignee, input.priority ?? 0, input.enabled !== false]
    );
    return this.mapDispatchRuleRow(result.rows[0]);
  }

  async getAllDispatchRules(): Promise<DispatchRule[]> {
    const result = await this.pool.query('SELECT * FROM dispatch_rules ORDER BY rule_priority ASC');
    return result.rows.map(r => this.mapDispatchRuleRow(r));
  }

  async getActiveDispatchRules(): Promise<DispatchRule[]> {
    const result = await this.pool.query('SELECT * FROM dispatch_rules WHERE enabled = true ORDER BY rule_priority ASC');
    return result.rows.map(r => this.mapDispatchRuleRow(r));
  }

  async updateDispatchRule(id: string, updates: Partial<CreateDispatchRuleInput>): Promise<DispatchRule | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (updates.name !== undefined) { params.push(updates.name); sets.push(`name = $${idx++}`); }
    if (updates.conditions !== undefined) { params.push(JSON.stringify(updates.conditions)); sets.push(`conditions = $${idx++}`); }
    if (updates.assignee !== undefined) { params.push(updates.assignee); sets.push(`assignee_id = $${idx++}`); }
    if (updates.priority !== undefined) { params.push(updates.priority); sets.push(`rule_priority = $${idx++}`); }
    if (updates.enabled !== undefined) { params.push(updates.enabled); sets.push(`enabled = $${idx++}`); }
    if (sets.length === 0) return null;
    params.push(id);
    sets.push(`updated_at = NOW()`);
    const result = await this.pool.query(
      `UPDATE dispatch_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? this.mapDispatchRuleRow(result.rows[0]) : null;
  }

  async deleteDispatchRule(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM dispatch_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Ticket Transfers ====================

  async createTransfer(input: CreateTransferInput): Promise<TicketTransfer> {
    const id = `XFER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_transfers (id, ticket_id, from_engineer_id, to_engineer_id, transfer_type, reason, initiated_by, transferred_at, hold_duration_ms, accepted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, true) RETURNING *`,
      [id, input.ticketId, input.fromEngineer, input.toEngineer, input.transferType, input.reason, input.initiatedBy, input.holdDurationMs || null]
    );
    return this.mapTransferRow(result.rows[0]);
  }

  async getTransfersByTicket(ticketId: string): Promise<TicketTransfer[]> {
    const result = await this.pool.query(
      'SELECT * FROM ticket_transfers WHERE ticket_id = $1 ORDER BY transferred_at DESC',
      [ticketId]
    );
    return result.rows.map(r => this.mapTransferRow(r));
  }

  async getTransfersByEngineer(engineerId: string): Promise<{ transferredFrom: TicketTransfer[]; transferredTo: TicketTransfer[] }> {
    const fromResult = await this.pool.query(
      'SELECT * FROM ticket_transfers WHERE from_engineer_id = $1 ORDER BY transferred_at DESC',
      [engineerId]
    );
    const toResult = await this.pool.query(
      'SELECT * FROM ticket_transfers WHERE to_engineer_id = $1 ORDER BY transferred_at DESC',
      [engineerId]
    );
    return {
      transferredFrom: fromResult.rows.map(r => this.mapTransferRow(r)),
      transferredTo: toResult.rows.map(r => this.mapTransferRow(r)),
    };
  }

  async countTransfersByTicket(ticketId: string): Promise<number> {
    const result = await this.pool.query('SELECT COUNT(*) as count FROM ticket_transfers WHERE ticket_id = $1', [ticketId]);
    return parseInt(result.rows[0].count, 10);
  }

  async getTransferStats(periodStart?: Date, periodEnd?: Date): Promise<any> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (periodStart) { params.push(periodStart); whereClause += ` AND transferred_at >= $${params.length}`; }
    if (periodEnd) { params.push(periodEnd); whereClause += ` AND transferred_at <= $${params.length}`; }

    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE transfer_type = 'manual') as manual,
        COUNT(*) FILTER (WHERE transfer_type = 'auto-timeout') as auto_timeout,
        COUNT(*) FILTER (WHERE transfer_type = 'escalation') as escalation,
        COUNT(*) FILTER (WHERE transfer_type = 'backup') as backup,
        AVG(hold_duration_ms) FILTER (WHERE hold_duration_ms IS NOT NULL) as avg_hold_time_ms
      FROM ticket_transfers ${whereClause}
    `, params);
    return result.rows[0];
  }

  // ==================== Engineer Suspensions ====================

  async createSuspend(input: CreateSuspendInput): Promise<EngineerSuspend> {
    const id = `SUSP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const status: SuspendStatus = input.startTime <= now ? 'active' : 'scheduled';
    const result = await this.pool.query(
      `INSERT INTO engineer_suspensions (id, engineer_id, reason, status, start_time, end_time, backup_engineer_id, auto_reassign, pause_sla, notes, created_by, created_at, tickets_reassigned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 0) RETURNING *`,
      [id, input.engineerId, input.reason, status, input.startTime, input.endTime, input.backupEngineerId || null, input.autoReassignPending ?? true, input.pauseSLAForPending ?? false, input.notes || null, input.createdBy]
    );
    return this.mapSuspendRow(result.rows[0]);
  }

  async findSuspendById(id: string): Promise<EngineerSuspend | null> {
    const result = await this.pool.query('SELECT * FROM engineer_suspensions WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapSuspendRow(result.rows[0]) : null;
  }

  async updateSuspendStatus(id: string, status: SuspendStatus, actualEndTime?: Date): Promise<EngineerSuspend | null> {
    const sets = ['status = $1'];
    const params: any[] = [status];
    let idx = 2;
    if (actualEndTime) { params.push(actualEndTime); sets.push(`actual_end_time = $${idx++}`); }
    params.push(id);
    const result = await this.pool.query(
      `UPDATE engineer_suspensions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? this.mapSuspendRow(result.rows[0]) : null;
  }

  async getActiveSuspensions(): Promise<EngineerSuspend[]> {
    const result = await this.pool.query("SELECT * FROM engineer_suspensions WHERE status = 'active' ORDER BY start_time ASC");
    return result.rows.map(r => this.mapSuspendRow(r));
  }

  async getScheduledSuspensions(): Promise<EngineerSuspend[]> {
    const result = await this.pool.query("SELECT * FROM engineer_suspensions WHERE status = 'scheduled' ORDER BY start_time ASC");
    return result.rows.map(r => this.mapSuspendRow(r));
  }

  async getSuspensionsByEngineer(engineerId: string): Promise<EngineerSuspend[]> {
    const result = await this.pool.query(
      'SELECT * FROM engineer_suspensions WHERE engineer_id = $1 ORDER BY start_time DESC',
      [engineerId]
    );
    return result.rows.map(r => this.mapSuspendRow(r));
  }

  // ==================== Workflow History ====================

  async createWorkflowHistory(ticketId: string, fromStatus: string, toStatus: string, performedBy: string, reason?: string): Promise<WorkflowHistory> {
    const id = `WH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_workflow_history (id, ticket_id, from_status, to_status, triggered_by, triggered_type, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, 'manual', $6, NOW()) RETURNING *`,
      [id, ticketId, fromStatus, toStatus, performedBy, reason || null]
    );
    return this.mapWorkflowHistoryRow(result.rows[0]);
  }

  async getWorkflowHistory(ticketId: string): Promise<WorkflowHistory[]> {
    const result = await this.pool.query(
      'SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );
    return result.rows.map(r => this.mapWorkflowHistoryRow(r));
  }

  // ==================== SLA Tracking ====================

  async createSLA(ticketId: string, priority: string, targetResolutionTimeMs: number): Promise<TicketSLA> {
    const id = `SLA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const responseTime = Math.round(targetResolutionTimeMs * 0.25 / 60000); // 25% for response
    const resolutionTime = Math.round(targetResolutionTimeMs / 60000);
    const result = await this.pool.query(
      `INSERT INTO ticket_sla (id, ticket_id, priority, response_time_minutes, resolution_time_minutes, response_breached, resolution_breached)
       VALUES ($1, $2, $3, $4, $5, false, false) RETURNING *`,
      [id, ticketId, priority, responseTime, resolutionTime]
    );
    return this.mapSLARow(result.rows[0]);
  }

  async getSLA(ticketId: string): Promise<TicketSLA | null> {
    const result = await this.pool.query('SELECT * FROM ticket_sla WHERE ticket_id = $1', [ticketId]);
    return result.rows.length > 0 ? this.mapSLARow(result.rows[0]) : null;
  }

  async getAllSLA(): Promise<TicketSLA[]> {
    const result = await this.pool.query('SELECT * FROM ticket_sla');
    return result.rows.map(r => this.mapSLARow(r));
  }

  async updateSLA(ticketId: string, updates: { resolvedAt?: Date; responseBreached?: boolean; resolutionBreached?: boolean; firstResponseAt?: Date }): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (updates.resolvedAt) { params.push(updates.resolvedAt); sets.push(`resolved_at = $${idx++}`); }
    if (updates.responseBreached !== undefined) { params.push(updates.responseBreached); sets.push(`response_breached = $${idx++}`); }
    if (updates.resolutionBreached !== undefined) { params.push(updates.resolutionBreached); sets.push(`resolution_breached = $${idx++}`); }
    if (updates.firstResponseAt) { params.push(updates.firstResponseAt); sets.push(`first_response_at = $${idx++}`); }
    if (sets.length === 0) return;
    params.push(ticketId);
    await this.pool.query(`UPDATE ticket_sla SET ${sets.join(', ')} WHERE ticket_id = $${idx}`, params);
  }

  // ==================== Row Mapping Helpers ====================

  private mapAssignmentRow(row: any): TicketAssignment {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      assignee: row.assignee_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      reason: row.reason,
      matchScore: row.match_score ? parseFloat(row.match_score) : undefined,
    };
  }

  private mapRelationRow(row: any): TicketRelation {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      relatedTicketId: row.related_ticket_id,
      relationType: row.relation_type as TicketRelationType,
      confidence: row.confidence ? parseFloat(row.confidence) : undefined,
      createdAt: row.created_at,
      createdBy: row.created_by,
      description: row.description,
    };
  }

  private mapDispatchRuleRow(row: any): DispatchRule {
    return {
      id: row.id,
      name: row.name,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      assignee: row.assignee_id,
      priority: row.rule_priority,
      enabled: row.enabled,
    };
  }

  private mapTransferRow(row: any): TicketTransfer {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      fromEngineer: row.from_engineer_id,
      toEngineer: row.to_engineer_id,
      transferType: row.transfer_type as TransferType,
      reason: row.reason,
      initiatedBy: row.initiated_by,
      transferredAt: row.transferred_at,
      holdDurationMs: row.hold_duration_ms ? parseInt(row.hold_duration_ms, 10) : undefined,
      accepted: row.accepted,
    };
  }

  private mapSuspendRow(row: any): EngineerSuspend {
    return {
      id: row.id,
      engineerId: row.engineer_id,
      reason: row.reason as SuspendReason,
      status: row.status as SuspendStatus,
      startTime: row.start_time,
      endTime: row.end_time,
      actualEndTime: row.actual_end_time,
      backupEngineerId: row.backup_engineer_id,
      autoReassignPending: row.auto_reassign,
      pauseSLAForPending: row.pause_sla,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      ticketsReassigned: row.tickets_reassigned,
    };
  }

  private mapWorkflowHistoryRow(row: any): WorkflowHistory {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      fromStatus: row.from_status as any,
      toStatus: row.to_status as any,
      performedBy: row.triggered_by,
      performedAt: row.created_at,
      reason: row.comment,
    };
  }

  private mapSLARow(row: any): TicketSLA {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      slaTargetId: row.id,
      targetResolutionTimeMs: (row.resolution_time_minutes || 0) * 60000,
      actualResolutionTimeMs: row.resolved_at ? (row.resolved_at.getTime() - (row.created_at ? row.created_at.getTime() : 0)) : undefined,
      breached: row.resolution_breached,
      breachedAt: row.resolution_breached ? row.resolved_at : undefined,
      resolvedAt: row.resolved_at,
      firstResponseAt: row.first_response_at,
      responseBreached: row.response_breached,
    };
  }

  // ==================== Engineer Profiles ====================

  async createEngineerProfile(input: CreateEngineerProfileInput): Promise<EngineerProfile> {
    const result = await this.pool.query(
      `INSERT INTO engineer_profiles (id, name, expertise, current_load, max_capacity, availability, team, on_call)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        input.id,
        input.name,
        input.expertise || [],
        input.currentLoad ?? 0,
        input.maxCapacity ?? 10,
        input.availability || 'available',
        input.team || null,
        input.onCall ?? false,
      ]
    );
    return this.mapEngineerProfileRow(result.rows[0]);
  }

  async findEngineerProfileById(id: string): Promise<EngineerProfile | null> {
    const result = await this.pool.query('SELECT * FROM engineer_profiles WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapEngineerProfileRow(result.rows[0]) : null;
  }

  async findAllEngineerProfiles(): Promise<EngineerProfile[]> {
    const result = await this.pool.query('SELECT * FROM engineer_profiles ORDER BY name ASC');
    return result.rows.map(r => this.mapEngineerProfileRow(r));
  }

  async updateEngineerProfile(id: string, updates: UpdateEngineerProfileInput): Promise<EngineerProfile | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (updates.name !== undefined) { params.push(updates.name); sets.push(`name = $${idx++}`); }
    if (updates.expertise !== undefined) { params.push(updates.expertise); sets.push(`expertise = $${idx++}`); }
    if (updates.currentLoad !== undefined) { params.push(updates.currentLoad); sets.push(`current_load = $${idx++}`); }
    if (updates.maxCapacity !== undefined) { params.push(updates.maxCapacity); sets.push(`max_capacity = $${idx++}`); }
    if (updates.availability !== undefined) { params.push(updates.availability); sets.push(`availability = $${idx++}`); }
    if (updates.team !== undefined) { params.push(updates.team); sets.push(`team = $${idx++}`); }
    if (updates.onCall !== undefined) { params.push(updates.onCall); sets.push(`on_call = $${idx++}`); }
    if (updates.skills !== undefined) { params.push(JSON.stringify(updates.skills)); sets.push(`skills = $${idx++}`); }
    if (sets.length === 0) return this.findEngineerProfileById(id);
    params.push(id);
    sets.push(`updated_at = NOW()`);
    const result = await this.pool.query(
      `UPDATE engineer_profiles SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? this.mapEngineerProfileRow(result.rows[0]) : null;
  }

  async deleteEngineerProfile(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM engineer_profiles WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getAvailableEngineers(): Promise<EngineerProfile[]> {
    const result = await this.pool.query(
      "SELECT * FROM engineer_profiles WHERE availability NOT IN ('offline', 'away') ORDER BY current_load ASC"
    );
    return result.rows.map(r => this.mapEngineerProfileRow(r));
  }

  private mapEngineerProfileRow(row: any): EngineerProfile {
    const resolutionStats: EngineerResolutionStats = {
      totalResolved: row.total_resolved || 0,
      avgResolutionTimeMs: row.avg_resolution_time_ms || 0,
      slaComplianceRate: row.sla_compliance_rate || 0,
      resolutionByCategory: (row.resolution_by_category || {}) as Record<TicketCategory, number>,
      resolutionByPriority: (row.resolution_by_priority || {}) as Record<TicketPriority, number>,
      escalationCount: row.escalation_count || 0,
      satisfactionScore: row.satisfaction_score,
    };
    return {
      id: row.id,
      name: row.name,
      expertise: (row.expertise || []) as TicketCategory[],
      currentLoad: row.current_load || 0,
      maxCapacity: row.max_capacity || 10,
      availability: (row.availability || 'available') as EngineerAvailability,
      resolutionStats,
      skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || undefined),
      team: row.team,
      onCall: row.on_call || false,
    };
  }
}
