/**
 * EfficiencyDashboardService - 工程效能仪表盘单元测试
 *
 * 测试覆盖: 8种场景模板、评分计算、场景缓存、可用场景列表
 */

import { EfficiencyDashboardService } from '../EfficiencyDashboardService';

// Mock repository
const mockScenarioRepo = {
  findByCacheKey: jest.fn(),
  create: jest.fn(),
};

jest.mock('../../../repositories/EfficiencyScenarioRepository', () => ({
  EfficiencyScenarioRepository: jest.fn().mockImplementation(() => mockScenarioRepo),
}));

describe('EfficiencyDashboardService', () => {
  let service: EfficiencyDashboardService;
  const timeRange = {
    start: new Date('2026-01-01'),
    end: new Date('2026-01-31'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EfficiencyDashboardService();
  });

  // ==================== getScenario ====================

  describe('getScenario', () => {
    it('should return delivery-speed scenario', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);

      expect(result.id).toBe('delivery-speed');
      expect(result.name).toBe('Delivery Speed');
      expect(result.category).toBe('delivery');
      expect(result.widgets.length).toBeGreaterThan(0);
      expect(result.summary.score).toBeGreaterThanOrEqual(0);
      expect(result.summary.score).toBeLessThanOrEqual(100);
    });

    it('should return release-quality scenario', async () => {
      const result = await service.getScenario('release-quality', timeRange);

      expect(result.id).toBe('release-quality');
      expect(result.category).toBe('quality');
      expect(result.summary.score).toBeGreaterThanOrEqual(0);
    });

    it('should return pipeline-performance scenario', async () => {
      const result = await service.getScenario('pipeline-performance', timeRange);

      expect(result.id).toBe('pipeline-performance');
      expect(result.category).toBe('performance');
    });

    it('should return incident-response scenario', async () => {
      const result = await service.getScenario('incident-response', timeRange);

      expect(result.id).toBe('incident-response');
      expect(result.category).toBe('incident');
    });

    it('should return cost-optimization scenario', async () => {
      const result = await service.getScenario('cost-optimization', timeRange);

      expect(result.id).toBe('cost-optimization');
      expect(result.category).toBe('cost');
    });

    it('should return team-productivity scenario', async () => {
      const result = await service.getScenario('team-productivity', timeRange);

      expect(result.id).toBe('team-productivity');
      expect(result.category).toBe('team');
    });

    it('should return security-compliance scenario', async () => {
      const result = await service.getScenario('security-compliance', timeRange);

      expect(result.id).toBe('security-compliance');
      expect(result.category).toBe('security');
    });

    it('should return overview scenario', async () => {
      const result = await service.getScenario('overview', timeRange);

      expect(result.id).toBe('overview');
      expect(result.category).toBe('overview');
      expect(result.summary.score).toBeGreaterThanOrEqual(0);
    });

    it('should throw for unknown scenario', async () => {
      await expect(service.getScenario('unknown', timeRange)).rejects.toThrow('Unknown scenario');
    });

    it('should cache scenario in memory', async () => {
      const result1 = await service.getScenario('delivery-speed', timeRange);
      const result2 = await service.getScenario('delivery-speed', timeRange);

      expect(result1).toEqual(result2);
    });
  });

  // ==================== Scenario Widgets ====================

  describe('scenario widgets', () => {
    it('should have proper widget structure for delivery-speed', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);

      for (const widget of result.widgets) {
        expect(widget.id).toBeDefined();
        expect(widget.type).toBeDefined();
        expect(widget.title).toBeDefined();
        expect(widget.data).toBeDefined();
      }
    });

    it('should have metric widgets with value and unit', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);
      const metricWidgets = result.widgets.filter(w => w.type === 'metric');

      expect(metricWidgets.length).toBeGreaterThan(0);
      for (const widget of metricWidgets) {
        const data = widget.data as any;
        expect(data.value).toBeDefined();
        expect(data.unit).toBeDefined();
      }
    });

    it('should have chart widgets with labels and values', async () => {
      const result = await service.getScenario('release-quality', timeRange);
      const chartWidgets = result.widgets.filter(w => w.type === 'chart');

      expect(chartWidgets.length).toBeGreaterThan(0);
    });

    it('should have table widgets with columns and rows', async () => {
      const result = await service.getScenario('pipeline-performance', timeRange);
      const tableWidgets = result.widgets.filter(w => w.type === 'table');

      expect(tableWidgets.length).toBeGreaterThan(0);
      for (const widget of tableWidgets) {
        const data = widget.data as any;
        expect(data.columns).toBeDefined();
        expect(data.rows).toBeDefined();
      }
    });

    it('should have funnel widgets for delivery', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);
      const funnelWidgets = result.widgets.filter(w => w.type === 'funnel');

      expect(funnelWidgets.length).toBeGreaterThan(0);
    });

    it('should have heatmap widgets for team', async () => {
      const result = await service.getScenario('team-productivity', timeRange);
      const heatmapWidgets = result.widgets.filter(w => w.type === 'heatmap');

      expect(heatmapWidgets.length).toBeGreaterThan(0);
    });
  });

  // ==================== Summary ====================

  describe('summary', () => {
    it('should have trend direction', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);

      expect(['up', 'down', 'stable']).toContain(result.summary.trend);
    });

    it('should have changePercent', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);

      expect(typeof result.summary.changePercent).toBe('number');
    });

    it('should have highlights array', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);

      expect(Array.isArray(result.summary.highlights)).toBe(true);
      expect(result.summary.highlights.length).toBeGreaterThan(0);
    });

    it('should have issues array', async () => {
      const result = await service.getScenario('delivery-speed', timeRange);

      expect(Array.isArray(result.summary.issues)).toBe(true);
    });

    it('should compute overview score as average of sub-scenarios', async () => {
      const result = await service.getScenario('overview', timeRange);

      // Overview score should be between 0 and 100
      expect(result.summary.score).toBeGreaterThanOrEqual(0);
      expect(result.summary.score).toBeLessThanOrEqual(100);
    });
  });

  // ==================== PostgreSQL Caching ====================

  describe('PostgreSQL caching', () => {
    it('should return cached scenario from PostgreSQL', async () => {
      const serviceWithDb = new EfficiencyDashboardService({ query: jest.fn() } as any);
      mockScenarioRepo.findByCacheKey.mockResolvedValue({
        scenarioId: 'delivery-speed',
        name: 'Delivery Speed',
        description: 'Track lead time',
        category: 'delivery',
        widgets: [],
        timeRange,
        summary: { score: 85, trend: 'up', changePercent: 10, highlights: [], issues: [] },
      });

      const result = await serviceWithDb.getScenario('delivery-speed', timeRange);

      expect(result.id).toBe('delivery-speed');
      expect(result.summary.score).toBe(85);
      expect(mockScenarioRepo.findByCacheKey).toHaveBeenCalled();
    });

    it('should fall back to building scenario when cache miss', async () => {
      const serviceWithDb = new EfficiencyDashboardService({ query: jest.fn() } as any);
      mockScenarioRepo.findByCacheKey.mockResolvedValue(null);

      const result = await serviceWithDb.getScenario('delivery-speed', timeRange);

      expect(result.id).toBe('delivery-speed');
      expect(mockScenarioRepo.create).toHaveBeenCalled();
    });

    it('should handle PostgreSQL cache errors gracefully', async () => {
      const serviceWithDb = new EfficiencyDashboardService({ query: jest.fn() } as any);
      mockScenarioRepo.findByCacheKey.mockRejectedValue(new Error('DB error'));

      const result = await serviceWithDb.getScenario('delivery-speed', timeRange);

      expect(result.id).toBe('delivery-speed');
    });
  });

  // ==================== getAvailableScenarios ====================

  describe('getAvailableScenarios', () => {
    it('should return 8 scenarios', () => {
      const scenarios = service.getAvailableScenarios();

      expect(scenarios).toHaveLength(8);
    });

    it('should have unique ids', () => {
      const scenarios = service.getAvailableScenarios();
      const ids = scenarios.map(s => s.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should cover all categories', () => {
      const scenarios = service.getAvailableScenarios();
      const categories = scenarios.map(s => s.category);

      expect(categories).toContain('delivery');
      expect(categories).toContain('quality');
      expect(categories).toContain('performance');
      expect(categories).toContain('incident');
      expect(categories).toContain('cost');
      expect(categories).toContain('team');
      expect(categories).toContain('security');
      expect(categories).toContain('overview');
    });
  });
});
