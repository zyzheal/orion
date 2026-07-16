/**
 * CostCalculator - Comprehensive Tests
 *
 * Tests for single/batch cost calculation, custom pricing,
 * monthly estimation, savings calculation, and model management.
 */

import { CostCalculator } from '../CostCalculator';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../repositories/ModelPricingRepository', () => ({
  ModelPricingRepository: jest.fn().mockImplementation(() => ({
    findByModelId: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ entities: [] }),
    upsertByModelId: jest.fn().mockResolvedValue({}),
  })),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CostCalculator', () => {
  let calculator: CostCalculator;

  beforeEach(() => {
    calculator = new CostCalculator();
  });

  // ─── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create without database', () => {
      const calc = new CostCalculator();
      expect(calc).toBeDefined();
    });

    it('should create with database', () => {
      const db = { query: jest.fn() };
      const calc = new CostCalculator(db as any);
      expect(calc).toBeDefined();
    });
  });

  // ─── calculate ────────────────────────────────────────────────────────────

  describe('calculate', () => {
    it('should calculate cost for gpt-4', async () => {
      const result = await calculator.calculate('gpt-4', 1000, 500);

      expect(result.inputCost).toBe(1000 * 0.002);
      expect(result.outputCost).toBe(500 * 0.004);
      expect(result.totalCost).toBe(1000 * 0.002 + 500 * 0.004);
      expect(result.currency).toBe('CNY');
    });

    it('should calculate cost for gpt-3.5-turbo', async () => {
      const result = await calculator.calculate('gpt-3.5-turbo', 2000, 1000);

      expect(result.inputCost).toBe(2000 * 0.0003);
      expect(result.outputCost).toBe(1000 * 0.0006);
    });

    it('should calculate cost for claude-sonnet', async () => {
      const result = await calculator.calculate('claude-sonnet', 500, 200);

      expect(result.inputCost).toBe(500 * 0.001);
      expect(result.outputCost).toBe(200 * 0.002);
    });

    it('should fallback to gpt-4 pricing for unknown model', async () => {
      const result = await calculator.calculate('unknown-model', 1000, 500);

      // Should use gpt-4 pricing
      expect(result.inputCost).toBe(1000 * 0.002);
      expect(result.outputCost).toBe(500 * 0.004);
    });

    it('should include breakdown by model', async () => {
      const result = await calculator.calculate('gpt-4', 1000, 500);

      expect(result.breakdownByModel).toBeDefined();
      expect(result.breakdownByModel['gpt-4']).toBe(result.totalCost);
    });

    it('should handle zero tokens', async () => {
      const result = await calculator.calculate('gpt-4', 0, 0);

      expect(result.totalCost).toBe(0);
    });
  });

  // ─── calculateBatch ───────────────────────────────────────────────────────

  describe('calculateBatch', () => {
    it('should calculate batch cost for multiple traces', async () => {
      const traces = [
        { modelId: 'gpt-4', inputTokens: 1000, outputTokens: 500 },
        { modelId: 'gpt-3.5-turbo', inputTokens: 2000, outputTokens: 1000 },
      ];

      const result = await calculator.calculateBatch(traces);

      const gpt4Cost = 1000 * 0.002 + 500 * 0.004;
      const gpt35Cost = 2000 * 0.0003 + 1000 * 0.0006;

      expect(result.totalCost).toBe(gpt4Cost + gpt35Cost);
      expect(result.inputCost).toBe(1000 * 0.002 + 2000 * 0.0003);
      expect(result.outputCost).toBe(500 * 0.004 + 1000 * 0.0006);
    });

    it('should aggregate costs by model', async () => {
      const traces = [
        { modelId: 'gpt-4', inputTokens: 1000, outputTokens: 500 },
        { modelId: 'gpt-4', inputTokens: 2000, outputTokens: 1000 },
      ];

      const result = await calculator.calculateBatch(traces);

      const expectedGpt4Cost = (1000 * 0.002 + 500 * 0.004) + (2000 * 0.002 + 1000 * 0.004);
      expect(result.breakdownByModel['gpt-4']).toBe(expectedGpt4Cost);
    });

    it('should handle empty traces', async () => {
      const result = await calculator.calculateBatch([]);

      expect(result.totalCost).toBe(0);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
    });

    it('should handle single trace', async () => {
      const traces = [{ modelId: 'gpt-4', inputTokens: 1000, outputTokens: 500 }];
      const result = await calculator.calculateBatch(traces);

      expect(result.totalCost).toBe(1000 * 0.002 + 500 * 0.004);
    });
  });

  // ─── getPricing ───────────────────────────────────────────────────────────

  describe('getPricing', () => {
    it('should return pricing for known model', async () => {
      const pricing = await calculator.getPricing('gpt-4');

      expect(pricing.input).toBe(0.002);
      expect(pricing.output).toBe(0.004);
    });

    it('should return gpt-4 pricing for unknown model', async () => {
      const pricing = await calculator.getPricing('unknown');

      expect(pricing.input).toBe(0.002);
      expect(pricing.output).toBe(0.004);
    });

    it('should return pricing for all known models', async () => {
      const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-opus', 'claude-sonnet', 'claude-haiku', 'qwen-max', 'deepseek'];

      for (const model of models) {
        const pricing = await calculator.getPricing(model);
        expect(pricing.input).toBeGreaterThan(0);
        expect(pricing.output).toBeGreaterThan(0);
      }
    });
  });

  // ─── estimateMonthlyCost ──────────────────────────────────────────────────

  describe('estimateMonthlyCost', () => {
    it('should estimate monthly cost', async () => {
      const monthlyCost = await calculator.estimateMonthlyCost(100000, 'gpt-4');

      // 100000 tokens/day, 50% input/50% output, 30 days
      const dailyInputCost = 50000 * 0.002;
      const dailyOutputCost = 50000 * 0.004;
      const expectedMonthly = (dailyInputCost + dailyOutputCost) * 30;

      expect(monthlyCost).toBe(expectedMonthly);
    });

    it('should handle zero daily tokens', async () => {
      const monthlyCost = await calculator.estimateMonthlyCost(0, 'gpt-4');
      expect(monthlyCost).toBe(0);
    });

    it('should use correct pricing for different models', async () => {
      const gpt4Monthly = await calculator.estimateMonthlyCost(100000, 'gpt-4');
      const gpt35Monthly = await calculator.estimateMonthlyCost(100000, 'gpt-3.5-turbo');

      expect(gpt35Monthly).toBeLessThan(gpt4Monthly);
    });
  });

  // ─── calculateSavings ─────────────────────────────────────────────────────

  describe('calculateSavings', () => {
    it('should calculate savings between models', async () => {
      const result = await calculator.calculateSavings('gpt-4', 'gpt-3.5-turbo', 1000, 500);

      const gpt4Cost = 1000 * 0.002 + 500 * 0.004;
      const gpt35Cost = 1000 * 0.0003 + 500 * 0.0006;

      expect(result.currentCost).toBe(gpt4Cost);
      expect(result.alternativeCost).toBe(gpt35Cost);
      expect(result.savings).toBe(gpt4Cost - gpt35Cost);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    it('should return positive savings when alternative is cheaper', async () => {
      const result = await calculator.calculateSavings('gpt-4', 'deepseek', 1000, 500);

      expect(result.savings).toBeGreaterThan(0);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    it('should handle zero cost scenario', async () => {
      const result = await calculator.calculateSavings('gpt-4', 'gpt-3.5-turbo', 0, 0);

      expect(result.currentCost).toBe(0);
      expect(result.alternativeCost).toBe(0);
      expect(result.savings).toBe(0);
      expect(result.savingsPercent).toBe(0);
    });
  });

  // ─── setCustomPricing ─────────────────────────────────────────────────────

  describe('setCustomPricing', () => {
    it('should throw when no database configured', async () => {
      await expect(
        calculator.setCustomPricing('custom-model', 0.001, 0.002)
      ).rejects.toThrow('Database not configured');
    });
  });

  // ─── getAvailableModels ───────────────────────────────────────────────────

  describe('getAvailableModels', () => {
    it('should return default models', async () => {
      const models = await calculator.getAvailableModels();

      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
      expect(models).toContain('claude-sonnet');
    });
  });

  // ─── getAllPricing ────────────────────────────────────────────────────────

  describe('getAllPricing', () => {
    it('should return all default pricing', async () => {
      const pricing = await calculator.getAllPricing();

      expect(pricing['gpt-4']).toBeDefined();
      expect(pricing['gpt-3.5-turbo']).toBeDefined();
      expect(pricing['claude-sonnet']).toBeDefined();
    });
  });

  // ─── Currency ─────────────────────────────────────────────────────────────

  describe('currency', () => {
    it('should default to CNY', () => {
      expect(calculator.getCurrency()).toBe('CNY');
    });

    it('should allow setting custom currency', () => {
      calculator.setCurrency('USD');
      expect(calculator.getCurrency()).toBe('USD');
    });
  });
});
