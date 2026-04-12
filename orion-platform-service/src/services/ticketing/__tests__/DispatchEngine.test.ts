/**
 * TASK-802: DispatchEngine Tests
 */

import { DispatchEngine } from '../DispatchEngine';
import {
  EngineerProfile,
  Ticket,
  DispatchWeights,
  TicketPriority,
} from '../types';

const createTestTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TKT-test-1',
  title: 'Test Ticket',
  description: 'Test description',
  category: 'infrastructure',
  priority: 'high',
  status: 'open',
  reporter: 'user-1',
  source: 'manual',
  createdAt: new Date(),
  updatedAt: new Date(),
  escalationLevel: 0,
  ...overrides,
});

const createTestEngineer = (overrides: Partial<EngineerProfile> = {}): EngineerProfile => ({
  id: 'eng-1',
  name: 'Test Engineer',
  expertise: ['infrastructure', 'network'],
  currentLoad: 2,
  maxCapacity: 10,
  availability: 'available',
  resolutionStats: {
    totalResolved: 50,
    avgResolutionTimeMs: 2 * 60 * 60 * 1000,
    slaComplianceRate: 0.9,
    resolutionByCategory: { infrastructure: 20, network: 10 } as any,
    resolutionByPriority: { high: 15, critical: 5 } as any,
    escalationCount: 2,
    satisfactionScore: 85,
  },
  ...overrides,
});

