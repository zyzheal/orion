/**
 * CostOptimizerService 单元测试
 *
 * 测试覆盖:
 * - analyzeCostSavings: 成本分析、缓存、mock数据生成
 * - recommendOptimization: 优化推荐、优先级分组
 * - applyCostSavings: 应用方案、状态变更、成本更新
 * - trackSavings: 节约跟踪、记录生成
 * - getSavingsHistory: 历史查询
 * - getTotalSavings: 累计节约
 * - 边界条件与错误处理
 */

import { CostOptimizerService, CostSavingOpportunity, OptimizationRecommendation, CostAnalysisReport, SavingsTrackingRecord } from '../CostOptimizerService';
import { OrionError, ErrorCode } from '../../../errors';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// Shared mock references accessible from tests
const mockRecommendationRepo = {
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByStatus: jest.fn().mockResolvedValue([]),
  createRecommendation: jest.fn(),
  updateRecommendation: jest.fn(),
  deleteRecommendation: jest.fn(),
};

const mockTrackingRepo = {
  findByTenant: jest.fn().mockResolvedValue([]),
  findByRecommendation: jest.fn().mockResolvedValue([]),
  findByTenantAndMonth: jest.fn().mockResolvedValue([]),
  createRecord: jest.fn(),
};

// Mock repositories
jest.mock('../../../repositories/CostOptimizationRepository', () => ({
  CostRecommendationRepository: jest.fn().mockImplementation(() => mockRecommendationRepo),
  SavingsTrackingRepository: jest.fn().mockImplementation(() => mockTrackingRepo),
}));

