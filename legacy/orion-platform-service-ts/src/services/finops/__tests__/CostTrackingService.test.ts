/**
 * TASK-502: CostTrackingService 单元测试
 */

import { CostTrackingService } from '../CostTrackingService';

describe('CostTrackingService', () => {
  let service: CostTrackingService;

  beforeEach(() => {
    service = new CostTrackingService();
  });

  // ==================== Track Costs ====================

  describe('trackProjectCost', () => {
    it('should record a project cost', () => {
      const record = service.trackProjectCost({
        projectId: 'proj-001',
        amount: 500,
        category: 'compute',
        environment: 'production',
      });

      expect(record.id).toBeDefined();
      expect(record.entityType).toBe('project');
      expect(record.entityId).toBe('proj-001');
      expect(record.amount).toBe(500);
      expect(record.category).toBe('compute');
      expect(record.environment).toBe('production');
      expect(record.currency).toBe('USD');
    });

    it('should use default currency', () => {
      const record = service.trackProjectCost({
        projectId: 'proj-001',
        amount: 100,
        category: 'storage',
      });

      expect(record.currency).toBe('USD');
    });

    it('should use provided timestamp', () => {
      const customDate = new Date('2026-01-01');
      const record = service.trackProjectCost({
        projectId: 'proj-001',
        amount: 100,
        category: 'compute',
        timestamp: customDate,
      });

      expect(record.timestamp.getTime()).toBe(customDate.getTime());
    });
  });

  describe('trackTenantCost', () => {
    it('should record a tenant cost', () => {
      const record = service.trackTenantCost({
        tenantId: 'tenant-001',
        amount: 1000,
        category: 'network',
        tags: { department: 'engineering' },
      });

      expect(record.entityType).toBe('tenant');
      expect(record.entityId).toBe('tenant-001');
      expect(record.amount).toBe(1000);
      expect(record.tags).toEqual({ department: 'engineering' });
    });
  });

  describe('trackTeamCost', () => {
    it('should record a team cost', () => {
      const record = service.trackTeamCost({
        teamId: 'team-alpha',
        amount: 250,
        category: 'tooling',
      });

      expect(record.entityType).toBe('team');
      expect(record.entityId).toBe('team-alpha');
      expect(record.amount).toBe(250);
    });
  });

  // ==================== Get Cost By Entity ====================

  describe('getCostByEntity', () => {
    beforeEach(() => {
      const now = new Date();

      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 100,
        category: 'compute',
        timestamp: now,
      });

      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 200,
        category: 'storage',
        timestamp: now,
      });

      service.trackProjectCost({
        projectId: 'proj-002',
        amount: 300,
        category: 'compute',
        timestamp: now,
      });
    });

    it('should return cost summary for a project', () => {
      const summary = service.getCostByEntity('project', 'proj-001');

      expect(summary.entityType).toBe('project');
      expect(summary.entityId).toBe('proj-001');
      expect(summary.totalCost).toBe(300);
      expect(summary.recordCount).toBe(2);
      expect(summary.breakdown.compute).toBe(100);
      expect(summary.breakdown.storage).toBe(200);
    });

    it('should return zero for entity with no costs', () => {
      const summary = service.getCostByEntity('project', 'proj-999');

      expect(summary.totalCost).toBe(0);
      expect(summary.recordCount).toBe(0);
    });

    it('should support tenant entity type', () => {
      service.trackTenantCost({
        tenantId: 'tenant-001',
        amount: 500,
        category: 'compute',
      });

      const summary = service.getCostByEntity('tenant', 'tenant-001');

      expect(summary.entityType).toBe('tenant');
      expect(summary.entityId).toBe('tenant-001');
      expect(summary.totalCost).toBe(500);
    });

    it('should support team entity type', () => {
      service.trackTeamCost({
        teamId: 'team-alpha',
        amount: 150,
        category: 'tooling',
      });

      const summary = service.getCostByEntity('team', 'team-alpha');

      expect(summary.entityType).toBe('team');
      expect(summary.totalCost).toBe(150);
    });
  });

  // ==================== Cost Trend ====================

  describe('getCostTrend', () => {
    beforeEach(() => {
      // Use dates at fixed UTC noon, each on separate days, all safely in the past
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const d = now.getUTCDate();
      const d1 = new Date(Date.UTC(y, m, d - 5, 12, 0, 0));
      const d2 = new Date(Date.UTC(y, m, d - 4, 12, 0, 0));
      const d3 = new Date(Date.UTC(y, m, d - 3, 12, 0, 0));
      const d4 = new Date(Date.UTC(y, m, d - 2, 12, 0, 0));

      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 100,
        category: 'compute',
        timestamp: d1,
      });
      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 150,
        category: 'compute',
        timestamp: d2,
      });
      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 120,
        category: 'compute',
        timestamp: d3,
      });
      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 200,
        category: 'storage',
        timestamp: d4,
      });
    });

    it('should calculate cost trend for an entity', () => {
      const trend = service.getCostTrend({
        entityType: 'project',
        entityId: 'proj-001',
        period: 'monthly',
      });

      expect(trend.points.length).toBeGreaterThan(0);
      expect(trend.maxCost).toBe(200);
      expect(trend.minCost).toBe(100);
    });

    it('should filter by category', () => {
      const trend = service.getCostTrend({
        entityType: 'project',
        entityId: 'proj-001',
        period: 'monthly',
        category: 'compute',
      });

      // Should only include compute costs: 100, 150, 120
      expect(trend.points.length).toBe(3);
      expect(trend.maxCost).toBe(150);
    });

    it('should return empty trend when no data', () => {
      const trend = service.getCostTrend({
        entityType: 'project',
        entityId: 'nonexistent',
        period: 'monthly',
      });

      expect(trend.points.length).toBe(0);
      expect(trend.overallChangeRate).toBe(0);
    });
  });

  // ==================== Chargeback Report ====================

  describe('getChargebackReport', () => {
    beforeEach(() => {
      const now = new Date();

      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 400,
        category: 'compute',
        timestamp: now,
      });

      service.trackTenantCost({
        tenantId: 'tenant-001',
        amount: 300,
        category: 'storage',
        timestamp: now,
      });

      service.trackTeamCost({
        teamId: 'team-alpha',
        amount: 100,
        category: 'tooling',
        timestamp: now,
      });
    });

    it('should generate chargeback report with all entities', () => {
      const report = service.getChargebackReport('monthly');

      expect(report.totalCost).toBe(800);
      expect(report.entities.length).toBe(3);
      expect(report.currency).toBe('USD');
    });

    it('should calculate correct percentages', () => {
      const report = service.getChargebackReport('monthly');

      const totalPercent = report.entities.reduce(
        (sum, e) => sum + e.percentage,
        0
      );
      expect(totalPercent).toBeCloseTo(100, 0);
    });

    it('should sort entities by cost descending', () => {
      const report = service.getChargebackReport('monthly');

      for (let i = 0; i < report.entities.length - 1; i++) {
        expect(report.entities[i].cost).toBeGreaterThanOrEqual(
          report.entities[i + 1].cost
        );
      }
    });

    it('should include breakdown per entity', () => {
      const report = service.getChargebackReport('monthly');

      const project = report.entities.find(
        (e) => e.entityId === 'proj-001'
      );
      expect(project).toBeDefined();
      expect(project!.breakdown.compute).toBe(400);
    });

    it('should return empty report when no data', () => {
      const emptyService = new CostTrackingService();
      const report = emptyService.getChargebackReport('monthly');

      expect(report.totalCost).toBe(0);
      expect(report.entities.length).toBe(0);
    });
  });

  // ==================== Get All Records ====================

  describe('getAllRecords', () => {
    beforeEach(() => {
      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 100,
        category: 'compute',
      });

      service.trackTenantCost({
        tenantId: 'tenant-001',
        amount: 200,
        category: 'storage',
      });

      service.trackTeamCost({
        teamId: 'team-alpha',
        amount: 50,
        category: 'tooling',
      });
    });

    it('should return all records', () => {
      const records = service.getAllRecords();
      expect(records.length).toBe(3);
    });

    it('should filter by entity type', () => {
      const records = service.getAllRecords({ entityType: 'project' });
      expect(records.length).toBe(1);
      expect(records[0].entityType).toBe('project');
    });

    it('should filter by entity ID', () => {
      const records = service.getAllRecords({ entityId: 'tenant-001' });
      expect(records.length).toBe(1);
    });

    it('should filter by category', () => {
      const records = service.getAllRecords({ category: 'compute' });
      expect(records.length).toBe(1);
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should clear all records', () => {
      service.trackProjectCost({
        projectId: 'proj-001',
        amount: 100,
        category: 'compute',
      });

      service.clearAll();

      const records = service.getAllRecords();
      expect(records.length).toBe(0);
    });
  });
});