describe('DispatchEngine', () => {
  let engine: DispatchEngine;

  beforeEach(() => {
    engine = new DispatchEngine();
  });

  afterEach(() => {
    engine.clearAll();
  });

  // ==================== Engineer Management ====================

  describe('engineer management', () => {
    it('should register an engineer', () => {
      const profile = createTestEngineer();
      engine.registerEngineer(profile);

      const found = engine.getEngineer('eng-1');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Engineer');
    });

    it('should update an engineer', () => {
      engine.registerEngineer(createTestEngineer());

      const updated = engine.updateEngineer('eng-1', { name: 'Updated Name' });
      expect(updated).toBe(true);
      expect(engine.getEngineer('eng-1')!.name).toBe('Updated Name');
    });

    it('should fail to update non-existent engineer', () => {
      const result = engine.updateEngineer('non-existent', { name: 'X' });
      expect(result).toBe(false);
    });

    it('should remove an engineer', () => {
      engine.registerEngineer(createTestEngineer());
      const removed = engine.removeEngineer('eng-1');
      expect(removed).toBe(true);
      expect(engine.getEngineer('eng-1')).toBeUndefined();
    });

    it('should list all engineers', () => {
      engine.registerEngineer(createTestEngineer({ id: 'eng-1', name: 'A' }));
      engine.registerEngineer(createTestEngineer({ id: 'eng-2', name: 'B' }));

      const engineers = engine.listEngineers();
      expect(engineers.length).toBe(2);
    });

    it('should get available engineers (exclude offline/away)', () => {
      engine.registerEngineer(createTestEngineer({ id: 'eng-1', availability: 'available' }));
      engine.registerEngineer(createTestEngineer({ id: 'eng-2', availability: 'offline' }));
      engine.registerEngineer(createTestEngineer({ id: 'eng-3', availability: 'busy' }));

      const available = engine.getAvailableEngineers();
      expect(available.length).toBe(2);
      expect(available.find(e => e.id === 'eng-2')).toBeUndefined();
    });
  });

  // ==================== Dispatch Rules ====================

  describe('dispatch rules', () => {
    it('should add and retrieve rules', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Infra Rule',
        conditions: { categories: ['infrastructure'] },
        assignee: 'eng-1',
        priority: 1,
        enabled: true,
      });

      const rules = engine.getRules();
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe('Infra Rule');
    });

    it('should remove a rule', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Test',
        conditions: {},
        assignee: 'eng-1',
        priority: 1,
        enabled: true,
      });

      engine.removeRule('rule-1');
      expect(engine.getRules().length).toBe(0);
    });

    it('should sort rules by priority', () => {
      engine.addRule({ id: 'r1', name: 'Low', conditions: {}, assignee: 'eng-1', priority: 10, enabled: true });
      engine.addRule({ id: 'r2', name: 'High', conditions: {}, assignee: 'eng-1', priority: 1, enabled: true });

      const rules = engine.getRules();
      expect(rules[0].name).toBe('High');
      expect(rules[1].name).toBe('Low');
    });
  });

  // ==================== Scoring ====================

  describe('scoring', () => {
    beforeEach(() => {
      engine.registerEngineer(createTestEngineer({
        id: 'eng-1',
        expertise: ['infrastructure', 'network'],
        currentLoad: 3,
        maxCapacity: 10,
      }));
      engine.registerEngineer(createTestEngineer({
        id: 'eng-2',
        expertise: ['database', 'application'],
        currentLoad: 1,
        maxCapacity: 10,
      }));
    });

    it('should calculate dispatch score', () => {
      const ticket = createTestTicket();
      const engineer = engine.getEngineer('eng-1')!;

      const result = engine.calculateDispatchScore(ticket, engineer);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.expertiseScore).toBeGreaterThan(0);
      expect(result.breakdown.workloadScore).toBeGreaterThan(0);
    });

    it('should give higher expertise score for matching category', () => {
      const ticket = createTestTicket({ category: 'infrastructure' });

      const eng1 = engine.getEngineer('eng-1')!; // Has infrastructure expertise
      const eng2 = engine.getEngineer('eng-2')!; // No infrastructure expertise

      const score1 = engine.calculateDispatchScore(ticket, eng1);
      const score2 = engine.calculateDispatchScore(ticket, eng2);

      expect(score1.breakdown.expertiseScore).toBeGreaterThan(score2.breakdown.expertiseScore);
    });

    it('should give higher workload score for less loaded engineer', () => {
      const ticket = createTestTicket();

      const eng1 = engine.getEngineer('eng-1')!; // Load 3/10
      const eng2 = engine.getEngineer('eng-2')!; // Load 1/10

      const score1 = engine.calculateDispatchScore(ticket, eng1);
      const score2 = engine.calculateDispatchScore(ticket, eng2);

      expect(score2.breakdown.workloadScore).toBeGreaterThan(score1.breakdown.workloadScore);
    });
  });

  // ==================== findBestEngineer ====================

  describe('findBestEngineer', () => {
    beforeEach(() => {
      engine.registerEngineer(createTestEngineer({
        id: 'eng-1',
        expertise: ['infrastructure', 'network'],
        currentLoad: 5,
        maxCapacity: 10,
        availability: 'available',
      }));
      engine.registerEngineer(createTestEngineer({
        id: 'eng-2',
        expertise: ['infrastructure', 'database'],
        currentLoad: 2,
        maxCapacity: 10,
        availability: 'available',
      }));
    });

    it('should find the best matching engineer', () => {
      const ticket = createTestTicket({ category: 'infrastructure' });

      const result = engine.findBestEngineer(ticket);

      expect(result).not.toBeNull();
      expect(result!.engineer.id).toBeDefined();
      expect(result!.score).toBeGreaterThanOrEqual(0);
    });

    it('should exclude specified engineers', () => {
      const ticket = createTestTicket();

      const result = engine.findBestEngineer(ticket, {
        excludeEngineers: ['eng-2'],
      });

      expect(result).not.toBeNull();
      expect(result!.engineer.id).toBe('eng-1');
    });

    it('should only consider specified engineers', () => {
      const ticket = createTestTicket();

      const result = engine.findBestEngineer(ticket, {
        onlyEngineers: ['eng-1'],
      });

      expect(result).not.toBeNull();
      expect(result!.engineer.id).toBe('eng-1');
    });

    it('should return null if no candidates', () => {
      const ticket = createTestTicket();

      const result = engine.findBestEngineer(ticket, {
        onlyEngineers: ['non-existent'],
      });

      expect(result).toBeNull();
    });

    it('should skip overloaded engineers for non-critical tickets', () => {
      engine.registerEngineer(createTestEngineer({
        id: 'eng-3',
        expertise: ['infrastructure'],
        currentLoad: 10,
        maxCapacity: 10,
        availability: 'available',
      }));

      const ticket = createTestTicket({ priority: 'medium' });

      const result = engine.findBestEngineer(ticket);
      expect(result).not.toBeNull();
      expect(result!.engineer.id).not.toBe('eng-3');
    });

    it('should consider overloaded engineers for critical tickets', () => {
      // Remove other engineers
      engine.removeEngineer('eng-1');
      engine.removeEngineer('eng-2');

      engine.registerEngineer(createTestEngineer({
        id: 'eng-3',
        expertise: ['infrastructure'],
        currentLoad: 10,
        maxCapacity: 10,
        availability: 'available',
      }));

      const ticket = createTestTicket({ priority: 'critical' });

      const result = engine.findBestEngineer(ticket);
      expect(result).not.toBeNull();
    });
  });

  // ==================== dispatchTicket ====================

  describe('dispatchTicket', () => {
    beforeEach(() => {
      engine.registerEngineer(createTestEngineer({
        id: 'eng-1',
        expertise: ['infrastructure'],
        currentLoad: 2,
        maxCapacity: 10,
        availability: 'available',
      }));
    });

    it('should dispatch a ticket to best engineer', () => {
      const ticket = createTestTicket();

      const result = engine.dispatchTicket(ticket);

      expect(result).not.toBeNull();
      expect(result!.assignee).toBe('eng-1');
      expect(result!.dispatchType).toBe('auto');
      expect(result!.accepted).toBe(true);
      expect(result!.score).toBeGreaterThanOrEqual(0);
    });

    it('should update engineer load after dispatch', () => {
      const ticket = createTestTicket();

      engine.dispatchTicket(ticket);

      const engineer = engine.getEngineer('eng-1');
      expect(engineer!.currentLoad).toBe(3);
    });

    it('should use rule-based dispatch when rule matches', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'Infra Dispatch',
        conditions: { categories: ['infrastructure'] },
        assignee: 'eng-1',
        priority: 1,
        enabled: true,
      });

      const ticket = createTestTicket({ category: 'infrastructure' });
      const result = engine.dispatchTicket(ticket);

      expect(result).not.toBeNull();
      expect(result!.dispatchType).toBe('rule');
      expect(result!.reason).toContain('Infra Dispatch');
    });

    it('should fall back to scoring when no rule matches', () => {
      engine.addRule({
        id: 'rule-1',
        name: 'DB Rule',
        conditions: { categories: ['database'] },
        assignee: 'eng-1',
        priority: 1,
        enabled: true,
      });

      const ticket = createTestTicket({ category: 'infrastructure' });
      const result = engine.dispatchTicket(ticket);

      expect(result).not.toBeNull();
      expect(result!.dispatchType).toBe('auto');
    });

    it('should return null if no engineers available', () => {
      engine.clearAll();

      const ticket = createTestTicket();
      const result = engine.dispatchTicket(ticket);

      expect(result).toBeNull();
    });
  });

  // ==================== Dispatch History ====================

  describe('dispatch history', () => {
    beforeEach(() => {
      engine.registerEngineer(createTestEngineer());
    });

    it('should record dispatch history', () => {
      const ticket = createTestTicket();
      engine.dispatchTicket(ticket);

      const history = engine.getDispatchHistory();
      expect(history.length).toBe(1);
    });

    it('should filter history by ticket ID', () => {
      const ticket1 = createTestTicket({ id: 'TKT-1' });
      const ticket2 = createTestTicket({ id: 'TKT-2' });

      engine.dispatchTicket(ticket1);
      engine.dispatchTicket(ticket2);

      const history = engine.getDispatchHistory({ ticketId: 'TKT-1' });
      expect(history.length).toBe(1);
      expect(history[0].ticketId).toBe('TKT-1');
    });

    it('should filter history by engineer ID', () => {
      const ticket = createTestTicket();
      engine.dispatchTicket(ticket);

      const history = engine.getDispatchHistory({ engineerId: 'eng-1' });
      expect(history.length).toBe(1);
    });

    it('should limit history results', () => {
      for (let i = 0; i < 5; i++) {
        const ticket = createTestTicket({ id: `TKT-${i}` });
        engine.dispatchTicket(ticket);
      }

      const history = engine.getDispatchHistory({ limit: 3 });
      expect(history.length).toBe(3);
    });

    it('should calculate average dispatch score', () => {
      const ticket1 = createTestTicket({ id: 'TKT-1' });
      const ticket2 = createTestTicket({ id: 'TKT-2' });

      engine.dispatchTicket(ticket1);
      engine.dispatchTicket(ticket2);

      const avg = engine.getAverageDispatchScore();
      expect(avg).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== undoDispatch ====================

  describe('undoDispatch', () => {
    beforeEach(() => {
      engine.registerEngineer(createTestEngineer({
        id: 'eng-1',
        currentLoad: 5,
        maxCapacity: 10,
      }));
    });

    it('should undo a dispatch and reduce load', () => {
      const ticket = createTestTicket();
      const result = engine.dispatchTicket(ticket)!;

      const engineerBefore = engine.getEngineer('eng-1');
      expect(engineerBefore!.currentLoad).toBe(6);

      const undone = engine.undoDispatch(result.id);
      expect(undone).toBe(true);

      const engineerAfter = engine.getEngineer('eng-1');
      expect(engineerAfter!.currentLoad).toBe(5);
    });

    it('should return false for non-existent dispatch', () => {
      const result = engine.undoDispatch('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== Weights ====================

  describe('weights', () => {
    it('should use default weights', () => {
      const weights = engine.getWeights();
      expect(weights.expertise).toBe(0.35);
      expect(weights.workload).toBe(0.25);
      expect(weights.availability).toBe(0.15);
    });

    it('should accept custom weights in constructor', () => {
      const customEngine = new DispatchEngine({
        expertise: 0.5,
        workload: 0.1,
        availability: 0.1,
        successRate: 0.2,
        slaUrgency: 0.1,
      });

      const weights = customEngine.getWeights();
      expect(weights.expertise).toBe(0.5);
      customEngine.clearAll();
    });

    it('should update weights', () => {
      engine.updateWeights({ expertise: 0.5 });

      const weights = engine.getWeights();
      expect(weights.expertise).toBe(0.5);
    });
  });
});
