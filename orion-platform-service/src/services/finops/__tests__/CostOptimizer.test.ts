/**
 * TASK-502: CostOptimizer 单元测试
 */

import { CostOptimizer } from '../CostOptimizer';
import { ResourceUtilization } from '../types';

describe('CostOptimizer', () => {
  let optimizer: CostOptimizer;

  beforeEach(() => {
    optimizer = new CostOptimizer();
  });

  // ==================== analyzeOptimization ====================

  describe('analyzeOptimization', () => {
    it('should identify unused resources', () => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Idle Server',
          cpuUtilization: 2,
          memoryUtilization: 1,
          storageUtilization: 3,
          monthlyCost: 200,
          environment: 'staging',
        },
      ];

      const suggestions = optimizer.analyzeOptimization(utilizations);

      expect(suggestions.length).toBeGreaterThan(0);
      const unused = suggestions.find(
        (s) => s.category === 'unused-resources'
      );
      expect(unused).toBeDefined();
      expect(unused!.priority).toBe('critical');
      expect(unused!.estimatedSavings).toBe(200);
    });

    it('should identify underutilized resources', () => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-002',
          resourceType: 'compute',
          resourceName: 'Low Usage Server',
          cpuUtilization: 15,
          memoryUtilization: 20,
          storageUtilization: 40,
          monthlyCost: 240,
          environment: 'production',
        },
      ];

      const suggestions = optimizer.analyzeOptimization(utilizations);

      const rightSizing = suggestions.find(
        (s) => s.category === 'right-sizing'
      );
      expect(rightSizing).toBeDefined();
    });

    it('should identify schedulable resources', () => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-003',
          resourceType: 'compute',
          resourceName: 'Dev Server',
          cpuUtilization: 25,
          memoryUtilization: 30,
          storageUtilization: 50,
          monthlyCost: 120,
          environment: 'development',
        },
      ];

      const suggestions = optimizer.analyzeOptimization(utilizations);

      const scheduling = suggestions.find(
        (s) => s.category === 'scheduling'
      );
      expect(scheduling).toBeDefined();
      expect(scheduling!.priority).toBe('medium');
    });

    it('should not generate suggestions for well-utilized production resources', () => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-004',
          resourceType: 'compute',
          resourceName: 'Busy Server',
          cpuUtilization: 75,
          memoryUtilization: 80,
          storageUtilization: 60,
          monthlyCost: 240,
          environment: 'production',
        },
      ];

      const suggestions = optimizer.analyzeOptimization(utilizations);
      expect(suggestions.length).toBe(0);
    });

    it('should return the generated suggestions', () => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-005',
          resourceType: 'compute',
          resourceName: 'Test',
          cpuUtilization: 3,
          memoryUtilization: 2,
          storageUtilization: 1,
          monthlyCost: 100,
        },
      ];

      const suggestions = optimizer.analyzeOptimization(utilizations);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  // ==================== getRightSizingRecommendations ====================

  describe('getRightSizingRecommendations', () => {
    beforeEach(() => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Over-provisioned',
          cpuUtilization: 10,
          memoryUtilization: 15,
          storageUtilization: 30,
          monthlyCost: 240,
          tenantId: 'tenant-001',
          environment: 'production',
        },
        {
          resourceId: 'res-002',
          resourceType: 'compute',
          resourceName: 'Another Server',
          cpuUtilization: 20,
          memoryUtilization: 25,
          storageUtilization: 50,
          monthlyCost: 120,
          tenantId: 'tenant-002',
          environment: 'staging',
        },
        {
          resourceId: 'res-003',
          resourceType: 'compute',
          resourceName: 'Well Utilized',
          cpuUtilization: 70,
          memoryUtilization: 75,
          storageUtilization: 60,
          monthlyCost: 120,
        },
      ];

      // Add data to optimizer via analyzeOptimization
      optimizer.analyzeOptimization(utilizations);
    });

    it('should return right-sizing recommendations for underutilized resources', () => {
      const recommendations = optimizer.getRightSizingRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      // Well-utilized resources should not be recommended
      const wellUtilized = recommendations.find(
        (r) => r.resourceId === 'res-003'
      );
      expect(wellUtilized).toBeUndefined();
    });

    it('should filter by tenant', () => {
      const recommendations = optimizer.getRightSizingRecommendations({
        tenantId: 'tenant-001',
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tenantId).toBe('tenant-001');
    });

    it('should filter by environment', () => {
      const recommendations = optimizer.getRightSizingRecommendations({
        environment: 'staging',
      });

      for (const rec of recommendations) {
        expect(rec.tenantId).toBe('tenant-002');
      }
    });

    it('should sort by savings descending', () => {
      const recommendations = optimizer.getRightSizingRecommendations();

      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].estimatedSavings).toBeGreaterThanOrEqual(
          recommendations[i + 1].estimatedSavings
        );
      }
    });
  });

  // ==================== detectUnusedResources ====================

  describe('detectUnusedResources', () => {
    beforeEach(() => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-unused-1',
          resourceType: 'compute',
          resourceName: 'Completely Idle',
          cpuUtilization: 1,
          memoryUtilization: 2,
          storageUtilization: 0,
          monthlyCost: 150,
          tenantId: 'tenant-001',
        },
        {
          resourceId: 'res-active-1',
          resourceType: 'compute',
          resourceName: 'Active Server',
          cpuUtilization: 60,
          memoryUtilization: 55,
          storageUtilization: 40,
          monthlyCost: 240,
        },
      ];

      optimizer.analyzeOptimization(utilizations);
    });

    it('should detect unused resources', () => {
      const unused = optimizer.detectUnusedResources();

      expect(unused.length).toBe(1);
      expect(unused[0].resourceId).toBe('res-unused-1');
    });

    it('should filter by tenant', () => {
      const unused = optimizer.detectUnusedResources({
        tenantId: 'non-existent',
      });

      expect(unused.length).toBe(0);
    });

    it('should return empty when no unused resources', () => {
      const newOptimizer = new CostOptimizer();
      newOptimizer.analyzeOptimization([
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Busy',
          cpuUtilization: 70,
          memoryUtilization: 60,
          storageUtilization: 50,
          monthlyCost: 200,
        },
      ]);

      const unused = newOptimizer.detectUnusedResources();
      expect(unused.length).toBe(0);
    });
  });

  // ==================== estimateSavings ====================

  describe('estimateSavings', () => {
    beforeEach(() => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Idle',
          cpuUtilization: 2,
          memoryUtilization: 1,
          storageUtilization: 0,
          monthlyCost: 200,
        },
        {
          resourceId: 'res-002',
          resourceType: 'compute',
          resourceName: 'Low Usage',
          cpuUtilization: 15,
          memoryUtilization: 20,
          storageUtilization: 30,
          monthlyCost: 240,
        },
      ];

      optimizer.analyzeOptimization(utilizations);
    });

    it('should estimate total savings', () => {
      const savings = optimizer.estimateSavings();

      expect(savings.totalMonthlySavings).toBeGreaterThan(0);
      expect(savings.totalAnnualSavings).toBe(
        savings.totalMonthlySavings * 12
      );
      expect(savings.suggestionCount).toBeGreaterThan(0);
    });

    it('should break down savings by category', () => {
      const savings = optimizer.estimateSavings();

      expect(Object.keys(savings.byCategory).length).toBeGreaterThan(0);
      const categoryTotal = Object.values(savings.byCategory).reduce(
        (sum, v) => sum + v,
        0
      );
      expect(categoryTotal).toBeCloseTo(savings.totalMonthlySavings, 0);
    });

    it('should filter by category', () => {
      const all = optimizer.estimateSavings();
      const filtered = optimizer.estimateSavings({
        category: 'unused-resources',
      });

      expect(filtered.suggestionCount).toBeLessThanOrEqual(all.suggestionCount);
    });

    it('should filter by status', () => {
      const identified = optimizer.estimateSavings({
        status: 'identified',
      });

      expect(identified.suggestionCount).toBeGreaterThan(0);
    });
  });

  // ==================== getOptimizations ====================

  describe('getOptimizations', () => {
    beforeEach(() => {
      const utilizations: ResourceUtilization[] = [
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Idle Server',
          cpuUtilization: 1,
          memoryUtilization: 1,
          storageUtilization: 0,
          monthlyCost: 100,
        },
        {
          resourceId: 'res-002',
          resourceType: 'compute',
          resourceName: 'Underutilized',
          cpuUtilization: 15,
          memoryUtilization: 20,
          storageUtilization: 30,
          monthlyCost: 200,
        },
      ];

      optimizer.analyzeOptimization(utilizations);
    });

    it('should return all optimizations', () => {
      const optimizations = optimizer.getOptimizations();
      expect(optimizations.length).toBeGreaterThan(0);
    });

    it('should filter by category', () => {
      const unused = optimizer.getOptimizations({
        category: 'unused-resources',
      });

      for (const opt of unused) {
        expect(opt.category).toBe('unused-resources');
      }
    });

    it('should filter by priority', () => {
      const critical = optimizer.getOptimizations({ priority: 'critical' });

      for (const opt of critical) {
        expect(opt.priority).toBe('critical');
      }
    });

    it('should filter by status', () => {
      const identified = optimizer.getOptimizations({ status: 'identified' });

      for (const opt of identified) {
        expect(opt.status).toBe('identified');
      }
    });

    it('should sort by priority', () => {
      const optimizations = optimizer.getOptimizations();
      const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      for (let i = 0; i < optimizations.length - 1; i++) {
        expect(priorityOrder[optimizations[i].priority]).toBeLessThanOrEqual(
          priorityOrder[optimizations[i + 1].priority]
        );
      }
    });
  });

  // ==================== Update Status ====================

  describe('updateOptimizationStatus', () => {
    let optimizationId: string;

    beforeEach(() => {
      const suggestions = optimizer.analyzeOptimization([
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Test',
          cpuUtilization: 2,
          memoryUtilization: 1,
          storageUtilization: 0,
          monthlyCost: 100,
        },
      ]);
      optimizationId = suggestions[0].id;
    });

    it('should update status', () => {
      const updated = optimizer.updateOptimizationStatus(
        optimizationId,
        'approved'
      );

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('approved');
    });

    it('should set updatedAt', () => {
      const updated = optimizer.updateOptimizationStatus(
        optimizationId,
        'in-progress'
      );

      expect(updated!.updatedAt).toBeDefined();
    });

    it('should return null for non-existent', () => {
      const updated = optimizer.updateOptimizationStatus(
        'non-existent',
        'approved'
      );
      expect(updated).toBeNull();
    });
  });

  // ==================== Delete Optimization ====================

  describe('deleteOptimization', () => {
    let optimizationId: string;

    beforeEach(() => {
      const suggestions = optimizer.analyzeOptimization([
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Test',
          cpuUtilization: 2,
          memoryUtilization: 1,
          storageUtilization: 0,
          monthlyCost: 100,
        },
      ]);
      optimizationId = suggestions[0].id;
    });

    it('should delete an optimization', () => {
      const deleted = optimizer.deleteOptimization(optimizationId);
      expect(deleted).toBe(true);

      const optimizations = optimizer.getOptimizations();
      expect(optimizations.find((o) => o.id === optimizationId)).toBeUndefined();
    });

    it('should return false for non-existent', () => {
      const deleted = optimizer.deleteOptimization('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      optimizer.analyzeOptimization([
        {
          resourceId: 'res-001',
          resourceType: 'compute',
          resourceName: 'Test',
          cpuUtilization: 2,
          memoryUtilization: 1,
          storageUtilization: 0,
          monthlyCost: 100,
        },
      ]);

      optimizer.clearAll();

      expect(optimizer.getOptimizations().length).toBe(0);
      expect(optimizer.getRightSizingRecommendations().length).toBe(0);
    });
  });
});
