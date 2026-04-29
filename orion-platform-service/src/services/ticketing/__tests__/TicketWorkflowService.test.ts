/**
 * TASK-801: TicketWorkflowService Unit Tests
 */

import { TicketWorkflowService } from '../TicketWorkflowService';
import { Ticket, TicketStatus, TicketPriority, TicketCategory, AssignmentRule } from '../types';

describe('TicketWorkflowService', () => {
  let workflow: TicketWorkflowService;

  beforeEach(() => {
    workflow = new TicketWorkflowService();
  });

  afterEach(() => {
    workflow.stopEscalationChecks();
  });

  // Helper to create a test ticket
  function createTestTicket(overrides?: Partial<Ticket>): Ticket {
    const now = new Date();
    return {
      id: `TKT-test-${Date.now()}`,
      title: 'Test Ticket',
      description: 'Test description',
      category: 'infrastructure',
      priority: 'medium',
      status: 'open',
      reporter: 'test-user',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      escalationLevel: 0,
      ...overrides,
    };
  }

  // ==================== createTicket ====================

  describe('createTicket', () => {
    it('should create a ticket with open status', () => {
      const ticket = createTestTicket();
      const created = workflow.createTicket(ticket);

      expect(created.id).toBe(ticket.id);
      expect(created.status).toBe('open');
    });

    it('should create workflow history on creation', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      const history = await workflow.getWorkflowHistory(ticket.id);
      expect(history.length).toBe(1);
      expect(history[0].fromStatus).toBe('open');
      expect(history[0].toStatus).toBe('open');
      expect(history[0].reason).toBe('Ticket created');
    });

    it('should create SLA tracking for the ticket', () => {
      const ticket = createTestTicket({ priority: 'critical' });
      workflow.createTicket(ticket);

      const sla = workflow.getTicketSLA(ticket.id);
      expect(sla).toBeDefined();
      expect(sla!.breached).toBe(false);
    });

    it('should set due date based on SLA', () => {
      const ticket = createTestTicket({ priority: 'critical' });
      const created = workflow.createTicket(ticket);

      expect(created.dueDate).toBeDefined();
      expect(created.dueDate!.getTime()).toBeGreaterThan(ticket.createdAt.getTime());
    });
  });

  // ==================== getTicket / listTickets ====================

  describe('getTicket and listTickets', () => {
    it('should get a ticket by ID', () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      const found = workflow.getTicket(ticket.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(ticket.id);
    });

    it('should return undefined for non-existent ticket', () => {
      expect(workflow.getTicket('non-existent')).toBeUndefined();
    });

    it('should list all tickets', () => {
      workflow.createTicket(createTestTicket({ id: 't1' }));
      workflow.createTicket(createTestTicket({ id: 't2' }));

      const tickets = workflow.listTickets();
      expect(tickets.length).toBe(2);
    });

    it('should filter tickets by status', () => {
      workflow.createTicket(createTestTicket({ id: 't1', status: 'open' }));
      workflow.createTicket(createTestTicket({ id: 't2', status: 'open' }));
      workflow.createTicket(createTestTicket({ id: 't3', status: 'resolved' }));

      const openTickets = workflow.listTickets({ status: 'open' });
      expect(openTickets.length).toBe(2);
    });

    it('should filter tickets by priority', () => {
      workflow.createTicket(createTestTicket({ id: 't1', priority: 'critical' }));
      workflow.createTicket(createTestTicket({ id: 't2', priority: 'low' }));

      const critical = workflow.listTickets({ priority: 'critical' });
      expect(critical.length).toBe(1);
      expect(critical[0].id).toBe('t1');
    });

    it('should filter tickets by assignee', () => {
      workflow.createTicket(createTestTicket({ id: 't1', assignee: 'user-a' }));
      workflow.createTicket(createTestTicket({ id: 't2', assignee: 'user-b' }));

      const tickets = workflow.listTickets({ assignee: 'user-a' });
      expect(tickets.length).toBe(1);
    });

    it('should sort tickets by creation date (newest first)', () => {
      workflow.createTicket(createTestTicket({ id: 't1', createdAt: new Date('2024-01-01') }));
      workflow.createTicket(createTestTicket({ id: 't2', createdAt: new Date('2024-01-02') }));

      const tickets = workflow.listTickets();
      expect(tickets[0].id).toBe('t2');
      expect(tickets[1].id).toBe('t1');
    });
  });

  // ==================== transitionStatus ====================

  describe('transitionStatus', () => {
    it('should transition open -> assigned', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      const result = await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('assigned');
    });

    it('should transition assigned -> in-progress', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');

      const result = await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('in-progress');
    });

    it('should transition in-progress -> resolved', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');

      const result = await workflow.transitionStatus(ticket.id, 'resolved', 'user-1');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('resolved');
    });

    it('should transition resolved -> closed', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');
      await workflow.transitionStatus(ticket.id, 'resolved', 'user-1');

      const result = await workflow.transitionStatus(ticket.id, 'closed', 'user-1');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('closed');
    });

    it('should reject invalid transition', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      // Cannot go from open directly to resolved
      const result = await workflow.transitionStatus(ticket.id, 'resolved', 'user-1');
      expect('error' in result).toBe(true);
    });

    it('should record workflow history', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1', 'Auto-assigned');

      const history = await workflow.getWorkflowHistory(ticket.id);
      expect(history.length).toBe(2); // creation + transition
      expect(history[1].fromStatus).toBe('open');
      expect(history[1].toStatus).toBe('assigned');
      expect(history[1].performedBy).toBe('user-1');
      expect(history[1].reason).toBe('Auto-assigned');
    });

    it('should return error for non-existent ticket', async () => {
      const result = await workflow.transitionStatus('non-existent', 'assigned', 'user-1');
      expect('error' in result).toBe(true);
    });
  });

  // ==================== canTransition ====================

  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      expect(workflow.canTransition('open', 'assigned')).toBe(true);
      expect(workflow.canTransition('assigned', 'in-progress')).toBe(true);
      expect(workflow.canTransition('in-progress', 'resolved')).toBe(true);
      expect(workflow.canTransition('resolved', 'closed')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(workflow.canTransition('open', 'resolved')).toBe(false);
      expect(workflow.canTransition('open', 'in-progress')).toBe(false);
      expect(workflow.canTransition('closed', 'resolved')).toBe(false);
    });

    it('should allow re-open from resolved', () => {
      expect(workflow.canTransition('resolved', 'open')).toBe(true);
    });

    it('should allow re-open from closed', () => {
      expect(workflow.canTransition('closed', 'open')).toBe(true);
    });
  });

  // ==================== getAllowedTransitions ====================

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions from open', () => {
      const transitions = workflow.getAllowedTransitions('open');
      expect(transitions).toContain('assigned');
      expect(transitions).toContain('closed');
    });

    it('should return allowed transitions from assigned', () => {
      const transitions = workflow.getAllowedTransitions('assigned');
      expect(transitions).toContain('in-progress');
      expect(transitions).toContain('open');
      expect(transitions).toContain('closed');
    });

    it('should return allowed transitions from in-progress', () => {
      const transitions = workflow.getAllowedTransitions('in-progress');
      expect(transitions).toContain('resolved');
      expect(transitions).toContain('assigned');
    });
  });

  // ==================== assignTicket ====================

  describe('assignTicket', () => {
    it('should assign a ticket', () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      const result = workflow.assignTicket(ticket.id, 'user-1', 'admin');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.assignee).toBe('user-1');
    });

    it('should auto-transition from open to assigned', () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      workflow.assignTicket(ticket.id, 'user-1', 'admin');
      const found = workflow.getTicket(ticket.id);
      expect(found!.status).toBe('assigned');
    });

    it('should record assignment history', () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      workflow.assignTicket(ticket.id, 'user-1', 'admin', 'Manual assignment');
      const history = workflow.getAssignmentHistory(ticket.id);
      expect(history.length).toBe(1);
      expect(history[0].assignee).toBe('user-1');
      expect(history[0].reason).toBe('Manual assignment');
    });

    it('should reject assigning closed ticket', () => {
      const ticket = createTestTicket({ status: 'closed' } as any);
      workflow.createTicket(ticket);

      const result = workflow.assignTicket(ticket.id, 'user-1', 'admin');
      expect('error' in result).toBe(true);
    });

    it('should return error for non-existent ticket', () => {
      const result = workflow.assignTicket('non-existent', 'user-1', 'admin');
      expect('error' in result).toBe(true);
    });
  });

  // ==================== escalateTicket ====================

  describe('escalateTicket', () => {
    it('should increase escalation level', () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);

      const result = workflow.escalateTicket(ticket.id, 'admin');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.escalationLevel).toBe(1);
    });

    it('should bump priority after 2 escalations', () => {
      const ticket = createTestTicket({ priority: 'medium' });
      workflow.createTicket(ticket);

      workflow.escalateTicket(ticket.id, 'admin');
      workflow.escalateTicket(ticket.id, 'admin');

      const found = workflow.getTicket(ticket.id);
      expect(found!.priority).toBe('high');
      expect(found!.escalationLevel).toBe(2);
    });

    it('should not exceed critical priority', () => {
      const ticket = createTestTicket({ priority: 'critical' });
      workflow.createTicket(ticket);

      workflow.escalateTicket(ticket.id, 'admin');
      workflow.escalateTicket(ticket.id, 'admin');

      const found = workflow.getTicket(ticket.id);
      expect(found!.priority).toBe('critical');
    });

    it('should return error for non-existent ticket', () => {
      const result = workflow.escalateTicket('non-existent', 'admin');
      expect('error' in result).toBe(true);
    });
  });

  // ==================== autoAssignTicket ====================

  describe('autoAssignTicket', () => {
    beforeEach(() => {
      // Add assignment rules
      workflow.addAssignmentRule({
        id: 'rule-infra',
        name: 'Infra Team',
        categories: ['infrastructure'],
        assignee: 'infra-team',
        enabled: true,
        order: 1,
      });

      workflow.addAssignmentRule({
        id: 'rule-db',
        name: 'DB Team',
        categories: ['database'],
        assignee: 'db-team',
        priorities: ['critical', 'high'],
        enabled: true,
        order: 2,
      });
    });

    it('should auto-assign based on category rule', () => {
      const ticket = createTestTicket({ category: 'infrastructure' });
      workflow.createTicket(ticket);

      const result = workflow.autoAssignTicket(ticket.id);
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
      if (result && 'ticket' in result) {
        expect(result.ticket.assignee).toBe('infra-team');
      }
    });

    it('should not auto-assign if no matching rule', () => {
      const ticket = createTestTicket({ category: 'network' });
      workflow.createTicket(ticket);

      const result = workflow.autoAssignTicket(ticket.id);
      expect(result).toBeNull();
    });

    it('should not re-assign already assigned ticket', () => {
      const ticket = createTestTicket({ category: 'infrastructure', assignee: 'user-1' });
      workflow.createTicket(ticket);

      const result = workflow.autoAssignTicket(ticket.id);
      expect(result).toBeNull();
    });

    it('should respect priority filter on rules', () => {
      const ticket = createTestTicket({ category: 'database', priority: 'low' });
      workflow.createTicket(ticket);

      const result = workflow.autoAssignTicket(ticket.id);
      expect(result).toBeNull(); // DB rule only applies to critical/high
    });

    it('should respect rule order', () => {
      workflow.addAssignmentRule({
        id: 'rule-all',
        name: 'Catch All',
        categories: ['infrastructure', 'database', 'network'],
        assignee: 'general-team',
        enabled: true,
        order: 0, // Higher priority than infra rule
      });

      const ticket = createTestTicket({ category: 'infrastructure' });
      workflow.createTicket(ticket);

      const result = workflow.autoAssignTicket(ticket.id);
      expect(result).not.toBeNull();
      if (result && 'ticket' in result) {
        expect(result.ticket.assignee).toBe('general-team'); // Order 0 beats order 1
      }
    });
  });

  // ==================== resolveTicket ====================

  describe('resolveTicket', () => {
    it('should resolve a ticket', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');

      const result = await workflow.resolveTicket(ticket.id, 'user-1', 'Fixed the issue');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('resolved');
      expect(result.ticket.resolutionNote).toBe('Fixed the issue');
    });

    it('should record SLA resolution time', async () => {
      const pastDate = new Date(Date.now() - 5000); // 5 seconds ago
      const ticket = createTestTicket({ priority: 'critical', createdAt: pastDate, updatedAt: pastDate });
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');

      await workflow.resolveTicket(ticket.id, 'user-1');
      const sla = workflow.getTicketSLA(ticket.id);

      expect(sla).toBeDefined();
      expect(sla!.resolvedAt).toBeDefined();
      expect(sla!.actualResolutionTimeMs).toBeGreaterThanOrEqual(5000);
    });

    it('should mark SLA as breached if overdue', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago
      const ticket = createTestTicket({
        priority: 'critical',
        createdAt: pastDate,
        updatedAt: pastDate,
      });
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');

      await workflow.resolveTicket(ticket.id, 'user-1');
      const sla = workflow.getTicketSLA(ticket.id);

      expect(sla!.breached).toBe(true);
    });
  });

  // ==================== closeTicket ====================

  describe('closeTicket', () => {
    it('should close a resolved ticket', async () => {
      const ticket = createTestTicket();
      workflow.createTicket(ticket);
      await workflow.transitionStatus(ticket.id, 'assigned', 'user-1');
      await workflow.transitionStatus(ticket.id, 'in-progress', 'user-1');
      await workflow.transitionStatus(ticket.id, 'resolved', 'user-1');

      const result = await workflow.closeTicket(ticket.id, 'user-1', 'Confirmed fixed');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('closed');
    });
  });

  // ==================== getCountsByStatus ====================

  describe('getCountsByStatus', () => {
    it('should count tickets by status', () => {
      workflow.createTicket(createTestTicket({ id: 't1', status: 'open' }));
      workflow.createTicket(createTestTicket({ id: 't2', status: 'open' }));
      workflow.createTicket(createTestTicket({ id: 't3', status: 'resolved' }));

      const counts = workflow.getCountsByStatus();
      expect(counts['open']).toBe(2);
      expect(counts['resolved']).toBe(1);
      expect(counts['assigned']).toBe(0);
    });
  });

  // ==================== SLA Management ====================

  describe('SLA management', () => {
    it('should add custom SLA target', () => {
      workflow.addSLATarget({
        id: 'sla-custom',
        name: 'Custom SLA',
        priority: 'high',
        targetResponseTimeMs: 30 * 60 * 1000,
        targetResolutionTimeMs: 2 * 60 * 60 * 1000,
        enabled: true,
      });

      const sla = workflow.getSLATarget('high');
      expect(sla).toBeDefined();
      expect(sla!.id).toBe('sla-custom');
    });

    it('should get all SLA records', () => {
      workflow.createTicket(createTestTicket({ id: 't1', priority: 'critical' }));
      workflow.createTicket(createTestTicket({ id: 't2', priority: 'low' }));

      const records = workflow.getAllSLARecords();
      expect(records.length).toBe(2);
    });
  });

  // ==================== clearAll ====================

  describe('clearAll', () => {
    it('should clear all tickets', () => {
      workflow.createTicket(createTestTicket({ id: 't1' }));
      workflow.createTicket(createTestTicket({ id: 't2' }));

      workflow.clearAll();
      expect(workflow.getTotalCount()).toBe(0);
    });
  });
});
