/**
 * CostTrackingService - SQL 参数与错误处理测试
 *
 * 覆盖现有测试未覆盖的场景:
 * - recordCost null coalescing (pipeline_id/run_id 为 undefined)
 * - getSummary default period 分支
 * - SQL 参数顺序验证
 * - DB query 失败错误处理
 * - 各方法的 SQL 语句结构验证
 */

import { CostTrackingService, CostRecord, CostSummary } from '../CostTrackingService';

const mockQuery = jest.fn();

const mockPool = {
  query: mockQuery,
};

describe('CostTrackingService - SQL Params & Error Handling', () => {
  let service: CostTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CostTrackingService(mockPool as any);
  });

  describe('recordCost SQL 参数验证', () => {
    it('pipeline_id 和 run_id 为 undefined 时应传 null', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 't1',
          pipeline_id: null,
          run_id: null,
          resource_type: 'cpu',
          units: 10,
          unit_cost_cents: 5,
          total_cost_cents: 50,
        }],
      });

      await service.recordCost({
        tenant_id: 't1',
        resource_type: 'cpu',
        units: 10,
        unit_cost_cents: 5,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO cost_records');
      expect(sql).toContain('RETURNING *');
      // params: [tenant_id, pipeline_id=null, run_id=null, resource_type, units, unit_cost, total]
      expect(params[0]).toBe('t1');        // tenant_id
      expect(params[1]).toBeNull();        // pipeline_id -> null
      expect(params[2]).toBeNull();        // run_id -> null
      expect(params[3]).toBe('cpu');       // resource_type
      expect(params[4]).toBe(10);          // units
      expect(params[5]).toBe(5);           // unit_cost_cents
      expect(params[6]).toBe(50);          // total = 10 * 5
    });

    it('pipeline_id 为空字符串时应传 null', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', pipeline_id: null, run_id: 'r1' }],
      });

      await service.recordCost({
        tenant_id: 't1',
        pipeline_id: '',
        run_id: 'r1',
        resource_type: 'cpu',
        units: 1,
        unit_cost_cents: 1,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBeNull(); // '' || null => null
    });

    it('run_id 为空字符串时应传 null', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', pipeline_id: 'p1', run_id: null }],
      });

      await service.recordCost({
        tenant_id: 't1',
        pipeline_id: 'p1',
        run_id: '',
        resource_type: 'cpu',
        units: 1,
        unit_cost_cents: 1,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[2]).toBeNull(); // '' || null => null
    });

    it('recordCost 参数数组应有 7 个元素', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1' }],
      });

      await service.recordCost({
        tenant_id: 't1',
        pipeline_id: 'p1',
        run_id: 'r1',
        resource_type: 'memory',
        units: 100,
        unit_cost_cents: 20,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params).toHaveLength(7);
    });

    it('total_cost_cents 应等于 units * unit_cost_cents', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'c1' }] });

      await service.recordCost({
        tenant_id: 't1',
        resource_type: 'storage',
        units: 250,
        unit_cost_cents: 40,
      });

      const [, params] = mockQuery.mock.calls[0];
      expect(params[6]).toBe(10000); // 250 * 40
    });
  });

  describe('getSummary SQL 参数验证', () => {
    it('day period 应传递 1 天前的日期', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const before = new Date();
      before.setDate(before.getDate() - 1);

      await service.getSummary('t1', 'day');

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe('t1');
      const startDate = params[1] as Date;
      // startDate 应该在 before 附近 (±1 秒容差)
      expect(Math.abs(startDate.getTime() - before.getTime())).toBeLessThan(2000);
    });

    it('week period 应传递 7 天前的日期', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const before = new Date();
      before.setDate(before.getDate() - 7);

      await service.getSummary('t1', 'week');

      const [, params] = mockQuery.mock.calls[0];
      const startDate = params[1] as Date;
      expect(Math.abs(startDate.getTime() - before.getTime())).toBeLessThan(2000);
    });

    it('month period 应传递 1 个月前的日期', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.getSummary('t1', 'month');

      const [, params] = mockQuery.mock.calls[0];
      const startDate = params[1] as Date;
      const now = new Date();
      const expectedMonth = new Date(now);
      expectedMonth.setMonth(expectedMonth.getMonth() - 1);
      // 容差 2 秒
      expect(Math.abs(startDate.getTime() - expectedMonth.getTime())).toBeLessThan(2000);
    });

    it('未知 period 应默认使用 30 天', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const before = new Date();
      before.setDate(before.getDate() - 30);

      await service.getSummary('t1', 'quarter');

      const [, params] = mockQuery.mock.calls[0];
      const startDate = params[1] as Date;
      expect(Math.abs(startDate.getTime() - before.getTime())).toBeLessThan(2000);
    });

    it('getSummary SQL 应包含 GROUP BY resource_type', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.getSummary('t1', 'month');

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('GROUP BY resource_type');
      expect(sql).toContain('SUM(total_cost_cents)');
      expect(sql).toContain('WHERE tenant_id = $1');
      expect(sql).toContain('created_at >= $2');
    });

    it('getSummary 参数数组应有 2 个元素', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.getSummary('t1', 'day');

      const [, params] = mockQuery.mock.calls[0];
      expect(params).toHaveLength(2);
    });
  });

  describe('getPipelineCosts SQL 参数验证', () => {
    it('应使用 pipeline_id 作为唯一查询参数', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.getPipelineCosts('pipeline-abc');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE pipeline_id = $1');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toEqual(['pipeline-abc']);
      expect(params).toHaveLength(1);
    });
  });

  describe('DB 查询错误处理', () => {
    it('recordCost 查询失败时应抛出错误', async () => {
      mockQuery.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.recordCost({
          tenant_id: 't1',
          resource_type: 'cpu',
          units: 10,
          unit_cost_cents: 5,
        })
      ).rejects.toThrow('connection refused');
    });

    it('getSummary 查询失败时应抛出错误', async () => {
      mockQuery.mockRejectedValue(new Error('timeout'));

      await expect(
        service.getSummary('t1', 'month')
      ).rejects.toThrow('timeout');
    });

    it('getPipelineCosts 查询失败时应抛出错误', async () => {
      mockQuery.mockRejectedValue(new Error('relation does not exist'));

      await expect(
        service.getPipelineCosts('p1')
      ).rejects.toThrow('relation does not exist');
    });

    it('recordCost 不应在查询失败时修改返回值', async () => {
      mockQuery.mockRejectedValue(new Error('disk full'));

      await expect(
        service.recordCost({
          tenant_id: 't1',
          resource_type: 'cpu',
          units: 10,
          unit_cost_cents: 5,
        })
      ).rejects.toThrow();

      // 确认只调用了一次查询
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });
});
