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

// Mock TicketingRepository with all required methods
const mockRepo: any = {
  createEngineerProfile: jest.fn().mockResolvedValue(null),
  findEngineerProfileById: jest.fn().mockResolvedValue(null),
  findAllEngineerProfiles: jest.fn().mockResolvedValue([]),
  updateEngineerProfile: jest.fn().mockResolvedValue(null),
  deleteEngineerProfile: jest.fn().mockResolvedValue(true),
  getAvailableEngineers: jest.fn().mockResolvedValue([]),
  getEngineerProfile: jest.fn().mockResolvedValue(null),
  getActiveAssignmentsByEngineer: jest.fn().mockResolvedValue([]),
  createAssignment: jest.fn().mockResolvedValue({ id: 'assign-1' }),
};

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
    jest.clearAllMocks();
    engine = new DispatchEngine({ ticketingRepository: mockRepo });
  });

  afterEach(() => {
    engine.clearAll();
  });

  // ==================== Engineer Management ====================

  describe('engineer management', () => {
    it('should register an engineer', async () => {
      const profile = createTestEngineer();
      mockRepo.createEngineerProfile.mockResolvedValueOnce(profile);

      const result = await engine.registerEngineer(profile);
      expect(result).toBeDefined();
    });

    it('should update an engineer', async () => {
      const profile = createTestEngineer();
      mockRepo.createEngineerProfile.mockResolvedValueOnce(profile);
      mockRepo.updateEngineerProfile.mockResolvedValueOnce({ ...profile, name: 'Updated Name' });

      await engine.registerEngineer(profile);
      await engine.updateEngineer('eng-1', { name: 'Updated Name' });
    });

    it('should remove an engineer', async () => {
      const profile = createTestEngineer();
      mockRepo.createEngineerProfile.mockResolvedValueOnce(profile);
      mockRepo.deleteEngineerProfile.mockResolvedValueOnce(true);

      await engine.registerEngineer(profile);
      const removed = await engine.removeEngineer('eng-1');
      expect(removed).toBe(true);
    });

    it('should list all engineers', async () => {
      mockRepo.findAllEngineerProfiles.mockResolvedValueOnce([]);
      const engineers = await engine.listEngineers();
      expect(Array.isArray(engineers)).toBe(true);
    });

    it('should get available engineers', async () => {
      mockRepo.getAvailableEngineers.mockResolvedValueOnce([]);
      const available = await engine.getAvailableEngineers();
      expect(Array.isArray(available)).toBe(true);
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
    it('should calculate dispatch score', async () => {
      const ticket = createTestTicket();
      const engineer = createTestEngineer({
        id: 'eng-1',
        expertise: ['infrastructure', 'network'],
        currentLoad: 3,
        maxCapacity: 10,
      });

      const result = await engine.calculateDispatchScore(ticket, engineer);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown).toBeDefined();
    });

    it('should give higher expertise score for matching category', async () => {
      const ticket = createTestTicket({ category: 'infrastructure' });

      const eng1 = createTestEngineer({ id: 'eng-1', expertise: ['infrastructure', 'network'] });
      const eng2 = createTestEngineer({ id: 'eng-2', expertise: ['database', 'application'] });

      const score1 = await engine.calculateDispatchScore(ticket, eng1);
      const score2 = await engine.calculateDispatchScore(ticket, eng2);

      expect(score1.breakdown.expertiseScore).toBeGreaterThan(score2.breakdown.expertiseScore);
    });

    it('should give higher workload score for less loaded engineer', async () => {
      const ticket = createTestTicket();

      const eng1 = createTestEngineer({ id: 'eng-1', currentLoad: 3, maxCapacity: 10 });
      const eng2 = createTestEngineer({ id: 'eng-2', currentLoad: 1, maxCapacity: 10 });

      const score1 = await engine.calculateDispatchScore(ticket, eng1);
      const score2 = await engine.calculateDispatchScore(ticket, eng2);

      expect(score2.breakdown.workloadScore).toBeGreaterThan(score1.breakdown.workloadScore);
    });
  });

  // ==================== Dispatch History ====================

  describe('dispatch history', () => {
    it('should calculate average dispatch score', () => {
      const avg = engine.getAverageDispatchScore();
      expect(avg).toBe(0); // No history
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
        weights: {
          expertise: 0.5,
          workload: 0.1,
          availability: 0.1,
          successRate: 0.2,
          slaUrgency: 0.1,
        },
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
