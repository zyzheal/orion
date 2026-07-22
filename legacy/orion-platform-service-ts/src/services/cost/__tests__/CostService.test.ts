/**
 * Tests for CostService
 */

import { CostService, CostServiceError, ListCostOptions, PaginatedResult } from '../CostService';
import { CostRepository, CostRecord, Budget, CostAggregation } from '../CostRepository';

// Mock CostRepository
jest.mock('../CostRepository');

describe('CostService', () => {
  let service: CostService;
  let mockRepo: jest.Mocked<CostRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = {
      findAll: jest.fn(),
      createCostRecord: jest.fn(),
      getCostByService: jest.fn(),
      getTotalCost: jest.fn(),
      findBudgetById: jest.fn(),
      findAllBudgets: jest.fn(),
      createBudget: jest.fn(),
      updateBudgetSpend: jest.fn(),
      getBudgetAlerts: jest.fn(),
    } as any;
    service = new CostService(mockRepo);
  });

  function makeCostRecord(overrides: Partial<CostRecord> = {}): CostRecord {
    return {
      id: 'c1',
      tenant_id: 't1',
      date: new Date('2026-05-01'),
      service: 'compute',
      resource_id: 'r1',
      region: 'us-east-1',
      cost: 50,
      currency: 'USD',
      tags: {},
      created_at: new Date(),
      ...overrides,
    };
  }

  function makeBudget(overrides: Partial<Budget> = {}): Budget {
    return {
      id: 'b1',
      tenant_id: 't1',
      name: 'Monthly Budget',
      amount: 1000,
      period: 'monthly',
      alert_threshold: 80,
      current_spend: 500,
      created_at: new Date(),
      ...overrides,
    };
  }

  // ==================== recordCost ====================

  describe('recordCost', () => {
    it('should record a cost with default date', async () => {
      const expected = makeCostRecord();
      mockRepo.createCostRecord.mockResolvedValueOnce(expected);

      const result = await service.recordCost('t1', 'compute', 50);

      expect(result).toEqual(expected);
      expect(mockRepo.createCostRecord).toHaveBeenCalledWith(
        't1',
        expect.any(Date),
        'compute',
        50,
        undefined,
        undefined,
        undefined
      );
    });

    it('should record a cost with all options', async () => {
      const expected = makeCostRecord({ resource_id: 'r2', region: 'eu-west-1', tags: { env: 'staging' } });
      mockRepo.createCostRecord.mockResolvedValueOnce(expected);

      const result = await service.recordCost('t1', 'storage', 100, {
        date: new Date('2026-06-01'),
        resourceId: 'r2',
        region: 'eu-west-1',
        tags: { env: 'staging' },
      });

      expect(result).toEqual(expected);
      expect(mockRepo.createCostRecord).toHaveBeenCalledWith(
        't1',
        expect.any(Date),
        'storage',
        100,
        'r2',
        'eu-west-1',
        { env: 'staging' }
      );
    });

    it('should throw CostServiceError when tenantId is empty', async () => {
      await expect(service.recordCost('', 'compute', 50)).rejects.toThrow(CostServiceError);
      await expect(service.recordCost('', 'compute', 50)).rejects.toThrow('Tenant ID required');
    });

    it('should throw CostServiceError with INVALID_INPUT code', async () => {
      try {
        await service.recordCost('', 'compute', 50);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CostServiceError);
        expect((err as CostServiceError).code).toBe('INVALID_INPUT');
      }
    });
  });

  // ==================== getCosts ====================

  describe('getCosts', () => {
    it('should return paginated costs with defaults', async () => {
      const records = [makeCostRecord(), makeCostRecord({ id: 'c2', cost: 75 })];
      mockRepo.findAll.mockResolvedValueOnce(records);

      const result = await service.getCosts();

      expect(result.data).toEqual(records);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(mockRepo.findAll).toHaveBeenCalledWith({
        tenantId: undefined,
        startDate: undefined,
        endDate: undefined,
        service: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it('should calculate offset for page > 1', async () => {
      mockRepo.findAll.mockResolvedValueOnce([]);

      await service.getCosts({ page: 3, limit: 10 });

      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should pass filter options to repository', async () => {
      mockRepo.findAll.mockResolvedValueOnce([]);
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-31');

      await service.getCosts({
        tenantId: 't1',
        startDate: start,
        endDate: end,
        service: 'ai',
      });

      expect(mockRepo.findAll).toHaveBeenCalledWith({
        tenantId: 't1',
        startDate: start,
        endDate: end,
        service: 'ai',
        limit: 20,
        offset: 0,
      });
    });

    it('should calculate totalPages correctly', async () => {
      const records = Array.from({ length: 25 }, (_, i) => makeCostRecord({ id: `c${i}` }));
      mockRepo.findAll.mockResolvedValueOnce(records);

      const result = await service.getCosts({ limit: 10 });

      expect(result.totalPages).toBe(3); // Math.ceil(25 / 10)
    });
  });

  // ==================== getCostByService ====================

  describe('getCostByService', () => {
    it('should delegate to repository', async () => {
      const agg: CostAggregation[] = [
        { service: 'compute', total_cost: 500, count: 10 },
      ];
      mockRepo.getCostByService.mockResolvedValueOnce(agg);

      const result = await service.getCostByService('t1', new Date('2026-05-01'), new Date('2026-05-31'));

      expect(result).toEqual(agg);
      expect(mockRepo.getCostByService).toHaveBeenCalledWith('t1', expect.any(Date), expect.any(Date));
    });
  });

  // ==================== getTotalCost ====================

  describe('getTotalCost', () => {
    it('should return total cost from repository', async () => {
      mockRepo.getTotalCost.mockResolvedValueOnce(1234.56);

      const result = await service.getTotalCost('t1', new Date('2026-05-01'), new Date('2026-05-31'));

      expect(result).toBe(1234.56);
    });
  });

  // ==================== createBudget ====================

  describe('createBudget', () => {
    it('should create a budget via repository', async () => {
      const budget = makeBudget();
      mockRepo.createBudget.mockResolvedValueOnce(budget);

      const result = await service.createBudget('t1', 'Monthly Budget', 1000, 'monthly', 80);

      expect(result).toEqual(budget);
      expect(mockRepo.createBudget).toHaveBeenCalledWith('t1', 'Monthly Budget', 1000, 'monthly', 80);
    });

    it('should throw when tenantId is empty', async () => {
      await expect(service.createBudget('', 'Budget', 100, 'monthly', 80)).rejects.toThrow(CostServiceError);
    });
  });

  // ==================== listBudgets ====================

  describe('listBudgets', () => {
    it('should return budgets from repository', async () => {
      const budgets = [makeBudget(), makeBudget({ id: 'b2' })];
      mockRepo.findAllBudgets.mockResolvedValueOnce(budgets);

      const result = await service.listBudgets('t1');

      expect(result).toEqual(budgets);
      expect(mockRepo.findAllBudgets).toHaveBeenCalledWith('t1');
    });

    it('should pass undefined when no tenantId', async () => {
      mockRepo.findAllBudgets.mockResolvedValueOnce([]);

      await service.listBudgets();

      expect(mockRepo.findAllBudgets).toHaveBeenCalledWith(undefined);
    });
  });

  // ==================== getBudget ====================

  describe('getBudget', () => {
    it('should return budget when found', async () => {
      const budget = makeBudget();
      mockRepo.findBudgetById.mockResolvedValueOnce(budget);

      const result = await service.getBudget('b1');

      expect(result).toEqual(budget);
    });

    it('should throw CostServiceError when budget not found', async () => {
      mockRepo.findBudgetById.mockResolvedValueOnce(null);

      await expect(service.getBudget('nonexistent')).rejects.toThrow(CostServiceError);
      await expect(service.getBudget('nonexistent')).rejects.toThrow('Budget not found: nonexistent');
    });

    it('should throw with NOT_FOUND code', async () => {
      mockRepo.findBudgetById.mockResolvedValueOnce(null);

      try {
        await service.getBudget('x');
        fail('Should have thrown');
      } catch (err) {
        expect((err as CostServiceError).code).toBe('NOT_FOUND');
      }
    });
  });

  // ==================== getBudgetAlerts ====================

  describe('getBudgetAlerts', () => {
    it('should return alerts from repository', async () => {
      const alerts = [makeBudget({ current_spend: 900 })];
      mockRepo.getBudgetAlerts.mockResolvedValueOnce(alerts);

      const result = await service.getBudgetAlerts('t1');

      expect(result).toEqual(alerts);
    });
  });

  // ==================== updateBudgetSpend ====================

  describe('updateBudgetSpend', () => {
    it('should update spend based on current month costs', async () => {
      const budget = makeBudget({ tenant_id: 't1' });
      mockRepo.findBudgetById.mockResolvedValueOnce(budget);
      mockRepo.getTotalCost.mockResolvedValueOnce(750);
      mockRepo.updateBudgetSpend.mockResolvedValueOnce({ ...budget, current_spend: 750 });

      const result = await service.updateBudgetSpend('b1');

      expect(result.current_spend).toBe(750);
      expect(mockRepo.getTotalCost).toHaveBeenCalledWith(
        't1',
        expect.any(Date), // start of current month
        expect.any(Date)  // now
      );
      expect(mockRepo.updateBudgetSpend).toHaveBeenCalledWith('b1', 750);
    });

    it('should throw when budget not found', async () => {
      mockRepo.findBudgetById.mockResolvedValueOnce(null);

      await expect(service.updateBudgetSpend('nonexistent')).rejects.toThrow(CostServiceError);
    });
  });

  // ==================== CostServiceError ====================

  describe('CostServiceError', () => {
    it('should have correct name', () => {
      const err = new CostServiceError('test', 'CODE');
      expect(err.name).toBe('CostServiceError');
    });

    it('should be instanceof Error', () => {
      const err = new CostServiceError('test', 'CODE');
      expect(err).toBeInstanceOf(Error);
    });

    it('should store code and message', () => {
      const err = new CostServiceError('msg', 'ERR_CODE');
      expect(err.message).toBe('msg');
      expect(err.code).toBe('ERR_CODE');
    });
  });
});
