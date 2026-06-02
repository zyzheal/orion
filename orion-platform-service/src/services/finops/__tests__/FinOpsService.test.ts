/**
 * FinOpsService - 业务逻辑层单元测试
 *
 * 测试覆盖: 报告生成、成本追踪、预算管理、ROI分析、成本优化、云/K8s/SaaS成本
 */

import { FinOpsService, FinOpsServiceError } from '../FinOpsService';
import { FinOpsRepository } from '../FinOpsRepository';

describe('FinOpsService', () => {
  let mockRepository: jest.Mocked<FinOpsRepository>;
  let service: FinOpsService;

  beforeEach(() => {
    mockRepository = {
      createReport: jest.fn(),
      getReports: jest.fn(),
      getResourceCosts: jest.fn(),
      insertCostRecord: jest.fn(),
      getCostByEntity: jest.fn(),
      getAllCostRecords: jest.fn(),
      createBudget: jest.fn(),
      updateBudget: jest.fn(),
      deleteBudget: jest.fn(),
      getBudget: jest.fn(),
      listBudgets: jest.fn(),
      recordSpend: jest.fn(),
      getCurrentSpend: jest.fn(),
      getSpendHistory: jest.fn(),
      insertAlertTrigger: jest.fn(),
      getAlertTriggers: jest.fn(),
      insertROIAnalysis: jest.fn(),
      getROIHistory: jest.fn(),
      insertCostComparison: jest.fn(),
      getCostComparisons: jest.fn(),
      getROISummary: jest.fn(),
      insertOptimization: jest.fn(),
      batchInsertOptimizations: jest.fn(),
      getOptimizations: jest.fn(),
      updateOptimizationStatus: jest.fn(),
      deleteOptimization: jest.fn(),
      getOptimizationById: jest.fn(),
      getResourceUtilizations: jest.fn(),
      insertCloudCost: jest.fn(),
      batchInsertCloudCosts: jest.fn(),
      getCloudCosts: jest.fn(),
      insertK8sCost: jest.fn(),
      batchInsertK8sCosts: jest.fn(),
      getK8sCosts: jest.fn(),
      getK8sNamespaceCosts: jest.fn(),
      getK8sPodCosts: jest.fn(),
      getK8sTenantCosts: jest.fn(),
      insertSaaSCost: jest.fn(),
      updateSaaSCost: jest.fn(),
      deleteSaaSCost: jest.fn(),
      getSaaSCosts: jest.fn(),
      createLegacyBudgetAlert: jest.fn(),
      getLegacyBudgetAlerts: jest.fn(),
      deleteLegacyBudgetAlert: jest.fn(),
      updateLegacyBudgetAlertSpend: jest.fn(),
    } as unknown as jest.Mocked<FinOpsRepository>;

    service = new FinOpsService(mockRepository);
  });

  // ==================== Reports ====================

  describe('generateReport', () => {
    it('should generate a report with calculated totals', async () => {
      const mockReport = {
        id: 'report-1',
        tenant_id: 't1',
        period: '2026-01',
        total_cost: 1700,
        breakdown: { compute: 1000, storage: 500, network: 200 },
        created_at: new Date(),
      };
      mockRepository.createReport.mockResolvedValue(mockReport);

      const result = await service.generateReport('t1', '2026-01');

      expect(result).toEqual(mockReport);
      expect(mockRepository.createReport).toHaveBeenCalledWith('t1', '2026-01', 1700, { compute: 1000, storage: 500, network: 200 });
    });
  });

  describe('getReportHistory', () => {
    it('should return report history', async () => {
      const mockReports = [{ id: 'r1' }, { id: 'r2' }];
      mockRepository.getReports.mockResolvedValue(mockReports as any);

      const result = await service.getReportHistory('t1');

      expect(result).toEqual(mockReports);
    });

    it('should pass limit parameter', async () => {
      mockRepository.getReports.mockResolvedValue([]);

      await service.getReportHistory('t1', 5);

      expect(mockRepository.getReports).toHaveBeenCalledWith('t1', 5);
    });
  });

  describe('analyzeCosts', () => {
    it('should return resource costs', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      const mockCosts = [{ id: 'rc1', cost: 100 }];
      mockRepository.getResourceCosts.mockResolvedValue(mockCosts as any);

      const result = await service.analyzeCosts('t1', startDate, endDate);

      expect(result).toEqual(mockCosts);
    });
  });

  // ==================== Cost Tracking ====================

  describe('trackCost', () => {
    it('should track cost with all fields', async () => {
      const mockRecord = { id: 'cr1', amount: 500 };
      mockRepository.insertCostRecord.mockResolvedValue(mockRecord as any);

      const result = await service.trackCost({
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

    it('should use default currency when not provided', async () => {
      mockRepository.insertCostRecord.mockResolvedValue({ id: 'cr1' } as any);

      await service.trackCost({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 100,
        category: 'storage',
      });

      expect(mockRepository.insertCostRecord).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' })
      );
    });
  });

  describe('getCostByEntity', () => {
    it('should return cost summary', async () => {
      const mockRecords = [
        { category: 'compute', amount: 100 },
        { category: 'compute', amount: 200 },
        { category: 'storage', amount: 50 },
      ];
      mockRepository.getCostByEntity.mockResolvedValue(mockRecords as any);

      const result = await service.getCostByEntity('project', 'proj-1', 'monthly');

      expect(result.totalCost).toBe(350);
      expect(result.breakdown.compute).toBe(300);
      expect(result.breakdown.storage).toBe(50);
      expect(result.recordCount).toBe(3);
    });

    it('should return zero values when no records', async () => {
      mockRepository.getCostByEntity.mockResolvedValue([]);

      const result = await service.getCostByEntity('project', 'proj-1', 'monthly');

      expect(result.totalCost).toBe(0);
      expect(result.recordCount).toBe(0);
    });
  });

  describe('getCostTrend', () => {
    it('should return cost trend with data points', async () => {
      const mockRecords = [
        { timestamp: new Date('2026-01-01'), amount: 100, category: 'compute' },
        { timestamp: new Date('2026-01-02'), amount: 150, category: 'compute' },
        { timestamp: new Date('2026-01-03'), amount: 200, category: 'compute' },
      ];
      mockRepository.getCostByEntity.mockResolvedValue(mockRecords as any);

      const result = await service.getCostTrend('project', 'proj-1', 'monthly');

      expect(result.points).toHaveLength(3);
      expect(result.averageCost).toBe(150);
      expect(result.maxCost).toBe(200);
      expect(result.minCost).toBe(100);
    });

    it('should filter by category', async () => {
      const mockRecords = [
        { timestamp: new Date('2026-01-01'), amount: 100, category: 'compute' },
        { timestamp: new Date('2026-01-01'), amount: 50, category: 'storage' },
      ];
      mockRepository.getCostByEntity.mockResolvedValue(mockRecords as any);

      const result = await service.getCostTrend('project', 'proj-1', 'monthly', 'compute');

      expect(result.points).toHaveLength(1);
    });

    it('should return empty trend when no records', async () => {
      mockRepository.getCostByEntity.mockResolvedValue([]);

      const result = await service.getCostTrend('project', 'proj-1', 'monthly');

      expect(result.points).toEqual([]);
      expect(result.averageCost).toBe(0);
    });
  });

  describe('getChargebackReport', () => {
    it('should generate chargeback report', async () => {
      const mockRecords = [
        { entity_type: 'project', entity_id: 'proj-1', amount: 100, category: 'compute', timestamp: new Date() },
        { entity_type: 'project', entity_id: 'proj-1', amount: 50, category: 'storage', timestamp: new Date() },
        { entity_type: 'project', entity_id: 'proj-2', amount: 200, category: 'compute', timestamp: new Date() },
      ];
      mockRepository.getAllCostRecords.mockResolvedValue(mockRecords as any);

      const result = await service.getChargebackReport('monthly');

      expect(result.entities).toHaveLength(2);
      expect(result.totalCost).toBe(350);
      expect(result.entities[0].entityId).toBe('proj-2'); // sorted by cost desc
    });
  });

  // ==================== Budget Management ====================

  describe('createBudget', () => {
    it('should create budget with default alerts', async () => {
      const mockBudget = { id: 'budget-1', amount: 10000 };
      mockRepository.createBudget.mockResolvedValue(mockBudget as any);

      const result = await service.createBudget({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 10000,
        period: 'monthly',
      });

      expect(result).toEqual(mockBudget);
      expect(mockRepository.createBudget).toHaveBeenCalledWith(
        expect.objectContaining({
          alerts: expect.arrayContaining([
            expect.objectContaining({ percentage: 50 }),
            expect.objectContaining({ percentage: 75 }),
            expect.objectContaining({ percentage: 90 }),
            expect.objectContaining({ percentage: 100 }),
          ]),
        })
      );
    });

    it('should create budget with custom alerts', async () => {
      mockRepository.createBudget.mockResolvedValue({ id: 'budget-1' } as any);

      await service.createBudget({
        entityType: 'project',
        entityId: 'proj-1',
        amount: 10000,
        period: 'monthly',
        alerts: [{ percentage: 80 }, { percentage: 95 }],
      });

      expect(mockRepository.createBudget).toHaveBeenCalledWith(
        expect.objectContaining({
          alerts: expect.arrayContaining([
            expect.objectContaining({ percentage: 80 }),
            expect.objectContaining({ percentage: 95 }),
          ]),
        })
      );
    });
  });

  describe('updateBudget', () => {
    it('should update budget amount', async () => {
      const mockUpdated = { id: 'budget-1', amount: 15000 };
      mockRepository.updateBudget.mockResolvedValue(mockUpdated as any);

      const result = await service.updateBudget('budget-1', { amount: 15000 });

      expect(result).toEqual(mockUpdated);
    });

    it('should return null when no updates provided', async () => {
      const result = await service.updateBudget('budget-1', {});

      expect(result).toBeNull();
      expect(mockRepository.updateBudget).not.toHaveBeenCalled();
    });
  });

  describe('deleteBudget', () => {
    it('should delete budget', async () => {
      mockRepository.deleteBudget.mockResolvedValue(true);

      const result = await service.deleteBudget('budget-1');

      expect(result).toBe(true);
    });
  });

  describe('getBudget', () => {
    it('should return budget', async () => {
      const mockBudget = { id: 'budget-1' };
      mockRepository.getBudget.mockResolvedValue(mockBudget as any);

      const result = await service.getBudget('budget-1');

      expect(result).toEqual(mockBudget);
    });
  });

  describe('listBudgets', () => {
    it('should list budgets', async () => {
      const mockBudgets = [{ id: 'b1' }];
      mockRepository.listBudgets.mockResolvedValue(mockBudgets as any);

      const result = await service.listBudgets();

      expect(result).toEqual(mockBudgets);
    });
  });

  describe('getBudgetStatus', () => {
    it('should return budget status', async () => {
      const mockBudget = {
        id: 'budget-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 10000,
        period: 'monthly',
      };
      mockRepository.getBudget.mockResolvedValue(mockBudget as any);
      mockRepository.getCurrentSpend.mockResolvedValue(7500);
      mockRepository.getAlertTriggers.mockResolvedValue([]);
      mockRepository.getSpendHistory.mockResolvedValue([]);

      const result = await service.getBudgetStatus('budget-1');

      expect(result).toBeDefined();
      expect(result!.budgetAmount).toBe(10000);
      expect(result!.currentSpend).toBe(7500);
      expect(result!.usagePercent).toBe(75);
      expect(result!.remaining).toBe(2500);
      expect(result!.overBudget).toBe(false);
    });

    it('should return null when budget not found', async () => {
      mockRepository.getBudget.mockResolvedValue(null);

      const result = await service.getBudgetStatus('non-existent');

      expect(result).toBeNull();
    });

    it('should detect over-budget status', async () => {
      const mockBudget = {
        id: 'budget-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 10000,
        period: 'monthly',
      };
      mockRepository.getBudget.mockResolvedValue(mockBudget as any);
      mockRepository.getCurrentSpend.mockResolvedValue(12000);
      mockRepository.getAlertTriggers.mockResolvedValue([]);
      mockRepository.getSpendHistory.mockResolvedValue([]);

      const result = await service.getBudgetStatus('budget-1');

      expect(result!.overBudget).toBe(true);
      expect(result!.usagePercent).toBe(120);
    });
  });

  describe('checkBudgetAlerts', () => {
    it('should trigger alerts when threshold exceeded', async () => {
      const mockBudgets = [{
        id: 'budget-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 10000,
        alerts: [{ id: 'a1', percentage: 80, triggered: false }],
      }];
      mockRepository.listBudgets.mockResolvedValue(mockBudgets as any);
      mockRepository.getCurrentSpend.mockResolvedValue(9000);
      mockRepository.insertAlertTrigger.mockResolvedValue({ id: 'trigger-1' } as any);

      const result = await service.checkBudgetAlerts();

      expect(result).toHaveLength(1);
      expect(mockRepository.insertAlertTrigger).toHaveBeenCalled();
    });

    it('should not trigger alerts when under threshold', async () => {
      const mockBudgets = [{
        id: 'budget-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 10000,
        alerts: [{ id: 'a1', percentage: 80, triggered: false }],
      }];
      mockRepository.listBudgets.mockResolvedValue(mockBudgets as any);
      mockRepository.getCurrentSpend.mockResolvedValue(5000);

      const result = await service.checkBudgetAlerts();

      expect(result).toHaveLength(0);
    });
  });

  describe('forecastBudget', () => {
    it('should forecast budget with history', async () => {
      const mockBudget = {
        id: 'budget-1',
        entity_type: 'project',
        entity_id: 'proj-1',
        amount: 10000,
        period: 'monthly',
      };
      mockRepository.getBudget.mockResolvedValue(mockBudget as any);
      mockRepository.getCurrentSpend.mockResolvedValue(5000);
      mockRepository.getSpendHistory.mockResolvedValue([
        { date: new Date('2026-01-01'), cumulativeCost: 1000 },
        { date: new Date('2026-01-15'), cumulativeCost: 5000 },
      ]);

      const result = await service.forecastBudget('budget-1');

      expect(result).toBeDefined();
      expect(result!.budgetId).toBe('budget-1');
      expect(result!.currentSpend).toBe(5000);
    });

    it('should return null when budget not found', async () => {
      mockRepository.getBudget.mockResolvedValue(null);

      const result = await service.forecastBudget('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== ROI Analysis ====================

  describe('calculateROI', () => {
    it('should calculate ROI', async () => {
      const mockAnalysis = { id: 'roi-1', roi_percentage: 200 };
      mockRepository.insertROIAnalysis.mockResolvedValue(mockAnalysis as any);

      const result = await service.calculateROI({
        investmentType: 'automation',
        name: 'CI/CD Pipeline',
        cost: 5000,
        monthlySavings: 1500,
      });

      expect(result).toEqual(mockAnalysis);
      expect(mockRepository.insertROIAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          roiPercentage: 260, // ((1500*12 - 5000) / 5000) * 100
          paybackMonths: 3.33, // 5000 / 1500
        })
      );
    });
  });

  describe('comparePeriods', () => {
    it('should compare periods', async () => {
      const mockComparison = { id: 'comp-1', savings: 500 };
      mockRepository.insertCostComparison.mockResolvedValue(mockComparison as any);

      const result = await service.comparePeriods({
        description: 'Before vs After',
        beforeCost: 1000,
        afterCost: 500,
        period: 'monthly',
      });

      expect(result).toEqual(mockComparison);
      expect(mockRepository.insertCostComparison).toHaveBeenCalledWith(
        expect.objectContaining({
          savings: 500,
          savingsPercent: 50,
        })
      );
    });
  });

  // ==================== Cost Optimization ====================

  describe('analyzeOptimization', () => {
    it('should analyze unused resources', async () => {
      mockRepository.batchInsertOptimizations.mockResolvedValue([{ id: 'opt-1' }] as any);

      const result = await service.analyzeOptimization([{
        resourceId: 'i-123',
        resourceName: 'web-server',
        resourceType: 'ec2',
        cpuUtilization: 2,
        memoryUtilization: 3,
        storageUtilization: 1,
        monthlyCost: 100,
        environment: 'staging',
        tenantId: 't1',
      }]);

      // The mock returns 1 item, but batchInsertOptimizations is called with suggestions array
      expect(result).toHaveLength(1);
      expect(mockRepository.batchInsertOptimizations).toHaveBeenCalled();
    });

    it('should analyze underutilized resources', async () => {
      mockRepository.batchInsertOptimizations.mockResolvedValue([{ id: 'opt-1' }] as any);

      const result = await service.analyzeOptimization([{
        resourceId: 'i-456',
        resourceName: 'db-server',
        resourceType: 'rds',
        cpuUtilization: 15,
        memoryUtilization: 20,
        storageUtilization: 50,
        monthlyCost: 500,
        environment: 'production',
        tenantId: 't1',
      }]);

      expect(result).toHaveLength(1); // right-sizing only (production not schedulable)
    });
  });

  describe('getRightSizingRecommendations', () => {
    it('should return right-sizing recommendations', async () => {
      mockRepository.getOptimizations.mockResolvedValue([
        { id: 'opt-1', resource_ids: ['i-123'], estimated_savings: 100, description: 'Right-size' },
      ] as any);

      const result = await service.getRightSizingRecommendations();

      expect(result).toHaveLength(1);
      expect(result[0].estimatedSavings).toBe(100);
    });

    it('should filter by tenantId', async () => {
      mockRepository.getOptimizations.mockResolvedValue([
        { id: 'opt-1', entity_id: 't1', resource_ids: ['i-1'], estimated_savings: 100, description: 'Test' },
        { id: 'opt-2', entity_id: 't2', resource_ids: ['i-2'], estimated_savings: 200, description: 'Test' },
      ] as any);

      const result = await service.getRightSizingRecommendations({ tenantId: 't1' });

      expect(result).toHaveLength(1);
    });
  });

  describe('estimateSavings', () => {
    it('should estimate savings', async () => {
      mockRepository.getOptimizations.mockResolvedValue([
        { category: 'compute', estimated_savings: 100 },
        { category: 'compute', estimated_savings: 200 },
        { category: 'storage', estimated_savings: 50 },
      ] as any);

      const result = await service.estimateSavings();

      expect(result.totalMonthlySavings).toBe(350);
      expect(result.totalAnnualSavings).toBe(4200);
      expect(result.byCategory.compute).toBe(300);
      expect(result.byCategory.storage).toBe(50);
      expect(result.suggestionCount).toBe(3);
    });
  });

  // ==================== Cloud Cost Collection ====================

  describe('collectCloudCosts', () => {
    it('should collect cloud costs', async () => {
      mockRepository.batchInsertCloudCosts.mockResolvedValue([{ id: 'cc-1' }] as any);

      const result = await service.collectCloudCosts([{
        provider: 'aws',
        resourceType: 'ec2',
        resourceId: 'i-123',
        region: 'us-east-1',
        cost: 100,
      }]);

      expect(result).toHaveLength(1);
      expect(mockRepository.batchInsertCloudCosts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ currency: 'USD' }),
        ])
      );
    });
  });

  describe('getCloudCosts', () => {
    it('should return cloud costs', async () => {
      mockRepository.getCloudCosts.mockResolvedValue([{ id: 'cc-1' }] as any);

      const result = await service.getCloudCosts({ provider: 'aws' });

      expect(result).toHaveLength(1);
    });
  });

  // ==================== K8s Cost Allocation ====================

  describe('allocateK8sCosts', () => {
    it('should allocate K8s costs', async () => {
      mockRepository.batchInsertK8sCosts.mockResolvedValue([{ id: 'k8s-1' }] as any);

      const result = await service.allocateK8sCosts([{
        namespace: 'default',
        deployment: 'web-app',
        cpuCost: 50,
        memoryCost: 30,
        storageCost: 10,
        networkCost: 5,
        totalCost: 95,
      }]);

      expect(result).toHaveLength(1);
    });
  });

  describe('getK8sCosts', () => {
    it('should return K8s costs', async () => {
      mockRepository.getK8sCosts.mockResolvedValue([{ id: 'k8s-1' }] as any);

      const result = await service.getK8sCosts({ namespace: 'production' });

      expect(result).toHaveLength(1);
    });
  });

  describe('getK8sNamespaceCosts', () => {
    it('should return namespace costs', async () => {
      mockRepository.getK8sNamespaceCosts.mockResolvedValue([{ namespace: 'prod', total_cost: 500 }]);

      const result = await service.getK8sNamespaceCosts();

      expect(result).toHaveLength(1);
    });
  });

  describe('getK8sPodCosts', () => {
    it('should return pod costs', async () => {
      mockRepository.getK8sPodCosts.mockResolvedValue([{ id: 'k8s-1' }] as any);

      const result = await service.getK8sPodCosts({ namespace: 'prod' });

      expect(result).toHaveLength(1);
    });
  });

  describe('getK8sTenantCosts', () => {
    it('should return tenant costs', async () => {
      mockRepository.getK8sTenantCosts.mockResolvedValue([{ tenant_id: 't1', total_cost: 1000 }]);

      const result = await service.getK8sTenantCosts();

      expect(result).toHaveLength(1);
    });
  });

  // ==================== SaaS Cost Tracking ====================

  describe('addSaaSSubscription', () => {
    it('should add SaaS subscription', async () => {
      const mockRecord = { id: 'saas-1', tool: 'GitHub' };
      mockRepository.insertSaaSCost.mockResolvedValue(mockRecord as any);

      const result = await service.addSaaSSubscription({
        tool: 'GitHub',
        subscription: 'Enterprise',
        seats: 50,
        unitCost: 20,
        billingCycle: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      expect(result).toEqual(mockRecord);
      expect(mockRepository.insertSaaSCost).toHaveBeenCalledWith(
        expect.objectContaining({ totalCost: 1000 })
      );
    });
  });

  describe('updateSaaSSubscription', () => {
    it('should update SaaS subscription', async () => {
      mockRepository.updateSaaSCost.mockResolvedValue({ id: 'saas-1' } as any);

      const result = await service.updateSaaSSubscription('saas-1', { seats: 100, unitCost: 20 });

      expect(result).toBeDefined();
      expect(mockRepository.updateSaaSCost).toHaveBeenCalledWith(
        'saas-1',
        expect.objectContaining({ totalCost: 2000 })
      );
    });
  });

  describe('deleteSaaSSubscription', () => {
    it('should delete SaaS subscription', async () => {
      mockRepository.deleteSaaSCost.mockResolvedValue(true);

      const result = await service.deleteSaaSSubscription('saas-1');

      expect(result).toBe(true);
    });
  });

  describe('getSaaSSubscriptions', () => {
    it('should return SaaS subscriptions', async () => {
      mockRepository.getSaaSCosts.mockResolvedValue([{ id: 'saas-1' }] as any);

      const result = await service.getSaaSSubscriptions({ tool: 'GitHub' });

      expect(result).toHaveLength(1);
    });
  });

  // ==================== Cost Aggregation ====================

  describe('getCostSummary', () => {
    it('should return cost summary', async () => {
      mockRepository.getCloudCosts.mockResolvedValue([
        { resource_type: 'compute', cost: 100 },
        { resource_type: 'storage', cost: 50 },
      ] as any);
      mockRepository.getK8sCosts.mockResolvedValue([
        { storage_cost: 20, network_cost: 10, total_cost: 100 },
      ] as any);
      mockRepository.getSaaSCosts.mockResolvedValue([]);

      const result = await service.getCostSummary('monthly');

      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.period).toBe('monthly');
      expect(result.currency).toBe('USD');
    });
  });

  describe('getCostBreakdown', () => {
    it('should return cost breakdown by category', async () => {
      mockRepository.getCloudCosts.mockResolvedValue([
        { resource_type: 'compute', cost: 100, provider: 'aws' },
        { resource_type: 'storage', cost: 50, provider: 'aws' },
      ] as any);
      mockRepository.getK8sCosts.mockResolvedValue([]);
      mockRepository.getSaaSCosts.mockResolvedValue([]);

      const result = await service.getCostBreakdown('category');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return cost breakdown by provider', async () => {
      mockRepository.getCloudCosts.mockResolvedValue([
        { resource_type: 'compute', cost: 100, provider: 'aws' },
        { resource_type: 'compute', cost: 200, provider: 'gcp' },
      ] as any);
      mockRepository.getK8sCosts.mockResolvedValue([]);
      mockRepository.getSaaSCosts.mockResolvedValue([]);

      const result = await service.getCostBreakdown('provider');

      expect(result.length).toBe(2);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate repository errors', async () => {
      mockRepository.createReport.mockRejectedValue(new Error('Database error'));

      await expect(service.generateReport('t1', '2026-01')).rejects.toThrow('Database error');
    });

    it('should propagate timeout errors', async () => {
      mockRepository.getCostByEntity.mockRejectedValue(new Error('Query timeout'));

      await expect(service.getCostByEntity('project', 'proj-1', 'monthly')).rejects.toThrow('Query timeout');
    });
  });
});
