/**
 * CostService 单元测试
 */

import { CostService } from '../CostService';
import { CloudResource, K8sCost, SaaSCost } from '../types';

describe('CostService', () => {
  let service: CostService;

  beforeEach(() => {
    service = new CostService();
  });

  // ==================== Add Costs ====================

  describe('addCloudCosts', () => {
    it('should add cloud cost records', () => {
      const costs: CloudResource[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 100,
          currency: 'USD',
          tags: {},
          timestamp: new Date(),
        },
      ];

      service.addCloudCosts(costs);
      const data = service.getAllData();

      expect(data.cloud.length).toBe(1);
    });
  });

  describe('addK8sCosts', () => {
    it('should add K8s cost records', () => {
      const costs: K8sCost[] = [
        {
          id: '1',
          namespace: 'default',
          deployment: 'api',
          cpuCost: 10,
          memoryCost: 20,
          storageCost: 5,
          networkCost: 3,
          totalCost: 38,
          timestamp: new Date(),
        },
      ];

      service.addK8sCosts(costs);
      const data = service.getAllData();

      expect(data.k8s.length).toBe(1);
    });
  });

  describe('addSaaSCosts', () => {
    it('should add SaaS cost records', () => {
      const costs: SaaSCost[] = [
        {
          id: '1',
          tool: 'GitLab',
          subscription: 'Premium',
          seats: 10,
          unitCost: 29,
          totalCost: 290,
          billingCycle: 'monthly',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'active',
        },
      ];

      service.addSaaSCosts(costs);
      const data = service.getAllData();

      expect(data.saas.length).toBe(1);
    });
  });

  // ==================== Cost Summary ====================

  describe('getCostSummary', () => {
    beforeEach(() => {
      const now = new Date();

      const cloudCosts: CloudResource[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 100,
          currency: 'USD',
          tags: {},
          timestamp: now,
          tenantId: 'tenant-001',
          environment: 'production',
        },
        {
          id: '2',
          provider: 'aws',
          resourceType: 'storage',
          resourceId: 'vol-xyz',
          region: 'us-east-1',
          cost: 50,
          currency: 'USD',
          tags: {},
          timestamp: now,
          tenantId: 'tenant-001',
          environment: 'production',
        },
        {
          id: '3',
          provider: 'aws',
          resourceType: 'network',
          resourceId: 'nat-123',
          region: 'us-east-1',
          cost: 25,
          currency: 'USD',
          tags: {},
          timestamp: now,
          environment: 'production',
        },
      ];

      const k8sCosts: K8sCost[] = [
        {
          id: '4',
          namespace: 'production',
          deployment: 'api',
          cpuCost: 30,
          memoryCost: 20,
          storageCost: 10,
          networkCost: 5,
          totalCost: 65,
          timestamp: now,
          tenantId: 'tenant-001',
        },
      ];

      const saasCosts: SaaSCost[] = [
        {
          id: '5',
          tool: 'GitLab',
          subscription: 'Premium',
          seats: 10,
          unitCost: 29,
          totalCost: 290,
          billingCycle: 'monthly',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'active',
        },
      ];

      service.addCloudCosts(cloudCosts);
      service.addK8sCosts(k8sCosts);
      service.addSaaSCosts(saasCosts);
    });

    it('should calculate cost summary with all categories', () => {
      const summary = service.getCostSummary('monthly');

      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.computeCost).toBeGreaterThan(0);
      expect(summary.storageCost).toBeGreaterThan(0);
      expect(summary.networkCost).toBeGreaterThan(0);
      expect(summary.saasCost).toBeGreaterThan(0);
      expect(summary.period).toBe('monthly');
      expect(summary.currency).toBe('USD');
    });

    it('should return zero costs when no data', () => {
      const emptyService = new CostService();
      const summary = emptyService.getCostSummary('monthly');

      expect(summary.totalCost).toBe(0);
      expect(summary.computeCost).toBe(0);
      expect(summary.storageCost).toBe(0);
      expect(summary.networkCost).toBe(0);
      expect(summary.saasCost).toBe(0);
    });

    it('should support different periods', () => {
      const daily = service.getCostSummary('daily');
      const weekly = service.getCostSummary('weekly');
      const quarterly = service.getCostSummary('quarterly');

      expect(daily.period).toBe('daily');
      expect(weekly.period).toBe('weekly');
      expect(quarterly.period).toBe('quarterly');
    });
  });

  // ==================== Cost Breakdown ====================

  describe('getCostBreakdown', () => {
    beforeEach(() => {
      const now = new Date();

      const cloudCosts: CloudResource[] = [
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 200,
          currency: 'USD',
          tags: {},
          timestamp: now,
          tenantId: 'tenant-001',
          environment: 'production',
        },
        {
          id: '2',
          provider: 'alicloud',
          resourceType: 'compute',
          resourceId: 'i-def',
          region: 'cn-hangzhou',
          cost: 100,
          currency: 'USD',
          tags: {},
          timestamp: now,
          tenantId: 'tenant-002',
          environment: 'staging',
        },
      ];

      service.addCloudCosts(cloudCosts);
    });

    it('should break down costs by category', () => {
      const breakdown = service.getCostBreakdown('category');

      expect(breakdown.length).toBeGreaterThan(0);
      const compute = breakdown.find((b) => b.dimensionValue === 'compute');
      expect(compute).toBeDefined();
      expect(compute!.cost).toBe(300);
    });

    it('should break down costs by tenant', () => {
      const breakdown = service.getCostBreakdown('tenant');

      const tenant1 = breakdown.find((b) => b.dimensionValue === 'tenant-001');
      const tenant2 = breakdown.find((b) => b.dimensionValue === 'tenant-002');

      expect(tenant1).toBeDefined();
      expect(tenant1!.cost).toBe(200);
      expect(tenant2).toBeDefined();
      expect(tenant2!.cost).toBe(100);
    });

    it('should break down costs by environment', () => {
      const breakdown = service.getCostBreakdown('environment');

      const prod = breakdown.find((b) => b.dimensionValue === 'production');
      const staging = breakdown.find((b) => b.dimensionValue === 'staging');

      expect(prod).toBeDefined();
      expect(prod!.cost).toBe(200);
      expect(staging).toBeDefined();
      expect(staging!.cost).toBe(100);
    });

    it('should break down costs by provider', () => {
      const breakdown = service.getCostBreakdown('provider');

      const aws = breakdown.find((b) => b.dimensionValue === 'aws');
      const alicloud = breakdown.find((b) => b.dimensionValue === 'alicloud');

      expect(aws).toBeDefined();
      expect(aws!.cost).toBe(200);
      expect(alicloud).toBeDefined();
      expect(alicloud!.cost).toBe(100);
    });

    it('should include percentage calculations', () => {
      const breakdown = service.getCostBreakdown('category');

      const total = breakdown.reduce((sum, b) => sum + b.cost, 0);
      for (const b of breakdown) {
        // Percentages should be between 0 and 100
        expect(b.percentage).toBeGreaterThanOrEqual(0);
        expect(b.percentage).toBeLessThanOrEqual(100);
      }
      // Sum of percentages should be ~100
      const totalPercent = breakdown.reduce((sum, b) => sum + b.percentage, 0);
      expect(totalPercent).toBeCloseTo(100, 0);
    });

    it('should sort by cost descending', () => {
      const breakdown = service.getCostBreakdown('tenant');

      for (let i = 0; i < breakdown.length - 1; i++) {
        expect(breakdown[i].cost).toBeGreaterThanOrEqual(breakdown[i + 1].cost);
      }
    });
  });

  // ==================== Cost Trend ====================

  describe('getCostTrend', () => {
    it('should calculate trend from data points', () => {
      const dataPoints = [
        { date: new Date('2026-04-01'), cost: 100 },
        { date: new Date('2026-04-02'), cost: 120 },
        { date: new Date('2026-04-03'), cost: 110 },
        { date: new Date('2026-04-04'), cost: 150 },
      ];

      const trend = service.getCostTrend(dataPoints);

      expect(trend.points.length).toBe(4);
      expect(trend.overallChangeRate).toBe(50); // (150-100)/100 * 100
      expect(trend.averageCost).toBe(120); // (100+120+110+150)/4
      expect(trend.maxCost).toBe(150);
      expect(trend.minCost).toBe(100);
    });

    it('should calculate change rates between consecutive points', () => {
      const dataPoints = [
        { date: new Date('2026-04-01'), cost: 100 },
        { date: new Date('2026-04-02'), cost: 150 },
      ];

      const trend = service.getCostTrend(dataPoints);

      expect(trend.points[0].changeRate).toBe(0); // First point has no previous
      expect(trend.points[1].changeRate).toBe(50); // (150-100)/100 * 100
    });

    it('should handle empty data', () => {
      const trend = service.getCostTrend([]);

      expect(trend.points.length).toBe(0);
      expect(trend.overallChangeRate).toBe(0);
      expect(trend.averageCost).toBe(0);
      expect(trend.maxCost).toBe(0);
      expect(trend.minCost).toBe(0);
    });

    it('should handle single data point', () => {
      const dataPoints = [
        { date: new Date('2026-04-01'), cost: 100 },
      ];

      const trend = service.getCostTrend(dataPoints);

      expect(trend.points.length).toBe(1);
      expect(trend.overallChangeRate).toBe(0);
      expect(trend.averageCost).toBe(100);
      expect(trend.maxCost).toBe(100);
      expect(trend.minCost).toBe(100);
    });

    it('should sort data points by date', () => {
      const dataPoints = [
        { date: new Date('2026-04-03'), cost: 110 },
        { date: new Date('2026-04-01'), cost: 100 },
        { date: new Date('2026-04-02'), cost: 120 },
      ];

      const trend = service.getCostTrend(dataPoints);

      expect(trend.points[0].date.getTime()).toBeLessThanOrEqual(trend.points[1].date.getTime());
      expect(trend.points[1].date.getTime()).toBeLessThanOrEqual(trend.points[2].date.getTime());
    });
  });

  // ==================== Budget Alerts ====================

  describe('createBudgetAlert', () => {
    it('should create a budget alert', () => {
      const alert = service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
      });

      expect(alert.id).toBeDefined();
      expect(alert.budgetAmount).toBe(1000);
      expect(alert.thresholdPercent).toBe(80);
      expect(alert.triggered).toBe(false);
      expect(alert.currentSpend).toBe(0);
    });

    it('should include optional tenant and environment', () => {
      const alert = service.createBudgetAlert({
        budgetAmount: 500,
        thresholdPercent: 90,
        tenantId: 'tenant-001',
        environment: 'production',
        currency: 'USD',
        period: 'monthly',
      });

      expect(alert.tenantId).toBe('tenant-001');
      expect(alert.environment).toBe('production');
    });
  });

  describe('getBudgetAlerts', () => {
    beforeEach(() => {
      service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
        tenantId: 'tenant-001',
      });

      service.createBudgetAlert({
        budgetAmount: 500,
        thresholdPercent: 90,
        currency: 'USD',
        period: 'monthly',
        tenantId: 'tenant-002',
      });
    });

    it('should return all alerts', () => {
      const alerts = service.getBudgetAlerts();
      expect(alerts.length).toBe(2);
    });

    it('should filter by tenant', () => {
      const alerts = service.getBudgetAlerts({ tenantId: 'tenant-001' });
      expect(alerts.length).toBe(1);
      expect(alerts[0].tenantId).toBe('tenant-001');
    });
  });

  describe('deleteBudgetAlert', () => {
    it('should delete an existing alert', () => {
      const alert = service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
      });

      const result = service.deleteBudgetAlert(alert.id);
      expect(result).toBe(true);

      const alerts = service.getBudgetAlerts();
      expect(alerts.length).toBe(0);
    });

    it('should return false for non-existent alert', () => {
      const result = service.deleteBudgetAlert('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('checkBudgetAlerts', () => {
    it('should trigger alert when spend exceeds threshold', () => {
      // Create alert with $1000 budget, 80% threshold
      service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
      });

      // Add costs totaling $900 (90% of budget)
      const now = new Date();
      service.addCloudCosts([
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 900,
          currency: 'USD',
          tags: {},
          timestamp: now,
        },
      ]);

      const triggered = service.checkBudgetAlerts();

      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0].usagePercent).toBe(90);
      expect(triggered[0].thresholdPercent).toBe(80);
    });

    it('should not trigger alert when below threshold', () => {
      service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
      });

      // Add costs totaling $500 (50% of budget)
      const now = new Date();
      service.addCloudCosts([
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 500,
          currency: 'USD',
          tags: {},
          timestamp: now,
        },
      ]);

      const triggered = service.checkBudgetAlerts();
      expect(triggered.length).toBe(0);
    });

    it('should not trigger the same alert twice', () => {
      service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
      });

      const now = new Date();
      service.addCloudCosts([
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 900,
          currency: 'USD',
          tags: {},
          timestamp: now,
        },
      ]);

      const firstCheck = service.checkBudgetAlerts();
      const secondCheck = service.checkBudgetAlerts();

      expect(firstCheck.length).toBeGreaterThan(0);
      expect(secondCheck.length).toBe(0); // Already triggered
    });

    it('should return empty when no alerts configured', () => {
      const triggered = service.checkBudgetAlerts();
      expect(triggered.length).toBe(0);
    });
  });

  // ==================== Data Management ====================

  describe('getAllData', () => {
    it('should return all cost data', () => {
      const now = new Date();

      service.addCloudCosts([
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 100,
          currency: 'USD',
          tags: {},
          timestamp: now,
        },
      ]);

      service.addK8sCosts([
        {
          id: '2',
          namespace: 'default',
          deployment: 'api',
          cpuCost: 10,
          memoryCost: 20,
          storageCost: 5,
          networkCost: 3,
          totalCost: 38,
          timestamp: now,
        },
      ]);

      service.addSaaSCosts([
        {
          id: '3',
          tool: 'GitLab',
          subscription: 'Premium',
          seats: 10,
          unitCost: 29,
          totalCost: 290,
          billingCycle: 'monthly',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'active',
        },
      ]);

      const data = service.getAllData();

      expect(data.cloud.length).toBe(1);
      expect(data.k8s.length).toBe(1);
      expect(data.saas.length).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all data', () => {
      const now = new Date();

      service.addCloudCosts([
        {
          id: '1',
          provider: 'aws',
          resourceType: 'compute',
          resourceId: 'i-abc',
          region: 'us-east-1',
          cost: 100,
          currency: 'USD',
          tags: {},
          timestamp: now,
        },
      ]);

      service.createBudgetAlert({
        budgetAmount: 1000,
        thresholdPercent: 80,
        currency: 'USD',
        period: 'monthly',
      });

      service.clearAll();

      const data = service.getAllData();
      expect(data.cloud.length).toBe(0);
      expect(data.k8s.length).toBe(0);
      expect(data.saas.length).toBe(0);
      expect(service.getBudgetAlerts().length).toBe(0);
    });
  });
});
