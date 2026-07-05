/**
 * TASK-801: Ticket Workflow Service
 *
 * Manages ticket state machine, status transitions,
 * auto-assignment, and escalation for overdue tickets.
 *
 * Uses PostgreSQL Repository pattern via TicketingRepository.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
  WorkflowTransition,
  WorkflowHistory,
  TicketAssignment,
  AssignmentRule,
  SLATarget,
  TicketSLA,
} from './types';
import { TicketWorkflowRepository, TicketSLARepository } from '../../repositories/TicketWorkflowRepository';
import { AssignmentRuleRepository } from '../../repositories/AssignmentRuleRepository';
import { TicketingRepository, TicketRecord } from './TicketingRepository';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('LTicket-LWorkflow-LService');

/**
 * Valid workflow transitions matrix
 */
const VALID_TRANSITIONS: WorkflowTransition[] = [
  { from: 'open', to: 'assigned', allowed: true },
  { from: 'open', to: 'closed', allowed: true },
  { from: 'assigned', to: 'in-progress', allowed: true },
  { from: 'assigned', to: 'open', allowed: true },
  { from: 'assigned', to: 'closed', allowed: true },
  { from: 'in-progress', to: 'resolved', allowed: true },
  { from: 'in-progress', to: 'assigned', allowed: true },
  { from: 'resolved', to: 'closed', allowed: true },
  { from: 'resolved', to: 'open', allowed: true },
  { from: 'closed', to: 'open', allowed: true },
];

/**
 * Default SLA targets by priority
 */
const DEFAULT_SLA_TARGETS: SLATarget[] = [
  { id: 'sla-critical', name: 'Critical SLA', priority: 'critical', targetResponseTimeMs: 15 * 60 * 1000, targetResolutionTimeMs: 4 * 60 * 60 * 1000, enabled: true },
  { id: 'sla-high', name: 'High SLA', priority: 'high', targetResponseTimeMs: 1 * 60 * 60 * 1000, targetResolutionTimeMs: 8 * 60 * 60 * 1000, enabled: true },
  { id: 'sla-medium', name: 'Medium SLA', priority: 'medium', targetResponseTimeMs: 4 * 60 * 60 * 1000, targetResolutionTimeMs: 24 * 60 * 60 * 1000, enabled: true },
  { id: 'sla-low', name: 'Low SLA', priority: 'low', targetResponseTimeMs: 8 * 60 * 60 * 1000, targetResolutionTimeMs: 72 * 60 * 60 * 1000, enabled: true },
];

/**
 * Ticket Workflow Service
 *
 * Manages:
 * - State machine for ticket lifecycle
 * - Transition validation
 * - Auto-assignment based on rules
 * - Escalation for overdue tickets
 */
export class TicketWorkflowService {
  /** Assignment rules - migrated to repository */
  private assignmentRuleRepository?: AssignmentRuleRepository;
  private assignmentRules: AssignmentRule[] = []; // in-memory cache

  /** SLA targets (in-memory configuration) */
  private slaTargets: SLATarget[] = [...DEFAULT_SLA_TARGETS];

  /** Repository injection */
  private workflowRepository?: TicketWorkflowRepository;
  private slaRepository?: TicketSLARepository;
  private ticketingRepository: TicketingRepository;

  /** In-memory runtime cache (write-through, populated during operations) */
  private ticketsCache: Map<string, Ticket> = new Map();

  /** Escalation timer */
  private escalationTimer?: NodeJS.Timeout;

