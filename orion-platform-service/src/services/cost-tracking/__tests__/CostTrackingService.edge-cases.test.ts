/**
 * CostTrackingService - 边界场景与数据契约测试
 *
 * 覆盖现有测试未覆盖的场景:
 * - 小数/浮点数 units 计算行为
 * - getSummary 多行结果累加
 * - getPipelineCosts 单条记录
 * - getPipelineCosts total_cost_cents 全为 0
 * - CostSummary.by_pipeline 始终为空对象
 * - CostSummary.trend 始终为 stable
 * - recordCost 返回值字段完整性
 * - getSummary 结果 parseInt 行为验证
 * - 大量记录聚合
 */

import { CostTrackingService, CostRecord, CostSummary } from '../CostTrackingService';

const mockQuery = jest.fn();

const mockPool = {
  query: mockQuery,
};

describe('CostTrackingService - Edge Cases & Data Contracts', () => {
  let service: CostTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CostTrackingService(mockPool as any);
  });

  describe('recordCost 计算边界', () => {
    it('小数 units 应按浮点乘法计算 total', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', total_cost_cents: 15.5 }],
      });

      await service.recordCost({
        tenant_id: 't1',
        resource_type: 'cpu',
        units: 3.1,
        unit_cost_cents: 5,
      });

      const [, params] = mockQuery.mock.calls[0];
      // 3.1 * 5 = 15.5 (浮点)
      expect(params[6]).toBeCloseTo(15.5);
    });

    it('units 为 0 时 total 应为 0', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', total_cost_cents: 0 }],
      });

      await service.recordCost({
        tenant_id: 't1',
        resource_type: 'cpu',
        units: 0,
        unit_cost_cents: 100,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[6]).toBe(0);
    });

    it('unit_cost_cents 为 0 时 total 应为 0', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', total_cost_cents: 0 }],
      });

      await service.recordCost({
        tenant_id: 't1',
        resource_type: 'cpu',
        units: 100,
        unit_cost_cents: 0,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[6]).toBe(0);
    });

    it('极大 units 和 unit_cost 应正确计算', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', total_cost_cents: 9999999999 }],
      });

      await service.recordCost({
        tenant_id: 't1',
        resource_type: 'license',
        units: 99999,
        unit_cost_cents: 100001,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[6]).toBe(99999 * 100001);
    });

    it('应正确传入所有 5 种 resource_type', async () => {
      const types = ['cpu', 'memory', 'storage', 'network', 'license'] as const;

      for (const resourceType of types) {
        mockQuery.mockResolvedValue({
          rows: [{ id: `c-${resourceType}`, resource_type: resourceType }],
        });

        const result = await service.recordCost({
          tenant_id: 't1',
          resource_type: resourceType,
          units: 1,
          unit_cost_cents: 1,
        });

        expect(result.resource_type).toBe(resourceType);
        const [, params] = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
        expect(params[3]).toBe(resourceType);
      }

      expect(mockQuery).toHaveBeenCalledTimes(5);
    });
  });

  describe('getSummary 数据聚合', () => {
    it('应正确累加多行不同 resource_type 的 total', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { resource_type: 'cpu', total: '1000' },
          { resource_type: 'memory', total: '2000' },
          { resource_type: 'storage', total: '3000' },
        ],
      });

      const result = await service.getSummary('t1', 'month');

      expect(result.total_cost_cents).toBe(6000);
      expect(result.by_resource_type.cpu).toBe(1000);
      expect(result.by_resource_type.memory).toBe(2000);
      expect(result.by_resource_type.storage).toBe(3000);
    });

    it('单行结果应正确解析', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '42' }],
      });

      const result = await service.getSummary('t1', 'week');

      expect(result.total_cost_cents).toBe(42);
      expect(result.by_resource_type).toEqual({ cpu: 42 });
    });

    it('total 字段为字符串应通过 parseInt 解析', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '9999' }],
      });

      const result = await service.getSummary('t1', 'day');

      expect(result.by_resource_type.cpu).toBe(9999);
      expect(typeof result.by_resource_type.cpu).toBe('number');
    });

    it('by_pipeline 应始终返回空对象', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '100' }],
      });

      const result = await service.getSummary('t1', 'month');

      expect(result.by_pipeline).toEqual({});
    });

    it('trend 应始终返回 stable', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '100' }],
      });

      const result = await service.getSummary('t1', 'month');

      expect(result.trend).toBe('stable');
    });

    it('empty period 字符串应走 default 分支', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getSummary('t1', '');

      expect(result.period).toBe('');
      // 验证调用了查询
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('应返回正确的 tenant_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getSummary('tenant-xyz', 'day');

      expect(result.tenant_id).toBe('tenant-xyz');
    });

    it('单个 resource_type 的 total 为 0 字符串应解析为 0', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '0' }],
      });

      const result = await service.getSummary('t1', 'month');

      expect(result.total_cost_cents).toBe(0);
      expect(result.by_resource_type.cpu).toBe(0);
    });
  });

  describe('getPipelineCosts 数据处理', () => {
    it('单条记录应正确计算 total', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', pipeline_id: 'p1', total_cost_cents: 500 }],
      });

      const result = await service.getPipelineCosts('p1');

      expect(result.total).toBe(500);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].id).toBe('c1');
    });

    it('所有记录 total_cost_cents 为 0 时 total 应为 0', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'c1', pipeline_id: 'p1', total_cost_cents: 0 },
          { id: 'c2', pipeline_id: 'p1', total_cost_cents: 0 },
          { id: 'c3', pipeline_id: 'p1', total_cost_cents: 0 },
        ],
      });

      const result = await service.getPipelineCosts('p1');

      expect(result.total).toBe(0);
      expect(result.records).toHaveLength(3);
    });

    it('大量记录应正确累加 total', async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `c${i}`,
        pipeline_id: 'p1',
        total_cost_cents: 10,
      }));
      mockQuery.mockResolvedValue({ rows: records });

      const result = await service.getPipelineCosts('p1');

      expect(result.total).toBe(1000);
      expect(result.records).toHaveLength(100);
    });

    it('records 应保留原始行数据结构', async () => {
      const now = new Date();
      const rawRow = {
        id: 'c1',
        tenant_id: 't1',
        pipeline_id: 'p1',
        run_id: 'r1',
        resource_type: 'cpu',
        units: 100,
        unit_cost_cents: 10,
        total_cost_cents: 1000,
        period_start: now,
        period_end: now,
        created_at: now,
      };
      mockQuery.mockResolvedValue({ rows: [rawRow] });

      const result = await service.getPipelineCosts('p1');

      expect(result.records[0]).toEqual(rawRow);
    });

    it('不同 pipeline_id 的查询应独立', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', pipeline_id: 'p1', total_cost_cents: 100 }],
      });

      await service.getPipelineCosts('p1');

      mockQuery.mockResolvedValue({
        rows: [{ id: 'c2', pipeline_id: 'p2', total_cost_cents: 200 }],
      });

      await service.getPipelineCosts('p2');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[0][1]).toEqual(['p1']);
      expect(mockQuery.mock.calls[1][1]).toEqual(['p2']);
    });
  });

  describe('CostRecord 接口契约', () => {
    it('recordCost 返回值应包含 CostRecord 所有字段', async () => {
      const now = new Date();
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 't1',
          pipeline_id: 'p1',
          run_id: 'r1',
          resource_type: 'cpu',
          units: 100,
          unit_cost_cents: 10,
          total_cost_cents: 1000,
          period_start: now,
          period_end: now,
          created_at: now,
        }],
      });

      const result = await service.recordCost({
        tenant_id: 't1',
        pipeline_id: 'p1',
        run_id: 'r1',
        resource_type: 'cpu',
        units: 100,
        unit_cost_cents: 10,
      });

      // CostRecord 接口字段
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('tenant_id');
      expect(result).toHaveProperty('pipeline_id');
      expect(result).toHaveProperty('run_id');
      expect(result).toHaveProperty('resource_type');
      expect(result).toHaveProperty('units');
      expect(result).toHaveProperty('unit_cost_cents');
      expect(result).toHaveProperty('total_cost_cents');
      expect(result).toHaveProperty('period_start');
      expect(result).toHaveProperty('period_end');
      expect(result).toHaveProperty('created_at');
    });
  });

  describe('CostSummary 接口契约', () => {
    it('getSummary 返回值应包含 CostSummary 所有字段', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ resource_type: 'cpu', total: '100' }],
      });

      const result = await service.getSummary('t1', 'month');

      expect(result).toHaveProperty('tenant_id');
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('total_cost_cents');
      expect(result).toHaveProperty('by_resource_type');
      expect(result).toHaveProperty('by_pipeline');
      expect(result).toHaveProperty('trend');
    });

    it('空结果返回值仍应包含所有 CostSummary 字段', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getSummary('t1', 'day');

      expect(result).toHaveProperty('tenant_id');
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('total_cost_cents');
      expect(result).toHaveProperty('by_resource_type');
      expect(result).toHaveProperty('by_pipeline');
      expect(result).toHaveProperty('trend');
      expect(result.total_cost_cents).toBe(0);
      expect(result.by_resource_type).toEqual({});
      expect(result.by_pipeline).toEqual({});
    });
  });
});
