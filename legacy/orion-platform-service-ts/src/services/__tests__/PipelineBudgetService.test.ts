/**
 * PipelineBudgetService — Unit Tests
 *
 * Tests cover: setBudget, getBudget, checkBudget, updateUsage, deleteBudget,
 * auto-blocking, and edge cases.
 */

import { PipelineBudgetService } from '../PipelineBudgetService';
import { PipelineBudgetRepository, PipelineBudgetEntity } from '../../repositories/PipelineBudgetRepository';

function createMockRepository(): jest.Mocked<PipelineBudgetRepository> {
  const store = new Map<string, PipelineBudgetEntity>();

  const mock: jest.Mocked<PipelineBudgetRepository> = {
    findByPipelineId: jest.fn(async (pipelineId: string) => {
      return store.get(pipelineId);
    }),
    updateCost: jest.fn(async (pipelineId: string, newCost: number) => {
      const entity = store.get(pipelineId);
      if (!entity) return undefined;
      entity.currentCost = newCost;
      entity.updatedAt = new Date();
      store.set(pipelineId, entity);
      return entity;
    }),
    updateBlocked: jest.fn(async (pipelineId: string, blocked: boolean) => {
      const entity = store.get(pipelineId);
      if (!entity) return undefined;
      entity.blocked = blocked;
      entity.updatedAt = new Date();
      store.set(pipelineId, entity);
      return entity;
    }),
    upsert: jest.fn(async (pipelineId: string, maxCost: number, currency: string, createdBy: string) => {
      const existing = store.get(pipelineId);
      const entity: PipelineBudgetEntity = {
        id: existing?.id ?? `budget-${pipelineId}`,
        pipelineId,
        maxCost,
        currentCost: existing?.currentCost ?? 0,
        currency,
        blocked: false,
        createdBy,
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      store.set(pipelineId, entity);
      return entity;
    }),
    deleteByPipelineId: jest.fn(async (pipelineId: string) => {
      return store.delete(pipelineId);
    }),
    findById: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    mapRowToEntity: jest.fn(),
  } as unknown as jest.Mocked<PipelineBudgetRepository>;

  return mock;
}

const TEST_PIPELINE = '550e8400-e29b-41d4-a716-446655440000';

describe('PipelineBudgetService', () => {
  let repo: jest.Mocked<PipelineBudgetRepository>;
  let service: PipelineBudgetService;

  beforeEach(() => {
    repo = createMockRepository();
    service = new PipelineBudgetService(repo);
  });

  describe('setBudget', () => {
    it('should create a new budget when none exists', async () => {
      const result = await service.setBudget({
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currency: 'USD',
        createdBy: 'user-1',
      });

      expect(result.pipelineId).toBe(TEST_PIPELINE);
      expect(result.maxCost).toBe(100);
      expect(result.currentCost).toBe(0);
      expect(result.currency).toBe('USD');
      expect(result.blocked).toBe(false);
      expect(repo.upsert).toHaveBeenCalledWith(TEST_PIPELINE, 100, 'USD', 'user-1');
    });

    it('should default currency to USD when not provided', async () => {
      const result = await service.setBudget({
        pipelineId: TEST_PIPELINE,
        maxCost: 50,
        createdBy: 'user-2',
      });

      expect(result.currency).toBe('USD');
    });

    it('should update maxCost and unblock when budget already exists', async () => {
      // Simulate existing blocked budget
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 120,
        currency: 'USD',
        blocked: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.setBudget({
        pipelineId: TEST_PIPELINE,
        maxCost: 200,
        currency: 'EUR',
        createdBy: 'user-2',
      });

      expect(result.maxCost).toBe(200);
      expect(result.blocked).toBe(false);
    });
  });

  describe('getBudget', () => {
    it('should return budget when it exists', async () => {
      const mockBudget: PipelineBudgetEntity = {
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 50,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repo.findByPipelineId.mockResolvedValueOnce(mockBudget);

      const result = await service.getBudget(TEST_PIPELINE);

      expect(result).toBeDefined();
      expect(result?.maxCost).toBe(100);
      expect(result?.currentCost).toBe(50);
    });

    it('should return undefined when no budget exists', async () => {
      repo.findByPipelineId.mockResolvedValueOnce(undefined);

      const result = await service.getBudget(TEST_PIPELINE);

      expect(result).toBeUndefined();
    });
  });

  describe('checkBudget', () => {
    it('should allow when no budget is set', async () => {
      repo.findByPipelineId.mockResolvedValueOnce(undefined);

      const result = await service.checkBudget(TEST_PIPELINE);

      expect(result.allowed).toBe(true);
      expect(result.budget).toBeUndefined();
    });

    it('should reject when budget is manually blocked', async () => {
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 50,
        currency: 'USD',
        blocked: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkBudget(TEST_PIPELINE);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Budget is blocked');
    });

    it('should reject when currentCost >= maxCost', async () => {
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 100,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkBudget(TEST_PIPELINE);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Budget exceeded');
    });

    it('should allow when currentCost < maxCost', async () => {
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 30,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkBudget(TEST_PIPELINE);

      expect(result.allowed).toBe(true);
      expect(result.budget).toBeDefined();
      expect(result.budget?.currentCost).toBe(30);
    });
  });

  describe('updateUsage', () => {
    it('should increment current_cost by costDelta', async () => {
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 30,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.updateCost.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 50,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUsage(TEST_PIPELINE, 20);

      expect(result.currentCost).toBe(50);
      expect(result.blocked).toBe(false);
      expect(repo.updateCost).toHaveBeenCalledWith(TEST_PIPELINE, 50);
    });

    it('should auto-block when newCost >= maxCost', async () => {
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 80,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.updateCost.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 110,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.updateBlocked.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 110,
        currency: 'USD',
        blocked: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUsage(TEST_PIPELINE, 30);

      expect(result.currentCost).toBe(110);
      expect(result.blocked).toBe(true);
      expect(repo.updateBlocked).toHaveBeenCalledWith(TEST_PIPELINE, true);
    });

    it('should auto-block when newCost equals maxCost', async () => {
      repo.findByPipelineId.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 70,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.updateCost.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 100,
        currency: 'USD',
        blocked: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.updateBlocked.mockResolvedValueOnce({
        id: `budget-${TEST_PIPELINE}`,
        pipelineId: TEST_PIPELINE,
        maxCost: 100,
        currentCost: 100,
        currency: 'USD',
        blocked: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUsage(TEST_PIPELINE, 30);

      expect(result.blocked).toBe(true);
    });

    it('should throw when no budget exists for the pipeline', async () => {
      repo.findByPipelineId.mockResolvedValueOnce(undefined);

      await expect(service.updateUsage(TEST_PIPELINE, 10)).rejects.toThrow(
        `No budget set for pipeline ${TEST_PIPELINE}`,
      );
    });
  });

  describe('deleteBudget', () => {
    it('should return true when budget is deleted', async () => {
      repo.deleteByPipelineId.mockResolvedValueOnce(true);

      const result = await service.deleteBudget(TEST_PIPELINE);

      expect(result).toBe(true);
      expect(repo.deleteByPipelineId).toHaveBeenCalledWith(TEST_PIPELINE);
    });

    it('should return false when no budget exists', async () => {
      repo.deleteByPipelineId.mockResolvedValueOnce(false);

      const result = await service.deleteBudget(TEST_PIPELINE);

      expect(result).toBe(false);
    });
  });
});