  constructor(options?: {
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
    ticketingRepository?: TicketingRepository;
  }) {
    const db = typeof options === 'object' ? options.db : undefined;
    if (db) {
      this.workflowRepository = new TicketWorkflowRepository(db);
      this.slaRepository = new TicketSLARepository(db);
      this.assignmentRuleRepository = new AssignmentRuleRepository(db);
    }
    if (options && options.ticketingRepository) {
      this.ticketingRepository = options.ticketingRepository;
    } else {
      throw new OrionError('TicketingRepository is required for TicketWorkflowService', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Load assignment rules from PostgreSQL on startup
   */
  async loadFromDb(): Promise<void> {
    if (this.assignmentRuleRepository) {
      const { entities } = await this.assignmentRuleRepository.findAll();
      this.assignmentRules = entities.map(e => ({
        id: e.id,
        name: e.name,
        categories: e.categories as any,
        assignee: e.assignee,
        priorities: e.priorities as any,
        enabled: e.enabled,
        order: e.ruleOrder,
      }));
    }
  }

  /** Escalation intervals (ms per priority) */
  private escalationIntervals: Record<TicketPriority, number> = {
    critical: 30 * 60 * 1000,   // 30 min
    high: 2 * 60 * 60 * 1000,   // 2 hours
    medium: 8 * 60 * 60 * 1000, // 8 hours
    low: 24 * 60 * 60 * 1000,   // 24 hours
  };

  /**
   * Create a new ticket
   */
  async createTicket(ticket: Ticket): Promise<Ticket> {
    // Create initial workflow history
    const history: WorkflowHistory = {
      id: `WH-${uuidv4()}`,
      ticketId: ticket.id,
      fromStatus: 'open',
      toStatus: ticket.status,
      performedBy: ticket.reporter,
      performedAt: new Date(),
      reason: 'Ticket created',
    };

    // Create SLA tracking
    const slaTarget = this.getSLATarget(ticket.priority);
    if (slaTarget) {
      const dueDate = new Date(ticket.createdAt.getTime() + slaTarget.targetResolutionTimeMs);
      ticket.dueDate = dueDate;
    }

    // Persist to repository
    const tenantId = getCurrentTraceId() || '';
    try {
      await this.ticketingRepository.createWorkflowHistory(
        ticket.id, 'open', ticket.status, ticket.reporter, 'Ticket created', tenantId
      );
      if (slaTarget) {
        await this.ticketingRepository.createSLA(
          ticket.id, ticket.priority, slaTarget.targetResolutionTimeMs, tenantId
        );
      }
    } catch (err) {
      const message = `[TicketWorkflowService] Failed to persist ticket to repository: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }

    // Update cache
    this.ticketsCache.set(ticket.id, { ...ticket });

    return { ...ticket };
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(ticketId: string): Promise<Ticket | undefined> {
    // Check cache first
    const cached = this.ticketsCache.get(ticketId);
    if (cached) return cached;

    // Fetch from repository
    const tid = getCurrentTraceId() || '';
    const record = await this.ticketingRepository.findById(ticketId, tid);
    if (record) {
      const ticket = this.mapRecordToTicket(record);
      this.ticketsCache.set(ticketId, ticket);
      return ticket;
    }
    return undefined;
  }

  /**
   * List tickets with optional filters
   */
  async listTickets(filter?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignee?: string;
    reporter?: string;
  }): Promise<Ticket[]> {
    try {
      const records = await this.ticketingRepository.findAll({
        status: filter?.status,
        assigneeId: filter?.assignee,
      });
      let tickets = records.map(r => this.mapRecordToTicket(r));
      if (filter?.priority) tickets = tickets.filter(t => t.priority === filter.priority);
      if (filter?.reporter) tickets = tickets.filter(t => t.reporter === filter.reporter);

      // Update cache
      for (const t of tickets) {
        this.ticketsCache.set(t.id, t);
      }
      return tickets;
    } catch (err) {
      const message = `[TicketWorkflowService] Repository list failed: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }
  }

  /** Map database record to Ticket interface */
  private mapRecordToTicket(record: TicketRecord): Ticket {
    return {
      id: record.id,
      title: record.title,
      description: record.description || '',
      category: (record.type as TicketCategory) || 'other',
      priority: (record.priority as TicketPriority) || 'medium',
      status: record.status as TicketStatus,
      assignee: record.assignee_id || undefined,
      reporter: record.reporter_id || '',
      source: (record.source as TicketSource) || 'manual',
      sourceAlertId: record.source_id || undefined,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      escalationLevel: 0,
      tags: Array.isArray(record.tags)
        ? Object.fromEntries(record.tags.map((t: string) => [t, '']))
        : (record.tags as Record<string, string> || {}),
      dueDate: record.resolved_at ? new Date(record.resolved_at.getTime() + 24 * 60 * 60 * 1000) : undefined,
    };
  }

  /**
   * Update an existing ticket
   */
  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const existing = await this.getTicket(ticketId);
    if (!existing) return null;

    // Persist to repository
    try {
      const dbUpdates: any = {};
      if (updates.title) dbUpdates.title = updates.title;
      if (updates.description) dbUpdates.description = updates.description;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.assignee) dbUpdates.assignee_id = updates.assignee;
      await this.ticketingRepository.update(ticketId, dbUpdates, getCurrentTraceId() || '');
    } catch (err) {
      const message = `[TicketWorkflowService] Failed to persist update: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.ticketsCache.set(ticketId, updated);
    return updated;
  }

  /**
   * Validate if a status transition is allowed
   */
  canTransition(from: TicketStatus, to: TicketStatus): boolean {
    return VALID_TRANSITIONS.some(t => t.from === from && t.to === to && t.allowed);
  }

  /**
   * Get allowed transitions from a status
   */
  getAllowedTransitions(from: TicketStatus): TicketStatus[] {
    return VALID_TRANSITIONS
      .filter(t => t.from === from && t.allowed)
      .map(t => t.to);
  }

  /**
   * Transition a ticket to a new status
   */
  async transitionStatus(
    ticketId: string,
    toStatus: TicketStatus,
    performedBy: string,
    reason?: string
  ): Promise<{ ticket: Ticket; history: WorkflowHistory } | { error: string }> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { error: `Ticket ${ticketId} not found` };
    }

    if (!this.canTransition(ticket.status, toStatus)) {
      return { error: `Cannot transition from ${ticket.status} to ${toStatus}` };
    }

    const fromStatus = ticket.status;
    ticket.status = toStatus;
    ticket.updatedAt = new Date();

    // Record workflow history
    const history: WorkflowHistory = {
      id: `WH-${uuidv4()}`,
      ticketId,
      fromStatus,
      toStatus,
      performedBy,
      performedAt: new Date(),
      reason,
    };

    // Persist to repository
    try {
      await this.ticketingRepository.createWorkflowHistory(
        ticketId, fromStatus, toStatus, performedBy, reason, getCurrentTraceId() || ''
      );
    } catch (err) {
      const message = `[TicketWorkflowService] Failed to persist workflow history: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }

    // Update SLA tracking on resolution
    if (toStatus === 'resolved' || toStatus === 'closed') {
      try {
        await this.ticketingRepository.updateSLA(ticketId, { resolvedAt: new Date() }, getCurrentTraceId() || '');
      } catch (err) {
        const message = `[TicketWorkflowService] Failed to update SLA: ${err}`;
        logger.error(message);
        throw new OrionError(message, 'OPERATION_FAILED');
      }
    }

    // Re-open: reset SLA breach status
    if (toStatus === 'open' && fromStatus === 'resolved') {
      try {
        await this.ticketingRepository.updateSLA(ticketId, {
          responseBreached: false,
          resolutionBreached: false,
        }, getCurrentTraceId() || '');
      } catch (err) {
        const message = `[TicketWorkflowService] Failed to reset SLA: ${err}`;
        logger.error(message);
        throw new OrionError(message, 'OPERATION_FAILED');
      }
    }

    this.ticketsCache.set(ticketId, ticket);

    return { ticket, history };
  }

  /**
   * Assign a ticket to a user
   */
  async assignTicket(
    ticketId: string,
    assignee: string,
    assignedBy: string,
    reason?: string
  ): Promise<{ ticket: Ticket; assignment: TicketAssignment } | { error: string }> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { error: `Ticket ${ticketId} not found` };
    }

