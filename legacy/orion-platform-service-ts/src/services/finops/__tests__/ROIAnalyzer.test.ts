/**
 * TASK-502: ROIAnalyzer 单元测试
 */

import { ROIAnalyzer } from '../ROIAnalyzer';

describe('ROIAnalyzer', () => {
  let analyzer: ROIAnalyzer;

  beforeEach(() => {
    analyzer = new ROIAnalyzer();
  });

  // ==================== calculateROI ====================

  describe('calculateROI', () => {
    it('should calculate ROI with positive return', () => {
      const result = analyzer.calculateROI({
        investmentType: 'infrastructure',
        name: 'Cloud Migration',
        cost: 10000,
        monthlySavings: 1500,
        description: 'Migrating to reserved instances',
      });

      expect(result.id).toBeDefined();
      expect(result.investmentType).toBe('infrastructure');
      expect(result.name).toBe('Cloud Migration');
      expect(result.cost).toBe(10000);
      // Annual savings = 1500 * 12 = 18000
      expect(result.savings).toBe(18000);
      // ROI = (18000 - 10000) / 10000 * 100 = 80%
      expect(result.roiPercentage).toBe(80);
      // Payback = 10000 / 1500 = 6.67 months
      expect(result.paybackMonths).toBeCloseTo(6.67, 0);
    });

    it('should calculate ROI with negative return', () => {
      const result = analyzer.calculateROI({
        investmentType: 'tooling',
        name: 'Expensive Tool',
        cost: 50000,
        monthlySavings: 2000,
      });

      // Annual savings = 24000, ROI = (24000 - 50000) / 50000 * 100 = -52%
      expect(result.roiPercentage).toBe(-52);
      expect(result.paybackMonths).toBe(25);
    });

    it('should handle zero cost', () => {
      const result = analyzer.calculateROI({
        investmentType: 'automation',
        name: 'Free Automation',
        cost: 0,
        monthlySavings: 500,
      });

      expect(result.roiPercentage).toBe(0);
      expect(result.paybackMonths).toBe(0); // Zero cost means instant payback
    });

    it('should include details in analysis', () => {
      const result = analyzer.calculateROI({
        investmentType: 'automation',
        name: 'CI/CD Pipeline',
        cost: 5000,
        monthlySavings: 1000,
        timeSavingsHours: 40,
        details: { teamSize: 10 },
      });

      expect(result.details).toBeDefined();
      expect(result.details!.monthlySavings).toBe(1000);
      expect(result.details!.annualSavings).toBe(12000);
      expect(result.details!.timeSavingsHours).toBe(40);
      expect(result.details!.teamSize).toBe(10);
    });

    it('should store analysis in history', () => {
      analyzer.calculateROI({
        investmentType: 'infrastructure',
        name: 'Test',
        cost: 1000,
        monthlySavings: 200,
      });

      const history = analyzer.getROIHistory();
      expect(history.length).toBe(1);
    });
  });

  // ==================== analyzeAutomationSavings ====================

  describe('analyzeAutomationSavings', () => {
    it('should calculate automation savings', () => {
      const result = analyzer.analyzeAutomationSavings({
        name: 'Deploy Automation',
        manualHoursPerMonth: 80,
        hourlyRate: 50,
        automationCost: 10000,
        timeSavingsPercent: 75,
      });

      expect(result.investmentType).toBe('automation');
      // Manual cost = 80 * 50 = 4000
      // Remaining hours = 80 * 0.25 = 20
      // Automated cost = 20 * 50 = 1000
      // Net savings = 4000 - 1000 = 3000/month
      // Annual savings = 3000 * 12 = 36000
      expect(result.savings).toBe(36000);
      // ROI = (36000 - 10000) / 10000 * 100 = 260%
      expect(result.roiPercentage).toBe(260);
      // Payback = 10000 / 3000 = 3.33 months
      expect(result.paybackMonths).toBeCloseTo(3.33, 0);
    });

    it('should include maintenance cost', () => {
      const result = analyzer.analyzeAutomationSavings({
        name: 'Monitoring Automation',
        manualHoursPerMonth: 40,
        hourlyRate: 75,
        automationCost: 5000,
        automationMaintenancePerMonth: 200,
        timeSavingsPercent: 90,
      });

      // Manual cost = 40 * 75 = 3000
      // Remaining hours = 40 * 0.1 = 4
      // Automated cost = 4 * 75 = 300
      // Net savings = 3000 - 300 - 200 = 2500/month
      expect(result.details!.monthlySavings).toBeCloseTo(2500, 0);
    });

    it('should calculate time savings', () => {
      const result = analyzer.analyzeAutomationSavings({
        name: 'Test Automation',
        manualHoursPerMonth: 100,
        hourlyRate: 50,
        automationCost: 3000,
        timeSavingsPercent: 80,
      });

      expect(result.details!.timeSavingsHours).toBe(80); // 100 * 0.8
    });
  });

  // ==================== comparePeriods ====================

  describe('comparePeriods', () => {
    it('should calculate cost savings', () => {
      const result = analyzer.comparePeriods({
        description: 'Before and after cloud optimization',
        beforeCost: 5000,
        afterCost: 3000,
        period: 'monthly',
      });

      expect(result.beforeCost).toBe(5000);
      expect(result.afterCost).toBe(3000);
      expect(result.savings).toBe(2000);
      expect(result.savingsPercent).toBe(40);
    });

    it('should handle time savings', () => {
      const result = analyzer.comparePeriods({
        description: 'CI/CD improvement',
        beforeCost: 2000,
        afterCost: 800,
        timeSavingsHours: 20,
        period: 'monthly',
      });

      expect(result.timeSavingsHours).toBe(20);
      expect(result.savings).toBe(1200);
      expect(result.savingsPercent).toBe(60);
    });

    it('should handle negative savings (cost increased)', () => {
      const result = analyzer.comparePeriods({
        description: 'Failed optimization',
        beforeCost: 1000,
        afterCost: 1500,
        period: 'monthly',
      });

      expect(result.savings).toBe(-500);
      expect(result.savingsPercent).toBe(-50);
    });

    it('should store comparison', () => {
      analyzer.comparePeriods({
        description: 'Test',
        beforeCost: 1000,
        afterCost: 500,
        period: 'monthly',
      });

      const comparisons = analyzer.getComparisons();
      expect(comparisons.length).toBe(1);
    });

    it('should filter comparisons by period', () => {
      analyzer.comparePeriods({
        description: 'Monthly',
        beforeCost: 1000,
        afterCost: 500,
        period: 'monthly',
      });

      analyzer.comparePeriods({
        description: 'Yearly',
        beforeCost: 12000,
        afterCost: 6000,
        period: 'yearly',
      });

      const monthly = analyzer.getComparisons({ period: 'monthly' });
      expect(monthly.length).toBe(1);
    });
  });

  // ==================== getROIHistory ====================

  describe('getROIHistory', () => {
    beforeEach(() => {
      analyzer.calculateROI({
        investmentType: 'infrastructure',
        name: 'Cloud Migration',
        cost: 10000,
        monthlySavings: 1500,
      });

      analyzer.calculateROI({
        investmentType: 'automation',
        name: 'Deploy Script',
        cost: 2000,
        monthlySavings: 500,
      });

      analyzer.calculateROI({
        investmentType: 'tooling',
        name: 'Monitoring Tool',
        cost: 5000,
        monthlySavings: 300,
      });
    });

    it('should return all analyses', () => {
      const history = analyzer.getROIHistory();
      expect(history.length).toBe(3);
    });

    it('should filter by investment type', () => {
      const history = analyzer.getROIHistory({
        investmentType: 'automation',
      });

      expect(history.length).toBe(1);
      expect(history[0].name).toBe('Deploy Script');
    });

    it('should filter by minimum ROI', () => {
      const history = analyzer.getROIHistory({ minROI: 50 });
      // Infrastructure: (18000-10000)/10000*100 = 80%, Automation: (6000-2000)/2000*100 = 200%, Tooling: (3600-5000)/5000*100 = -28%
      expect(history.length).toBe(2);
    });

    it('should sort by analyzedAt descending', () => {
      const history = analyzer.getROIHistory();

      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].analyzedAt.getTime()).toBeGreaterThanOrEqual(
          history[i + 1].analyzedAt.getTime()
        );
      }
    });
  });

  // ==================== getSummary ====================

  describe('getSummary', () => {
    it('should return zero summary when no data', () => {
      const summary = analyzer.getSummary();

      expect(summary.totalAnalyses).toBe(0);
      expect(summary.averageROI).toBe(0);
      expect(summary.averagePaybackMonths).toBe(0);
      expect(summary.totalComparisons).toBe(0);
      expect(summary.totalSavings).toBe(0);
    });

    it('should calculate averages', () => {
      analyzer.calculateROI({
        investmentType: 'infrastructure',
        name: 'Test 1',
        cost: 10000,
        monthlySavings: 1000,
      });

      analyzer.calculateROI({
        investmentType: 'automation',
        name: 'Test 2',
        cost: 5000,
        monthlySavings: 800,
      });

      const summary = analyzer.getSummary();

      expect(summary.totalAnalyses).toBe(2);
      expect(summary.averagePaybackMonths).toBeGreaterThan(0);
    });

    it('should include comparison savings', () => {
      analyzer.comparePeriods({
        description: 'Test',
        beforeCost: 2000,
        afterCost: 1000,
        period: 'monthly',
      });

      const summary = analyzer.getSummary();

      expect(summary.totalComparisons).toBe(1);
      expect(summary.totalSavings).toBe(1000);
    });
  });

  // ==================== Clear All ====================

  describe('clearAll', () => {
    it('should clear all data', () => {
      analyzer.calculateROI({
        investmentType: 'infrastructure',
        name: 'Test',
        cost: 1000,
        monthlySavings: 200,
      });

      analyzer.comparePeriods({
        description: 'Test',
        beforeCost: 1000,
        afterCost: 500,
        period: 'monthly',
      });

      analyzer.clearAll();

      expect(analyzer.getROIHistory().length).toBe(0);
      expect(analyzer.getComparisons().length).toBe(0);
    });
  });
});
