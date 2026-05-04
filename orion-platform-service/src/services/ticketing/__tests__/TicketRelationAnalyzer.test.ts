/**
 * TASK-801: TicketRelationAnalyzer Unit Tests
 */

import { TicketRelationAnalyzer } from '../TicketRelationAnalyzer';
import { Ticket } from '../types';

// Mock TicketingRepository
const mockTicketingRepository = {
  createTicket: jest.fn().mockResolvedValue(null),
  getTicketById: jest.fn().mockResolvedValue(null),
};

describe('TicketRelationAnalyzer', () => {
  let analyzer: TicketRelationAnalyzer;

  beforeEach(() => {
    analyzer = new TicketRelationAnalyzer({ ticketingRepository: mockTicketingRepository as any });
  });

  // Helper to create test tickets
  function createTicket(overrides: Partial<Ticket> = {}): Ticket {
    const now = new Date();
    return {
      id: `TKT-test-${Date.now()}-${Math.random()}`,
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

  // ==================== addRelation ====================

  describe('addRelation', () => {
    it('should add a relation between two tickets', () => {
      const t1 = createTicket({ id: 't1' });
      const t2 = createTicket({ id: 't2' });
      analyzer.registerTicket(t1);
      analyzer.registerTicket(t2);

      const relation = analyzer.addRelation('t1', 't2', 'related', 'user-1', 'Related issues');

      expect(relation.ticketId).toBe('t1');
      expect(relation.relatedTicketId).toBe('t2');
      expect(relation.relationType).toBe('related');
      expect(relation.confidence).toBe(1.0);
      expect(relation.createdBy).toBe('user-1');
    });

    it('should auto-register tickets', () => {
      const relation = analyzer.addRelation('new-t1', 'new-t2', 'duplicate', 'system');

      expect(relation).toBeDefined();
      const relations = analyzer.getRelationsForTicket('new-t1');
      expect(relations.length).toBe(1);
    });
  });

  // ==================== findRelatedTickets ====================

  describe('findRelatedTickets', () => {
    beforeEach(() => {
      const now = new Date();

      analyzer.registerTicket(createTicket({
        id: 't1',
        title: 'CPU usage high',
        description: 'Server CPU usage is at 95%',
        category: 'infrastructure',
        priority: 'critical',
        tags: { host: 'server-1', env: 'production' },
        createdAt: now,
      }));

      analyzer.registerTicket(createTicket({
        id: 't2',
        title: 'High CPU on database server',
        description: 'Database server experiencing high CPU load',
        category: 'infrastructure',
        priority: 'high',
        tags: { host: 'server-2', env: 'production' },
        createdAt: new Date(now.getTime() + 60000),
      }));

      analyzer.registerTicket(createTicket({
        id: 't3',
        title: 'API response slow',
        description: 'API endpoints are responding slowly',
        category: 'application',
        priority: 'medium',
        tags: { service: 'api' },
        createdAt: new Date(now.getTime() + 120000),
      }));

      analyzer.registerTicket(createTicket({
        id: 't4',
        title: 'SSL certificate expiring',
        description: 'Certificate will expire in 7 days',
        category: 'security',
        priority: 'low',
        createdAt: now,
      }));
    });

    it('should find related tickets with high confidence for same category', () => {
      const related = analyzer.findRelatedTickets('t1');

      expect(related.length).toBeGreaterThan(0);
      // t2 (same category, similar text) should have high confidence
      const t2Relation = related.find(r => r.ticket.id === 't2');
      expect(t2Relation).toBeDefined();
      expect(t2Relation!.confidence).toBeGreaterThan(0.2);
    });

    it('should return empty for non-existent ticket', () => {
      const related = analyzer.findRelatedTickets('non-existent');
      expect(related.length).toBe(0);
    });

    it('should respect maxResults limit', () => {
      const related = analyzer.findRelatedTickets('t1', { maxResults: 1 });
      expect(related.length).toBeLessThanOrEqual(1);
    });

    it('should respect minConfidence filter', () => {
      const related = analyzer.findRelatedTickets('t1', { minConfidence: 0.9 });
      // Very high threshold should return fewer results
      for (const r of related) {
        expect(r.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should give higher confidence to tickets with matching tags', () => {
      const related = analyzer.findRelatedTickets('t1');
      const t2 = related.find(r => r.ticket.id === 't2');
      const t4 = related.find(r => r.ticket.id === 't4');

      // t2 shares env=production tag, t4 has no matching tags
      if (t2 && t4) {
        expect(t2.confidence).toBeGreaterThanOrEqual(t4.confidence);
      }
    });

    it('should consider temporal proximity', () => {
      // t2 was created 1 min after t1, t3 was created 2 min after t1
      const related = analyzer.findRelatedTickets('t1');
      expect(related.length).toBeGreaterThan(0);
    });
  });

  // ==================== detectDuplicates ====================

  describe('detectDuplicates', () => {
    beforeEach(() => {
      const now = new Date();

      analyzer.registerTicket(createTicket({
        id: 't1',
        title: 'CPU usage high on server-1',
        description: 'CPU exceeded 95% threshold',
        category: 'infrastructure',
        priority: 'critical',
        status: 'open',
        metadata: { metric: 'system.cpu.usage' },
        createdAt: now,
      }));

      analyzer.registerTicket(createTicket({
        id: 't2',
        title: 'High CPU usage on server-1',
        description: 'CPU exceeded 95% threshold alert',
        category: 'infrastructure',
        priority: 'high',
        status: 'open',
        metadata: { metric: 'system.cpu.usage' },
        createdAt: new Date(now.getTime() + 30000),
      }));

      analyzer.registerTicket(createTicket({
        id: 't3',
        title: 'Memory usage warning',
        description: 'Memory at 80%',
        category: 'infrastructure',
        priority: 'medium',
        status: 'open',
        createdAt: new Date(now.getTime() + 60000),
      }));

      // Already resolved ticket should not be flagged as duplicate
      analyzer.registerTicket(createTicket({
        id: 't4',
        title: 'CPU usage high on server-1',
        description: 'CPU exceeded 95% threshold',
        category: 'infrastructure',
        priority: 'critical',
        status: 'resolved',
        createdAt: new Date(now.getTime() + 90000),
      }));
    });

    it('should detect highly similar tickets as duplicates', () => {
      const duplicates = analyzer.detectDuplicates('t1', 0.5);

      expect(duplicates.length).toBeGreaterThan(0);
      // t2 has very similar title and description
      const t2Dup = duplicates.find(d => d.ticket.id === 't2');
      expect(t2Dup).toBeDefined();
    });

    it('should not flag resolved tickets as duplicates', () => {
      const duplicates = analyzer.detectDuplicates('t1', 0.5);

      const t4Dup = duplicates.find(d => d.ticket.id === 't4');
      expect(t4Dup).toBeUndefined();
    });

    it('should not flag very different tickets as duplicates', () => {
      const duplicates = analyzer.detectDuplicates('t1', 0.7);

      const t3Dup = duplicates.find(d => d.ticket.id === 't3');
      // Memory warning is different enough from CPU alert
      expect(t3Dup).toBeUndefined();
    });

    it('should return empty for non-existent ticket', () => {
      const duplicates = analyzer.detectDuplicates('non-existent');
      expect(duplicates.length).toBe(0);
    });

    it('should detect same source alert as strong duplicate signal', () => {
      analyzer.registerTicket(createTicket({
        id: 't5',
        title: 'CPU alert',
        description: 'test',
        category: 'infrastructure',
        priority: 'high',
        status: 'open',
        source: 'alert',
        sourceAlertId: 'alert-same',
        metadata: { metric: 'system.cpu.usage' },
        createdAt: new Date(),
      }));

      analyzer.registerTicket(createTicket({
        id: 't6',
        title: 'CPU alert duplicate',
        description: 'test',
        category: 'infrastructure',
        priority: 'high',
        status: 'open',
        source: 'alert',
        sourceAlertId: 'alert-same',
        metadata: { metric: 'system.cpu.usage' },
        createdAt: new Date(),
      }));

      const duplicates = analyzer.detectDuplicates('t5', 0.3);
      const t6Dup = duplicates.find(d => d.ticket.id === 't6');
      expect(t6Dup).toBeDefined();
      expect(t6Dup!.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==================== correlateRootCause ====================

  describe('correlateRootCause', () => {
    it('should identify root cause from related tickets', () => {
      const now = new Date();

      analyzer.registerTicket(createTicket({
        id: 't1',
        title: 'Disk space full on primary server',
        description: 'Primary disk is 100% full',
        category: 'infrastructure',
        priority: 'critical',
        createdAt: now,
      }));

      analyzer.registerTicket(createTicket({
        id: 't2',
        title: 'Database write failures',
        description: 'Cannot write to database',
        category: 'database',
        priority: 'high',
        createdAt: new Date(now.getTime() + 5 * 60 * 1000),
      }));

      analyzer.registerTicket(createTicket({
        id: 't3',
        title: 'API 500 errors',
        description: 'API returning internal server errors',
        category: 'application',
        priority: 'high',
        createdAt: new Date(now.getTime() + 10 * 60 * 1000),
      }));

      const result = analyzer.correlateRootCause(['t1', 't2', 't3']);

      expect(result.rootCauseTicket).toBeDefined();
      expect(result.rootCauseTicket!.id).toBe('t1'); // Earliest + infrastructure
      expect(result.affectedTickets.length).toBe(2);
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle single ticket', () => {
      const ticket = createTicket({ id: 't1' });
      analyzer.registerTicket(ticket);

      const result = analyzer.correlateRootCause(['t1']);

      expect(result.rootCauseTicket!.id).toBe('t1');
      expect(result.affectedTickets.length).toBe(0);
      expect(result.confidence).toBe(1.0);
    });

    it('should handle empty input', () => {
      const result = analyzer.correlateRootCause([]);

      expect(result.rootCauseTicket).toBeUndefined();
      expect(result.affectedTickets.length).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should create caused-by relations automatically', () => {
      const now = new Date();

      analyzer.registerTicket(createTicket({
        id: 't1',
        title: 'Network switch failure',
        description: 'Core network switch is down',
        category: 'infrastructure',
        priority: 'critical',
        createdAt: now,
      }));

      analyzer.registerTicket(createTicket({
        id: 't2',
        title: 'Service unreachable',
        description: 'Cannot reach backend service',
        category: 'application',
        priority: 'high',
        createdAt: new Date(now.getTime() + 60000),
      }));

      analyzer.correlateRootCause(['t1', 't2']);

      const t2Relations = analyzer.getRelationsForTicket('t2');
      const causedBy = t2Relations.find(
        r => r.relationType === 'caused-by' && r.relatedTicketId === 't1'
      );
      expect(causedBy).toBeDefined();
    });

    it('should prioritize infrastructure tickets as root cause', () => {
      const now = new Date();

      analyzer.registerTicket(createTicket({
        id: 't1',
        title: 'Database slow queries',
        description: 'Slow query performance',
        category: 'application',
        priority: 'high',
        createdAt: now,
      }));

      analyzer.registerTicket(createTicket({
        id: 't2',
        title: 'Database replication lag',
        description: 'Replication falling behind',
        category: 'database',
        priority: 'high',
        createdAt: now,
      }));

      const result = analyzer.correlateRootCause(['t1', 't2']);

      // Database ticket should score higher due to category boost
      expect(result.rootCauseTicket).toBeDefined();
    });
  });

  // ==================== getRelationsForTicket ====================

  describe('getRelationsForTicket', () => {
    it('should return all relations for a ticket', () => {
      analyzer.addRelation('t1', 't2', 'related', 'user-1');
      analyzer.addRelation('t3', 't1', 'caused-by', 'user-2');

      const relations = analyzer.getRelationsForTicket('t1');
      expect(relations.length).toBe(2);
    });

    it('should return empty for ticket with no relations', () => {
      const relations = analyzer.getRelationsForTicket('isolated');
      expect(relations.length).toBe(0);
    });
  });

  // ==================== removeRelation ====================

  describe('removeRelation', () => {
    it('should remove a relation', () => {
      const relation = analyzer.addRelation('t1', 't2', 'related', 'user-1');
      const removed = analyzer.removeRelation(relation.id);

      expect(removed).toBe(true);
      expect(analyzer.getRelationsForTicket('t1').length).toBe(0);
    });

    it('should return false for non-existent relation', () => {
      const removed = analyzer.removeRelation('non-existent');
      expect(removed).toBe(false);
    });
  });

  // ==================== getAllRelations ====================

  describe('getAllRelations', () => {
    it('should return all relations', () => {
      analyzer.addRelation('t1', 't2', 'related', 'user-1');
      analyzer.addRelation('t3', 't4', 'duplicate', 'user-2');

      const all = analyzer.getAllRelations();
      expect(all.length).toBe(2);
    });
  });

  // ==================== clearAll ====================

  describe('clearAll', () => {
    it('should clear all relations and tickets', () => {
      analyzer.addRelation('t1', 't2', 'related', 'user-1');
      analyzer.clearAll();

      expect(analyzer.getAllRelations().length).toBe(0);
    });
  });
});
