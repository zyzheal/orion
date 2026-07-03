/**
 * HealingStrategyEngine - Unit Tests
 *
 * Tests for strategy registration, retrieval, matching, condition evaluation,
 * enable/disable operations, and built-in strategy loading.
 */

import { createLogger } from '../utils/logger';
import { HealingStrategyEngine } from '../HealingStrategyEngine';
import { HealingStrategy, IncidentType } from '../types';
import { HealingStrategyRepository } from '../../../repositories/HealingStrategyRepository';

// Mock pino - suppresses logs during tests
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

describe('HealingStrategyEngine', () => {
  // We use a spy on the repository constructor to intercept instantiation
  let createSpy: jest.SpyInstance;
  let mockRepoMethods: Record<string, jest.Mock>;
  let engine: HealingStrategyEngine;

  function makeStrategyEntity(overrides?: Partial<any>) {
    return {
      id: 'e1',
      name: 'Test',
      triggerType: 'pod_crash',
      actions: [{ type: 'restart', params: {} }],
      conditions: [],
      confidence: 80,
      enabled: true,
      description: null,
      environments: null,
      maxRetries: null,
      retryCooldownMs: null,
      tenantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function makeStrategy(overrides?: Partial<HealingStrategy>): HealingStrategy {
    return {
      id: `strategy-${Date.now()}-${Math.random()}`,
      name: 'Test Strategy',
      triggerType: 'pod_crash',
      confidence: 80,
      enabled: true,
      actions: [
        {
          type: 'restart',
          params: { target: 'test-app' },
          timeout: 60000,
          rollback: true,
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoMethods = {
      findById: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
      findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
      findEnabled: jest.fn().mockResolvedValue([]),
      enableStrategy: jest.fn().mockResolvedValue(undefined),
      disableStrategy: jest.fn().mockResolvedValue(undefined),
    };
    createSpy = jest.spyOn(HealingStrategyRepository.prototype, 'findById');

    // Use jest.mock-style interception: create a fake db
    const fakeDb = { query: jest.fn() };
    engine = new HealingStrategyEngine(fakeDb);
  });

  // After creation, replace methods via prototype spy
  function getMockRepo() {
    return mockRepoMethods;
  }

  // Helper to apply mock methods after construction
  function applyMocks(): Record<string, jest.Mock> {
    // The engine created its own repository internally. We need to spy on the class methods.
    jest.spyOn(HealingStrategyRepository.prototype, 'findById').mockImplementation(mockRepoMethods.findById);
    jest.spyOn(HealingStrategyRepository.prototype, 'create').mockImplementation(mockRepoMethods.create);
    jest.spyOn(HealingStrategyRepository.prototype, 'update').mockImplementation(mockRepoMethods.update);
    jest.spyOn(HealingStrategyRepository.prototype, 'delete').mockImplementation(mockRepoMethods.delete);
    jest.spyOn(HealingStrategyRepository.prototype, 'findAll').mockImplementation(mockRepoMethods.findAll);
    jest.spyOn(HealingStrategyRepository.prototype, 'findEnabled').mockImplementation(mockRepoMethods.findEnabled);
    jest.spyOn(HealingStrategyRepository.prototype, 'enableStrategy').mockImplementation(mockRepoMethods.enableStrategy);
    jest.spyOn(HealingStrategyRepository.prototype, 'disableStrategy').mockImplementation(mockRepoMethods.disableStrategy);
    return mockRepoMethods;
  }

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should throw when db is null', () => {
      expect(() => new HealingStrategyEngine(null as any)).toThrow('DatabasePool is required');
    });

    it('should throw when db is undefined', () => {
      expect(() => new HealingStrategyEngine(undefined as any)).toThrow('DatabasePool is required');
    });

    it('should initialize with a valid db', () => {
      const db = { query: jest.fn() } as any;
      const eng = new HealingStrategyEngine(db);
      expect(eng).toBeDefined();
    });
  });

  // ==================== registerStrategy ====================

  describe('registerStrategy', () => {
    it('should register a new strategy via create', async () => {
      applyMocks();
      const strategy = makeStrategy({ id: 'custom-1' });

      await engine.registerStrategy(strategy);

      expect(mockRepoMethods.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'custom-1' })
      );
    });

    it('should update existing strategy', async () => {
      applyMocks();
      const strategy = makeStrategy({ id: 'exist-1' });
      mockRepoMethods.findById.mockResolvedValueOnce(makeStrategyEntity({ id: 'exist-1', name: 'Old' }));

      await engine.registerStrategy(strategy);

      expect(mockRepoMethods.update).toHaveBeenCalledWith('exist-1', expect.any(Object));
    });
  });

  // ==================== unregisterStrategy ====================

  describe('unregisterStrategy', () => {
    it('should delete a strategy', async () => {
      applyMocks();
      mockRepoMethods.delete.mockResolvedValueOnce(true);

      const result = await engine.unregisterStrategy('to-delete');

      expect(mockRepoMethods.delete).toHaveBeenCalledWith('to-delete');
      expect(result).toBe(true);
    });

    it('should return false when delete fails', async () => {
      applyMocks();
      mockRepoMethods.delete.mockResolvedValueOnce(false);

      const result = await engine.unregisterStrategy('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== getStrategy ====================

  describe('getStrategy', () => {
    it('should return undefined for unknown strategy', async () => {
      applyMocks();
      mockRepoMethods.findById.mockResolvedValueOnce(undefined);

      const result = await engine.getStrategy('unknown');

      expect(result).toBeUndefined();
    });

    it('should return the strategy from repository', async () => {
      applyMocks();
      const entity = makeStrategyEntity({ id: 'cached-1', name: 'Cached Strategy', actions: [{ type: 'restart', params: {} }], conditions: [] });
      mockRepoMethods.findById.mockResolvedValueOnce(entity);

      const result = await engine.getStrategy('cached-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('cached-1');
    });
  });

  // ==================== getAllStrategies ====================

  describe('getAllStrategies', () => {
    it('should return all strategies from DB', async () => {
      applyMocks();
      mockRepoMethods.findAll.mockResolvedValueOnce({
        entities: [makeStrategyEntity({ id: 's1', name: 'S1' })],
        total: 1,
      });

      const strategies = await engine.getAllStrategies();

      expect(strategies.length).toBe(1);
    });
  });

  // ==================== enableStrategy / disableStrategy ====================

  describe('enableStrategy / disableStrategy', () => {
    it('should enable a strategy', async () => {
      applyMocks();
      mockRepoMethods.enableStrategy.mockResolvedValueOnce(makeStrategyEntity({ id: 'toggle-1', enabled: true }));

      const result = await engine.enableStrategy('toggle-1');

      expect(result).toBe(true);
    });

    it('should disable a strategy', async () => {
      applyMocks();
      mockRepoMethods.disableStrategy.mockResolvedValueOnce(makeStrategyEntity({ id: 'toggle-2', enabled: false }));

      const result = await engine.disableStrategy('toggle-2');

      expect(result).toBe(true);
    });

    it('should return false when strategy not found', async () => {
      applyMocks();
      mockRepoMethods.enableStrategy.mockResolvedValueOnce(undefined);

      const result = await engine.enableStrategy('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== matchStrategies ====================

  describe('matchStrategies', () => {
    it('should match strategies by incident type', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([makeStrategyEntity({ id: 'match-1', triggerType: 'pod_crash' })]);

      const matched = await engine.matchStrategies('pod_crash');

      expect(matched.length).toBeGreaterThan(0);
    });

    it('should return empty when no strategies enabled', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([]);

      const matched = await engine.matchStrategies('pod_crash');
      expect(matched).toEqual([]);
    });
  });

  // ==================== selectBestStrategy ====================

  describe('selectBestStrategy', () => {
    it('should select strategy with highest confidence', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([
        makeStrategyEntity({ id: 'low', confidence: 50 }),
        makeStrategyEntity({ id: 'high', confidence: 95 }),
      ]);

      const best = await engine.selectBestStrategy('pod_crash');

      expect(best!.confidence).toBe(95);
    });

    it('should return null when no strategies', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([]);

      const best = await engine.selectBestStrategy('custom' as IncidentType);
      expect(best).toBeNull();
    });
  });

  // ==================== condition evaluation ====================

  describe('condition evaluation', () => {
    it('should match when conditions pass', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([
        makeStrategyEntity({
          id: 'eq-cond',
          triggerType: 'pod_crash',
          conditions: JSON.parse(JSON.stringify([{ field: 'env', operator: '==', value: 'prod' }])),
        }),
      ]);

      const matched = await engine.matchStrategies('pod_crash', { env: 'prod' });
      expect(matched.length).toBe(1);
    });

    it('should filter by severity in conditions', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([
        makeStrategyEntity({
          id: 'in-cond',
          triggerType: 'pod_crash',
          conditions: JSON.parse(JSON.stringify([{ field: 'severity', operator: 'in', value: ['critical', 'warning'] }])),
        }),
      ]);

      const matched = await engine.matchStrategies('pod_crash', { severity: 'critical' });
      expect(matched.length).toBe(1);

      const notMatched = await engine.matchStrategies('pod_crash', { severity: 'info' });
      expect(notMatched).toEqual([]);
    });

    it('should match without conditions', async () => {
      applyMocks();
      mockRepoMethods.findEnabled.mockResolvedValueOnce([
        makeStrategyEntity({
          id: 'no-conds',
          triggerType: 'pod_crash',
          conditions: [],
        }),
      ]);

      const matched = await engine.matchStrategies('pod_crash');
      expect(matched.length).toBe(1);
    });
  });
});