    if (ticket.status === 'closed') {
      return { error: 'Cannot assign a closed ticket' };
    }

    const assignment: TicketAssignment = {
      id: `ASGN-${uuidv4()}`,
      ticketId,
      assignee,
      assignedBy,
      assignedAt: new Date(),
      reason: reason || 'Manual assignment',
    };

    const prevStatus = ticket.status;
    ticket.assignee = assignee;
    ticket.updatedAt = new Date();

    // Auto-transition from open to assigned
    if (ticket.status === 'open') {
      ticket.status = 'assigned';
    }

    const tid = getCurrentTraceId() || '';
    // Persist to repository
    try {
      await this.ticketingRepository.update(ticketId, { status: ticket.status, assignee_id: assignee }, tid);
      await this.ticketingRepository.createAssignment({
        ticketId, assignee, assignedBy, reason: reason || 'Manual assignment',
      }, tid);
      if (prevStatus === 'open') {
        await this.ticketingRepository.createWorkflowHistory(
          ticketId, prevStatus, 'assigned', assignedBy, 'Auto-transitioned on assignment', tid
        );
      }
    } catch (err) {
      const message = `[TicketWorkflowService] Failed to persist assignment: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }

    this.ticketsCache.set(ticketId, ticket);

    return { ticket, assignment };
  }

  /**
   * Add an assignment rule
   */
  addAssignmentRule(rule: AssignmentRule): void {
    this.assignmentRules.push(rule);
    this.assignmentRules.sort((a, b) => a.order - b.order);

    // Persist to repository
    if (this.assignmentRuleRepository) {
      this.assignmentRuleRepository.create({
        id: rule.id,
        name: rule.name,
        categories: rule.categories,
        assignee: rule.assignee,
        priorities: rule.priorities || null,
        enabled: rule.enabled,
        ruleOrder: rule.order,
      }).catch(() => {/* ignore */});
    }
  }

  /**
   * Get all assignment rules
   */
  getAssignmentRules(): AssignmentRule[] {
    return [...this.assignmentRules];
  }

  /**
   * Remove an assignment rule
   */
  removeAssignmentRule(ruleId: string): boolean {
    const idx = this.assignmentRules.findIndex(r => r.id === ruleId);
    if (idx === -1) return false;
    this.assignmentRules.splice(idx, 1);

    // Persist deletion to repository
    if (this.assignmentRuleRepository) {
      this.assignmentRuleRepository.delete(ruleId).catch(() => {/* ignore */});
    }

    return true;
  }

  /**
   * Auto-assign a ticket based on rules
   */
  async autoAssignTicket(
    ticketId: string,
    assignedBy: string = 'system'
  ): Promise<{ ticket: Ticket; assignment: TicketAssignment } | { error: string } | null> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { error: `Ticket ${ticketId} not found` };
    }

    if (ticket.assignee) {
      return null; // Already assigned
    }

    // Find matching rule
    const matchingRule = this.assignmentRules.find(rule => {
      if (!rule.enabled) return false;
      if (!rule.categories.includes(ticket.category)) return false;
      if (rule.priorities && rule.priorities.length > 0 && !rule.priorities.includes(ticket.priority)) {
        return false;
      }
      return true;
    });

    if (!matchingRule) {
      return null; // No matching rule
    }

    return this.assignTicket(ticketId, matchingRule.assignee, assignedBy, `Auto-assigned by rule: ${matchingRule.name}`);
  }

  /**
   * Escalate a ticket
   */
  async escalateTicket(
    ticketId: string,
    escalatedBy: string,
    reason?: string
  ): Promise<{ ticket: Ticket } | { error: string }> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return { error: `Ticket ${ticketId} not found` };
    }

    ticket.escalationLevel += 1;
    ticket.updatedAt = new Date();

    // Optionally bump priority on escalation
    if (ticket.escalationLevel >= 2 && ticket.priority !== 'critical') {
      const priorityOrder: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
      const idx = priorityOrder.indexOf(ticket.priority);
      if (idx < priorityOrder.length - 1) {
        ticket.priority = priorityOrder[idx + 1];
      }
    }

    const history: WorkflowHistory = {
      id: `WH-${uuidv4()}`,
      ticketId,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      performedBy: escalatedBy,
      performedAt: new Date(),
      reason: reason || `Escalated to level ${ticket.escalationLevel}`,
    };

    this.ticketsCache.set(ticketId, ticket);

    const tid2 = getCurrentTraceId() || '';
    // Persist to repository
    try {
      await this.ticketingRepository.update(ticketId, {
        priority: ticket.priority,
      }, tid2);
      await this.ticketingRepository.createWorkflowHistory(
        ticketId, ticket.status, ticket.status, escalatedBy,
        reason || `Escalated to level ${ticket.escalationLevel}`, tid2
      );
    } catch (err) {
      const message = `[TicketWorkflowService] Failed to persist escalation: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }

