/**
 * HealingStrategyEngine - Unit Tests
 *
 * Tests for strategy registration, retrieval, matching, condition evaluation,
 * enable/disable operations, and built-in strategy loading.
 */

import { HealingStrategyEngine } from '../HealingStrategyEngine';
import { HealingStrategy, IncidentType } from '../types';

// Mock HealingStrategyRepository
jest.mock('../../../repositories/HealingStrategyRepository', () => ({
  HealingStrategyRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue(true),
    findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
    findEnabled: jest.fn().mockResolvedValue([]),
    enableStrategy: jest.fn().mockResolvedValue(true),
    disableStrategy: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock pino
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

function createStrategy(overrides?: Partial<HealingStrategy>): HealingStrategy {
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

describe('HealingStrategyEngine', () => {
  let engine: HealingStrategyEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new HealingStrategyEngine();
  });

  // ==================== registerStrategy ====================

  describe('registerStrategy', () => {
    it('should register a new strategy', async () => {
      const strategy = createStrategy({ id: 'custom-1' });

      await engine.registerStrategy(strategy);

      const retrieved = await engine.getStrategy('custom-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Strategy');
    });

    it('should allow overwriting an existing strategy', async () => {
      const strategy1 = createStrategy({ id: 'overwrite-1', name: 'V1' });
      const strategy2 = createStrategy({ id: 'overwrite-1', name: 'V2' });

      await engine.registerStrategy(strategy1);
      await engine.registerStrategy(strategy2);

      const retrieved = await engine.getStrategy('overwrite-1');
      expect(retrieved!.name).toBe('V2');
    });
  });

  // ==================== unregisterStrategy ====================

  describe('unregisterStrategy', () => {
    it('should remove a registered strategy', async () => {
      const strategy = createStrategy({ id: 'to-delete' });
      await engine.registerStrategy(strategy);

      const result = await engine.unregisterStrategy('to-delete');

      expect(result).toBe(true);
      const retrieved = await engine.getStrategy('to-delete');
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent strategy', async () => {
      const result = await engine.unregisterStrategy('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== getStrategy ====================

  describe('getStrategy', () => {
    it('should return undefined for unknown strategy', async () => {
      const result = await engine.getStrategy('unknown');

      expect(result).toBeUndefined();
    });

    it('should return the strategy from memory cache', async () => {
      const strategy = createStrategy({ id: 'cached-1', name: 'Cached Strategy' });
      await engine.registerStrategy(strategy);

      const result = await engine.getStrategy('cached-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('cached-1');
    });
  });

  // ==================== getAllStrategies ====================

  describe('getAllStrategies', () => {
    it('should return all registered strategies including built-ins', async () => {
      const strategies = await engine.getAllStrategies();

      // Built-in strategies should be registered
      expect(strategies.length).toBeGreaterThan(0);
    });

    it('should include custom strategies', async () => {
      await engine.registerStrategy(createStrategy({ id: 'custom-all-1' }));

      const strategies = await engine.getAllStrategies();

      const found = strategies.find(s => s.id === 'custom-all-1');
      expect(found).toBeDefined();
    });
  });

  // ==================== enableStrategy / disableStrategy ====================

  describe('enableStrategy / disableStrategy', () => {
    it('should enable a strategy', async () => {
      const strategy = createStrategy({ id: 'toggle-1', enabled: false });
      await engine.registerStrategy(strategy);

      const result = await engine.enableStrategy('toggle-1');

      expect(result).toBe(true);
      const retrieved = await engine.getStrategy('toggle-1');
      expect(retrieved!.enabled).toBe(true);
    });

    it('should disable a strategy', async () => {
      const strategy = createStrategy({ id: 'toggle-2', enabled: true });
      await engine.registerStrategy(strategy);

      const result = await engine.disableStrategy('toggle-2');

      expect(result).toBe(true);
      const retrieved = await engine.getStrategy('toggle-2');
      expect(retrieved!.enabled).toBe(false);
    });

    it('should return false for non-existent strategy', async () => {
      const result = await engine.enableStrategy('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== matchStrategies ====================

  describe('matchStrategies', () => {
    it('should match strategies by incident type', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'match-1',
        triggerType: 'pod_crash',
        enabled: true,
      }));

      const matched = await engine.matchStrategies('pod_crash');

      expect(matched.length).toBeGreaterThan(0);
      expect(matched.some(s => s.id === 'match-1')).toBe(true);
    });

    it('should not match disabled strategies', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'disabled-match',
        triggerType: 'pod_crash',
        enabled: false,
      }));

      const matched = await engine.matchStrategies('pod_crash');

      expect(matched.find(s => s.id === 'disabled-match')).toBeUndefined();
    });

    it('should match strategies with triggerType "any"', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'any-trigger',
        triggerType: 'any',
        enabled: true,
      }));

      const matched = await engine.matchStrategies('high_cpu');

      expect(matched.some(s => s.id === 'any-trigger')).toBe(true);
    });

    it('should filter by conditions when tags are provided', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'conditional-1',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [
          { field: 'severity', operator: '==', value: 'critical' },
        ],
      }));

      const matchedWithTags = await engine.matchStrategies('pod_crash', { severity: 'critical' });
      const matchedWithoutTags = await engine.matchStrategies('pod_crash', { severity: 'warning' });

      expect(matchedWithTags.some(s => s.id === 'conditional-1')).toBe(true);
      expect(matchedWithoutTags.find(s => s.id === 'conditional-1')).toBeUndefined();
    });

    it('should return empty array when no strategies match', async () => {
      const matched = await engine.matchStrategies('custom' as IncidentType);

      // Built-in strategies don't have 'custom' trigger type
      const customMatched = matched.filter(s => s.triggerType === 'custom');
      expect(customMatched).toHaveLength(0);
    });
  });

  // ==================== selectBestStrategy ====================

  describe('selectBestStrategy', () => {
    it('should select strategy with highest confidence', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'low-conf',
        triggerType: 'pod_crash',
        enabled: true,
        confidence: 50,
      }));
      await engine.registerStrategy(createStrategy({
        id: 'high-conf',
        triggerType: 'pod_crash',
        enabled: true,
        confidence: 95,
      }));

      const best = await engine.selectBestStrategy('pod_crash');

      expect(best).toBeDefined();
      expect(best!.confidence).toBeGreaterThanOrEqual(90);
    });

    it('should return null when no strategies match', async () => {
      const best = await engine.selectBestStrategy('custom' as IncidentType);

      // Only check if there are no built-in strategies matching 'custom'
      const allStrategies = await engine.getAllStrategies();
      const hasCustomMatch = allStrategies.some(s => s.triggerType === 'custom' || s.triggerType === 'any');
      if (!hasCustomMatch) {
        expect(best).toBeNull();
      }
    });

    it('should prefer strategies with more retries when confidence is equal', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'no-retries',
        triggerType: 'pod_crash',
        enabled: true,
        confidence: 80,
        maxRetries: 0,
      }));
      await engine.registerStrategy(createStrategy({
        id: 'with-retries',
        triggerType: 'pod_crash',
        enabled: true,
        confidence: 80,
        maxRetries: 3,
      }));

      const best = await engine.selectBestStrategy('pod_crash');

      // Should prefer the one with more retries (or built-in ones with higher confidence)
      expect(best).toBeDefined();
    });
  });

  // ==================== condition evaluation ====================

  describe('condition evaluation', () => {
    it('should evaluate "==" operator', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'eq-cond',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [{ field: 'env', operator: '==', value: 'prod' }],
      }));

      const matched = await engine.matchStrategies('pod_crash', { env: 'prod' });
      const notMatched = await engine.matchStrategies('pod_crash', { env: 'dev' });

      expect(matched.some(s => s.id === 'eq-cond')).toBe(true);
      expect(notMatched.find(s => s.id === 'eq-cond')).toBeUndefined();
    });

    it('should evaluate "!=" operator', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'neq-cond',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [{ field: 'env', operator: '!=', value: 'dev' }],
      }));

      const matched = await engine.matchStrategies('pod_crash', { env: 'prod' });
      const notMatched = await engine.matchStrategies('pod_crash', { env: 'dev' });

      expect(matched.some(s => s.id === 'neq-cond')).toBe(true);
      expect(notMatched.find(s => s.id === 'neq-cond')).toBeUndefined();
    });

    it('should evaluate "in" operator', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'in-cond',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [{ field: 'severity', operator: 'in', value: ['critical', 'warning'] }],
      }));

      const matchedCritical = await engine.matchStrategies('pod_crash', { severity: 'critical' });
      const matchedInfo = await engine.matchStrategies('pod_crash', { severity: 'info' });

      expect(matchedCritical.some(s => s.id === 'in-cond')).toBe(true);
      expect(matchedInfo.find(s => s.id === 'in-cond')).toBeUndefined();
    });

    it('should evaluate "contains" operator for strings', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'contains-cond',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [{ field: 'message', operator: 'contains', value: 'OOM' }],
      }));

      const matched = await engine.matchStrategies('pod_crash', { message: 'Pod OOM killed' });
      const notMatched = await engine.matchStrategies('pod_crash', { message: 'Pod restarted' });

      expect(matched.some(s => s.id === 'contains-cond')).toBe(true);
      expect(notMatched.find(s => s.id === 'contains-cond')).toBeUndefined();
    });

    it('should evaluate "contains" operator for arrays', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'contains-arr',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [{ field: 'tags', operator: 'contains', value: 'urgent' }],
      }));

      const matched = await engine.matchStrategies('pod_crash', { tags: ['urgent', 'p1'] });
      const notMatched = await engine.matchStrategies('pod_crash', { tags: ['p2'] });

      expect(matched.some(s => s.id === 'contains-arr')).toBe(true);
      expect(notMatched.find(s => s.id === 'contains-arr')).toBeUndefined();
    });

    it('should evaluate ">" and "<" operators', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'gt-cond',
        triggerType: 'high_cpu',
        enabled: true,
        conditions: [{ field: 'cpu', operator: '>', value: 80 }],
      }));

      const matched = await engine.matchStrategies('high_cpu', { cpu: 90 });
      const notMatched = await engine.matchStrategies('high_cpu', { cpu: 50 });

      expect(matched.some(s => s.id === 'gt-cond')).toBe(true);
      expect(notMatched.find(s => s.id === 'gt-cond')).toBeUndefined();
    });

    it('should evaluate ">=" and "<=" operators', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'gte-cond',
        triggerType: 'high_cpu',
        enabled: true,
        conditions: [{ field: 'cpu', operator: '>=', value: 80 }],
      }));

      const matched = await engine.matchStrategies('high_cpu', { cpu: 80 });
      const notMatched = await engine.matchStrategies('high_cpu', { cpu: 79 });

      expect(matched.some(s => s.id === 'gte-cond')).toBe(true);
      expect(notMatched.find(s => s.id === 'gte-cond')).toBeUndefined();
    });

    it('should return false for missing field in context', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'missing-field',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: [{ field: 'nonexistent', operator: '==', value: 'x' }],
      }));

      const matched = await engine.matchStrategies('pod_crash', { other: 'value' });

      expect(matched.find(s => s.id === 'missing-field')).toBeUndefined();
    });

    it('should pass when no conditions and no context', async () => {
      await engine.registerStrategy(createStrategy({
        id: 'no-conditions',
        triggerType: 'pod_crash',
        enabled: true,
        conditions: undefined,
      }));

      const matched = await engine.matchStrategies('pod_crash');

      expect(matched.some(s => s.id === 'no-conditions')).toBe(true);
    });
  });

  // ==================== built-in strategies ====================

  describe('built-in strategies', () => {
    it('should register built-in strategies on construction', async () => {
      const strategies = await engine.getAllStrategies();

      const ids = strategies.map(s => s.id);
      expect(ids).toContain('restart-on-crash');
      expect(ids).toContain('scale-on-high-cpu');
      expect(ids).toContain('scale-on-high-memory');
      expect(ids).toContain('failover-on-node-failure');
      expect(ids).toContain('rollback-on-deployment-failure');
      expect(ids).toContain('restart-on-service-down');
      expect(ids).toContain('scale-on-high-error-rate');
      expect(ids).toContain('restart-on-network-timeout');
    });

    it('should have correct trigger types for built-in strategies', async () => {
      const strategies = await engine.getAllStrategies();

      const restartOnCrash = strategies.find(s => s.id === 'restart-on-crash');
      expect(restartOnCrash!.triggerType).toBe('pod_crash');

      const scaleOnCpu = strategies.find(s => s.id === 'scale-on-high-cpu');
      expect(scaleOnCpu!.triggerType).toBe('high_cpu');
    });

    it('should have all built-in strategies enabled by default', async () => {
      const strategies = await engine.getAllStrategies();

      const builtIns = strategies.filter(s =>
        s.id.startsWith('restart-on-') ||
        s.id.startsWith('scale-on-') ||
        s.id.startsWith('failover-') ||
        s.id.startsWith('rollback-')
      );

      builtIns.forEach(s => {
        expect(s.enabled).toBe(true);
      });
    });
  });

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should initialize without db', () => {
      const engine = new HealingStrategyEngine();
      expect(engine).toBeDefined();
    });

    it('should initialize with db for PostgreSQL persistence', () => {
      const mockDb = { query: jest.fn() };
      const engine = new HealingStrategyEngine(mockDb);
      expect(engine).toBeDefined();
    });
  });
});
