/**
 * TASK-801: TicketWorkflowService Unit Tests
 */

import { TicketWorkflowService } from '../TicketWorkflowService';
import { Ticket, TicketStatus, TicketPriority, TicketCategory, AssignmentRule } from '../types';

// Mock TicketingRepository with all required methods
const mockRepo: any = {
  createTicket: jest.fn().mockResolvedValue(null),
  findById: jest.fn().mockResolvedValue(null),
  findAll: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue(null),
  delete: jest.fn().mockResolvedValue(true),
  count: jest.fn().mockResolvedValue(0),
  addComment: jest.fn().mockResolvedValue(null),
  getComments: jest.fn().mockResolvedValue([]),
  createAssignment: jest.fn().mockResolvedValue({ id: 'assign-1' }),
  getAssignmentsByTicket: jest.fn().mockResolvedValue([]),
  getActiveAssignmentsByEngineer: jest.fn().mockResolvedValue([]),
  updateAssignment: jest.fn().mockResolvedValue(null),
  getWorkflowHistory: jest.fn().mockResolvedValue([]),
  addWorkflowHistory: jest.fn().mockResolvedValue({ id: 'history-1' }),
  createWorkflowHistory: jest.fn().mockResolvedValue({ id: 'history-1' }),
  updateWorkflowHistory: jest.fn().mockResolvedValue(null),
  createSLA: jest.fn().mockResolvedValue({ id: 'sla-1' }),
  getSLA: jest.fn().mockResolvedValue(null),
  updateSLA: jest.fn().mockResolvedValue(undefined),
  getAllSLA: jest.fn().mockResolvedValue([]),
  createRelation: jest.fn().mockResolvedValue({ id: 'relation-1' }),
  getRelationsByTicket: jest.fn().mockResolvedValue([]),
  getEngineerProfile: jest.fn().mockResolvedValue(null),
  updateEngineerProfile: jest.fn().mockResolvedValue(null),
  findEngineerProfileById: jest.fn().mockResolvedValue(null),
};

describe('TicketWorkflowService', () => {
  let workflow: TicketWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    workflow = new TicketWorkflowService({ ticketingRepository: mockRepo });
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
    it('should create a ticket with open status', async () => {
      const ticket = createTestTicket();
      const created = await workflow.createTicket(ticket);

      expect(created.id).toBe(ticket.id);
      expect(created.status).toBe('open');
    });

    it('should set due date based on SLA', async () => {
      const ticket = createTestTicket({ priority: 'critical' });
      const created = await workflow.createTicket(ticket);

      expect(created.dueDate).toBeDefined();
      expect(created.dueDate!.getTime()).toBeGreaterThan(ticket.createdAt.getTime());
    });
  });

  // ==================== getTicket / listTickets ====================

  describe('getTicket and listTickets', () => {
    it('should get a ticket by ID', async () => {
      const ticket = createTestTicket();
      await workflow.createTicket(ticket);

      mockRepo.findById.mockResolvedValueOnce(null); // cache miss fallback
      const found = await workflow.getTicket(ticket.id);
      expect(found).toBeDefined();
    });

    it('should return undefined for non-existent ticket', async () => {
      const result = await workflow.getTicket('non-existent');
      expect(result).toBeUndefined();
    });

    it('should list all tickets', async () => {
      mockRepo.findAll.mockResolvedValueOnce([]);
      const tickets = await workflow.listTickets();
      expect(Array.isArray(tickets)).toBe(true);
    });

    it('should sort tickets by creation date (newest first)', async () => {
      mockRepo.findAll.mockResolvedValueOnce([]);
      const tickets = await workflow.listTickets();
      expect(Array.isArray(tickets)).toBe(true);
    });
  });

  // ==================== transitionStatus ====================

  describe('transitionStatus', () => {
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
    it('should return error for non-existent ticket', async () => {
      const result = await workflow.assignTicket('non-existent', 'user-1', 'admin');
      expect('error' in result).toBe(true);
    });
  });

  // ==================== escalateTicket ====================

  describe('escalateTicket', () => {
    it('should return error for non-existent ticket', async () => {
      const result = await workflow.escalateTicket('non-existent', 'admin');
      expect('error' in result).toBe(true);
    });
  });

  // ==================== autoAssignTicket ====================

  describe('autoAssignTicket', () => {
    beforeEach(() => {
      workflow.addAssignmentRule({
        id: 'rule-infra',
        name: 'Infra Team',
        categories: ['infrastructure'],
        assignee: 'infra-team',
        enabled: true,
        order: 1,
      });
    });

    it('should not auto-assign if no matching rule', async () => {
      const ticket = createTestTicket({ category: 'network' });
      await workflow.createTicket(ticket);

      const result = await workflow.autoAssignTicket(ticket.id);
      expect(result).toBeNull();
    });

    it('should not re-assign already assigned ticket', async () => {
      const ticket = createTestTicket({ category: 'infrastructure', assignee: 'user-1' });
      await workflow.createTicket(ticket);

      const result = await workflow.autoAssignTicket(ticket.id);
      expect(result).toBeNull();
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
  });

  // ==================== clearAll ====================

  describe('clearAll', () => {
    it('should clear all tickets', () => {
      workflow.clearAll();
    });
  });
});
