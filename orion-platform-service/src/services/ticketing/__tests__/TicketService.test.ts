/**
 * TASK-801: TicketService Integration Tests
 */

import { TicketService } from '../TicketService';

describe('TicketService', () => {
  let service: TicketService;

  beforeEach(() => {
    service = new TicketService({
      enableAutoAssignment: false, // Disable for predictable tests
      enableAutoEscalation: false,
    });
  });

  afterEach(async () => {
    await service.stop();
  });

  // ==================== Lifecycle ====================

  describe('start/stop', () => {
    it('should start the service', async () => {
      await service.start();
      expect(service.getIsRunning()).toBe(true);
    });

    it('should stop the service', async () => {
      await service.start();
      await service.stop();
      expect(service.getIsRunning()).toBe(false);
    });

    it('should be idempotent for start', async () => {
      await service.start();
      await service.start(); // Should not error
      expect(service.getIsRunning()).toBe(true);
    });

    it('should be idempotent for stop', async () => {
      await service.stop(); // Should not error when not started
      expect(service.getIsRunning()).toBe(false);
    });

    it('should emit started event', async () => {
      let started = false;
      service.on('started', () => { started = true; });

      await service.start();
      expect(started).toBe(true);
    });

    it('should emit stopped event', async () => {
      await service.start();

      let stopped = false;
      service.on('stopped', () => { stopped = true; });

      await service.stop();
      expect(stopped).toBe(true);
    });
  });

  // ==================== Ticket Creation ====================

  describe('createTicket', () => {
    it('should create a manual ticket', () => {
      const ticket = service.createTicket({
        title: 'Test Ticket',
        description: 'Test description',
        category: 'infrastructure',
        priority: 'high',
        reporter: 'user-1',
      });

      expect(ticket.id).toMatch(/^TKT-/);
      expect(ticket.title).toBe('Test Ticket');
      expect(ticket.status).toBe('open');
      expect(ticket.source).toBe('manual');
    });

    it('should emit ticket:created event', () => {
      let created: any = null;
      service.on('ticket:created', (t) => { created = t; });

      service.createTicket({
        title: 'Test',
        description: 'Test',
        category: 'infrastructure',
        priority: 'medium',
        reporter: 'user-1',
      });

      expect(created).not.toBeNull();
      expect(created.title).toBe('Test');
    });

    it('should auto-assign when enabled', () => {
      const autoService = new TicketService({ enableAutoAssignment: true });

      autoService.addAssignmentRule({
        id: 'rule-1',
        name: 'Test Rule',
        categories: ['infrastructure'],
        assignee: 'auto-user',
        enabled: true,
        order: 1,
      });

      const ticket = autoService.createTicket({
        title: 'Auto-assign Test',
        description: 'Test',
        category: 'infrastructure',
        priority: 'medium',
        reporter: 'user-1',
      });

      // Auto-assignment happens synchronously
      const found = autoService.getTicket(ticket.id);
      expect(found!.assignee).toBe('auto-user');
      expect(found!.status).toBe('assigned'); // Auto-transitioned

      autoService.clearAll();
    });

    it('should not auto-assign when disabled', () => {
      const ticket = service.createTicket({
        title: 'No Auto-assign',
        description: 'Test',
        category: 'infrastructure',
        priority: 'medium',
        reporter: 'user-1',
      });

      expect(ticket.assignee).toBeUndefined();
    });
  });

  // ==================== Alert/Incident Integration ====================

  describe('createTicketFromAlert', () => {
    it('should create a ticket from alert data', async () => {
      const ticket = await service.createTicketFromAlert({
        alertId: 'alert-1',
        metric: 'system.cpu.usage',
        severity: 'critical',
        message: 'CPU at 98%',
        tags: { host: 'prod-1' },
        triggeredAt: new Date(),
      });

      expect(ticket.source).toBe('alert');
      expect(ticket.sourceAlertId).toBe('alert-1');
      expect(ticket.category).toBe('infrastructure');
      expect(ticket.priority).toBe('critical');
    });

    it('should detect potential duplicates', async () => {
      // Create first ticket
      await service.createTicketFromAlert({
        alertId: 'alert-same',
        metric: 'system.cpu.usage',
        severity: 'critical',
        message: 'CPU at 98% on prod-1',
        triggeredAt: new Date(),
      });

      // Create second ticket from same alert type
      const ticket2 = await service.createTicketFromAlert({
        alertId: 'alert-same-2',
        metric: 'system.cpu.usage',
        severity: 'critical',
        message: 'CPU at 98% on prod-1',
        triggeredAt: new Date(),
      });

      expect(ticket2).toBeDefined();
    });
  });

  describe('createTicketFromIncident', () => {
    it('should create a ticket from incident data', () => {
      const ticket = service.createTicketFromIncident({
        incidentId: 'inc-1',
        title: 'Service Outage',
        description: 'Multiple services are down',
        severity: 'critical',
        affectedServices: ['api', 'web'],
        reporter: 'oncall',
      });

      expect(ticket.source).toBe('incident');
      expect(ticket.sourceIncidentId).toBe('inc-1');
      expect(ticket.title).toBe('Service Outage');
    });
  });

  // ==================== Workflow Operations ====================

  describe('workflow operations', () => {
    let ticketId: string;

    beforeEach(() => {
      const ticket = service.createTicket({
        title: 'Workflow Test',
        description: 'Testing workflow',
        category: 'infrastructure',
        priority: 'high',
        reporter: 'user-1',
      });
      ticketId = ticket.id;
    });

    it('should transition status', async () => {
      const result = await service.transitionStatus(ticketId, 'assigned', 'user-2');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('assigned');
    });

    it('should emit status change event', async () => {
      let statusChanged: any = null;
      service.on('ticket:status_changed', (data) => { statusChanged = data; });

      await service.transitionStatus(ticketId, 'assigned', 'user-2');

      expect(statusChanged).not.toBeNull();
      expect(statusChanged.ticket.status).toBe('assigned');
    });

    it('should assign ticket', () => {
      const result = service.assignTicket(ticketId, 'user-3', 'user-1', 'Reassignment');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.assignee).toBe('user-3');
    });

    it('should emit assignment event', () => {
      let assigned: any = null;
      service.on('ticket:assigned', (data) => { assigned = data; });

      service.assignTicket(ticketId, 'user-3', 'user-1');

      expect(assigned).not.toBeNull();
      expect(assigned.ticket.assignee).toBe('user-3');
    });

    it('should escalate ticket', () => {
      const result = service.escalateTicket(ticketId, 'manager', 'Urgent');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.escalationLevel).toBe(1);
    });

    it('should emit escalation event', () => {
      let escalated: any = null;
      service.on('ticket:escalated', (data) => { escalated = data; });

      service.escalateTicket(ticketId, 'manager');

      expect(escalated).not.toBeNull();
      expect(escalated.ticket.escalationLevel).toBe(1);
    });

    it('should resolve ticket', async () => {
      await service.transitionStatus(ticketId, 'assigned', 'user-1');
      await service.transitionStatus(ticketId, 'in-progress', 'user-1');

      const result = await service.resolveTicket(ticketId, 'user-1', 'Fixed');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('resolved');
    });

    it('should emit resolution event', async () => {
      await service.transitionStatus(ticketId, 'assigned', 'user-1');
      await service.transitionStatus(ticketId, 'in-progress', 'user-1');

      let resolved: any = null;
      service.on('ticket:resolved', (data) => { resolved = data; });

      await service.resolveTicket(ticketId, 'user-1');

      expect(resolved).not.toBeNull();
      expect(resolved.status).toBe('resolved');
    });

    it('should close ticket', async () => {
      await service.transitionStatus(ticketId, 'assigned', 'user-1');
      await service.transitionStatus(ticketId, 'in-progress', 'user-1');
      await service.transitionStatus(ticketId, 'resolved', 'user-1');

      const result = await service.closeTicket(ticketId, 'user-1', 'Confirmed');
      expect('ticket' in result).toBe(true);
      expect(result.ticket.status).toBe('closed');
    });
  });

  // ==================== Assignment Rules ====================

  describe('assignment rules', () => {
    it('should add and retrieve rules', () => {
      service.addAssignmentRule({
        id: 'rule-1',
        name: 'Infra Team',
        categories: ['infrastructure'],
        assignee: 'infra-team',
        enabled: true,
        order: 1,
      });

      const rules = service.getAssignmentRules();
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe('Infra Team');
    });

    it('should remove a rule', () => {
      service.addAssignmentRule({
        id: 'rule-1',
        name: 'Test',
        categories: ['infrastructure'],
        assignee: 'user-1',
        enabled: true,
        order: 1,
      });

      service.removeAssignmentRule('rule-1');
      expect(service.getAssignmentRules().length).toBe(0);
    });
  });

  // ==================== Relations ====================

  describe('relations', () => {
    let ticket1: any;
    let ticket2: any;

    beforeEach(() => {
      ticket1 = service.createTicket({
        title: 'Ticket 1',
        description: 'First ticket about CPU issues',
        category: 'infrastructure',
        priority: 'high',
        reporter: 'user-1',
      });

      ticket2 = service.createTicket({
        title: 'Ticket 2',
        description: 'Second ticket about CPU issues',
        category: 'infrastructure',
        priority: 'medium',
        reporter: 'user-1',
      });
    });

    it('should find related tickets', () => {
      const related = service.findRelatedTickets(ticket1.id);
      expect(related.length).toBeGreaterThan(0);
      expect(related[0].ticket.id).toBe(ticket2.id);
    });

    it('should detect duplicates', () => {
      const duplicates = service.detectDuplicates(ticket1.id, 0.3);
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should correlate root cause', () => {
      const correlation = service.correlateRootCause([ticket1.id, ticket2.id]);
      expect(correlation.rootCauseTicket).toBeDefined();
      expect(correlation.affectedTickets.length).toBe(1);
    });

    it('should get relations for a ticket', () => {
      service.analyzer.addRelation(ticket1.id, ticket2.id, 'related', 'user-1');

      const relations = service.getRelationsForTicket(ticket1.id);
      expect(relations.length).toBe(1);
    });
  });

  // ==================== Reports ====================

  describe('reports', () => {
    beforeEach(() => {
      // Create a mix of tickets
      service.createTicket({
        title: 'Critical Issue',
        description: 'Something critical',
        category: 'infrastructure',
        priority: 'critical',
        reporter: 'user-1',
      });

      service.createTicket({
        title: 'Medium Issue',
        description: 'Something medium',
        category: 'database',
        priority: 'medium',
        reporter: 'user-2',
      });

      const pastDate = new Date(Date.now() - 3000); // 3 seconds ago
      const resolved = service.createTicket({
        title: 'Resolved Issue',
        description: 'Already fixed',
        category: 'application',
        priority: 'high',
        reporter: 'user-1',
        metadata: { _createdAt: pastDate },
      });
      // Manually adjust createdAt for resolution time calculation
      const resolvedTicket = service.getTicket(resolved.id)!;
      resolvedTicket.createdAt = pastDate;

      service.transitionStatus(resolved.id, 'assigned', 'user-1');
      service.transitionStatus(resolved.id, 'in-progress', 'user-1');
      service.resolveTicket(resolved.id, 'user-1', 'Fixed');
    });

    it('should get SLA compliance report', () => {
      const report = service.getSLACompliance();

      expect(report.totalTickets).toBe(3);
      expect(report.byPriority).toBeDefined();
    });

    it('should get resolution statistics', () => {
      const stats = service.getResolutionStats();

      expect(stats.totalResolved).toBe(1);
      expect(stats.meanResolutionTimeMs).toBeGreaterThan(0);
    });

    it('should get backlog analysis', () => {
      const analysis = service.getBacklogAnalysis();

      expect(analysis.openCount + analysis.assignedCount).toBeGreaterThan(0); // 2 unresolved
    });

    it('should get trend report', () => {
      const report = service.getTrendReport({ days: 7 });

      expect(report.dataPoints.length).toBeGreaterThan(0);
      expect(report.totalCreated).toBe(3);
    });

    it('should get overall statistics', () => {
      const stats = service.getStatistics();

      expect(stats.totalTickets).toBe(3);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byPriority).toBeDefined();
      expect(stats.byCategory).toBeDefined();
    });
  });

  // ==================== SLA ====================

  describe('SLA', () => {
    it('should add custom SLA target', () => {
      service.addSLATarget({
        id: 'sla-custom',
        name: 'Custom',
        priority: 'critical',
        targetResponseTimeMs: 5 * 60 * 1000,
        targetResolutionTimeMs: 2 * 60 * 60 * 1000,
        enabled: true,
      });

      const sla = service.workflow.getSLATarget('critical');
      expect(sla).toBeDefined();
      expect(sla!.id).toBe('sla-custom');
    });

    it('should get SLA for a ticket', () => {
      const ticket = service.createTicket({
        title: 'SLA Test',
        description: 'Test',
        category: 'infrastructure',
        priority: 'high',
        reporter: 'user-1',
      });

      const sla = service.getTicketSLA(ticket.id);
      expect(sla).toBeDefined();
      expect(sla!.ticketId).toBe(ticket.id);
    });
  });

  // ==================== List/Get Tickets ====================

  describe('list/get tickets', () => {
    beforeEach(() => {
      service.createTicket({
        title: 'Open Infra',
        description: 'test',
        category: 'infrastructure',
        priority: 'high',
        reporter: 'user-1',
      });

      service.createTicket({
        title: 'Open DB',
        description: 'test',
        category: 'database',
        priority: 'medium',
        reporter: 'user-2',
      });
    });

    it('should get a ticket by ID', () => {
      const tickets = service.listTickets();
      const ticket = service.getTicket(tickets[0].id);

      expect(ticket).toBeDefined();
    });

    it('should list tickets with filters', () => {
      const infra = service.listTickets({ category: 'infrastructure' });
      expect(infra.length).toBe(1);
      expect(infra[0].category).toBe('infrastructure');
    });

    it('should filter by reporter', () => {
      const user1Tickets = service.listTickets({ reporter: 'user-1' });
      expect(user1Tickets.length).toBe(1);
    });
  });

  // ==================== Health Status ====================

  describe('getHealthStatus', () => {
    it('should return healthy with no overdue tickets', () => {
      service.createTicket({
        title: 'Fresh Ticket',
        description: 'test',
        category: 'infrastructure',
        priority: 'low',
        reporter: 'user-1',
      });

      const health = service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.totalTickets).toBe(1);
    });
  });

  // ==================== clearAll ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      service.createTicket({
        title: 'Test',
        description: 'test',
        category: 'infrastructure',
        priority: 'medium',
        reporter: 'user-1',
      });

      service.clearAll();
      expect(service.listTickets().length).toBe(0);
    });
  });
});
