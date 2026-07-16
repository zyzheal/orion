/**
 * CostCalculator - 成本计算与ROI分析单元测试
 *
 * 测试覆盖: 单次成本计算、批量估算、ROI分析、趋势计算、成本预测
 */

import { CostCalculator } from '../CostCalculator';

// Mock BudgetService
const mockBudgetService = {
  getPricingForModel: jest.fn(),
  queryCosts: jest.fn(),
};

// Mock CostEstimateRepository
const mockEstimateRepo = {
  create: jest.fn(),
};

jest.mock('../../../repositories/CostEstimateRepository', () => ({
  CostEstimateRepository: jest.fn().mockImplementation(() => mockEstimateRepo),
}));

describe('CostCalculator', () => {
  let calculator: CostCalculator;

  beforeEach(() => {
    jest.clearAllMocks();
    calculator = new CostCalculator(mockBudgetService as any);
  });

  // ==================== calculateCost ====================

  describe('calculateCost', () => {
    it('should calculate cost from model pricing', async () => {
      mockBudgetService.getPricingForModel.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        inputPricePer1k: 0.03,
        outputPricePer1k: 0.06,
        currency: 'USD',
      });

      const result = await calculator.calculateCost({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(result.model).toBe('gpt-4');
      expect(result.provider).toBe('openai');
      expect(result.inputCost).toBe(0.03); // 1000/1000 * 0.03
      expect(result.outputCost).toBe(0.03); // 500/1000 * 0.06
      expect(result.totalCost).toBe(0.06);
      expect(result.currency).toBe('USD');
    });

    it('should throw when pricing not found', async () => {
      mockBudgetService.getPricingForModel.mockResolvedValue(undefined);

      await expect(calculator.calculateCost({
        provider: 'unknown',
        model: 'unknown',
        inputTokens: 100,
        outputTokens: 50,
      })).rejects.toThrow('No pricing found');
    });

    it('should round costs to 4 decimal places', async () => {
      mockBudgetService.getPricingForModel.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        inputPricePer1k: 0.03,
        outputPricePer1k: 0.06,
        currency: 'USD',
      });

      const result = await calculator.calculateCost({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 333,
        outputTokens: 167,
      });

      // inputCost = 333/1000 * 0.03 = 0.00999 → 0.01
      expect(result.inputCost).toBeCloseTo(0.01, 2);
    });
  });

  // ==================== estimateBatchCost ====================

  describe('estimateBatchCost', () => {
    it('should estimate batch cost for multiple requests', async () => {
      mockBudgetService.getPricingForModel.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        inputPricePer1k: 0.03,
        outputPricePer1k: 0.06,
        currency: 'USD',
      });

      const result = await calculator.estimateBatchCost([
        { provider: 'openai', model: 'gpt-4', inputTokens: 1000, outputTokens: 500 },
        { provider: 'openai', model: 'gpt-4', inputTokens: 2000, outputTokens: 1000 },
      ]);

      expect(result.estimates).toHaveLength(2);
      expect(result.totalCost).toBe(0.18); // 0.06 + 0.12
    });

    it('should skip requests without pricing', async () => {
      mockBudgetService.getPricingForModel
        .mockResolvedValueOnce({
          model: 'gpt-4', provider: 'openai',
          inputPricePer1k: 0.03, outputPricePer1k: 0.06, currency: 'USD',
        })
        .mockResolvedValueOnce(undefined);

      const result = await calculator.estimateBatchCost([
        { provider: 'openai', model: 'gpt-4', inputTokens: 1000, outputTokens: 500 },
        { provider: 'unknown', model: 'unknown', inputTokens: 100, outputTokens: 50 },
      ]);

      expect(result.estimates).toHaveLength(1);
      expect(result.totalCost).toBe(0.06);
    });

    it('should return zero for empty requests', async () => {
      const result = await calculator.estimateBatchCost([]);

      expect(result.estimates).toEqual([]);
      expect(result.totalCost).toBe(0);
    });
  });

  // ==================== calculateRoi ====================

  describe('calculateRoi', () => {
    it('should calculate ROI correctly', () => {
      const result = calculator.calculateRoi({
        totalInvestment: 10000,
        manualCostPerTask: 50,
        aiTasksCompleted: 500,
        monthlyAiCost: 500,
        analysisPeriodMonths: 12,
      });

      expect(result.totalInvestment).toBe(10000);
      expect(result.estimatedSavings).toBe(15000); // 50*500 - 10000
      expect(result.roi).toBe(150); // 15000/10000 * 100
      expect(result.monthlyNetBenefit).toBe(1250); // 15000/12
      expect(result.paybackPeriod).toBe(8); // 10000/1250
    });

    it('should handle zero investment', () => {
      const result = calculator.calculateRoi({
        totalInvestment: 0,
        manualCostPerTask: 50,
        aiTasksCompleted: 500,
        monthlyAiCost: 500,
        analysisPeriodMonths: 12,
      });

      expect(result.roi).toBe(0);
      // paybackPeriod = 0 / positive = 0
      expect(result.paybackPeriod).toBe(0);
    });

    it('should handle negative ROI', () => {
      const result = calculator.calculateRoi({
        totalInvestment: 10000,
        manualCostPerTask: 10,
        aiTasksCompleted: 100,
        monthlyAiCost: 500,
        analysisPeriodMonths: 12,
      });

      // savings = 10*100 - 10000 = -9000
      expect(result.estimatedSavings).toBe(-9000);
      expect(result.roi).toBe(-90);
    });

    it('should handle zero analysis period', () => {
      const result = calculator.calculateRoi({
        totalInvestment: 10000,
        manualCostPerTask: 50,
        aiTasksCompleted: 500,
        monthlyAiCost: 500,
        analysisPeriodMonths: 0,
      });

      expect(result.monthlyNetBenefit).toBe(0);
      expect(result.paybackPeriod).toBe(Infinity);
    });
  });

  // ==================== calculateROI (async) ====================

  describe('calculateROI', () => {
    it('should calculate ROI report for monthly period', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({
        records: [
          { provider: 'openai', model: 'gpt-4', totalCost: 100, timestamp: new Date() },
          { provider: 'openai', model: 'gpt-4', totalCost: 50, timestamp: new Date() },
        ],
      });

      const result = await calculator.calculateROI({ period: 'monthly' });

      expect(result.totalInvestment).toBe(150);
      expect(result.totalCostSaved).toBe(375); // 150 * 2.5
      expect(result.roi).toBe(150); // (375-150)/150 * 100
      expect(result.period).toBe('monthly');
      expect(result.costBreakdown['openai/gpt-4']).toBe(150);
    });

    it('should handle weekly period', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({ records: [] });

      const result = await calculator.calculateROI({ period: 'weekly' });

      expect(result.period).toBe('weekly');
    });

    it('should handle quarterly period', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({ records: [] });

      const result = await calculator.calculateROI({ period: 'quarterly' });

      expect(result.period).toBe('quarterly');
    });

    it('should default to monthly when no period specified', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({ records: [] });

      const result = await calculator.calculateROI({});

      expect(result.period).toBe('monthly');
    });

    it('should handle zero investment', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({ records: [] });

      const result = await calculator.calculateROI({});

      expect(result.totalInvestment).toBe(0);
      expect(result.roi).toBe(0);
    });
  });

  // ==================== computeTrend ====================

  describe('computeTrend', () => {
    it('should compute daily trend', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({
        records: [
          { totalCost: 10, timestamp: new Date('2026-01-01') },
          { totalCost: 20, timestamp: new Date('2026-01-01') },
          { totalCost: 30, timestamp: new Date('2026-01-02') },
        ],
      });

      const result = await calculator.computeTrend({
        granularity: 'daily',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-03',
      });

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe('2026-01-01');
      expect(result[0].cost).toBe(30);
      expect(result[0].requests).toBe(2);
      expect(result[1].period).toBe('2026-01-02');
      expect(result[1].cost).toBe(30);
    });

    it('should compute monthly trend', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({
        records: [
          { totalCost: 100, timestamp: new Date('2026-01-15') },
          { totalCost: 200, timestamp: new Date('2026-02-15') },
        ],
      });

      const result = await calculator.computeTrend({
        granularity: 'monthly',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-01',
      });

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe('2026-01');
      expect(result[1].period).toBe('2026-02');
    });

    it('should return empty for no records', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({ records: [] });

      const result = await calculator.computeTrend({
        granularity: 'daily',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-02',
      });

      expect(result).toEqual([]);
    });

    it('should calculate average cost per request', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({
        records: [
          { totalCost: 10, timestamp: new Date('2026-01-01') },
          { totalCost: 20, timestamp: new Date('2026-01-01') },
        ],
      });

      const result = await calculator.computeTrend({
        granularity: 'daily',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-02',
      });

      expect(result[0].avgCostPerRequest).toBe(15); // 30/2
    });
  });

  // ==================== forecastCost ====================

  describe('forecastCost', () => {
    it('should forecast cost based on historical data', async () => {
      const records = Array.from({ length: 30 }, (_, i) => ({
        totalCost: 10,
        timestamp: new Date(Date.now() - i * 86400000),
      }));
      mockBudgetService.queryCosts.mockResolvedValue({ records });

      const result = await calculator.forecastCost({ daysAhead: 7 });

      expect(result.forecastedCost).toBe(70); // 10*30/30 * 7
      expect(result.dailyAverage).toBe(10);
      expect(result.confidence).toBe('medium'); // 30 records
    });

    it('should return low confidence for few records', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({
        records: [{ totalCost: 10, timestamp: new Date() }],
      });

      const result = await calculator.forecastCost({ daysAhead: 7 });

      expect(result.confidence).toBe('low');
    });

    it('should return high confidence for many records', async () => {
      const records = Array.from({ length: 100 }, () => ({
        totalCost: 10,
        timestamp: new Date(),
      }));
      mockBudgetService.queryCosts.mockResolvedValue({ records });

      const result = await calculator.forecastCost({ daysAhead: 7 });

      expect(result.confidence).toBe('high');
    });

    it('should return zero for no records', async () => {
      mockBudgetService.queryCosts.mockResolvedValue({ records: [] });

      const result = await calculator.forecastCost({ daysAhead: 7 });

      expect(result.forecastedCost).toBe(0);
      expect(result.dailyAverage).toBe(0);
      expect(result.confidence).toBe('low');
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate pricing lookup errors', async () => {
      mockBudgetService.getPricingForModel.mockRejectedValue(new Error('DB error'));

      await expect(calculator.calculateCost({
        provider: 'openai', model: 'gpt-4', inputTokens: 100, outputTokens: 50,
      })).rejects.toThrow('DB error');
    });

    it('should propagate query errors on trend', async () => {
      mockBudgetService.queryCosts.mockRejectedValue(new Error('Query timeout'));

      await expect(calculator.computeTrend({
        granularity: 'daily', dateFrom: '2026-01-01', dateTo: '2026-01-02',
      })).rejects.toThrow('Query timeout');
    });
  });
});
