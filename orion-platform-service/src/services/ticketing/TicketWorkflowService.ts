/**
 * TASK-801: Ticket Workflow Service
 *
 * Manages ticket state machine, status transitions,
 * auto-assignment, and escalation for overdue tickets.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  WorkflowTransition,
  WorkflowHistory,
  TicketAssignment,
  AssignmentRule,
  SLATarget,
  TicketSLA,
} from './types';
import { TicketWorkflowRepository, TicketSLARepository } from '../../repositories/TicketWorkflowRepository';

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
  /** Ticket storage */
  private tickets: Map<string, Ticket> = new Map();

  /** Workflow history */
  private workflowHistory: Map<string, WorkflowHistory[]> = new Map();

  /** Assignment records */
  private assignments: Map<string, TicketAssignment[]> = new Map();

  /** Assignment rules */
  private assignmentRules: AssignmentRule[] = [];

  /** SLA targets */
  private slaTargets: SLATarget[] = [...DEFAULT_SLA_TARGETS];

  /** SLA tracking */
  private slaTracking: Map<string, TicketSLA> = new Map();

  /** Repository injection */
  private workflowRepository?: TicketWorkflowRepository;
  private slaRepository?: TicketSLARepository;

  /** Escalation timer */
  private escalationTimer?: NodeJS.Timeout;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.workflowRepository = new TicketWorkflowRepository(db);
      this.slaRepository = new TicketSLARepository(db);
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
  createTicket(ticket: Ticket): Ticket {
    this.tickets.set(ticket.id, { ...ticket });

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
    this.workflowHistory.set(ticket.id, [history]);

    // Create SLA tracking
    const slaTarget = this.getSLATarget(ticket.priority);
    if (slaTarget) {
      const sla: TicketSLA = {
        id: `SLA-${uuidv4()}`,
        ticketId: ticket.id,
        slaTargetId: slaTarget.id,
        targetResolutionTimeMs: slaTarget.targetResolutionTimeMs,
        breached: false,
        responseBreached: false,
      };
      this.slaTracking.set(ticket.id, sla);

      // Set due date
      const dueDate = new Date(ticket.createdAt.getTime() + slaTarget.targetResolutionTimeMs);
      const t = this.tickets.get(ticket.id)!;
      t.dueDate = dueDate;
      this.tickets.set(ticket.id, t);
    }

    return this.tickets.get(ticket.id)!;
  }

  /**
   * Get a ticket by ID
   */
  getTicket(ticketId: string): Ticket | undefined {
    return this.tickets.get(ticketId);
  }

  /**
   * List tickets with optional filters
   */
  listTickets(filter?: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignee?: string;
    reporter?: string;
  }): Ticket[] {
    let tickets = Array.from(this.tickets.values());

    if (filter?.status) {
      tickets = tickets.filter(t => t.status === filter.status);
    }
    if (filter?.priority) {
      tickets = tickets.filter(t => t.priority === filter.priority);
    }
    if (filter?.category) {
      tickets = tickets.filter(t => t.category === filter.category);
    }
    if (filter?.assignee) {
      tickets = tickets.filter(t => t.assignee === filter.assignee);
    }
    if (filter?.reporter) {
      tickets = tickets.filter(t => t.reporter === filter.reporter);
    }

    // Sort by creation date (newest first)
    return tickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Update an existing ticket
   */
  updateTicket(ticketId: string, updates: Partial<Ticket>): Ticket | null {
    const existing = this.tickets.get(ticketId);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.tickets.set(ticketId, updated);
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
    const ticket = this.tickets.get(ticketId);
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

    const histList = this.workflowHistory.get(ticketId) || [];
    histList.push(history);
    this.workflowHistory.set(ticketId, histList);

    // Persist to repository
    if (this.workflowRepository) {
      try {
        await this.workflowRepository.createEntry({
          ticketId,
          fromStatus: history.fromStatus,
          toStatus: history.toStatus,
          triggeredBy: history.performedBy,
          triggeredType: 'manual',
          comment: history.reason,
        });
      } catch (err) {
        console.warn(`[TicketWorkflowService] Failed to persist workflow history: ${err}`);
      }
    }

    // Update SLA tracking on resolution
    if (toStatus === 'resolved' || toStatus === 'closed') {
      const sla = this.slaTracking.get(ticketId);
      if (sla) {
        sla.resolvedAt = new Date();
        sla.actualResolutionTimeMs = sla.resolvedAt.getTime() - ticket.createdAt.getTime();
        sla.breached = sla.actualResolutionTimeMs > sla.targetResolutionTimeMs;
        if (sla.breached) {
          sla.breachedAt = sla.resolvedAt;
        }
      }
    }

    // Re-open: reset SLA breach status
    if (toStatus === 'open' && fromStatus === 'resolved') {
      const sla = this.slaTracking.get(ticketId);
      if (sla) {
        sla.resolvedAt = undefined;
        sla.actualResolutionTimeMs = undefined;
        sla.breached = false;
        sla.breachedAt = undefined;
      }
    }

    this.tickets.set(ticketId, ticket);

    return { ticket, history };
  }

  /**
   * Assign a ticket to a user
   */
  assignTicket(
    ticketId: string,
    assignee: string,
    assignedBy: string,
    reason?: string
  ): { ticket: Ticket; assignment: TicketAssignment } | { error: string } {
    const ticket = this.tickets.get(ticketId);
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

    const assignList = this.assignments.get(ticketId) || [];
    assignList.push(assignment);
    this.assignments.set(ticketId, assignList);

    const prevStatus = ticket.status;
    ticket.assignee = assignee;
    ticket.updatedAt = new Date();

    // Auto-transition from open to assigned
    if (ticket.status === 'open') {
      ticket.status = 'assigned';

      const history: WorkflowHistory = {
        id: `WH-${uuidv4()}`,
        ticketId,
        fromStatus: prevStatus,
        toStatus: 'assigned',
        performedBy: assignedBy,
        performedAt: new Date(),
        reason: 'Auto-transitioned on assignment',
      };
      const histList = this.workflowHistory.get(ticketId) || [];
      histList.push(history);
      this.workflowHistory.set(ticketId, histList);
    }

    this.tickets.set(ticketId, ticket);

    return { ticket, assignment };
  }

  /**
   * Add an assignment rule
   */
  addAssignmentRule(rule: AssignmentRule): void {
    this.assignmentRules.push(rule);
    this.assignmentRules.sort((a, b) => a.order - b.order);
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
    return true;
  }

  /**
   * Auto-assign a ticket based on rules
   */
  autoAssignTicket(
    ticketId: string,
    assignedBy: string = 'system'
  ): { ticket: Ticket; assignment: TicketAssignment } | { error: string } | null {
    const ticket = this.tickets.get(ticketId);
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
  escalateTicket(
    ticketId: string,
    escalatedBy: string,
    reason?: string
  ): { ticket: Ticket } | { error: string } {
    const ticket = this.tickets.get(ticketId);
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

    const histList = this.workflowHistory.get(ticketId) || [];
    histList.push(history);
    this.workflowHistory.set(ticketId, histList);

    this.tickets.set(ticketId, ticket);

    return { ticket };
  }

  /**
   * Check and auto-escalate overdue tickets
   */
  checkAndEscalateOverdue(): Ticket[] {
    const escalated: Ticket[] = [];
    const now = Date.now();

    for (const ticket of this.tickets.values()) {
      // Skip closed/resolved tickets
      if (ticket.status === 'closed' || ticket.status === 'resolved') continue;

      // Skip already highly escalated
      if (ticket.escalationLevel >= 3) continue;

      const sla = this.slaTracking.get(ticket.id);
      if (!sla) continue;

      const age = now - ticket.createdAt.getTime();
      const escalationThreshold = this.escalationIntervals[ticket.priority];

      if (age > escalationThreshold) {
        const result = this.escalateTicket(ticket.id, 'system', `Auto-escalated: exceeded ${ticket.priority} threshold`);
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

    this.escalationTimer = setInterval(() => {
      const escalated = this.checkAndEscalateOverdue();
      if (escalated.length > 0) {
        console.log(`[TicketWorkflowService] Auto-escalated ${escalated.length} overdue tickets`);
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
    return this.workflowHistory.get(ticketId) || [];
  }

  /**
   * Get assignment history for a ticket
   */
  getAssignmentHistory(ticketId: string): TicketAssignment[] {
    return this.assignments.get(ticketId) || [];
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
  getTicketSLA(ticketId: string): TicketSLA | undefined {
    return this.slaTracking.get(ticketId);
  }

  /**
   * Get all SLA tracking records
   */
  getAllSLARecords(): TicketSLA[] {
    return Array.from(this.slaTracking.values());
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
      this.tickets.set(ticketId, ticket);
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
  getCountsByStatus(): Record<TicketStatus, number> {
    const counts: Record<string, number> = {
      'open': 0,
      'assigned': 0,
      'in-progress': 0,
      'resolved': 0,
      'closed': 0,
    };

    for (const ticket of this.tickets.values()) {
      counts[ticket.status] = (counts[ticket.status] || 0) + 1;
    }

    return counts as Record<TicketStatus, number>;
  }

  /**
   * Get total ticket count
   */
  getTotalCount(): number {
    return this.tickets.size;
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.tickets.clear();
    this.workflowHistory.clear();
    this.assignments.clear();
    this.slaTracking.clear();
    this.assignmentRules = [];
    this.stopEscalationChecks();
  }
}
