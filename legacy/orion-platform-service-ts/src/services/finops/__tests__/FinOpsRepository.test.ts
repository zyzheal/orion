/**
 * FinOpsRepository - 数据仓库层单元测试
 *
 * 测试覆盖: 报告、成本追踪、预算管理、支出追踪、告警触发、ROI分析、成本优化、云成本、K8s成本、SaaS成本
 */

import { FinOpsRepository } from '../FinOpsRepository';

describe('FinOpsRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: FinOpsRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new FinOpsRepository(mockDb as any);
  });

  // ==================== Reports ====================

  describe('createReport', () => {
    it('should create a report', async () => {
      const mockReport = {
        id: 'report-1',
        tenant_id: 't1',
        period: '2026-01',
        total_cost: 1700,
        breakdown: { compute: 1000, storage: 500, network: 200 },
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockReport] });

      const result = await repository.createReport('t1', '2026-01', 1700, { compute: 1000, storage: 500, network: 200 });

      expect(result).toEqual(mockReport);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO finops_reports'),
        ['t1', '2026-01', 1700, { compute: 1000, storage: 500, network: 200 }]
      );
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.createReport('t1', '2026-01', 100, {})).rejects.toThrow('Connection refused');
    });
  });

  describe('getReports', () => {
    it('should return reports with default limit', async () => {
      const mockReports = [{ id: 'r1' }, { id: 'r2' }];
      mockDb.query.mockResolvedValue({ rows: mockReports });

      const result = await repository.getReports('t1');

      expect(result).toEqual(mockReports);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM finops_reports'),
        ['t1', 12]
      );
    });

    it('should return reports with custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getReports('t1', 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['t1', 5]
      );
    });

    it('should return empty array when no reports', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getReports('t1');

      expect(result).toEqual([]);
    });
  });

  describe('getResourceCosts', () => {
    it('should return resource costs within date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const mockCosts = [{ id: 'rc1', cost: 100 }];
      mockDb.query.mockResolvedValue({ rows: mockCosts });

      const result = await repository.getResourceCosts('t1', startDate, endDate);

      expect(result).toEqual(mockCosts);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM resource_costs'),
        ['t1', startDate, endDate]
      );
    });
  });

  // ==================== Cost Tracking ====================

  describe('insertCostRecord', () => {
    it('should insert a cost record with all fields', async () => {
      const mockRecord = {
        id: 'cr1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 500,
        category: 'compute',
        environment: 'production',
        tags: { team: 'backend' },
        currency: 'USD',
        timestamp: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRecord] });

      const result = await repository.insertCostRecord({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 500,
        category: 'compute',
        environment: 'production',
        tags: { team: 'backend' },
        currency: 'USD',
      });

      expect(result).toEqual(mockRecord);
    });

    it('should use default timestamp when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'cr1' }] });

      await repository.insertCostRecord({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 100,
        category: 'storage',
        currency: 'USD',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[7]).toBeInstanceOf(Date);
    });

    it('should use provided timestamp', async () => {
      const customDate = new Date('2026-06-01');
      mockDb.query.mockResolvedValue({ rows: [{ id: 'cr1' }] });

      await repository.insertCostRecord({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 100,
        category: 'storage',
        currency: 'USD',
        timestamp: customDate,
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[7]).toEqual(customDate);
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Constraint violation'));

      await expect(repository.insertCostRecord({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 100,
        category: 'compute',
        currency: 'USD',
      })).rejects.toThrow('Constraint violation');
    });
  });

  describe('getCostByEntity', () => {
    it('should return cost records for entity within date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const mockRecords = [{ id: 'cr1', amount: 100 }, { id: 'cr2', amount: 200 }];
      mockDb.query.mockResolvedValue({ rows: mockRecords });

      const result = await repository.getCostByEntity('project', 'proj-1', startDate, endDate);

      expect(result).toEqual(mockRecords);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM finops_cost_records'),
        ['project', 'proj-1', startDate, endDate]
      );
    });

    it('should return empty array when no records', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getCostByEntity('project', 'proj-1', new Date(), new Date());

      expect(result).toEqual([]);
    });
  });

  describe('getAllCostRecords', () => {
    it('should return all records without filter', async () => {
      const mockRecords = [{ id: 'cr1' }, { id: 'cr2' }];
      mockDb.query.mockResolvedValue({ rows: mockRecords });

      const result = await repository.getAllCostRecords();

      expect(result).toEqual(mockRecords);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        []
      );
    });

    it('should filter by entityType', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAllCostRecords({ entityType: 'project' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $1'),
        ['project']
      );
    });

    it('should filter by entityId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAllCostRecords({ entityId: 'proj-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_id = $1'),
        ['proj-1']
      );
    });

    it('should filter by category', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAllCostRecords({ category: 'compute' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $1'),
        ['compute']
      );
    });

    it('should filter by multiple criteria', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAllCostRecords({ entityType: 'project', entityId: 'proj-1', category: 'compute' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $1 AND entity_id = $2 AND category = $3'),
        ['project', 'proj-1', 'compute']
      );
    });
  });

  // ==================== Budgets ====================

  describe('createBudget', () => {
    it('should create a budget with all fields', async () => {
      const mockBudget = {
        id: 'budget-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 10000,
        period: 'monthly',
        currency: 'USD',
        alerts: [{ id: 'a1', percentage: 80, triggered: false }],
        environment: 'production',
        description: 'Project budget',
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockBudget] });

      const result = await repository.createBudget({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 10000,
        period: 'monthly',
        currency: 'USD',
        alerts: [{ id: 'a1', percentage: 80, triggered: false }],
        environment: 'production',
        description: 'Project budget',
      });

      expect(result).toEqual(mockBudget);
    });

    it('should create budget with minimal fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'budget-1' }] });

      await repository.createBudget({
        entityType: 'tenant',
        entityId: 't1',
        amount: 5000,
        period: 'quarterly',
        currency: 'USD',
        alerts: [],
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[6]).toBeNull(); // environment
      expect(params[7]).toBeNull(); // description
    });
  });

  describe('updateBudget', () => {
    it('should update budget amount', async () => {
      const mockUpdated = { id: 'budget-1', amount: 15000 };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateBudget('budget-1', { amount: 15000 });

      expect(result).toEqual(mockUpdated);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE finops_budgets SET'),
        expect.arrayContaining([15000, 'budget-1'])
      );
    });

    it('should update budget alerts', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'budget-1' }] });

      await repository.updateBudget('budget-1', {
        alerts: [{ percentage: 90 }],
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('alerts = $1'),
        expect.arrayContaining([expect.any(String), 'budget-1'])
      );
    });

    it('should return null when no updates provided', async () => {
      const result = await repository.updateBudget('budget-1', {});

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return null when budget not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateBudget('non-existent', { amount: 100 });

      expect(result).toBeNull();
    });
  });

  describe('deleteBudget', () => {
    it('should delete an existing budget', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteBudget('budget-1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM finops_budgets WHERE id = $1',
        ['budget-1']
      );
    });

    it('should return false when budget not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteBudget('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getBudget', () => {
    it('should return budget by id', async () => {
      const mockBudget = { id: 'budget-1', amount: 10000 };
      mockDb.query.mockResolvedValue({ rows: [mockBudget] });

      const result = await repository.getBudget('budget-1');

      expect(result).toEqual(mockBudget);
    });

    it('should return null when budget not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getBudget('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listBudgets', () => {
    it('should list all budgets without filter', async () => {
      const mockBudgets = [{ id: 'b1' }, { id: 'b2' }];
      mockDb.query.mockResolvedValue({ rows: mockBudgets });

      const result = await repository.listBudgets();

      expect(result).toEqual(mockBudgets);
    });

    it('should filter by entityType', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.listBudgets({ entityType: 'project' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $1'),
        ['project']
      );
    });

    it('should filter by entityId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.listBudgets({ entityId: 'proj-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_id = $1'),
        ['proj-1']
      );
    });
  });

  // ==================== Spend Tracking ====================

  describe('recordSpend', () => {
    it('should record a spend', async () => {
      const mockSpend = {
        id: 'spend-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 500,
        recorded_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockSpend] });

      const result = await repository.recordSpend('project', 'proj-1', 500);

      expect(result).toEqual(mockSpend);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO finops_spend_tracking'),
        ['project', 'proj-1', 500]
      );
    });
  });

  describe('getCurrentSpend', () => {
    it('should return current spend total', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ total: '1500.50' }] });

      const result = await repository.getCurrentSpend('project', 'proj-1');

      expect(result).toBe(1500.50);
    });

    it('should return 0 when no spend records', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ total: 0 }] });

      const result = await repository.getCurrentSpend('project', 'proj-1');

      expect(result).toBe(0);
    });
  });

  describe('getSpendHistory', () => {
    it('should return spend history ordered by date', async () => {
      const mockHistory = [
        { date: new Date('2026-01-01'), cumulative_cost: '100' },
        { date: new Date('2026-01-02'), cumulative_cost: '200' },
      ];
      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const result = await repository.getSpendHistory('project', 'proj-1');

      expect(result).toHaveLength(2);
      expect(result[0].cumulativeCost).toBe(100);
      expect(result[1].cumulativeCost).toBe(200);
    });

    it('should return empty array when no history', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getSpendHistory('project', 'proj-1');

      expect(result).toEqual([]);
    });
  });

  // ==================== Alert Triggers ====================

  describe('insertAlertTrigger', () => {
    it('should insert an alert trigger', async () => {
      const mockTrigger = {
        id: 'trigger-1',
        budget_id: 'budget-1',
        threshold: 80,
        actual: 9000,
        percentage: 90,
        entity_type: 'project',
        entity_id: 'proj-1',
        triggered_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockTrigger] });

      const result = await repository.insertAlertTrigger({
        budgetId: 'budget-1',
        threshold: 80,
        actual: 9000,
        percentage: 90,
        entityType: 'project',
        entityId: 'proj-1',
      });

      expect(result).toEqual(mockTrigger);
    });
  });

  describe('getAlertTriggers', () => {
    it('should return all triggers without filter', async () => {
      const mockTriggers = [{ id: 't1' }, { id: 't2' }];
      mockDb.query.mockResolvedValue({ rows: mockTriggers });

      const result = await repository.getAlertTriggers();

      expect(result).toEqual(mockTriggers);
    });

    it('should filter by budgetId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAlertTriggers({ budgetId: 'budget-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('budget_id = $1'),
        ['budget-1']
      );
    });

    it('should filter by entityType', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAlertTriggers({ entityType: 'project' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $1'),
        ['project']
      );
    });
  });

  // ==================== ROI Analysis ====================

  describe('insertROIAnalysis', () => {
    it('should insert an ROI analysis', async () => {
      const mockAnalysis = {
        id: 'roi-1',
        investment_type: 'automation',
        name: 'CI/CD Pipeline',
        cost: 5000,
        savings: 15000,
        period: 'monthly',
        roi_percentage: 200,
        payback_months: 4,
        description: 'Automated testing',
        details: { tests: 100 },
        analyzed_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockAnalysis] });

      const result = await repository.insertROIAnalysis({
        investmentType: 'automation',
        name: 'CI/CD Pipeline',
        cost: 5000,
        savings: 15000,
        period: 'monthly',
        roiPercentage: 200,
        paybackMonths: 4,
        description: 'Automated testing',
        details: { tests: 100 },
      });

      expect(result).toEqual(mockAnalysis);
    });

    it('should insert ROI analysis with minimal fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'roi-1' }] });

      await repository.insertROIAnalysis({
        investmentType: 'tool',
        name: 'IDE License',
        cost: 100,
        savings: 500,
        period: 'yearly',
        roiPercentage: 400,
        paybackMonths: 3,
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[7]).toBeNull(); // description
      expect(params[8]).toBeNull(); // details
    });
  });

  describe('getROIHistory', () => {
    it('should return all ROI history without filter', async () => {
      const mockHistory = [{ id: 'roi-1' }];
      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const result = await repository.getROIHistory();

      expect(result).toEqual(mockHistory);
    });

    it('should filter by investmentType', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getROIHistory({ investmentType: 'automation' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('investment_type = $1'),
        ['automation']
      );
    });

    it('should filter by minROI', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getROIHistory({ minROI: 100 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('roi_percentage >= $1'),
        [100]
      );
    });
  });

  describe('insertCostComparison', () => {
    it('should insert a cost comparison', async () => {
      const mockComparison = {
        id: 'comp-1',
        description: 'Before vs After',
        before_cost: 1000,
        after_cost: 500,
        savings: 500,
        savings_percent: 50,
        time_savings_hours: 10,
        period: 'monthly',
      };
      mockDb.query.mockResolvedValue({ rows: [mockComparison] });

      const result = await repository.insertCostComparison({
        description: 'Before vs After',
        beforeCost: 1000,
        afterCost: 500,
        savings: 500,
        savingsPercent: 50,
        timeSavingsHours: 10,
        period: 'monthly',
      });

      expect(result).toEqual(mockComparison);
    });
  });

  describe('getCostComparisons', () => {
    it('should return all comparisons without filter', async () => {
      const mockComparisons = [{ id: 'comp-1' }];
      mockDb.query.mockResolvedValue({ rows: mockComparisons });

      const result = await repository.getCostComparisons();

      expect(result).toEqual(mockComparisons);
    });

    it('should filter by period', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getCostComparisons({ period: 'monthly' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('period = $1'),
        ['monthly']
      );
    });
  });

  describe('getROISummary', () => {
    it('should return ROI summary', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total_analyses: '10',
          average_roi: '150.5',
          average_payback: '6.2',
          total_comparisons: '5',
          total_savings: '10000',
        }],
      });

      const result = await repository.getROISummary();

      expect(result).toEqual({
        totalAnalyses: 10,
        averageROI: 150.5,
        averagePaybackMonths: 6.2,
        totalComparisons: 5,
        totalSavings: 10000,
      });
    });
  });

  // ==================== Cost Optimizations ====================

  describe('insertOptimization', () => {
    it('should insert an optimization', async () => {
      const mockOpt = {
        id: 'opt-1',
        category: 'compute',
        description: 'Right-size instances',
        estimated_savings: 5000,
        effort: 3,
        priority: 'high',
        status: 'pending',
        resource_ids: ['i-123'],
        entity_id: 'proj-1',
        entity_type: 'project',
        notes: 'Review quarterly',
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockOpt] });

      const result = await repository.insertOptimization({
        category: 'compute',
        description: 'Right-size instances',
        estimatedSavings: 5000,
        effort: 3,
        priority: 'high',
        status: 'pending',
        resourceIds: ['i-123'],
        entityId: 'proj-1',
        entityType: 'project',
        notes: 'Review quarterly',
      });

      expect(result).toEqual(mockOpt);
    });

    it('should insert optimization with minimal fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'opt-1' }] });

      await repository.insertOptimization({
        category: 'storage',
        description: 'Archive old data',
        estimatedSavings: 1000,
        effort: 1,
        priority: 'medium',
        status: 'pending',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[6]).toBeNull(); // resourceIds
      expect(params[7]).toBeNull(); // entityId
      expect(params[8]).toBeNull(); // entityType
      expect(params[9]).toBeNull(); // notes
    });
  });

  describe('batchInsertOptimizations', () => {
    it('should batch insert optimizations', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'opt-1' }] });

      const result = await repository.batchInsertOptimizations([
        { category: 'compute', description: 'Opt 1', estimatedSavings: 100, effort: 1, priority: 'high', status: 'pending' },
        { category: 'storage', description: 'Opt 2', estimatedSavings: 200, effort: 2, priority: 'medium', status: 'pending' },
      ]);

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOptimizations', () => {
    it('should return all optimizations without filter', async () => {
      const mockOpts = [{ id: 'opt-1' }];
      mockDb.query.mockResolvedValue({ rows: mockOpts });

      const result = await repository.getOptimizations();

      expect(result).toEqual(mockOpts);
    });

    it('should filter by category', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getOptimizations({ category: 'compute' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $1'),
        ['compute']
      );
    });

    it('should filter by priority', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getOptimizations({ priority: 'high' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('priority = $1'),
        ['high']
      );
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getOptimizations({ status: 'pending' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['pending']
      );
    });
  });

  describe('updateOptimizationStatus', () => {
    it('should update optimization status', async () => {
      const mockUpdated = { id: 'opt-1', status: 'implemented' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateOptimizationStatus('opt-1', 'implemented');

      expect(result).toEqual(mockUpdated);
    });

    it('should return null when optimization not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateOptimizationStatus('non-existent', 'implemented');

      expect(result).toBeNull();
    });
  });

  describe('deleteOptimization', () => {
    it('should delete an existing optimization', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteOptimization('opt-1');

      expect(result).toBe(true);
    });

    it('should return false when optimization not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteOptimization('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getOptimizationById', () => {
    it('should return optimization by id', async () => {
      const mockOpt = { id: 'opt-1', category: 'compute' };
      mockDb.query.mockResolvedValue({ rows: [mockOpt] });

      const result = await repository.getOptimizationById('opt-1');

      expect(result).toEqual(mockOpt);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getOptimizationById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getResourceUtilizations', () => {
    it('should return all utilizations without filter', async () => {
      const mockUtils = [{ id: 'opt-1' }];
      mockDb.query.mockResolvedValue({ rows: mockUtils });

      const result = await repository.getResourceUtilizations();

      expect(result).toEqual(mockUtils);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getResourceUtilizations({ tenantId: 't1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_id = $1'),
        ['t1']
      );
    });

    it('should filter by environment', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getResourceUtilizations({ environment: 'production' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('notes LIKE $1'),
        ['%production%']
      );
    });
  });

  // ==================== Cloud Cost Collection ====================

  describe('insertCloudCost', () => {
    it('should insert a cloud cost record', async () => {
      const mockRecord = {
        id: 'cc-1',
        provider: 'aws',
        resource_type: 'ec2',
        resource_id: 'i-123',
        resource_name: 'web-server',
        region: 'us-east-1',
        cost: 100,
        currency: 'USD',
        tags: { env: 'prod' },
        timestamp: new Date(),
        tenant_id: 't1',
        environment: 'production',
        billing_period: '2026-01',
      };
      mockDb.query.mockResolvedValue({ rows: [mockRecord] });

      const result = await repository.insertCloudCost({
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: 'i-123',
        resourceName: 'web-server',
        region: 'us-east-1',
        cost: 100,
        currency: 'USD',
        tags: { env: 'prod' },
        tenantId: 't1',
        environment: 'production',
        billingPeriod: '2026-01',
      });

      expect(result).toEqual(mockRecord);
    });

    it('should use default timestamp when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'cc-1' }] });

      await repository.insertCloudCost({
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: 'i-123',
        region: 'us-east-1',
        cost: 100,
        currency: 'USD',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[8]).toBeInstanceOf(Date);
    });
  });

  describe('batchInsertCloudCosts', () => {
    it('should batch insert cloud costs', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'cc-1' }] });

      const result = await repository.batchInsertCloudCosts([
        { provider: 'aws', resourceType: 'ec2', resourceId: 'i-1', region: 'us-east-1', cost: 100, currency: 'USD' },
        { provider: 'gcp', resourceType: 'compute', resourceId: 'i-2', region: 'us-central1', cost: 200, currency: 'USD' },
      ]);

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCloudCosts', () => {
    it('should return all cloud costs without filter', async () => {
      const mockCosts = [{ id: 'cc-1' }];
      mockDb.query.mockResolvedValue({ rows: mockCosts });

      const result = await repository.getCloudCosts();

      expect(result).toEqual(mockCosts);
    });

    it('should filter by provider', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getCloudCosts({ provider: 'aws' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('provider = $1'),
        ['aws']
      );
    });

    it('should filter by resourceType', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getCloudCosts({ resourceType: 'ec2' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $1'),
        ['ec2']
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getCloudCosts({ startDate, endDate });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('timestamp >= $1 AND timestamp <= $2'),
        [startDate, endDate]
      );
    });
  });

  // ==================== K8s Cost Allocation ====================

  describe('insertK8sCost', () => {
    it('should insert a K8s cost record', async () => {
      const mockRecord = {
        id: 'k8s-1',
        namespace: 'default',
        deployment: 'web-app',
        pod_name: 'web-app-123',
        cpu_cost: 50,
        memory_cost: 30,
        storage_cost: 10,
        network_cost: 5,
        total_cost: 95,
        tenant_id: 't1',
        timestamp: new Date(),
        cluster_name: 'prod-cluster',
        node_name: 'node-1',
      };
      mockDb.query.mockResolvedValue({ rows: [mockRecord] });

      const result = await repository.insertK8sCost({
        namespace: 'default',
        deployment: 'web-app',
        podName: 'web-app-123',
        cpuCost: 50,
        memoryCost: 30,
        storageCost: 10,
        networkCost: 5,
        totalCost: 95,
        tenantId: 't1',
        clusterName: 'prod-cluster',
        nodeName: 'node-1',
      });

      expect(result).toEqual(mockRecord);
    });

    it('should use default timestamp when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'k8s-1' }] });

      await repository.insertK8sCost({
        namespace: 'default',
        deployment: 'web-app',
        cpuCost: 50,
        memoryCost: 30,
        storageCost: 10,
        networkCost: 5,
        totalCost: 95,
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[9]).toBeInstanceOf(Date);
    });
  });

  describe('batchInsertK8sCosts', () => {
    it('should batch insert K8s costs', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'k8s-1' }] });

      const result = await repository.batchInsertK8sCosts([
        { namespace: 'default', deployment: 'app1', cpuCost: 10, memoryCost: 20, storageCost: 5, networkCost: 2, totalCost: 37 },
        { namespace: 'default', deployment: 'app2', cpuCost: 15, memoryCost: 25, storageCost: 8, networkCost: 3, totalCost: 51 },
      ]);

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getK8sCosts', () => {
    it('should return all K8s costs without filter', async () => {
      const mockCosts = [{ id: 'k8s-1' }];
      mockDb.query.mockResolvedValue({ rows: mockCosts });

      const result = await repository.getK8sCosts();

      expect(result).toEqual(mockCosts);
    });

    it('should filter by namespace', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getK8sCosts({ namespace: 'production' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('namespace = $1'),
        ['production']
      );
    });

    it('should filter by deployment', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getK8sCosts({ deployment: 'web-app' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('deployment = $1'),
        ['web-app']
      );
    });
  });

  describe('getK8sNamespaceCosts', () => {
    it('should return namespace cost summary', async () => {
      const mockSummary = [
        { namespace: 'production', total_cost: '500' },
        { namespace: 'staging', total_cost: '200' },
      ];
      mockDb.query.mockResolvedValue({ rows: mockSummary });

      const result = await repository.getK8sNamespaceCosts();

      expect(result).toEqual(mockSummary);
    });

    it('should filter by namespace', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getK8sNamespaceCosts({ namespace: 'production' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('namespace = $1'),
        ['production']
      );
    });
  });

  describe('getK8sPodCosts', () => {
    it('should return pod costs', async () => {
      const mockPodCosts = [{ id: 'k8s-1', pod_name: 'pod-1' }];
      mockDb.query.mockResolvedValue({ rows: mockPodCosts });

      const result = await repository.getK8sPodCosts();

      expect(result).toEqual(mockPodCosts);
    });

    it('should filter by namespace and deployment', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getK8sPodCosts({ namespace: 'production', deployment: 'web-app' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('namespace = $1 AND deployment = $2'),
        ['production', 'web-app']
      );
    });
  });

  describe('getK8sTenantCosts', () => {
    it('should return tenant cost summary', async () => {
      const mockSummary = [
        { tenant_id: 't1', total_cost: '1000' },
        { tenant_id: 't2', total_cost: '500' },
      ];
      mockDb.query.mockResolvedValue({ rows: mockSummary });

      const result = await repository.getK8sTenantCosts();

      expect(result).toEqual(mockSummary);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getK8sTenantCosts({ tenantId: 't1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });
  });

  // ==================== SaaS Cost Tracking ====================

  describe('insertSaaSCost', () => {
    it('should insert a SaaS cost record', async () => {
      const mockRecord = {
        id: 'saas-1',
        tool: 'GitHub',
        subscription: 'Enterprise',
        seats: 50,
        unit_cost: 20,
        total_cost: 1000,
        billing_cycle: 'monthly',
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
        tenant_id: 't1',
        status: 'active',
        notes: 'Team license',
      };
      mockDb.query.mockResolvedValue({ rows: [mockRecord] });

      const result = await repository.insertSaaSCost({
        tool: 'GitHub',
        subscription: 'Enterprise',
        seats: 50,
        unitCost: 20,
        totalCost: 1000,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        tenantId: 't1',
        notes: 'Team license',
      });

      expect(result).toEqual(mockRecord);
    });

    it('should use default status when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'saas-1' }] });

      await repository.insertSaaSCost({
        tool: 'GitHub',
        subscription: 'Pro',
        seats: 10,
        unitCost: 10,
        totalCost: 100,
        billingCycle: 'monthly',
        startDate: new Date(),
        endDate: new Date(),
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[9]).toBe('active');
    });
  });

  describe('updateSaaSCost', () => {
    it('should update SaaS cost seats', async () => {
      const mockUpdated = { id: 'saas-1', seats: 100 };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateSaaSCost('saas-1', { seats: 100 });

      expect(result).toEqual(mockUpdated);
    });

    it('should update SaaS cost status', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'saas-1' }] });

      await repository.updateSaaSCost('saas-1', { status: 'cancelled' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['cancelled', 'saas-1'])
      );
    });

    it('should return null when no updates provided', async () => {
      const result = await repository.updateSaaSCost('saas-1', {});

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return null when SaaS cost not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateSaaSCost('non-existent', { seats: 100 });

      expect(result).toBeNull();
    });
  });

  describe('deleteSaaSCost', () => {
    it('should delete an existing SaaS cost', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteSaaSCost('saas-1');

      expect(result).toBe(true);
    });

    it('should return false when SaaS cost not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteSaaSCost('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate connection refused errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.getReports('t1')).rejects.toThrow('Connection refused');
    });

    it('should propagate timeout errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.createBudget({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 1000,
        period: 'monthly',
        currency: 'USD',
        alerts: [],
      })).rejects.toThrow('Query timeout');
    });

    it('should propagate constraint violation errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repository.recordSpend('project', 'proj-1', 100)).rejects.toThrow('Unique constraint violation');
    });
  });
});
