/**
 * CostTrackingService 单元测试
 */

import { CostTrackingService } from '../CostTrackingService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('CostTrackingService', () => {
  let service: CostTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CostTrackingService(mockPool as any);
  });

  describe('recordCost', () => {
    it('应该记录成本', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          resource_type: 'cpu',
          units: 100,
          unit_cost_cents: 10,
          total_cost_cents: 1000,
        }],
      });

      const result = await service.recordCost({
        tenant_id: 'tenant1',
        resource_type: 'cpu',
        units: 100,
        unit_cost_cents: 10,
      });

      expect(result.resource_type).toBe('cpu');
      expect(result.total_cost_cents).toBe(1000);
    });

    it('应该正确计算总成本', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          units: 50,
          unit_cost_cents: 20,
          total_cost_cents: 1000,
        }],
      });

      await service.recordCost({
        tenant_id: 'tenant1',
        resource_type: 'memory',
        units: 50,
        unit_cost_cents: 20,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cost_records'),
        expect.arrayContaining([50, 20, 1000]) // units, unit_cost, total
      );
    });

    it('应该支持管道和运行关联', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          pipeline_id: 'p1',
          run_id: 'r1',
        }],
      });

      const result = await service.recordCost({
        tenant_id: 'tenant1',
        pipeline_id: 'p1',
        run_id: 'r1',
        resource_type: 'cpu',
        units: 100,
        unit_cost_cents: 10,
      });

      expect(result.pipeline_id).toBe('p1');
      expect(result.run_id).toBe('r1');
    });

    it('应该支持不同的资源类型', async () => {
      const resourceTypes = ['cpu', 'memory', 'storage', 'network', 'license'];

      for (const type of resourceTypes) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', resource_type: type }],
        });

        const result = await service.recordCost({
          tenant_id: 'tenant1',
          resource_type: type,
          units: 10,
          unit_cost_cents: 5,
        });

        expect(result.resource_type).toBe(type);
      }
    });
  });

  describe('getSummary', () => {
    it('应该返回成本汇总', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { resource_type: 'cpu', total: '5000' },
          { resource_type: 'memory', total: '3000' },
        ],
      });

      const result = await service.getSummary('tenant1', 'month');

      expect(result.total_cost_cents).toBe(8000);
      expect(result.by_resource_type.cpu).toBe(5000);
      expect(result.by_resource_type.memory).toBe(3000);
    });

    it('应该支持不同的时间段', async () => {
      const periods = ['day', 'week', 'month'];

      for (const period of periods) {
        mockPool.query.mockResolvedValue({
          rows: [{ resource_type: 'cpu', total: '100' }],
        });

        const result = await service.getSummary('tenant1', period);

        expect(result.period).toBe(period);
      }
    });

    it('应该包含趋势信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '100' }],
      });

      const result = await service.getSummary('tenant1', 'week');

      expect(result.trend).toBeDefined();
      expect(['increasing', 'stable', 'decreasing'].includes(result.trend)).toBe(true);
    });

    it('应该处理空结果', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getSummary('tenant1', 'day');

      expect(result.total_cost_cents).toBe(0);
      expect(result.by_resource_type).toEqual({});
    });
  });

  describe('getPipelineCosts', () => {
    it('应该返回管道成本', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'c1', pipeline_id: 'p1', total_cost_cents: 500 },
          { id: 'c2', pipeline_id: 'p1', total_cost_cents: 300 },
        ],
      });

      const result = await service.getPipelineCosts('p1');

      expect(result.total).toBe(800);
      expect(result.records.length).toBe(2);
    });

    it('应该按时间倒序排列', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
      });

      await service.getPipelineCosts('p1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['p1']
      );
    });

    it('应该处理空成本记录', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getPipelineCosts('p1');

      expect(result.total).toBe(0);
      expect(result.records.length).toBe(0);
    });
  });

  describe('CostRecord', () => {
    it('应该包含完整的成本记录信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          run_id: 'r1',
          resource_type: 'cpu',
          units: 100,
          unit_cost_cents: 10,
          total_cost_cents: 1000,
          period_start: new Date(),
          period_end: new Date(),
          created_at: new Date(),
        }],
      });

      const result = await service.recordCost({
        tenant_id: 'tenant1',
        pipeline_id: 'p1',
        run_id: 'r1',
        resource_type: 'cpu',
        units: 100,
        unit_cost_cents: 10,
      });

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant1');
      expect(result.resource_type).toBe('cpu');
    });
  });

  describe('CostSummary', () => {
    it('应该包含完整的汇总信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { resource_type: 'cpu', total: '1000' },
          { resource_type: 'memory', total: '500' },
        ],
      });

      const result = await service.getSummary('tenant1', 'month');

      expect(result.tenant_id).toBe('tenant1');
      expect(result.period).toBe('month');
      expect(result.total_cost_cents).toBe(1500);
      expect(result.by_resource_type).toBeDefined();
      expect(result.trend).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('应该处理大数值', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          units: 1000000,
          unit_cost_cents: 100,
          total_cost_cents: 100000000,
        }],
      });

      const result = await service.recordCost({
        tenant_id: 'tenant1',
        resource_type: 'cpu',
        units: 1000000,
        unit_cost_cents: 100,
      });

      expect(result.total_cost_cents).toBe(100000000);
    });

    it('应该处理零成本', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          units: 0,
          unit_cost_cents: 10,
          total_cost_cents: 0,
        }],
      });

      const result = await service.recordCost({
        tenant_id: 'tenant1',
        resource_type: 'cpu',
        units: 0,
        unit_cost_cents: 10,
      });

      expect(result.total_cost_cents).toBe(0);
    });

    it('应该处理多种资源类型汇总', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { resource_type: 'cpu', total: '100' },
          { resource_type: 'memory', total: '200' },
          { resource_type: 'storage', total: '300' },
          { resource_type: 'network', total: '400' },
          { resource_type: 'license', total: '500' },
        ],
      });

      const result = await service.getSummary('tenant1', 'month');

      expect(result.total_cost_cents).toBe(1500);
      expect(Object.keys(result.by_resource_type).length).toBe(5);
    });
  });
});