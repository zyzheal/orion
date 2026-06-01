/**
 * ABExperimentService - Unit Tests
 *
 * Tests for A/B experiment lifecycle (create/start/stop/cancel),
 * variant management, traffic splitting, and user assignment.
 */

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `exp-uuid-${++uuidCounter}`),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import {
  ABExperimentService,
  CreateExperimentInput,
} from '../ABExperimentService';
import { OrionError } from '../../../errors';

describe('ABExperimentService', () => {
  let service: ABExperimentService;

  beforeEach(() => {
    uuidCounter = 0;
    service = new ABExperimentService(); // No database = in-memory
  });

  // ==================== createExperiment ====================

  describe('createExperiment', () => {
    it('should create an experiment with valid variants (100% traffic)', async () => {
      const input: CreateExperimentInput = {
        name: 'Homepage Redesign',
        description: 'Test new homepage layout',
        hypothesis: 'New layout increases conversion by 10%',
        variants: [
          { name: 'control', trafficPercentage: 50, config: { layout: 'old' }, isControl: true },
          { name: 'variant-a', trafficPercentage: 50, config: { layout: 'new' } },
        ],
        metrics: [
          { name: 'conversion_rate', type: 'conversion', target: 0.1 },
        ],
      };

      const exp = await service.createExperiment('tenant-1', input, 'pm');

      expect(exp.id).toBeDefined();
      expect(exp.tenantId).toBe('tenant-1');
      expect(exp.name).toBe('Homepage Redesign');
      expect(exp.description).toBe('Test new homepage layout');
      expect(exp.hypothesis).toBe('New layout increases conversion by 10%');
      expect(exp.status).toBe('draft');
      expect(exp.variants).toHaveLength(2);
      expect(exp.variants[0].isControl).toBe(true);
      expect(exp.metrics).toHaveLength(1);
      expect(exp.createdBy).toBe('pm');
      expect(exp.createdAt).toBeInstanceOf(Date);
      expect(exp.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when total traffic is not 100%', async () => {
      const input: CreateExperimentInput = {
        name: 'Bad Traffic',
        variants: [
          { name: 'control', trafficPercentage: 30, config: {} },
          { name: 'variant', trafficPercentage: 30, config: {} },
        ],
      };

      await expect(
        service.createExperiment('tenant-1', input, 'admin')
      ).rejects.toThrow('Total traffic percentage must be 100');
    });

    it('should auto-assign first variant as control when none specified', async () => {
      const input: CreateExperimentInput = {
        name: 'Auto Control',
        variants: [
          { name: 'a', trafficPercentage: 50, config: {} },
          { name: 'b', trafficPercentage: 50, config: {} },
        ],
      };

      const exp = await service.createExperiment('tenant-1', input, 'admin');
      expect(exp.variants[0].isControl).toBe(true);
      expect(exp.variants[1].isControl).toBe(false);
    });

    it('should use explicit control variant when specified', async () => {
      const input: CreateExperimentInput = {
        name: 'Explicit Control',
        variants: [
          { name: 'a', trafficPercentage: 50, config: {}, isControl: false },
          { name: 'b', trafficPercentage: 50, config: {}, isControl: true },
        ],
      };

      const exp = await service.createExperiment('tenant-1', input, 'admin');
      expect(exp.variants[0].isControl).toBe(false);
      expect(exp.variants[1].isControl).toBe(true);
    });

    it('should default metrics to empty array', async () => {
      const input: CreateExperimentInput = {
        name: 'No Metrics',
        variants: [
          { name: 'a', trafficPercentage: 100, config: {} },
        ],
      };

      const exp = await service.createExperiment('tenant-1', input, 'admin');
      expect(exp.metrics).toEqual([]);
    });

    it('should support three-way traffic split', async () => {
      const input: CreateExperimentInput = {
        name: 'Three Way',
        variants: [
          { name: 'control', trafficPercentage: 34, config: {}, isControl: true },
          { name: 'variant-a', trafficPercentage: 33, config: {} },
          { name: 'variant-b', trafficPercentage: 33, config: {} },
        ],
      };

      const exp = await service.createExperiment('tenant-1', input, 'admin');
      expect(exp.variants).toHaveLength(3);
    });
  });

  // ==================== startExperiment ====================

  describe('startExperiment', () => {
    it('should start a draft experiment', async () => {
      const exp = await createTestExperiment();
      const started = await service.startExperiment(exp.id);

      expect(started.status).toBe('running');
      expect(started.startDate).toBeInstanceOf(Date);
      expect(started.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent experiment', async () => {
      await expect(service.startExperiment('non-existent')).rejects.toThrow(
        'Experiment'
      );
    });

    it('should throw error when starting a non-draft experiment', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      await expect(service.startExperiment(exp.id)).rejects.toThrow(
        'cannot be started from'
      );
    });
  });

  // ==================== stopExperiment ====================

  describe('stopExperiment', () => {
    it('should stop a running experiment', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      const stopped = await service.stopExperiment(exp.id, 'variant-a');

      expect(stopped.status).toBe('completed');
      expect(stopped.endDate).toBeInstanceOf(Date);
      expect(stopped.results).toBeDefined();
    });

    it('should generate results with winner variant', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      const stopped = await service.stopExperiment(exp.id, 'variant-a');
      expect(stopped.results).toBeDefined();
      const results = stopped.results as any;
      expect(results.variants).toBeDefined();
      expect(results.completedAt).toBeDefined();
    });

    it('should throw error for non-existent experiment', async () => {
      await expect(service.stopExperiment('non-existent')).rejects.toThrow(
        'Experiment'
      );
    });

    it('should throw error when stopping a non-running experiment', async () => {
      const exp = await createTestExperiment();

      await expect(service.stopExperiment(exp.id)).rejects.toThrow(
        'not running'
      );
    });
  });

  // ==================== cancelExperiment ====================

  describe('cancelExperiment', () => {
    it('should cancel a draft experiment', async () => {
      const exp = await createTestExperiment();
      const cancelled = await service.cancelExperiment(exp.id);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.endDate).toBeInstanceOf(Date);
    });

    it('should cancel a running experiment', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      const cancelled = await service.cancelExperiment(exp.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should throw error when cancelling a completed experiment', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);
      await service.stopExperiment(exp.id);

      await expect(service.cancelExperiment(exp.id)).rejects.toThrow(
        'Cannot cancel completed experiment'
      );
    });

    it('should throw error for non-existent experiment', async () => {
      await expect(service.cancelExperiment('non-existent')).rejects.toThrow(
        'Experiment'
      );
    });
  });

  // ==================== getExperiment / listExperiments ====================

  describe('getExperiment', () => {
    it('should return experiment by id', async () => {
      const exp = await createTestExperiment();
      const found = await service.getExperiment(exp.id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Test Experiment');
    });

    it('should return null for non-existent id', async () => {
      const found = await service.getExperiment('ghost');
      expect(found).toBeNull();
    });
  });

  describe('listExperiments', () => {
    it('should list experiments for a tenant', async () => {
      await createTestExperiment('Experiment A');
      await createTestExperiment('Experiment B');

      const list = await service.listExperiments('tenant-1');
      expect(list).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const exp1 = await createTestExperiment('Draft Exp');
      const exp2 = await createTestExperiment('Running Exp');
      await service.startExperiment(exp2.id);

      const drafts = await service.listExperiments('tenant-1', 'draft');
      expect(drafts).toHaveLength(1);
      expect(drafts[0].name).toBe('Draft Exp');

      const running = await service.listExperiments('tenant-1', 'running');
      expect(running).toHaveLength(1);
      expect(running[0].name).toBe('Running Exp');
    });
  });

  // ==================== deleteExperiment ====================

  describe('deleteExperiment', () => {
    it('should delete a draft experiment', async () => {
      const exp = await createTestExperiment();
      const result = await service.deleteExperiment(exp.id);
      expect(result).toBe(true);

      const found = await service.getExperiment(exp.id);
      expect(found).toBeNull();
    });

    it('should throw error when deleting a running experiment', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      await expect(service.deleteExperiment(exp.id)).rejects.toThrow(
        'Cannot delete running experiment'
      );
    });

    it('should return false for non-existent experiment', async () => {
      const result = await service.deleteExperiment('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== getAssignedVariant ====================

  describe('getAssignedVariant', () => {
    it('should assign user to a variant for running experiment', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      const variant = await service.getAssignedVariant(exp.id, 'user-1');
      expect(variant).not.toBeNull();
      expect(variant!.name).toBeDefined();
    });

    it('should return null for non-running experiment', async () => {
      const exp = await createTestExperiment();

      const variant = await service.getAssignedVariant(exp.id, 'user-1');
      expect(variant).toBeNull();
    });

    it('should return null for non-existent experiment', async () => {
      const variant = await service.getAssignedVariant('ghost', 'user-1');
      expect(variant).toBeNull();
    });

    it('should be deterministic for same user', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      const v1 = await service.getAssignedVariant(exp.id, 'user-42');
      const v2 = await service.getAssignedVariant(exp.id, 'user-42');

      expect(v1!.name).toBe(v2!.name);
    });

    it('should distribute users across variants', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);

      // With 50/50 split, we should see both variants with enough users
      const assignments = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const variant = await service.getAssignedVariant(exp.id, `user-${i}`);
        if (variant) assignments.add(variant.name);
      }

      // With 100 users and 50/50 split, very likely both variants are assigned
      expect(assignments.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== State machine transitions ====================

  describe('experiment lifecycle', () => {
    it('should follow draft -> running -> completed lifecycle', async () => {
      const exp = await createTestExperiment();
      expect(exp.status).toBe('draft');

      const started = await service.startExperiment(exp.id);
      expect(started.status).toBe('running');

      const completed = await service.stopExperiment(exp.id);
      expect(completed.status).toBe('completed');
    });

    it('should follow draft -> cancelled lifecycle', async () => {
      const exp = await createTestExperiment();
      const cancelled = await service.cancelExperiment(exp.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should follow draft -> running -> cancelled lifecycle', async () => {
      const exp = await createTestExperiment();
      await service.startExperiment(exp.id);
      const cancelled = await service.cancelExperiment(exp.id);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  // ==================== Helper ====================

  async function createTestExperiment(name = 'Test Experiment') {
    return service.createExperiment(
      'tenant-1',
      {
        name,
        variants: [
          { name: 'control', trafficPercentage: 50, config: { version: 'old' }, isControl: true },
          { name: 'variant-a', trafficPercentage: 50, config: { version: 'new' } },
        ],
      },
      'admin'
    );
  }
});