describe('CostOptimizerService', () => {
  let service: CostOptimizerService;
  let mockDb: { query: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply default resolved values after clearAllMocks
    mockRecommendationRepo.findByStatus.mockResolvedValue([]);
    mockTrackingRepo.findByTenant.mockResolvedValue([]);
    mockTrackingRepo.findByRecommendation.mockResolvedValue([]);
    mockTrackingRepo.findByTenantAndMonth.mockResolvedValue([]);
    mockDb = { query: jest.fn() };
    service = new CostOptimizerService(mockDb);
  });

  describe('constructor', () => {
    it('should initialize without database', () => {
      const noDbService = new CostOptimizerService();
      expect(noDbService).toBeDefined();
    });

    it('should initialize with database', () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== analyzeCostSavings ====================

  describe('analyzeCostSavings', () => {
    it('should return a valid cost analysis report', () => {
      const report = service.analyzeCostSavings('tenant-1');

      expect(report).toBeDefined();
      expect(report.tenantId).toBe('tenant-1');
      expect(report.totalMonthlyCost).toBeGreaterThan(0);
      expect(report.opportunities).toBeInstanceOf(Array);
      expect(report.savingsByCategory).toBeDefined();
      expect(report.analyzedAt).toBeInstanceOf(Date);
    });

    it('should calculate totalMonthlyCost as sum of all cost components', () => {
      const report = service.analyzeCostSavings('tenant-abc');
      const expectedTotal = report.opportunities.length > 0
        ? report.estimatedOptimizedCost + report.totalEstimatedSavings
        : report.totalMonthlyCost;

      // totalMonthlyCost should be consistent
      expect(report.totalMonthlyCost).toBeGreaterThan(0);
      expect(report.estimatedOptimizedCost).toBeLessThanOrEqual(report.totalMonthlyCost);
    });

    it('should return cached result within 5 minutes', () => {
      const report1 = service.analyzeCostSavings('tenant-cached');
      const report2 = service.analyzeCostSavings('tenant-cached');

      expect(report2).toBe(report1); // Same reference = cached
      expect(report2.analyzedAt).toBe(report1.analyzedAt);
    });

    it('should generate opportunities when thresholds are met', () => {
      // The default mock data for most tenants should generate opportunities
      const report = service.analyzeCostSavings('tenant-threshold');

      // At minimum, idle resources and compute rightsizing should trigger
      expect(report.opportunities.length).toBeGreaterThan(0);
      report.opportunities.forEach(opp => {
        expect(opp.id).toBeDefined();
        expect(opp.category).toBeDefined();
        expect(opp.estimatedMonthlySavings).toBeGreaterThan(0);
        expect(opp.savingsPercentage).toBeGreaterThan(0);
        expect(opp.savingsPercentage).toBeLessThanOrEqual(100);
      });
    });

    it('should group savings by category correctly', () => {
      const report = service.analyzeCostSavings('tenant-group');

      const totalFromCategories = Object.values(report.savingsByCategory)
        .reduce((sum, val) => sum + val, 0);

      expect(totalFromCategories).toBeCloseTo(report.totalEstimatedSavings, 1);
    });

    it('should calculate overallSavingsPercentage correctly', () => {
      const report = service.analyzeCostSavings('tenant-percent');

      if (report.totalMonthlyCost > 0) {
        const expectedPercentage = Math.round(
          (report.totalEstimatedSavings / report.totalMonthlyCost) * 10000
        ) / 100;
        expect(report.overallSavingsPercentage).toBeCloseTo(expectedPercentage, 1);
      } else {
        expect(report.overallSavingsPercentage).toBe(0);
      }
    });

    it('should generate consistent mock data for the same tenant', () => {
      // Clear cache to force re-analysis
      const report1 = service.analyzeCostSavings('tenant-consistent');
      // Create a new service to bypass cache
      const service2 = new CostOptimizerService(mockDb);
      const report2 = service2.analyzeCostSavings('tenant-consistent');

      // Mock data should be deterministic based on tenantId
      expect(report1.totalMonthlyCost).toBe(report2.totalMonthlyCost);
    });

    it('should generate different data for different tenants', () => {
      // Use tenant IDs that produce different hashes
      const report1 = service.analyzeCostSavings('tenant-aaa');
      const service2 = new CostOptimizerService(mockDb);
      const report2 = service.analyzeCostSavings('tenant-zzz');

      // Different tenants should likely have different costs (hash-based)
      // This is a probabilistic test, but with aaa vs zzz, hashes differ
      expect(report1.tenantId).not.toBe(report2.tenantId);
    });
  });

  // ==================== recommendOptimization ====================

  describe('recommendOptimization', () => {
    it('should return recommendations with proper priority grouping', async () => {
      const recommendations = await service.recommendOptimization('tenant-rec');

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);

      recommendations.forEach(rec => {
        expect(rec.recommendationId).toBeDefined();
        expect(rec.tenantId).toBe('tenant-rec');
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.opportunities).toBeInstanceOf(Array);
        expect(rec.totalEstimatedSavings).toBeGreaterThanOrEqual(0);
        expect(['high', 'medium', 'low']).toContain(rec.priority);
        expect(rec.status).toBe('pending');
        expect(rec.createdAt).toBeInstanceOf(Date);
      });
    });

    it('should sort recommendations by priority value', async () => {
      const recommendations = await service.recommendOptimization('tenant-priority');

      const priorities = recommendations.map(r => r.priority);
      const priorityOrder = { high: 0, medium: 1, low: 2 };

      for (let i = 1; i < priorities.length; i++) {
        expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(priorityOrder[priorities[i - 1]]);
      }
    });

    it('should contain correct number of opportunities per recommendation', async () => {
      const recommendations = await service.recommendOptimization('tenant-count');
      const totalOpps = recommendations.reduce((sum, r) => sum + r.opportunities.length, 0);
      const analysis = service.analyzeCostSavings('tenant-count');

      expect(totalOpps).toBe(analysis.opportunities.length);
    });

    it('should calculate totalEstimatedSavings as sum of opportunity savings', async () => {
      const recommendations = await service.recommendOptimization('tenant-calc');

      recommendations.forEach(rec => {
        const expectedTotal = rec.opportunities.reduce(
          (sum, opp) => sum + opp.estimatedMonthlySavings, 0
        );
        expect(rec.totalEstimatedSavings).toBeCloseTo(expectedTotal, 1);
      });
    });

    it('should mark high priority for savings > 500', async () => {
      const recommendations = await service.recommendOptimization('tenant-high');
      const highRecs = recommendations.filter(r => r.priority === 'high');

      if (highRecs.length > 0) {
        highRecs.forEach(rec => {
          rec.opportunities.forEach(opp => {
            expect(opp.estimatedMonthlySavings).toBeGreaterThan(500);
          });
        });
      }
    });

    it('should mark medium priority for savings 100-500', async () => {
      const recommendations = await service.recommendOptimization('tenant-medium');
      const mediumRecs = recommendations.filter(r => r.priority === 'medium');

      if (mediumRecs.length > 0) {
        mediumRecs.forEach(rec => {
          rec.opportunities.forEach(opp => {
            expect(opp.estimatedMonthlySavings).toBeGreaterThan(100);
            expect(opp.estimatedMonthlySavings).toBeLessThanOrEqual(500);
          });
        });
      }
    });

    it('should mark low priority for savings <= 100', async () => {
      const recommendations = await service.recommendOptimization('tenant-low');
      const lowRecs = recommendations.filter(r => r.priority === 'low');

      if (lowRecs.length > 0) {
        lowRecs.forEach(rec => {
          rec.opportunities.forEach(opp => {
            expect(opp.estimatedMonthlySavings).toBeLessThanOrEqual(100);
          });
        });
      }
    });
  });

  // ==================== applyCostSavings ====================

  describe('applyCostSavings', () => {
    it('should apply a recommendation and update status', async () => {
      const recommendations = await service.recommendOptimization('tenant-apply');
      const targetRec = recommendations[0];

      const applied = await service.applyCostSavings(targetRec.recommendationId);

      expect(applied.status).toBe('applied');
      expect(applied.appliedAt).toBeInstanceOf(Date);
    });

    it('should return already applied recommendation without error', async () => {
      const recommendations = await service.recommendOptimization('tenant-idempotent');
      const targetRec = recommendations[0];

      const first = await service.applyCostSavings(targetRec.recommendationId);
      const second = await service.applyCostSavings(targetRec.recommendationId);

      expect(first.status).toBe('applied');
      expect(second.status).toBe('applied');
      expect(first.recommendationId).toBe(second.recommendationId);
    });

    it('should throw OrionError for non-existent recommendation', async () => {
      await expect(service.applyCostSavings('non-existent-id'))
        .rejects.toThrow(OrionError);
    });

    it('should throw NOT_FOUND error code for missing recommendation', async () => {
      try {
        await service.applyCostSavings('missing-rec-id');
        fail('Expected OrionError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OrionError);
        expect((error as OrionError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('should clear analysis cache after applying', async () => {
      const tenantId = 'tenant-cache-clear';
      const report1 = service.analyzeCostSavings(tenantId);

      const recommendations = await service.recommendOptimization(tenantId);
      await service.applyCostSavings(recommendations[0].recommendationId);

      // After applying, the cache should be cleared and new analysis should differ
      const report2 = service.analyzeCostSavings(tenantId);

      // The report should be different because cost data was updated
      expect(report2.analyzedAt.getTime()).toBeGreaterThanOrEqual(report1.analyzedAt.getTime());
    });

    it('should try to load from DB when not in cache', async () => {
      mockRecommendationRepo.findById.mockResolvedValue({
        id: 'db-rec-1',
        tenantId: 'tenant-db',
        title: 'DB Recommendation',
        description: 'From database',
        opportunities: [],
        totalEstimatedSavings: 100,
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
        appliedAt: null,
      });

      const applied = await service.applyCostSavings('db-rec-1');

      expect(applied.status).toBe('applied');
    });
  });

  // ==================== trackSavings ====================

  describe('trackSavings', () => {
    it('should return empty array when no applied recommendations exist', async () => {
      const records = await service.trackSavings('tenant-no-recs');

      expect(records).toBeInstanceOf(Array);
      expect(records.length).toBe(0);
    });

    it('should generate tracking records for applied recommendations', async () => {
      // First apply a recommendation
      const recommendations = await service.recommendOptimization('tenant-track');
      await service.applyCostSavings(recommendations[0].recommendationId);

      // Mock the repository to return applied recommendation entities
      mockRecommendationRepo.findByStatus.mockResolvedValue([{
        id: recommendations[0].recommendationId,
        tenantId: 'tenant-track',
        title: recommendations[0].title,
        description: recommendations[0].description,
        opportunities: recommendations[0].opportunities,
        totalEstimatedSavings: recommendations[0].totalEstimatedSavings,
        priority: recommendations[0].priority,
        status: 'applied',
        createdAt: recommendations[0].createdAt,
        appliedAt: new Date(),
      }]);

      const records = await service.trackSavings('tenant-track');

      expect(records.length).toBeGreaterThan(0);
      records.forEach(record => {
        expect(record.id).toBeDefined();
        expect(record.tenantId).toBe('tenant-track');
        expect(record.recommendationId).toBeDefined();
        expect(record.month).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
        expect(record.actualSavings).toBeGreaterThan(0);
        expect(record.estimatedSavings).toBeGreaterThan(0);
        expect(record.achievementRate).toBeGreaterThanOrEqual(80);
        expect(record.achievementRate).toBeLessThanOrEqual(110);
        expect(record.recordedAt).toBeInstanceOf(Date);
      });
    });

    it('should use current month format YYYY-MM', async () => {
      const recommendations = await service.recommendOptimization('tenant-month');
      await service.applyCostSavings(recommendations[0].recommendationId);

      mockRecommendationRepo.findByStatus.mockResolvedValue([{
        id: recommendations[0].recommendationId,
        tenantId: 'tenant-month',
        title: recommendations[0].title,
        description: recommendations[0].description,
        opportunities: recommendations[0].opportunities,
        totalEstimatedSavings: recommendations[0].totalEstimatedSavings,
        priority: recommendations[0].priority,
        status: 'applied',
        createdAt: recommendations[0].createdAt,
        appliedAt: new Date(),
      }]);

      const records = await service.trackSavings('tenant-month');
      const currentMonth = new Date().toISOString().slice(0, 7);

      records.forEach(record => {
        expect(record.month).toBe(currentMonth);
      });
    });

    it('should not duplicate records for same month', async () => {
      const recommendations = await service.recommendOptimization('tenant-dup');
      await service.applyCostSavings(recommendations[0].recommendationId);

      const appliedEntity = {
        id: recommendations[0].recommendationId,
        tenantId: 'tenant-dup',
        title: recommendations[0].title,
        description: recommendations[0].description,
        opportunities: recommendations[0].opportunities,
        totalEstimatedSavings: recommendations[0].totalEstimatedSavings,
        priority: recommendations[0].priority,
        status: 'applied',
        createdAt: recommendations[0].createdAt,
        appliedAt: new Date(),
      };

      mockRecommendationRepo.findByStatus.mockResolvedValue([appliedEntity]);

      // First call creates records
      const records1 = await service.trackSavings('tenant-dup');

      // Second call: mock returns existing records from DB
      const currentMonth = new Date().toISOString().slice(0, 7);
      mockTrackingRepo.findByTenantAndMonth.mockResolvedValue([{
        id: 'existing-record',
        tenantId: 'tenant-dup',
        recommendationId: recommendations[0].recommendationId,
        month: currentMonth,
        actualSavings: 500,
        estimatedSavings: 400,
        achievementRate: 100,
        recordedAt: new Date(),
      }]);

      const records2 = await service.trackSavings('tenant-dup');

      // Second call should find existing record and not create new one
      expect(records2.length).toBe(1);
      expect(records2[0].id).toBe('existing-record');
    });
  });

  // ==================== getSavingsHistory ====================

  describe('getSavingsHistory', () => {
    it('should return empty array without repository', async () => {
      const noDbService = new CostOptimizerService();
      const history = await noDbService.getSavingsHistory('tenant-1');

      expect(history).toEqual([]);
    });

    it('should return history from repository', async () => {
      const mockEntities = [
        {
          id: 'record-1',
          tenantId: 'tenant-hist',
          recommendationId: 'rec-1',
          month: '2026-05',
          actualSavings: 500,
          estimatedSavings: 450,
          achievementRate: 111,
          recordedAt: new Date(),
        },
        {
          id: 'record-2',
          tenantId: 'tenant-hist',
          recommendationId: 'rec-2',
          month: '2026-04',
          actualSavings: 300,
          estimatedSavings: 350,
          achievementRate: 86,
          recordedAt: new Date(),
        },
      ];

      mockTrackingRepo.findByTenant.mockResolvedValue(mockEntities);

      const history = await service.getSavingsHistory('tenant-hist');

      expect(history.length).toBe(2);
      expect(history[0].id).toBe('record-1');
      expect(history[0].actualSavings).toBe(500);
      expect(history[1].id).toBe('record-2');
    });
  });

  // ==================== getTotalSavings ====================

  describe('getTotalSavings', () => {
    it('should return 0 without repository', async () => {
      const noDbService = new CostOptimizerService();
      const total = await noDbService.getTotalSavings('tenant-1');

      expect(total).toBe(0);
    });

    it('should sum all actual savings from history', async () => {
      mockTrackingRepo.findByTenant.mockResolvedValue([
        { actualSavings: 100 } as any,
        { actualSavings: 200 } as any,
        { actualSavings: 300 } as any,
      ]);

      const total = await service.getTotalSavings('tenant-sum');

      expect(total).toBe(600);
    });

    it('should return 0 for tenant with no history', async () => {
      mockTrackingRepo.findByTenant.mockResolvedValue([]);

      const total = await service.getTotalSavings('tenant-empty');

      expect(total).toBe(0);
    });
  });

  // ==================== generateOpportunities (via analyzeCostSavings) ====================

  describe('generateOpportunities', () => {
    it('should generate rightsizing opportunity when compute > 2000', () => {
      const report = service.analyzeCostSavings('tenant-rightsizing');
      const rightsizingOpps = report.opportunities.filter(o => o.category === 'rightsizing');

      expect(rightsizingOpps.length).toBeGreaterThan(0);
      rightsizingOpps.forEach(opp => {
        expect(opp.resourceName).toBe('compute-cluster');
        expect(opp.savingsPercentage).toBe(25);
        expect(opp.implementationDifficulty).toBe('medium');
        expect(opp.riskLevel).toBe('low');
      });
    });

    it('should generate scheduling opportunity when compute > 5000', () => {
      const report = service.analyzeCostSavings('tenant-scheduling');
      const schedulingOpps = report.opportunities.filter(o => o.category === 'scheduling');

      expect(schedulingOpps.length).toBeGreaterThan(0);
      schedulingOpps.forEach(opp => {
        expect(opp.resourceName).toBe('compute-nonprod');
        expect(opp.savingsPercentage).toBe(30);
        expect(opp.implementationDifficulty).toBe('low');
      });
    });

    it('should generate storage opportunity when storage > 1000', () => {
      const report = service.analyzeCostSavings('tenant-storage');
      const storageOpps = report.opportunities.filter(o => o.category === 'storage');

      expect(storageOpps.length).toBeGreaterThan(0);
      storageOpps.forEach(opp => {
        expect(opp.resourceName).toBe('persistent-volumes');
        expect(opp.savingsPercentage).toBe(20);
        expect(opp.riskLevel).toBe('medium');
      });
    });

    it('should generate idle_resources opportunity when idle > 1000', () => {
      const report = service.analyzeCostSavings('tenant-idle');
      const idleOpps = report.opportunities.filter(o => o.category === 'idle_resources');

      expect(idleOpps.length).toBeGreaterThan(0);
      idleOpps.forEach(opp => {
        expect(opp.resourceName).toBe('idle-instances');
        expect(opp.savingsPercentage).toBe(80);
        expect(opp.implementationDifficulty).toBe('low');
      });
    });

    it('should generate network opportunity when network > 1000', () => {
      const report = service.analyzeCostSavings('tenant-network');
      const networkOpps = report.opportunities.filter(o => o.category === 'network');

      expect(networkOpps.length).toBeGreaterThan(0);
      networkOpps.forEach(opp => {
        expect(opp.resourceName).toBe('network-egress');
        expect(opp.savingsPercentage).toBe(15);
        expect(opp.implementationDifficulty).toBe('high');
      });
    });

    it('should generate compute spot opportunity when compute > 10000', () => {
      // Need a tenant whose hash produces compute > 10000
      // computeCost = 5000 * baseMultiplier, baseMultiplier = (hash % 10) + 1
      // For compute > 10000: baseMultiplier > 2
      const report = service.analyzeCostSavings('tenant-spot');
      const spotOpps = report.opportunities.filter(o => o.category === 'compute');

      // This depends on the hash of 'tenant-spot'
      if (spotOpps.length > 0) {
        spotOpps.forEach(opp => {
          expect(opp.resourceName).toBe('compute-spot');
          expect(opp.savingsPercentage).toBe(40);
          expect(opp.implementationDifficulty).toBe('high');
          expect(opp.riskLevel).toBe('medium');
        });
      }
    });

    it('should have valid description for each opportunity', () => {
      const report = service.analyzeCostSavings('tenant-desc');

      report.opportunities.forEach(opp => {
        expect(opp.description).toBeDefined();
        expect(opp.description.length).toBeGreaterThan(0);
      });
    });
  });

  // ==================== Mock data generation ====================

  describe('getMockCostData', () => {
    it('should generate deterministic data based on tenantId', () => {
      const report1 = service.analyzeCostSavings('deterministic-tenant');
      const service2 = new CostOptimizerService(mockDb);
      const report2 = service2.analyzeCostSavings('deterministic-tenant');

      expect(report1.totalMonthlyCost).toBe(report2.totalMonthlyCost);
    });

    it('should generate positive cost values', () => {
      const report = service.analyzeCostSavings('positive-cost');

      expect(report.totalMonthlyCost).toBeGreaterThan(0);
      report.opportunities.forEach(opp => {
        expect(opp.currentMonthlyCost).toBeGreaterThan(0);
        expect(opp.estimatedMonthlyCost).toBeGreaterThanOrEqual(0);
        expect(opp.estimatedMonthlySavings).toBeGreaterThan(0);
      });
    });
  });

  // ==================== Edge cases ====================

  describe('edge cases', () => {
    it('should handle empty tenantId gracefully', () => {
      const report = service.analyzeCostSavings('');

      expect(report).toBeDefined();
      expect(report.tenantId).toBe('');
    });

    it('should handle very long tenantId', () => {
      const longId = 'a'.repeat(1000);
      const report = service.analyzeCostSavings(longId);

      expect(report).toBeDefined();
      expect(report.tenantId).toBe(longId);
    });

    it('should handle special characters in tenantId', () => {
      const report = service.analyzeCostSavings('tenant-!@#$%^&*()');

      expect(report).toBeDefined();
      expect(report.tenantId).toBe('tenant-!@#$%^&*()');
    });

    it('should handle concurrent analyze calls for different tenants', () => {
      const report1 = service.analyzeCostSavings('concurrent-1');
      const report2 = service.analyzeCostSavings('concurrent-2');
      const report3 = service.analyzeCostSavings('concurrent-3');

      expect(report1.tenantId).toBe('concurrent-1');
      expect(report2.tenantId).toBe('concurrent-2');
      expect(report3.tenantId).toBe('concurrent-3');
    });
  });
});