    return { ticket };
  }

  /**
   * Check and auto-escalate overdue tickets
   */
  async checkAndEscalateOverdue(): Promise<Ticket[]> {
    const escalated: Ticket[] = [];
    const now = Date.now();

    const tickets = await this.listTickets();

    for (const ticket of tickets) {
      // Skip closed/resolved tickets
      if (ticket.status === 'closed' || ticket.status === 'resolved') continue;

      // Skip already highly escalated
      if (ticket.escalationLevel >= 3) continue;

      const sla = await this.ticketingRepository.getSLA(ticket.id, getCurrentTraceId() || '');
      if (!sla) continue;

      const age = now - ticket.createdAt.getTime();
      const escalationThreshold = this.escalationIntervals[ticket.priority];

      if (age > escalationThreshold) {
        const result = await this.escalateTicket(ticket.id, 'system', `Auto-escalated: exceeded ${ticket.priority} threshold`);
        if ('ticket' in result) {
          escalated.push(result.ticket);
        }
      }
    }

    return escalated;
  }

  /**
   * Start periodic escalation checks
   */
  startEscalationChecks(intervalMs: number = 5 * 60 * 1000): void {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
    }

    this.escalationTimer = setInterval(async () => {
      const escalated = await this.checkAndEscalateOverdue();
      if (escalated.length > 0) {
        logger.info(`[TicketWorkflowService] Auto-escalated ${escalated.length} overdue tickets`);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic escalation checks
   */
  stopEscalationChecks(): void {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
      this.escalationTimer = undefined;
    }
  }

  /**
   * Get workflow history for a ticket
   */
  async getWorkflowHistory(ticketId: string): Promise<WorkflowHistory[]> {
    if (this.workflowRepository) {
      const entities = await this.workflowRepository.findByTicketId(ticketId);
      return entities.map(e => ({
        id: e.id,
        ticketId: e.ticketId,
        fromStatus: e.fromStatus as TicketStatus,
        toStatus: e.toStatus as TicketStatus,
        performedBy: e.triggeredBy ?? 'system',
        performedAt: e.createdAt,
        reason: e.comment,
      }));
    }
    try {
      return await this.ticketingRepository.getWorkflowHistory(ticketId, getCurrentTraceId() || '');
    } catch (err) {
      const message = `[TicketWorkflowService] Repository getWorkflowHistory failed: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }
  }

  /**
   * Get assignment history for a ticket
   */
  async getAssignmentHistory(ticketId: string): Promise<TicketAssignment[]> {
    try {
      return await this.ticketingRepository.getAssignmentsByTicket(ticketId, getCurrentTraceId() || '');
    } catch (err) {
      const message = `[TicketWorkflowService] Repository getAssignmentHistory failed: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }
  }

  /**
   * Add SLA target
   */
  addSLATarget(target: SLATarget): void {
    // Replace existing target with same priority if exists
    const idx = this.slaTargets.findIndex(t => t.priority === target.priority);
    if (idx >= 0) {
      this.slaTargets[idx] = target;
    } else {
      this.slaTargets.push(target);
    }
  }

  /**
   * Get SLA target for a priority
   */
  getSLATarget(priority: TicketPriority): SLATarget | undefined {
    return this.slaTargets.find(t => t.priority === priority && t.enabled);
  }

  /**
   * Get SLA tracking for a ticket
   */
  async getTicketSLA(ticketId: string): Promise<TicketSLA | undefined> {
    try {
      const sla = await this.ticketingRepository.getSLA(ticketId, getCurrentTraceId() || '');
      return sla || undefined;
    } catch (err) {
      const message = `[TicketWorkflowService] Repository getTicketSLA failed: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }
  }

  /**
   * Get all SLA tracking records
   */
  async getAllSLARecords(): Promise<TicketSLA[]> {
    try {
      return await this.ticketingRepository.getAllSLA(getCurrentTraceId() || '');
    } catch (err) {
      const message = `[TicketWorkflowService] Repository getAllSLARecords failed: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }
  }

  /**
   * Resolve a ticket with notes
   */
  async resolveTicket(ticketId: string, performedBy: string, resolutionNote?: string): Promise<{ ticket: Ticket } | { error: string }> {
    const result = await this.transitionStatus(ticketId, 'resolved', performedBy, resolutionNote);
    if ('error' in result) return result;

    const ticket = result.ticket;
    if (resolutionNote) {
      ticket.resolutionNote = resolutionNote;
      this.ticketsCache.set(ticketId, ticket);
    }

    return { ticket };
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string, performedBy: string, reason?: string): Promise<{ ticket: Ticket } | { error: string }> {
    const result = await this.transitionStatus(ticketId, 'closed', performedBy, reason);
    if ('error' in result) return result;
    return { ticket: result.ticket };
  }

  /**
   * Get ticket count by status
   */
  async getCountsByStatus(): Promise<Record<TicketStatus, number>> {
    const counts: Record<string, number> = {
      'open': 0,
      'assigned': 0,
      'in-progress': 0,
      'resolved': 0,
      'closed': 0,
    };

    const tickets = await this.listTickets();
    for (const ticket of tickets) {
      counts[ticket.status] = (counts[ticket.status] || 0) + 1;
    }

    return counts as Record<TicketStatus, number>;
  }

  /**
   * Get total ticket count
   */
  async getTotalCount(): Promise<number> {
    try {
      return await this.ticketingRepository.count();
    } catch (err) {
      const message = `[TicketWorkflowService] Repository count failed: ${err}`;
      logger.error(message);
      throw new OrionError(message, 'OPERATION_FAILED');
    }
  }

  /**
   * Clear cache (for testing)
   */
  clearAll(): void {
    this.ticketsCache.clear();
    this.assignmentRules = [];
    this.stopEscalationChecks();
  }
}
