// orion-platform-service/src/services/llm-trace/__tests__/LLMTraceService.test.ts
import { LLMTraceService } from '../LLMTraceService';
import { TokenCounter } from '../TokenCounter';
import { CostCalculator } from '../CostCalculator';

describe('LLMTraceService', () => {
  let service: LLMTraceService;

  beforeEach(() => {
    service = new LLMTraceService();
  });

  describe('startTrace', () => {
    it('should create trace with unique trace_id', async () => {
      const trace = await service.startTrace({
        tenantId: 1,
        userId: 'user_001',
        scenarioId: 'autofix',
        modelId: 'gpt-4',
        promptContent: 'Fix this bug',
      });

      expect(trace.traceId).toBeDefined();
      expect(trace.traceId).toMatch(/^trace_\d+_[a-z0-9]+$/);
    });
  });

  describe('completeTrace', () => {
    it('should record output and calculate tokens', async () => {
      const trace = await service.startTrace({
        tenantId: 1,
        modelId: 'gpt-4',
        promptContent: 'Test prompt',
      });

      const completed = await service.completeTrace(trace.traceId, {
        outputContent: 'Test output',
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(completed.totalTokens).toBe(150);
      expect(completed.totalCost).toBeGreaterThan(0);
      expect(completed.status).toBe('completed');
    });
  });

  describe('costCalculation', () => {
    it('should calculate cost correctly for GPT-4', async () => {
      const cost = service.calculateCost({
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // GPT-4: ¥0.002/input token, ¥0.004/output token
      // Expected: (1000 * 0.002) + (500 * 0.004) = ¥4.00
      expect(cost.totalCost).toBeCloseTo(4.0, 1);
    });

    it('should calculate cost correctly for Claude', async () => {
      const cost = service.calculateCost({
        modelId: 'claude-sonnet',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Claude Sonnet: ¥0.001/input, ¥0.002/output
      // Expected: (1000 * 0.001) + (500 * 0.002) = ¥2.00
      expect(cost.totalCost).toBeCloseTo(2.0, 1);
    });
  });

  describe('traceAccuracy', () => {
    it('should achieve >98% cost tracking accuracy', async () => {
      // Simulate multiple traces
      const traces = [];
      for (let i = 0; i < 100; i++) {
        const trace = await service.startTrace({
          tenantId: 1,
          modelId: 'gpt-4',
          promptContent: 'Test ' + i,
        });
        traces.push(trace);
      }

      // Complete traces
      for (const trace of traces) {
        await service.completeTrace(trace.traceId, {
          outputContent: 'Output',
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      const accuracy = service.getTrackingAccuracy();
      expect(accuracy).toBeGreaterThanOrEqual(0.98);
    });
  });
});

describe('TokenCounter', () => {
  let tokenCounter: TokenCounter;

  beforeEach(() => {
    tokenCounter = new TokenCounter();
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for English text', () => {
      // English: ~4 chars per token
      const text = 'Hello world this is a test'; // 26 chars
      const tokens = tokenCounter.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // Should be less than char count
    });

    it('should estimate tokens for Chinese text', () => {
      // Chinese: ~1.5 chars per token
      const text = '这是一个中文测试'; // 7 Chinese characters
      const tokens = tokenCounter.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      // Chinese tokens = Math.ceil(7 / 1.5) = Math.ceil(4.67) = 5
      // Allow some tolerance for estimation
      expect(tokens).toBeGreaterThanOrEqual(4);
      expect(tokens).toBeLessThanOrEqual(8);
    });

    it('should handle mixed Chinese and English text', () => {
      const text = 'Hello 世界 this is 测试'; // Mixed
      const tokens = tokenCounter.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('countFromResponse', () => {
    it('should extract tokens from API response', () => {
      const response = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };
      const result = tokenCounter.countFromResponse(response);
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.totalTokens).toBe(150);
    });

    it('should return zeros when no usage data', () => {
      const response = {};
      const result = tokenCounter.countFromResponse(response);
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
    });
  });
});

describe('CostCalculator', () => {
  let costCalculator: CostCalculator;

  beforeEach(() => {
    costCalculator = new CostCalculator();
  });

  describe('calculate', () => {
    it('should calculate cost for GPT-4', () => {
      const result = costCalculator.calculate('gpt-4', 1000, 500);
      expect(result.inputCost).toBe(2.0); // 1000 * 0.002
      expect(result.outputCost).toBe(2.0); // 500 * 0.004
      expect(result.totalCost).toBe(4.0);
      expect(result.currency).toBe('CNY');
    });

    it('should calculate cost for Claude Sonnet', () => {
      const result = costCalculator.calculate('claude-sonnet', 1000, 500);
      expect(result.inputCost).toBe(1.0); // 1000 * 0.001
      expect(result.outputCost).toBe(1.0); // 500 * 0.002
      expect(result.totalCost).toBe(2.0);
    });

    it('should fallback to GPT-4 pricing for unknown model', () => {
      const result = costCalculator.calculate('unknown-model', 1000, 500);
      expect(result.totalCost).toBe(4.0); // Same as GPT-4
    });
  });

  describe('calculateBatch', () => {
    it('should calculate batch costs', () => {
      const traces = [
        { modelId: 'gpt-4', inputTokens: 1000, outputTokens: 500 },
        { modelId: 'claude-sonnet', inputTokens: 2000, outputTokens: 1000 },
      ];
      const result = costCalculator.calculateBatch(traces);
      expect(result.totalCost).toBe(8.0); // 4.0 + 4.0
      expect(result.breakdownByModel['gpt-4']).toBe(4.0);
      expect(result.breakdownByModel['claude-sonnet']).toBe(4.0);
    });
  });

  describe('setCustomPricing', () => {
    it('should use custom pricing', () => {
      costCalculator.setCustomPricing('custom-model', 0.01, 0.02);
      const result = costCalculator.calculate('custom-model', 100, 50);
      expect(result.inputCost).toBe(1.0); // 100 * 0.01
      expect(result.outputCost).toBe(1.0); // 50 * 0.02
      expect(result.totalCost).toBe(2.0);
    });
  });

  describe('estimateMonthlyCost', () => {
    it('should estimate monthly cost', () => {
      // Daily 1000 tokens, split 50/50 input/output
      const monthly = costCalculator.estimateMonthlyCost(1000, 'gpt-4');
      // (500 * 0.002 + 500 * 0.004) * 30 = (1.0 + 2.0) * 30 = 90.0
      expect(monthly).toBe(90.0);
    });
  });
});