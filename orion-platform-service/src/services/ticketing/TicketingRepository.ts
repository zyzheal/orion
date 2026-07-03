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
  TicketTemplate,
  CreateTicketTemplateInput,
  UpdateTicketTemplateInput,
  AutomationRule,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationRuleExecution,
  TicketSLAStatus,
  SLAViolation,
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

  /** Expose db connection for sub-services that need direct query access */
  getDb(): DatabasePool { return this.pool; }

  // ==================== Ticket CRUD ====================

  async findById(id: string, tenantId: string): Promise<TicketRecord | null> {
    return (await this.pool.query('SELECT * FROM tickets WHERE id = $1 AND tenant_id = $2', [id, tenantId])).rows[0] || null;
  }

  async findAll(options?: { tenantId?: string; status?: string; assigneeId?: string; reporterId?: string; priority?: string; limit?: number; offset?: number }): Promise<TicketRecord[]> {
    let query = 'SELECT * FROM tickets';
    const params: any[] = [];
    const conditions: string[] = [];
    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
    if (options?.assigneeId) { params.push(options.assigneeId); conditions.push(`assignee_id = $${params.length}`); }
    if (options?.reporterId) { params.push(options.reporterId); conditions.push(`reporter_id = $${params.length}`); }
    if (options?.priority) { params.push(options.priority); conditions.push(`priority = $${params.length}`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${params.length}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${params.length}`; }
    return (await this.pool.query(query, params)).rows;
  }

  async count(options?: { tenantId?: string; status?: string; assigneeId?: string; reporterId?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM tickets';
    const params: any[] = [];
    const conditions: string[] = [];
    if (options?.tenantId) { params.push(options.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (options?.status) { params.push(options.status); conditions.push(`status = $${params.length}`); }
    if (options?.assigneeId) { params.push(options.assigneeId); conditions.push(`assignee_id = $${params.length}`); }
    if (options?.reporterId) { params.push(options.reporterId); conditions.push(`reporter_id = $${params.length}`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
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

  async update(id: string, input: UpdateTicketInput, tenantId: string): Promise<TicketRecord | null> {
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
    if (updates.length === 0) return this.findById(id, tenantId);
    params.push(id, tenantId);
    const result = await this.pool.query(`UPDATE tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, params);
    return result.rows[0] || null;
  }

  async addComment(ticketId: string, tenantId: string, authorId: string | null, content: string, isInternal: boolean = false): Promise<TicketCommentRecord> {
    // Verify ticket belongs to tenant before adding comment
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) throw new Error(`Ticket not found or access denied: ${ticketId}`);
    const result = await this.pool.query(
      `INSERT INTO ticket_comments (ticket_id, author_id, content, is_internal) VALUES ($1, $2, $3, $4) RETURNING *`,
      [ticketId, authorId, content, isInternal]
    );
    return result.rows[0];
  }

  async getComments(ticketId: string, tenantId: string): Promise<TicketCommentRecord[]> {
    // Verify ticket belongs to tenant before returning comments
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return [];
    return (await this.pool.query('SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC', [ticketId])).rows;
  }

  // ==================== Ticket Assignments ====================

  async createAssignment(input: CreateAssignmentInput, tenantId: string): Promise<TicketAssignment> {
    // Verify ticket belongs to tenant before creating assignment
    const ticket = await this.findById(input.ticketId, tenantId);
    if (!ticket) throw new Error(`Ticket not found or access denied: ${input.ticketId}`);
    const id = `ASGN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_assignments (id, ticket_id, assignee_id, assigned_by, assigned_at, reason, match_score)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6) RETURNING *`,
      [id, input.ticketId, input.assignee, input.assignedBy, input.reason || 'Manual assignment', input.matchScore || null]
    );
    return this.mapAssignmentRow(result.rows[0]);
  }

  async getAssignmentsByTicket(ticketId: string, tenantId: string): Promise<TicketAssignment[]> {
    // Verify ticket belongs to tenant
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return [];
    const result = await this.pool.query(
      'SELECT * FROM ticket_assignments WHERE ticket_id = $1 ORDER BY assigned_at ASC',
      [ticketId]
    );
    return result.rows.map(r => this.mapAssignmentRow(r));
  }

  async getAssignmentsByAssignee(assignee: string, tenantId: string, limit: number = 50): Promise<TicketAssignment[]> {
    // Join with tickets to filter by tenant
    const result = await this.pool.query(
      `SELECT a.* FROM ticket_assignments a
       JOIN tickets t ON a.ticket_id = t.id
       WHERE a.assignee_id = $1 AND t.tenant_id = $2
       ORDER BY a.assigned_at DESC LIMIT $3`,
      [assignee, tenantId, limit]
    );
    return result.rows.map(r => this.mapAssignmentRow(r));
  }

  // ==================== Ticket Relations ====================

  async createRelation(input: CreateRelationInput, tenantId: string): Promise<TicketRelation> {
    // Verify both tickets belong to tenant before creating relation
    const ticket1 = await this.findById(input.ticketId, tenantId);
    const ticket2 = await this.findById(input.relatedTicketId, tenantId);
    if (!ticket1 || !ticket2) throw new Error(`One or both tickets not found or access denied`);
    const id = `REL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_relations (id, ticket_id, related_ticket_id, relation_type, confidence, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [id, input.ticketId, input.relatedTicketId, input.relationType, input.confidence || null, input.description || null, input.createdBy]
    );
    return this.mapRelationRow(result.rows[0]);
  }

  async getRelationsByTicket(ticketId: string, tenantId: string): Promise<TicketRelation[]> {
    // Verify ticket belongs to tenant
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return [];
    const result = await this.pool.query(
      `SELECT * FROM ticket_relations WHERE ticket_id = $1 OR related_ticket_id = $1 ORDER BY created_at DESC`,
      [ticketId]
    );
    return result.rows.map(r => this.mapRelationRow(r));
  }

  async getAllRelations(tenantId: string): Promise<TicketRelation[]> {
    // Get relations where both tickets belong to the tenant
    const result = await this.pool.query(
      `SELECT r.* FROM ticket_relations r
       JOIN tickets t ON r.ticket_id = t.id
       WHERE t.tenant_id = $1
       UNION ALL
       SELECT r.* FROM ticket_relations r
       JOIN tickets t ON r.related_ticket_id = t.id
       WHERE t.tenant_id = $1 AND r.ticket_id NOT IN (SELECT id FROM tickets WHERE tenant_id = $1)`,
      [tenantId]
    );
    return result.rows.map(r => this.mapRelationRow(r));
  }

  async deleteRelation(relationId: string, tenantId: string): Promise<boolean> {
    // Only delete if at least one ticket in the relation belongs to this tenant
    const result = await this.pool.query(
      `DELETE FROM ticket_relations WHERE id = $1 AND
       (ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $2) OR
        related_ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $2))`,
      [relationId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findExistingRelation(ticketId: string, relatedTicketId: string, tenantId: string): Promise<TicketRelation | null> {
    // Verify at least one ticket belongs to tenant
    const t1 = await this.findById(ticketId, tenantId);
    const t2 = await this.findById(relatedTicketId, tenantId);
    if (!t1 && !t2) return null;
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

  async createTransfer(input: CreateTransferInput, tenantId: string): Promise<TicketTransfer> {
    // Verify ticket belongs to tenant before creating transfer
    const ticket = await this.findById(input.ticketId, tenantId);
    if (!ticket) throw new Error(`Ticket not found or access denied: ${input.ticketId}`);
    const id = `XFER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_transfers (id, ticket_id, from_engineer_id, to_engineer_id, transfer_type, reason, initiated_by, transferred_at, hold_duration_ms, accepted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, true) RETURNING *`,
      [id, input.ticketId, input.fromEngineer, input.toEngineer, input.transferType, input.reason, input.initiatedBy, input.holdDurationMs || null]
    );
    return this.mapTransferRow(result.rows[0]);
  }

  async getTransfersByTicket(ticketId: string, tenantId: string): Promise<TicketTransfer[]> {
    // Verify ticket belongs to tenant
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return [];
    const result = await this.pool.query(
      'SELECT * FROM ticket_transfers WHERE ticket_id = $1 ORDER BY transferred_at DESC',
      [ticketId]
    );
    return result.rows.map(r => this.mapTransferRow(r));
  }

  async getTransfersByEngineer(engineerId: string, tenantId: string): Promise<{ transferredFrom: TicketTransfer[]; transferredTo: TicketTransfer[] }> {
    // Filter by tenant via the tickets involved in each transfer
    const fromResult = await this.pool.query(
      `SELECT t.* FROM ticket_transfers t
       JOIN tickets tk ON t.ticket_id = tk.id
       WHERE t.from_engineer_id = $1 AND tk.tenant_id = $2
       ORDER BY t.transferred_at DESC`,
      [engineerId, tenantId]
    );
    const toResult = await this.pool.query(
      `SELECT t.* FROM ticket_transfers t
       JOIN tickets tk ON t.ticket_id = tk.id
       WHERE t.to_engineer_id = $1 AND tk.tenant_id = $2
       ORDER BY t.transferred_at DESC`,
      [engineerId, tenantId]
    );
    return {
      transferredFrom: fromResult.rows.map(r => this.mapTransferRow(r)),
      transferredTo: toResult.rows.map(r => this.mapTransferRow(r)),
    };
  }

  async countTransfersByTicket(ticketId: string, tenantId: string): Promise<number> {
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return 0;
    const result = await this.pool.query('SELECT COUNT(*) as count FROM ticket_transfers WHERE ticket_id = $1', [ticketId]);
    return parseInt(result.rows[0].count, 10);
  }

  async getTransferStats(tenantId: string, periodStart?: Date, periodEnd?: Date): Promise<any> {
    let whereClause = 'WHERE tk.tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;
    if (periodStart) { params.push(periodStart); whereClause += ` AND t.transferred_at >= $${paramIndex++}`; }
    if (periodEnd) { params.push(periodEnd); whereClause += ` AND t.transferred_at <= $${paramIndex++}`; }

    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE t.transfer_type = 'manual') as manual,
        COUNT(*) FILTER (WHERE t.transfer_type = 'auto-timeout') as auto_timeout,
        COUNT(*) FILTER (WHERE t.transfer_type = 'escalation') as escalation,
        COUNT(*) FILTER (WHERE t.transfer_type = 'backup') as backup,
        AVG(t.hold_duration_ms) FILTER (WHERE t.hold_duration_ms IS NOT NULL) as avg_hold_time_ms
      FROM ticket_transfers t
      JOIN tickets tk ON t.ticket_id = tk.id
      ${whereClause}
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

  async listAllSuspensions(): Promise<EngineerSuspend[]> {
    const result = await this.pool.query('SELECT * FROM engineer_suspensions ORDER BY start_time DESC');
    return result.rows.map(r => this.mapSuspendRow(r));
  }

  // ==================== Workflow History ====================

  async createWorkflowHistory(ticketId: string, fromStatus: string, toStatus: string, performedBy: string, reason?: string, tenantId?: string): Promise<WorkflowHistory> {
    if (tenantId) {
      const ticket = await this.findById(ticketId, tenantId);
      if (!ticket) throw new Error(`Ticket not found or access denied: ${ticketId}`);
    }
    const id = `WH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_workflow_history (id, ticket_id, from_status, to_status, triggered_by, triggered_type, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, 'manual', $6, NOW()) RETURNING *`,
      [id, ticketId, fromStatus, toStatus, performedBy, reason || null]
    );
    return this.mapWorkflowHistoryRow(result.rows[0]);
  }

  async getWorkflowHistory(ticketId: string, tenantId: string): Promise<WorkflowHistory[]> {
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return [];
    const result = await this.pool.query(
      'SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );
    return result.rows.map(r => this.mapWorkflowHistoryRow(r));
  }

  // ==================== SLA Tracking ====================

  async createSLA(ticketId: string, priority: string, targetResolutionTimeMs: number, tenantId: string): Promise<TicketSLA> {
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) throw new Error(`Ticket not found or access denied: ${ticketId}`);
    const id = `SLA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const responseTime = Math.round(targetResolutionTimeMs * 0.25 / 60000);
    const resolutionTime = Math.round(targetResolutionTimeMs / 60000);
    const result = await this.pool.query(
      `INSERT INTO ticket_sla (id, ticket_id, priority, response_time_minutes, resolution_time_minutes, response_breached, resolution_breached)
       VALUES ($1, $2, $3, $4, $5, false, false) RETURNING *`,
      [id, ticketId, priority, responseTime, resolutionTime]
    );
    return this.mapSLARow(result.rows[0]);
  }

  async getSLA(ticketId: string, tenantId: string): Promise<TicketSLA | null> {
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return null;
    const result = await this.pool.query('SELECT * FROM ticket_sla WHERE ticket_id = $1', [ticketId]);
    return result.rows.length > 0 ? this.mapSLARow(result.rows[0]) : null;
  }

  async getAllSLA(tenantId: string): Promise<TicketSLA[]> {
    const result = await this.pool.query(
      `SELECT s.* FROM ticket_sla s JOIN tickets t ON s.ticket_id = t.id WHERE t.tenant_id = $1`,
      [tenantId]
    );
    return result.rows.map(r => this.mapSLARow(r));
  }

  async updateSLA(ticketId: string, updates: { resolvedAt?: Date; responseBreached?: boolean; resolutionBreached?: boolean; firstResponseAt?: Date }, tenantId: string): Promise<void> {
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return;
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

  // ==================== Ticket Templates ====================

  async createTemplate(input: CreateTicketTemplateInput, tenantId: string): Promise<TicketTemplate> {
    const id = `TMPL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO ticket_templates (id, tenant_id, name, description, title, template_body, category, priority, status, assignee_id, tags, sla_target_id, workflow_steps, field_defaults, metadata, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        id,
        tenantId,
        input.name,
        input.description || null,
        input.title,
        input.templateBody,
        input.category,
        input.priority || 'medium',
        input.status || 'open',
        input.assigneeId || null,
        input.tags || [],
        input.slaTargetId || null,
        input.workflowSteps ? JSON.stringify(input.workflowSteps) : null,
        JSON.stringify(input.fieldDefaults || {}),
        JSON.stringify(input.metadata || {}),
        input.isPublic ?? false,
        input.createdBy || null,
      ]
    );
    return this.mapTemplateRow(result.rows[0]);
  }

  async findTemplateById(id: string, tenantId: string): Promise<TicketTemplate | null> {
    const result = await this.pool.query(
      'SELECT * FROM ticket_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapTemplateRow(result.rows[0]) : null;
  }

  async findAllTemplates(tenantId: string, options?: { category?: string; isPublic?: boolean; limit?: number; offset?: number }): Promise<TicketTemplate[]> {
    let query = 'SELECT * FROM ticket_templates WHERE (tenant_id = $1 OR is_public = true)';
    const params: any[] = [tenantId];
    let paramIndex = 2;
    if (options?.category) { params.push(options.category); query += ` AND category = $${paramIndex++}`; }
    if (options?.isPublic !== undefined) { params.push(options.isPublic); query += ` AND is_public = $${paramIndex++}`; }
    query += ' ORDER BY usage_count DESC, created_at DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${paramIndex++}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${paramIndex++}`; }
    const result = await this.pool.query(query, params);
    return result.rows.map(r => this.mapTemplateRow(r));
  }

  async updateTemplate(id: string, input: UpdateTicketTemplateInput, tenantId: string): Promise<TicketTemplate | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${idx++}`); }
    if (input.description !== undefined) { params.push(input.description); sets.push(`description = $${idx++}`); }
    if (input.title !== undefined) { params.push(input.title); sets.push(`title = $${idx++}`); }
    if (input.templateBody !== undefined) { params.push(input.templateBody); sets.push(`template_body = $${idx++}`); }
    if (input.category !== undefined) { params.push(input.category); sets.push(`category = $${idx++}`); }
    if (input.priority !== undefined) { params.push(input.priority); sets.push(`priority = $${idx++}`); }
    if (input.status !== undefined) { params.push(input.status); sets.push(`status = $${idx++}`); }
    if (input.assigneeId !== undefined) { params.push(input.assigneeId); sets.push(`assignee_id = $${idx++}`); }
    if (input.tags !== undefined) { params.push(input.tags); sets.push(`tags = $${idx++}`); }
    if (input.slaTargetId !== undefined) { params.push(input.slaTargetId); sets.push(`sla_target_id = $${idx++}`); }
    if (input.workflowSteps !== undefined) { params.push(JSON.stringify(input.workflowSteps)); sets.push(`workflow_steps = $${idx++}`); }
    if (input.fieldDefaults !== undefined) { params.push(JSON.stringify(input.fieldDefaults)); sets.push(`field_defaults = $${idx++}`); }
    if (input.metadata !== undefined) { params.push(JSON.stringify(input.metadata)); sets.push(`metadata = $${idx++}`); }
    if (input.isPublic !== undefined) { params.push(input.isPublic); sets.push(`is_public = $${idx++}`); }
    if (sets.length === 0) return this.findTemplateById(id, tenantId);
    sets.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const result = await this.pool.query(
      `UPDATE ticket_templates SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? this.mapTemplateRow(result.rows[0]) : null;
  }

  async deleteTemplate(id: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM ticket_templates WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return (result.rowCount ?? 0) > 0;
  }

  async incrementTemplateUsage(id: string, tenantId: string): Promise<void> {
    await this.pool.query(
      'UPDATE ticket_templates SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  }

  async countTemplates(tenantId: string, category?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM ticket_templates WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (category) { params.push(category); query += ` AND category = $2`; }
    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  // ==================== Automation Rules ====================

  async createAutomationRule(input: CreateAutomationRuleInput, tenantId: string): Promise<AutomationRule> {
    const id = `AR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO automation_rules (id, tenant_id, name, description, enabled, priority, conditions, actions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        id,
        tenantId,
        input.name,
        input.description || null,
        input.enabled ?? true,
        input.priority ?? 0,
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        input.createdBy || null,
      ]
    );
    return this.mapAutomationRuleRow(result.rows[0]);
  }

  async findAutomationRuleById(id: string, tenantId: string): Promise<AutomationRule | null> {
    const result = await this.pool.query(
      'SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapAutomationRuleRow(result.rows[0]) : null;
  }

  async findAllAutomationRules(tenantId: string, options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<AutomationRule[]> {
    let query = 'SELECT * FROM automation_rules WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;
    if (options?.enabled !== undefined) { params.push(options.enabled); query += ` AND enabled = $${paramIndex++}`; }
    query += ' ORDER BY priority DESC, created_at DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${paramIndex++}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${paramIndex++}`; }
    const result = await this.pool.query(query, params);
    return result.rows.map(r => this.mapAutomationRuleRow(r));
  }

  async updateAutomationRule(id: string, input: UpdateAutomationRuleInput, tenantId: string): Promise<AutomationRule | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${idx++}`); }
    if (input.description !== undefined) { params.push(input.description); sets.push(`description = $${idx++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); sets.push(`enabled = $${idx++}`); }
    if (input.priority !== undefined) { params.push(input.priority); sets.push(`priority = $${idx++}`); }
    if (input.conditions !== undefined) { params.push(JSON.stringify(input.conditions)); sets.push(`conditions = $${idx++}`); }
    if (input.actions !== undefined) { params.push(JSON.stringify(input.actions)); sets.push(`actions = $${idx++}`); }
    if (sets.length === 0) return this.findAutomationRuleById(id, tenantId);
    sets.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const result = await this.pool.query(
      `UPDATE automation_rules SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? this.mapAutomationRuleRow(result.rows[0]) : null;
  }

  async deleteAutomationRule(id: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM automation_rules WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return (result.rowCount ?? 0) > 0;
  }

  async incrementAutomationRuleExecution(id: string, tenantId: string): Promise<void> {
    await this.pool.query(
      'UPDATE automation_rules SET execution_count = execution_count + 1, last_executed = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  }

  async createAutomationRuleExecution(execution: Omit<AutomationRuleExecution, 'id' | 'executedAt'>): Promise<AutomationRuleExecution> {
    const id = `EXEC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.pool.query(
      `INSERT INTO automation_rule_executions (id, rule_id, ticket_id, triggered_by, conditions_met, actions_taken, status, error_message, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        id,
        execution.ruleId,
        execution.ticketId,
        execution.triggeredBy,
        JSON.stringify(execution.conditionsMet),
        JSON.stringify(execution.actionsTaken),
        execution.status,
        execution.errorMessage || null,
        execution.completedAt || null,
      ]
    );
    return this.mapAutomationRuleExecutionRow(result.rows[0]);
  }

  async updateAutomationRuleExecution(id: string, updates: { status?: string; errorMessage?: string; completedAt?: Date }): Promise<AutomationRuleExecution | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (updates.status !== undefined) { params.push(updates.status); sets.push(`status = $${idx++}`); }
    if (updates.errorMessage !== undefined) { params.push(updates.errorMessage); sets.push(`error_message = $${idx++}`); }
    if (updates.completedAt !== undefined) { params.push(updates.completedAt); sets.push(`completed_at = $${idx++}`); }
    if (sets.length === 0) return null;
    params.push(id);
    const result = await this.pool.query(
      `UPDATE automation_rule_executions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? this.mapAutomationRuleExecutionRow(result.rows[0]) : null;
  }

  async getAutomationRuleExecutionsByRule(ruleId: string, tenantId: string, limit = 50): Promise<AutomationRuleExecution[]> {
    const result = await this.pool.query(
      `SELECT e.* FROM automation_rule_executions e
       JOIN automation_rules r ON e.rule_id = r.id
       WHERE r.id = $1 AND r.tenant_id = $2
       ORDER BY e.executed_at DESC LIMIT $3`,
      [ruleId, tenantId, limit]
    );
    return result.rows.map(r => this.mapAutomationRuleExecutionRow(r));
  }

  async getAutomationRuleExecutionsByTicket(ticketId: string, tenantId: string): Promise<AutomationRuleExecution[]> {
    const result = await this.pool.query(
      `SELECT e.* FROM automation_rule_executions e
       JOIN automation_rules r ON e.rule_id = r.id
       WHERE e.ticket_id = $1 AND r.tenant_id = $2
       ORDER BY e.executed_at DESC`,
      [ticketId, tenantId]
    );
    return result.rows.map(r => this.mapAutomationRuleExecutionRow(r));
  }

  async getEnabledAutomationRules(tenantId: string): Promise<AutomationRule[]> {
    const result = await this.pool.query(
      'SELECT * FROM automation_rules WHERE tenant_id = $1 AND enabled = true ORDER BY priority DESC, created_at ASC',
      [tenantId]
    );
    return result.rows.map(r => this.mapAutomationRuleRow(r));
  }

  // ==================== SLA Visualization ====================

  async getTicketSLAStatus(ticketId: string, tenantId: string): Promise<TicketSLAStatus | null> {
    const ticket = await this.findById(ticketId, tenantId);
    if (!ticket) return null;
    const sla = await this.getSLA(ticketId, tenantId);
    if (!sla) return null;

    const now = new Date();
    const createdAt = ticket.created_at;
    const elapsedTimeMs = now.getTime() - createdAt.getTime();
    const targetResolutionTimeMs = sla.targetResolutionTimeMs || 0;
    const remainingTimeMs = targetResolutionTimeMs - elapsedTimeMs;
    const percentUsed = targetResolutionTimeMs > 0 ? Math.round((elapsedTimeMs / targetResolutionTimeMs) * 100) : 0;

    const warningThreshold = 0.8;
    const resolutionBreached = remainingTimeMs < 0;
    const responseBreached = sla.responseBreached;

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
      targetResponseTimeMs: Math.round(targetResolutionTimeMs * 0.25),
      elapsedTimeMs,
      remainingTimeMs: Math.max(0, remainingTimeMs),
      percentUsed: Math.min(100, percentUsed),
      responseBreached,
      resolutionBreached,
      firstResponseAt: sla.firstResponseAt,
      resolvedAt: sla.resolvedAt,
      breachAt: resolutionBreached ? new Date(createdAt.getTime() + targetResolutionTimeMs) : undefined,
      warningThreshold,
    };
  }

  async getSLAViolations(tenantId: string, periodStart: Date, periodEnd: Date): Promise<SLAViolation[]> {
    const result = await this.pool.query(
      `SELECT s.*, t.title as ticket_title, t.priority as ticket_priority, t.status as ticket_status
       FROM ticket_sla s
       JOIN tickets t ON s.ticket_id = t.id
       WHERE t.tenant_id = $1
       AND t.created_at >= $2
       AND t.created_at <= $3
       AND (s.resolution_breached = true OR s.response_breached = true)
       ORDER BY t.created_at DESC`,
      [tenantId, periodStart, periodEnd]
    );
    return result.rows.map(r => ({
      id: r.id,
      ticketId: r.ticket_id,
      slaTargetId: r.sla_target_id,
      targetResolutionTimeMs: (r.resolution_time_minutes || 0) * 60000,
      actualResolutionTimeMs: r.resolved_at ? (r.resolved_at.getTime() - (r.created_at ? r.created_at.getTime() : 0)) : undefined,
      breached: r.resolution_breached || r.response_breached,
      breachedAt: r.resolution_breached ? r.resolved_at : undefined,
      resolvedAt: r.resolved_at,
      firstResponseAt: r.first_response_at,
      responseBreached: r.response_breached,
      ticketTitle: r.ticket_title,
      ticketPriority: r.ticket_priority,
      ticketStatus: r.ticket_status,
    }));
  }

  async getSLAComplianceStats(tenantId: string, periodStart: Date, periodEnd: Date): Promise<{ total: number; compliant: number; breached: number; rate: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE s.resolution_breached = false AND s.response_breached = false) as compliant,
              COUNT(*) FILTER (WHERE s.resolution_breached = true OR s.response_breached = true) as breached
       FROM ticket_sla s
       JOIN tickets t ON s.ticket_id = t.id
       WHERE t.tenant_id = $1
       AND t.created_at >= $2
       AND t.created_at <= $3`,
      [tenantId, periodStart, periodEnd]
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

  private mapTemplateRow(row: any): TicketTemplate {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      title: row.title,
      templateBody: row.template_body,
      category: row.category,
      priority: row.priority,
      status: row.status,
      assigneeId: row.assignee_id,
      tags: row.tags || [],
      slaTargetId: row.sla_target_id,
      workflowSteps: typeof row.workflow_steps === 'string' ? JSON.parse(row.workflow_steps) : row.workflow_steps,
      fieldDefaults: typeof row.field_defaults === 'string' ? JSON.parse(row.field_defaults) : row.field_defaults || {},
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      isPublic: row.is_public,
      usageCount: row.usage_count || 0,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAutomationRuleRow(row: any): AutomationRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      priority: row.priority,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
      executionCount: row.execution_count || 0,
      lastExecuted: row.last_executed,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAutomationRuleExecutionRow(row: any): AutomationRuleExecution {
    return {
      id: row.id,
      ruleId: row.rule_id,
      ticketId: row.ticket_id,
      triggeredBy: row.triggered_by as any,
      conditionsMet: typeof row.conditions_met === 'string' ? JSON.parse(row.conditions_met) : row.conditions_met,
      actionsTaken: typeof row.actions_taken === 'string' ? JSON.parse(row.actions_taken) : row.actions_taken,
      status: row.status as any,
      errorMessage: row.error_message,
      executedAt: row.executed_at,
      completedAt: row.completed_at,
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
