/**
 * PipelineBudgetService - 流水线预算管理单元测试
 *
 * 测试覆盖: 预算配置、预算估算、使用量追踪、超预算检查
 */

import { PipelineBudgetService } from '../PipelineBudgetService';

describe('PipelineBudgetService', () => {
  let service: PipelineBudgetService;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new PipelineBudgetService(mockPool as any);
  });

  // ==================== getBudget ====================

  describe('getBudget', () => {
    it('should return budget config', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          pipeline_id: 'p-1',
          max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
          max_cpu_core_hours: '4', max_memory_gb_hours: '8',
          resource_warning_pct: 75, resource_policy: 'block',
          max_cost_cents: '1000', cost_warning_pct: 90, cost_policy: 'warn',
          updated_at: new Date(),
        }],
      });

      const result = await service.getBudget('p-1');

      expect(result).toBeDefined();
      expect(result!.timeBudget!.maxDurationMs).toBe(600000);
      expect(result!.timeBudget!.policy).toBe('warn');
      expect(result!.resourceBudget!.maxCpuCoreHours).toBe(4);
      expect(result!.resourceBudget!.policy).toBe('block');
      expect(result!.costBudget!.maxCostCents).toBe(1000);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getBudget('non-existent');

      expect(result).toBeNull();
    });

    it('should handle partial budget config', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          pipeline_id: 'p-1',
          max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
          max_cpu_core_hours: null, max_memory_gb_hours: null,
          resource_warning_pct: null, resource_policy: null,
          max_cost_cents: null, cost_warning_pct: null, cost_policy: null,
          updated_at: new Date(),
        }],
      });

      const result = await service.getBudget('p-1');

      expect(result!.timeBudget).toBeDefined();
      expect(result!.resourceBudget).toBeUndefined();
      expect(result!.costBudget).toBeUndefined();
    });
  });

  // ==================== updateBudget ====================

  describe('updateBudget', () => {
    it('should create new budget when none exists', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // getBudget
        .mockResolvedValueOnce({ rows: [{ // INSERT
          pipeline_id: 'p-1',
          max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
          max_cpu_core_hours: null, max_memory_gb_hours: null,
          resource_warning_pct: 80, resource_policy: 'warn',
          max_cost_cents: null, cost_warning_pct: 80, cost_policy: 'warn',
          updated_at: new Date(),
        }] });

      const result = await service.updateBudget('p-1', { maxDurationMs: 600000 });

      expect(result).toBeDefined();
      expect(result.timeBudget!.maxDurationMs).toBe(600000);
    });

    it('should update existing budget', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ pipeline_id: 'p-1', max_duration_ms: '300000' }] }) // getBudget
        .mockResolvedValueOnce({ rows: [{ // UPDATE
          pipeline_id: 'p-1',
          max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
          max_cpu_core_hours: null, max_memory_gb_hours: null,
          resource_warning_pct: 80, resource_policy: 'warn',
          max_cost_cents: null, cost_warning_pct: 80, cost_policy: 'warn',
          updated_at: new Date(),
        }] });

      const result = await service.updateBudget('p-1', { maxDurationMs: 600000 });

      expect(result).toBeDefined();
    });
  });

  // ==================== estimateBudget ====================

  describe('estimateBudget', () => {
    it('should estimate from historical data', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { duration_ms: '120000' },
          { duration_ms: '180000' },
          { duration_ms: '150000' },
        ],
      });

      const result = await service.estimateBudget('p-1');

      expect(result.estimatedTimeMs).toBe(150000); // avg
      expect(result.estimatedCpuCores).toBeGreaterThanOrEqual(1);
      expect(result.estimatedMemoryGB).toBeGreaterThanOrEqual(2);
      expect(result.confidence).toBeCloseTo(0.3);
    });

    it('should return defaults when no historical data', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.estimateBudget('p-1');

      expect(result.estimatedTimeMs).toBe(300000);
      expect(result.estimatedCpuCores).toBe(2);
      expect(result.estimatedMemoryGB).toBe(4);
      expect(result.confidence).toBe(0);
    });
  });

  // ==================== getBudgetUsage ====================

  describe('getBudgetUsage', () => {
    it('should return usage with alerts when budget exceeded', async () => {
      // getBudget
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          pipeline_id: 'p-1',
          max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
          max_cpu_core_hours: '4', max_memory_gb_hours: '8',
          resource_warning_pct: 80, resource_policy: 'warn',
          max_cost_cents: '1000', cost_warning_pct: 80, cost_policy: 'warn',
          updated_at: new Date(),
        }],
      });
      // getRun
      mockPool.query.mockResolvedValueOnce({
        rows: [{ duration_ms: '700000', status: 'running' }],
      });
      // getUsage
      mockPool.query.mockResolvedValueOnce({
        rows: [{ cpu_core_hours: '5', memory_gb_hours: '10', cost_cents: '1200' }],
      });

      const result = await service.getBudgetUsage('p-1', 'run-1');

      expect(Number(result.timeUsed)).toBe(700000);
      expect(result.timePercent).toBeGreaterThan(100);
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.some(a => a.type === 'time')).toBe(true);
    });

    it('should return zeroes when no budget configured', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getBudgetUsage('p-1', 'run-1');

      expect(result.timeUsed).toBe(0);
      expect(result.alerts).toEqual([]);
    });

    it('should generate warning alerts', async () => {
      // getBudget
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          pipeline_id: 'p-1',
          max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
          max_cpu_core_hours: null, max_memory_gb_hours: null,
          resource_warning_pct: 80, resource_policy: 'warn',
          max_cost_cents: '1000', cost_warning_pct: 80, cost_policy: 'warn',
          updated_at: new Date(),
        }],
      });
      // getRun - 85% of budget
      mockPool.query.mockResolvedValueOnce({
        rows: [{ duration_ms: '510000', status: 'running' }],
      });
      // getUsage
      mockPool.query.mockResolvedValueOnce({
        rows: [{ cpu_core_hours: '0', memory_gb_hours: '0', cost_cents: '850' }],
      });

      const result = await service.getBudgetUsage('p-1', 'run-1');

      expect(result.alerts.some(a => a.level === 'warning')).toBe(true);
    });
  });

  // ==================== checkBudgetExceeded ====================

  describe('checkBudgetExceeded', () => {
    it('should return null when no budget', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkBudgetExceeded('p-1', 'run-1');

      expect(result).toBeNull();
    });

    it('should detect time budget exceeded', async () => {
      const budgetRow = {
        pipeline_id: 'p-1',
        max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'block',
        max_cpu_core_hours: null, max_memory_gb_hours: null,
        resource_warning_pct: 80, resource_policy: 'warn',
        max_cost_cents: null, cost_warning_pct: 80, cost_policy: 'warn',
        updated_at: new Date(),
      };
      // getBudgetUsage -> getBudget (call 1)
      mockPool.query.mockResolvedValueOnce({ rows: [budgetRow] });
      // getBudgetUsage -> getRun (call 2)
      mockPool.query.mockResolvedValueOnce({ rows: [{ duration_ms: '700000', status: 'running' }] });
      // getBudgetUsage -> getUsage (call 3)
      mockPool.query.mockResolvedValueOnce({ rows: [{}] });
      // checkBudgetExceeded -> getBudget (call 4)
      mockPool.query.mockResolvedValueOnce({ rows: [budgetRow] });

      const result = await service.checkBudgetExceeded('p-1', 'run-1');

      expect(result!.exceeded).toBe(true);
      expect(result!.action).toBe('block');
    });

    it('should return not exceeded when within budget', async () => {
      const budgetRow = {
        pipeline_id: 'p-1',
        max_duration_ms: '600000', time_warning_pct: 80, time_policy: 'warn',
        max_cpu_core_hours: null, max_memory_gb_hours: null,
        resource_warning_pct: 80, resource_policy: 'warn',
        max_cost_cents: null, cost_warning_pct: 80, cost_policy: 'warn',
        updated_at: new Date(),
      };
      // getBudgetUsage -> getBudget (call 1)
      mockPool.query.mockResolvedValueOnce({ rows: [budgetRow] });
      // getBudgetUsage -> getRun (call 2)
      mockPool.query.mockResolvedValueOnce({ rows: [{ duration_ms: '300000', status: 'running' }] });
      // getBudgetUsage -> getUsage (call 3)
      mockPool.query.mockResolvedValueOnce({ rows: [{}] });
      // checkBudgetExceeded -> getBudget (call 4)
      mockPool.query.mockResolvedValueOnce({ rows: [budgetRow] });

      const result = await service.checkBudgetExceeded('p-1', 'run-1');

      expect(result!.exceeded).toBe(false);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      await expect(service.getBudget('p-1')).rejects.toThrow('Connection refused');
    });
  });
});
