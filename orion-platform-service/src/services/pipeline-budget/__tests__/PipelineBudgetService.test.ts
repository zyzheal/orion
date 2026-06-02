/**
 * PipelineBudgetService 单元测试
 */

import { PipelineBudgetService, PipelineBudgetRepository, PipelineBudgetServiceError } from '../PipelineBudgetService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('PipelineBudgetService', () => {
  let service: PipelineBudgetService;
  let repository: PipelineBudgetRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PipelineBudgetRepository(mockPool as any);
    service = new PipelineBudgetService(mockPool as any);
  });

  describe('PipelineBudgetRepository', () => {
    describe('findByPipeline', () => {
      it('应该返回管道预算配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'b1',
            pipeline_id: 'p1',
            time_budget: { maxDurationMs: 3600000, warningPercent: 80, policy: 'warn' },
          }],
        });

        const result = await repository.findByPipeline('p1');

        expect(result).not.toBeNull();
        expect(result!.pipeline_id).toBe('p1');
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findByPipeline('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('createOrUpdate', () => {
      it('应该创建新预算配置', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // findByPipeline returns null
          .mockResolvedValueOnce({
            rows: [{
              id: 'b1',
              pipeline_id: 'p1',
              time_budget: { maxDurationMs: 3600000 },
            }],
          });

        const result = await repository.createOrUpdate({
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          time_budget: { maxDurationMs: 7200000 },
        });

        expect(result.pipeline_id).toBe('p1');
      });

      it('应该更新现有预算配置', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              id: 'b1',
              pipeline_id: 'p1',
              time_budget: { maxDurationMs: 3600000, warningPercent: 80, policy: 'warn' },
              resource_budget: { maxCpuCoreHours: 100 },
              cost_budget: { maxCostCents: 10000 },
            }],
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'b1',
              time_budget: { maxDurationMs: 7200000 },
            }],
          });

        const result = await repository.createOrUpdate({
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          time_budget: { maxDurationMs: 7200000 },
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.any(Array)
        );
      });

      it('应该使用默认值创建预算', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              id: 'b1',
              time_budget: { maxDurationMs: 3600000, warningPercent: 80, policy: 'warn' },
              resource_budget: { maxCpuCoreHours: 100, maxMemoryGBHours: 200, warningPercent: 80, policy: 'warn' },
              cost_budget: { maxCostCents: 10000, warningPercent: 80, policy: 'warn' },
            }],
          });

        const result = await repository.createOrUpdate({
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
        });

        expect(result.time_budget.maxDurationMs).toBe(3600000);
      });
    });

    describe('mapRowToConfig', () => {
      it('应该正确映射数据库行到配置对象', () => {
        const row = {
          id: 'b1',
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          time_budget: { maxDurationMs: 3600000 },
          created_at: new Date(),
          updated_at: new Date(),
        };

        const result = repository.mapRowToConfig(row);

        expect(result.id).toBe('b1');
        expect(result.time_budget.maxDurationMs).toBe(3600000);
      });

      it('应该处理缺失的预算字段', () => {
        const row = {
          id: 'b1',
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          created_at: new Date(),
          updated_at: new Date(),
        };

        const result = repository.mapRowToConfig(row);

        expect(result.time_budget.maxDurationMs).toBe(3600000); // Default
        expect(result.resource_budget.maxCpuCoreHours).toBe(100); // Default
      });
    });

    describe('getBudgetUsage', () => {
      it('应该返回预算使用情况', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              time_budget: { maxDurationMs: 3600000 },
              resource_budget: { maxCpuCoreHours: 100 },
              cost_budget: { maxCostCents: 10000 },
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ duration_ms: 1800000 }],
          });

        const result = await repository.getBudgetUsage('run1', 'p1');

        expect(result).not.toBeNull();
      });

      it('应该返回 null 如果没有预算配置', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await repository.getBudgetUsage('run1', 'p1');

        expect(result).toBeNull();
      });
    });
  });

  describe('PipelineBudgetService', () => {
    describe('setBudget', () => {
      it('应该设置预算配置', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ id: 'b1', pipeline_id: 'p1' }],
          });

        const result = await service.setBudget({
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          time_budget: { maxDurationMs: 7200000 },
        });

        expect(result.pipeline_id).toBe('p1');
      });
    });

    describe('getBudget', () => {
      it('应该返回预算配置', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'b1', pipeline_id: 'p1' }],
        });

        const result = await service.getBudget('p1');

        expect(result).not.toBeNull();
      });
    });

    describe('getBudgetUsage', () => {
      it('应该返回预算使用情况', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{
              time_budget: { maxDurationMs: 3600000, warningPercent: 80 },
            }],
          })
          .mockResolvedValueOnce({
            rows: [{ duration_ms: 1800000 }],
          });

        const result = await service.getBudgetUsage('run1', 'p1');

        expect(result).toHaveProperty('alerts');
      });
    });

    describe('estimateBudget', () => {
      it('应该估算预算', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { duration_ms: 1800000 },
            { duration_ms: 1800000 },
          ],
        });

        const result = await service.estimateBudget('p1');

        expect(result).toHaveProperty('estimatedTimeMs');
        expect(result).toHaveProperty('confidence');
      });
    });
  });

  describe('PipelineBudgetServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new PipelineBudgetServiceError('Budget exceeded', 'BUDGET_EXCEEDED');

      expect(error.message).toBe('Budget exceeded');
      expect(error.code).toBe('BUDGET_EXCEEDED');
      expect(error.name).toBe('PipelineBudgetServiceError');
    });
  });

  describe('getBudgetUsage - alerts', () => {
    it('should generate warning alert when time usage >= warningPercent', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            time_budget: { maxDurationMs: 1000, warningPercent: 80, policy: 'warn' },
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ duration_ms: 900 }], // 90% usage
        });

      const result = await repository.getBudgetUsage('run1', 'p1');

      expect(result).not.toBeNull();
      expect(result!.alerts).toHaveLength(1);
      expect(result!.alerts[0].type).toBe('time');
      expect(result!.alerts[0].level).toBe('warning');
    });

    it('should generate critical alert when time usage >= 100%', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            time_budget: { maxDurationMs: 1000, warningPercent: 80, policy: 'block' },
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ duration_ms: 1500 }], // 150% usage
        });

      const result = await repository.getBudgetUsage('run1', 'p1');

      expect(result!.alerts).toHaveLength(1);
      expect(result!.alerts[0].level).toBe('critical');
    });

    it('should return null when run not found', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ time_budget: { maxDurationMs: 1000 } }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.getBudgetUsage('run-missing', 'p1');
      expect(result).toBeNull();
    });

    it('should handle run with completed_at and started_at', async () => {
      const start = new Date('2026-01-01T10:00:00Z');
      const end = new Date('2026-01-01T11:00:00Z');

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ time_budget: { maxDurationMs: 7200000, warningPercent: 80 } }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'run1', duration_ms: null, started_at: start, completed_at: end }],
        });

      const result = await repository.getBudgetUsage('run1', 'p1');

      expect(result).not.toBeNull();
      expect(result!.time_used).toBe(3600000); // 1 hour
    });
  });

  describe('checkBudgetExceeded', () => {
    it('should return exceeded=true when time >= 100%', async () => {
      // getBudget -> findByPipeline
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'b1', pipeline_id: 'p1',
          time_budget: { maxDurationMs: 1000, warningPercent: 80, policy: 'block' },
        }],
      });
      // getBudgetUsage -> findByPipeline
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          time_budget: { maxDurationMs: 1000, warningPercent: 80, policy: 'block' },
        }],
      });
      // getBudgetUsage -> run query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ duration_ms: 1500 }],
      });

      const result = await service.checkBudgetExceeded('run1', 'p1');

      expect(result.exceeded).toBe(true);
      expect(result.policy).toBe('block');
    });

    it('should return exceeded=false when no budget config', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkBudgetExceeded('run1', 'p1');

      expect(result.exceeded).toBe(false);
      expect(result.policy).toBeNull();
    });

    it('should return exceeded=false when usage below threshold', async () => {
      // getBudget
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'b1', pipeline_id: 'p1',
          time_budget: { maxDurationMs: 10000, warningPercent: 80, policy: 'warn' },
        }],
      });
      // getBudgetUsage -> findByPipeline
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          time_budget: { maxDurationMs: 10000, warningPercent: 80 },
        }],
      });
      // getBudgetUsage -> run query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ duration_ms: 1000 }],
      });

      const result = await service.checkBudgetExceeded('run1', 'p1');

      expect(result.exceeded).toBe(false);
    });
  });

  describe('markBudgetExceeded', () => {
    it('should update pipeline run with budget exceeded flag', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await service.markBudgetExceeded('run1', 'block');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pipeline_runs'),
        ['run1', 'block']
      );
    });
  });

  describe('getTenantBudgetDashboard', () => {
    it('should return dashboard data for tenant', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b1',
          tenant_id: 't1',
          pipeline_id: 'p1',
          pipeline_name: 'Build Pipeline',
          time_budget: { maxDurationMs: 3600000 },
          resource_budget: { maxCpuCoreHours: 100 },
          cost_budget: { maxCostCents: 10000 },
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await service.getTenantBudgetDashboard('t1');

      expect(result.pipelines).toHaveLength(1);
      expect(result.pipelines[0].pipeline_name).toBe('Build Pipeline');
      expect(result.totals.totalRuns).toBe(1);
    });

    it('should return empty dashboard when no budgets', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getTenantBudgetDashboard('t1');

      expect(result.pipelines).toHaveLength(0);
      expect(result.totals.totalRuns).toBe(0);
    });
  });

  describe('getHistoricalUsage', () => {
    it('should return historical usage data', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ avg_time: '1800000', sample_count: '5' }],
      });

      const result = await repository.getHistoricalUsage('p1', 10);

      expect(result.avgTimeMs).toBe(1800000);
      expect(result.sampleCount).toBe(5);
    });

    it('should handle null averages', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ avg_time: null, sample_count: '0' }],
      });

      const result = await repository.getHistoricalUsage('p1');

      expect(result.avgTimeMs).toBe(0);
      expect(result.sampleCount).toBe(0);
    });
  });
});