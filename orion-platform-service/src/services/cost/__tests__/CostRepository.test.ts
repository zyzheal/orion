/**
 * Tests for CostRepository
 */

import { CostRepository, CostRecord, Budget, CostAggregation } from '../CostRepository';

const mockPool = {
  query: jest.fn(),
};

describe('CostRepository', () => {
  let repo: CostRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CostRepository(mockPool as any);
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should query with no filters', async () => {
      const rows: CostRecord[] = [
        {
          id: 'c1',
          tenant_id: 't1',
          date: new Date('2026-05-01'),
          service: 'compute',
          resource_id: 'r1',
          region: 'us-east-1',
          cost: 100,
          currency: 'USD',
          tags: {},
          created_at: new Date(),
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await repo.findAll();

      expect(result).toEqual(rows);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM cost_records WHERE 1=1'),
        expect.any(Array)
      );
    });

    it('should filter by tenantId', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ tenantId: 't1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });

    it('should filter by date range', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-31');

      await repo.findAll({ startDate: start, endDate: end });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('date >= $1');
      expect(query).toContain('date <= $2');
      expect(params).toEqual([start, end]);
    });

    it('should filter by service', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ service: 'compute' });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('service = $1');
      expect(params).toContain('compute');
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({ limit: 10, offset: 20 });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('LIMIT $1');
      expect(query).toContain('OFFSET $2');
      expect(params).toContain(10);
      expect(params).toContain(20);
    });

    it('should combine multiple filters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repo.findAll({
        tenantId: 't1',
        startDate: new Date('2026-05-01'),
        service: 'storage',
        limit: 5,
      });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('tenant_id = $1');
      expect(query).toContain('date >= $2');
      expect(query).toContain('service = $3');
      expect(query).toContain('LIMIT $4');
      expect(params).toHaveLength(4);
    });
  });

  // ==================== createCostRecord ====================

  describe('createCostRecord', () => {
    it('should insert a cost record with all parameters', async () => {
      const expectedRow = {
        id: 'c1',
        tenant_id: 't1',
        date: new Date('2026-05-01'),
        service: 'compute',
        resource_id: 'r1',
        region: 'us-east-1',
        cost: 42.5,
        currency: 'USD',
        tags: { env: 'prod' },
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [expectedRow] });

      const result = await repo.createCostRecord(
        't1',
        new Date('2026-05-01'),
        'compute',
        42.5,
        'r1',
        'us-east-1',
        { env: 'prod' }
      );

      expect(result).toEqual(expectedRow);
      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO cost_records');
      expect(query).toContain('RETURNING *');
      expect(params).toEqual(['t1', expect.any(Date), 'compute', 'r1', 'us-east-1', 42.5, { env: 'prod' }]);
    });

    it('should use null for optional params when not provided', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'c1', cost: 10, currency: 'USD', resource_id: null, region: null, tags: {} }],
      });

      await repo.createCostRecord('t1', new Date(), 'ai', 10);

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[3]).toBeNull(); // resourceId
      expect(params[4]).toBeNull(); // region
      expect(params[6]).toEqual({}); // tags
    });
  });

  // ==================== getCostByService ====================

  describe('getCostByService', () => {
    it('should return aggregated costs grouped by service', async () => {
      const aggRows: CostAggregation[] = [
        { service: 'compute', total_cost: 500, count: 10 },
        { service: 'storage', total_cost: 200, count: 5 },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: aggRows });

      const result = await repo.getCostByService('t1', new Date('2026-05-01'), new Date('2026-05-31'));

      expect(result).toEqual(aggRows);
      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('GROUP BY service');
      expect(query).toContain('ORDER BY total_cost DESC');
      expect(params).toEqual(['t1', expect.any(Date), expect.any(Date)]);
    });
  });

  // ==================== getTotalCost ====================

  describe('getTotalCost', () => {
    it('should return total cost as a number', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ total: '1234.56' }] });

      const result = await repo.getTotalCost('t1', new Date('2026-05-01'), new Date('2026-05-31'));

      expect(result).toBe(1234.56);
    });

    it('should return 0 when no records', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const result = await repo.getTotalCost('t1', new Date('2026-05-01'), new Date('2026-05-31'));

      expect(result).toBe(0);
    });
  });

  // ==================== Budget operations ====================

  describe('findBudgetById', () => {
    it('should return budget when found', async () => {
      const budget: Budget = {
        id: 'b1',
        tenant_id: 't1',
        name: 'Monthly',
        amount: 1000,
        period: 'monthly',
        alert_threshold: 80,
        current_spend: 500,
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [budget] });

      const result = await repo.findBudgetById('b1');

      expect(result).toEqual(budget);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findBudgetById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAllBudgets', () => {
    it('should return all budgets when no tenantId', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'b1' }, { id: 'b2' }] });

      const result = await repo.findAllBudgets();

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        []
      );
    });

    it('should filter by tenantId when provided', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'b1' }] });

      await repo.findAllBudgets('t1');

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('WHERE tenant_id = $1');
      expect(params).toEqual(['t1']);
    });
  });

  describe('createBudget', () => {
    it('should insert a new budget', async () => {
      const budget: Budget = {
        id: 'b1',
        tenant_id: 't1',
        name: 'Q2 Budget',
        amount: 5000,
        period: 'quarterly',
        alert_threshold: 90,
        current_spend: 0,
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [budget] });

      const result = await repo.createBudget('t1', 'Q2 Budget', 5000, 'quarterly', 90);

      expect(result).toEqual(budget);
      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('INSERT INTO budgets');
      expect(query).toContain('RETURNING *');
      expect(params).toEqual(['t1', 'Q2 Budget', 5000, 'quarterly', 90]);
    });
  });

  describe('updateBudgetSpend', () => {
    it('should update current_spend and return updated budget', async () => {
      const updated: Budget = {
        id: 'b1',
        tenant_id: 't1',
        name: 'Budget',
        amount: 1000,
        period: 'monthly',
        alert_threshold: 80,
        current_spend: 750,
        created_at: new Date(),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await repo.updateBudgetSpend('b1', 750);

      expect(result).toEqual(updated);
    });

    it('should return null when budget not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateBudgetSpend('nonexistent', 100);

      expect(result).toBeNull();
    });
  });

  describe('getBudgetAlerts', () => {
    it('should return budgets exceeding alert threshold', async () => {
      const alerts: Budget[] = [
        {
          id: 'b1',
          tenant_id: 't1',
          name: 'Over Budget',
          amount: 1000,
          period: 'monthly',
          alert_threshold: 80,
          current_spend: 900,
          created_at: new Date(),
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: alerts });

      const result = await repo.getBudgetAlerts('t1');

      expect(result).toEqual(alerts);
      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('current_spend >= (amount * alert_threshold / 100)');
      expect(params).toEqual(['t1']);
    });

    it('should return empty when no budgets exceed threshold', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.getBudgetAlerts('t1');

      expect(result).toEqual([]);
    });
  });
});
