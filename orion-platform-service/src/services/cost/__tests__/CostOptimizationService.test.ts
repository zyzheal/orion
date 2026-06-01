/**
 * Tests for CostOptimizationService
 *
 * NOTE: CostOptimizationService uses module-level Map stores, so each test
 * must use a unique tenant ID to avoid cross-test contamination.
 */

import { CostOptimizationService, UtilizationRecord } from '../CostOptimizationService';

describe('CostOptimizationService', () => {
  let service: CostOptimizationService;
  let tenantCounter = 0;

  function nextTenant(): string {
    return `t_${++tenantCounter}`;
  }

  beforeEach(() => {
    service = new CostOptimizationService(null);
  });

  function makeUtilRecord(overrides: Partial<UtilizationRecord> = {}): UtilizationRecord {
    return {
      resourceId: 'res-001',
      resourceType: 'vm',
      resourceName: 'web-server-1',
      cpuUtilization: 50,
      memoryUtilization: 60,
      storageUtilization: 40,
      monthlyCost: 200,
      tenantId: 'unused',
      environment: 'production',
      ...overrides,
    };
  }

  // ==================== recordUtilization ====================

  describe('recordUtilization', () => {
    it('should record a new utilization entry', async () => {
      const tid = nextTenant();
      const record = makeUtilRecord({ tenantId: tid });

      const result = await service.recordUtilization(tid, record);

      expect(result).toEqual(record);
    });

    it('should update existing record for same resource', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, cpuUtilization: 30 }));
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, cpuUtilization: 80 }));

      const records = await service.getUtilizationRecords(tid);
      expect(records).toHaveLength(1);
      expect(records[0].cpuUtilization).toBe(80);
    });

    it('should keep separate records for different resources', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, resourceId: 'res-1' }));
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, resourceId: 'res-2' }));

      const records = await service.getUtilizationRecords(tid);
      expect(records).toHaveLength(2);
    });

    it('should keep separate records for different tenants', async () => {
      const tid1 = nextTenant();
      const tid2 = nextTenant();
      await service.recordUtilization(tid1, makeUtilRecord({ tenantId: tid1, resourceId: 'res-1' }));
      await service.recordUtilization(tid2, makeUtilRecord({ tenantId: tid2, resourceId: 'res-1' }));

      expect(await service.getUtilizationRecords(tid1)).toHaveLength(1);
      expect(await service.getUtilizationRecords(tid2)).toHaveLength(1);
    });
  });

  // ==================== analyzeResourceUtilization ====================

  describe('analyzeResourceUtilization', () => {
    it('should return empty analysis for no records', async () => {
      const result = await service.analyzeResourceUtilization(nextTenant());

      expect(result.totalResources).toBe(0);
      expect(result.underutilizedResources).toBe(0);
      expect(result.unusedResources).toBe(0);
      expect(result.optimalResources).toBe(0);
      expect(result.potentialMonthlySavings).toBe(0);
    });

    it('should classify unused resources (cpu<5, mem<5, storage<5)', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 2,
        memoryUtilization: 3,
        storageUtilization: 1,
        monthlyCost: 100,
      }));

      const result = await service.analyzeResourceUtilization(tid);

      expect(result.unusedResources).toBe(1);
      expect(result.underutilizedResources).toBe(0);
      expect(result.optimalResources).toBe(0);
      expect(result.potentialMonthlySavings).toBe(100);
      expect(result.byCategory['unused-resources']).toBe(1);
    });

    it('should classify underutilized resources (cpu<30 or mem<30)', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 15,
        memoryUtilization: 60,
        monthlyCost: 200,
      }));

      const result = await service.analyzeResourceUtilization(tid);

      expect(result.underutilizedResources).toBe(1);
      expect(result.unusedResources).toBe(0);
      expect(result.optimalResources).toBe(0);
      expect(result.potentialMonthlySavings).toBe(60); // 200 * 0.3
      expect(result.byCategory['right-sizing']).toBe(1);
    });

    it('should classify optimal resources', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 70,
        memoryUtilization: 65,
        storageUtilization: 50,
        monthlyCost: 300,
      }));

      const result = await service.analyzeResourceUtilization(tid);

      expect(result.optimalResources).toBe(1);
      expect(result.underutilizedResources).toBe(0);
      expect(result.unusedResources).toBe(0);
    });

    it('should handle mixed resource types', async () => {
      const tid = nextTenant();
      // Unused
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r1',
        cpuUtilization: 1,
        memoryUtilization: 2,
        storageUtilization: 1,
        monthlyCost: 50,
      }));
      // Underutilized
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r2',
        cpuUtilization: 20,
        memoryUtilization: 80,
        monthlyCost: 200,
      }));
      // Optimal
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r3',
        cpuUtilization: 70,
        memoryUtilization: 60,
        monthlyCost: 300,
      }));

      const result = await service.analyzeResourceUtilization(tid);

      expect(result.totalResources).toBe(3);
      expect(result.unusedResources).toBe(1);
      expect(result.underutilizedResources).toBe(1);
      expect(result.optimalResources).toBe(1);
      expect(result.potentialMonthlySavings).toBe(110); // 50 (unused) + 200*0.3 (under)
    });

    it('should round potential savings to 2 decimals', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 10,
        memoryUtilization: 80,
        monthlyCost: 33.33,
      }));

      const result = await service.analyzeResourceUtilization(tid);

      expect(result.potentialMonthlySavings).toBe(10); // 33.33 * 0.3 = 9.999 -> 10.00
    });
  });

  // ==================== generateSuggestions ====================

  describe('generateSuggestions', () => {
    it('should generate unused-resource suggestion', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'dead-vm',
        resourceName: 'Dead VM',
        cpuUtilization: 1,
        memoryUtilization: 2,
        storageUtilization: 1,
        monthlyCost: 100,
      }));

      const suggestions = await service.generateSuggestions(tid);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].category).toBe('unused-resources');
      expect(suggestions[0].priority).toBe('critical');
      expect(suggestions[0].estimatedSavings).toBe(100);
      expect(suggestions[0].resourceIds).toContain('dead-vm');
    });

    it('should generate right-sizing suggestion with high priority for large savings', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'vm-1',
        cpuUtilization: 10,
        memoryUtilization: 80,
        monthlyCost: 500,
      }));

      const suggestions = await service.generateSuggestions(tid);

      const rightSize = suggestions.find(s => s.category === 'right-sizing');
      expect(rightSize).toBeDefined();
      expect(rightSize!.priority).toBe('high'); // 500*0.3=150 > 100
      expect(rightSize!.estimatedSavings).toBe(150);
    });

    it('should generate right-sizing suggestion with medium priority for small savings', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'vm-2',
        cpuUtilization: 10,
        memoryUtilization: 80,
        monthlyCost: 100,
      }));

      const suggestions = await service.generateSuggestions(tid);

      const rightSize = suggestions.find(s => s.category === 'right-sizing');
      expect(rightSize!.priority).toBe('medium'); // 100*0.3=30 < 100
    });

    it('should generate scheduling suggestion for non-production with low CPU', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'dev-vm',
        cpuUtilization: 30,
        memoryUtilization: 60,
        environment: 'development',
        monthlyCost: 100,
      }));

      const suggestions = await service.generateSuggestions(tid);

      const scheduling = suggestions.find(s => s.category === 'scheduling');
      expect(scheduling).toBeDefined();
      expect(scheduling!.estimatedSavings).toBe(40); // 100 * 0.4
    });

    it('should not generate scheduling suggestion for production', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 30,
        memoryUtilization: 60,
        environment: 'production',
      }));

      const suggestions = await service.generateSuggestions(tid);

      const scheduling = suggestions.find(s => s.category === 'scheduling');
      expect(scheduling).toBeUndefined();
    });

    it('should store suggestions for later retrieval', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 50,
      }));

      await service.generateSuggestions(tid);
      const stored = await service.getOptimizationSuggestions(tid);

      expect(stored).toHaveLength(1);
    });

    it('should return empty for no records', async () => {
      const suggestions = await service.generateSuggestions(nextTenant());
      expect(suggestions).toEqual([]);
    });
  });

  // ==================== getOptimizationSuggestions ====================

  describe('getOptimizationSuggestions', () => {
    it('should filter out rejected suggestions', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 50,
      }));
      const generated = await service.generateSuggestions(tid);
      await service.rejectSuggestion(tid, generated[0].id);

      const result = await service.getOptimizationSuggestions(tid);

      expect(result).toHaveLength(0);
    });

    it('should filter by category', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r1',
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 50,
      }));
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r2',
        cpuUtilization: 10,
        memoryUtilization: 80,
        monthlyCost: 200,
        environment: 'staging',
      }));
      await service.generateSuggestions(tid);

      const result = await service.getOptimizationSuggestions(tid, {
        category: 'unused-resources',
      });

      expect(result.every(s => s.category === 'unused-resources')).toBe(true);
    });

    it('should filter by minimum savings', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r1',
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 50,
      }));
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r2',
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 500,
      }));
      await service.generateSuggestions(tid);

      const result = await service.getOptimizationSuggestions(tid, {
        minSavings: 100,
      });

      expect(result.every(s => s.estimatedSavings >= 100)).toBe(true);
    });

    it('should sort by priority (critical first)', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r1',
        cpuUtilization: 10,
        memoryUtilization: 80,
        monthlyCost: 200,
        environment: 'staging',
      }));
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        resourceId: 'r2',
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 50,
      }));
      await service.generateSuggestions(tid);

      const result = await service.getOptimizationSuggestions(tid);

      // Should have suggestions; critical should come before medium
      const priorities = result.map(s => s.priority);
      const criticalIdx = priorities.indexOf('critical');
      const mediumIdx = priorities.indexOf('medium');
      if (criticalIdx >= 0 && mediumIdx >= 0) {
        expect(criticalIdx).toBeLessThan(mediumIdx);
      }
    });

    it('should return empty array for unknown tenant', async () => {
      const result = await service.getOptimizationSuggestions('nonexistent_tenant_xyz');
      expect(result).toEqual([]);
    });
  });

  // ==================== applySuggestion / rejectSuggestion ====================

  describe('applySuggestion', () => {
    it('should set status to applied', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
        monthlyCost: 50,
      }));
      const suggestions = await service.generateSuggestions(tid);

      const result = await service.applySuggestion(tid, suggestions[0].id);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('applied');
      expect(result!.updatedAt).toBeDefined();
    });

    it('should return null for non-existent suggestion', async () => {
      const result = await service.applySuggestion(nextTenant(), 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for wrong tenant', async () => {
      const tid = nextTenant();
      const tid2 = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
      }));
      const suggestions = await service.generateSuggestions(tid);

      const result = await service.applySuggestion(tid2, suggestions[0].id);
      expect(result).toBeNull();
    });
  });

  describe('rejectSuggestion', () => {
    it('should set status to rejected', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({
        tenantId: tid,
        cpuUtilization: 1,
        memoryUtilization: 1,
        storageUtilization: 1,
      }));
      const suggestions = await service.generateSuggestions(tid);

      const result = await service.rejectSuggestion(tid, suggestions[0].id);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('rejected');
    });

    it('should return null for non-existent suggestion', async () => {
      const result = await service.rejectSuggestion(nextTenant(), 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // ==================== getCostMetrics ====================

  describe('getCostMetrics', () => {
    it('should return zero metrics in no-DB mode', async () => {
      const result = await service.getCostMetrics({});

      expect(result.totalCost).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.costByModel).toEqual({});
    });
  });

  // ==================== clearUtilizationRecords ====================

  describe('clearUtilizationRecords', () => {
    it('should clear all records for a tenant', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid }));
      await service.clearUtilizationRecords(tid);

      const records = await service.getUtilizationRecords(tid);
      expect(records).toEqual([]);
    });

    it('should not affect other tenants', async () => {
      const tid1 = nextTenant();
      const tid2 = nextTenant();
      await service.recordUtilization(tid1, makeUtilRecord({ tenantId: tid1, resourceId: 'r1' }));
      await service.recordUtilization(tid2, makeUtilRecord({ tenantId: tid2, resourceId: 'r2' }));
      await service.clearUtilizationRecords(tid1);

      expect(await service.getUtilizationRecords(tid2)).toHaveLength(1);
    });
  });

  // ==================== getUtilizationRecords ====================

  describe('getUtilizationRecords', () => {
    it('should return empty array for unknown tenant', async () => {
      const result = await service.getUtilizationRecords('unknown_tenant_xyz');
      expect(result).toEqual([]);
    });

    it('should return all recorded entries', async () => {
      const tid = nextTenant();
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, resourceId: 'r1' }));
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, resourceId: 'r2' }));
      await service.recordUtilization(tid, makeUtilRecord({ tenantId: tid, resourceId: 'r3' }));

      const result = await service.getUtilizationRecords(tid);
      expect(result).toHaveLength(3);
    });
  });
});
