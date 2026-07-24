// orion-platform-service/src/services/llm-trace/__tests__/LLMTraceService.test.ts
import { LLMTraceService } from '../LLMTraceService';
import { TokenCounter } from '../TokenCounter';
import { CostCalculator } from '../CostCalculator';

// Mock tiktoken to avoid native module dependency
jest.mock('tiktoken', () => {
  const mockEncoding = {
    encode: jest.fn().mockImplementation((text: string) => {
      // Simple heuristic: ~4 chars per token for English, ~1 char per token for CJK
      const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
      const otherChars = text.length - cjkChars;
      const tokens = cjkChars + Math.ceil(otherChars / 4);
      return new Array(Math.max(tokens, 1));
    }),
    free: jest.fn(),
  };
  return {
    get_encoding: jest.fn().mockReturnValue(mockEncoding),
    encoding_for_model: jest.fn().mockReturnValue(mockEncoding),
  };
});

// Helper to parse $N param references from SQL
function extractParam(sql: string, paramNum: number, params: any[]): any {
  return params[paramNum - 1];
}

// Stateful mock db for LLMTraceRepository queries
let traceStore: Map<string, any>;
let pricingStore: Map<string, any>;

function createMockDb() {
  traceStore = new Map();
  pricingStore = new Map();
  return {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // INSERT ... RETURNING *
      if (sql.includes('INSERT INTO')) {
        const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
        const cols = colsMatch ? colsMatch[1].split(',').map((c) => c.trim()) : [];
        const row: any = {};
        cols.forEach((col, i) => {
          row[col] = params?.[i];
        });
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        // Store in appropriate store
        if (row.trace_id) traceStore.set(row.trace_id, row);
        if (sql.includes('model_custom_pricing') && row.model_id) {
          pricingStore.set(row.model_id, row);
        }
        return { rows: [row], rowCount: 1 };
      }
      // UPDATE ... WHERE ... RETURNING *
      if (sql.includes('UPDATE ')) {
        // Determine which store to use based on table name
        const isTrace = sql.includes('llm_traces');
        const isPricing = sql.includes('model_custom_pricing');
        // Extract WHERE condition to find the row
        const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\d+)/);
        if (!whereMatch) return { rows: [], rowCount: 0 };
        const whereCol = whereMatch[1];
        const whereParamIdx = parseInt(whereMatch[2], 10) - 1;
        const whereVal = params?.[whereParamIdx];

        let existing: any = undefined;
        if (isTrace) existing = traceStore.get(whereVal);
        if (isPricing) {
          // For pricing, WHERE might be on id, not model_id
          for (const [key, val] of pricingStore) {
            if (val[whereCol] === whereVal || val.id === whereVal) {
              existing = val;
              break;
            }
          }
        }
        if (!existing) return { rows: [], rowCount: 0 };

        const setMatch = sql.match(/SET (.+?) WHERE/);
        if (setMatch) {
          const assignments = setMatch[1].split(',').map((s) => s.trim());
          for (const assignment of assignments) {
            const parts = assignment.split('=');
            const col = parts[0].trim();
            const paramRef = parts[1]?.trim();
            if (paramRef && paramRef.startsWith('$')) {
              const pIdx = parseInt(paramRef.slice(1), 10) - 1;
              existing[col] = params?.[pIdx];
            }
          }
        }
        if (isTrace) traceStore.set(whereVal, existing);
        return { rows: [existing], rowCount: 1 };
      }
      // SELECT ... WHERE trace_id = $1
      if (sql.includes('WHERE trace_id = $1')) {
        const traceId = params?.[0];
        const row = traceStore.get(traceId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT ... model_custom_pricing WHERE model_id = $1
      if (sql.includes('model_custom_pricing') && sql.includes('model_id')) {
        const modelId = params?.[0];
        const row = pricingStore.get(modelId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT ... model_custom_pricing (other queries)
      if (sql.includes('model_custom_pricing')) {
        return { rows: Array.from(pricingStore.values()), rowCount: pricingStore.size };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('LLMTraceService', () => {
  let service: LLMTraceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new LLMTraceService(mockDb as any);
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
      expect(trace.traceId).toMatch(/^trace_\d+_[a-f0-9]{16}$/);
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
    it('should calculate cost correctly for GPT-4', () => {
      const cost = service.calculateCost({
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // GPT-4: ¥0.002/input token, ¥0.004/output token
      // Expected: (1000 * 0.002) + (500 * 0.004) = ¥4.00
      expect(cost.totalCost).toBeCloseTo(4.0, 1);
    });

    it('should calculate cost correctly for Claude', () => {
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
      // Chinese: ~1 char per token (tiktoken accurate)
      const text = '这是一个中文测试'; // 7 Chinese characters
      const tokens = tokenCounter.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
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
    it('should calculate cost for GPT-4', async () => {
      const result = await costCalculator.calculate('gpt-4', 1000, 500);
      expect(result.inputCost).toBe(2.0); // 1000 * 0.002
      expect(result.outputCost).toBe(2.0); // 500 * 0.004
      expect(result.totalCost).toBe(4.0);
      expect(result.currency).toBe('CNY');
    });

    it('should calculate cost for Claude Sonnet', async () => {
      const result = await costCalculator.calculate('claude-sonnet', 1000, 500);
      expect(result.inputCost).toBe(1.0); // 1000 * 0.001
      expect(result.outputCost).toBe(1.0); // 500 * 0.002
      expect(result.totalCost).toBe(2.0);
    });

    it('should fallback to GPT-4 pricing for unknown model', async () => {
      const result = await costCalculator.calculate('unknown-model', 1000, 500);
      expect(result.totalCost).toBe(4.0); // Same as GPT-4
    });
  });

  describe('calculateBatch', () => {
    it('should calculate batch costs', async () => {
      const traces = [
        { modelId: 'gpt-4', inputTokens: 1000, outputTokens: 500 },
        { modelId: 'claude-sonnet', inputTokens: 2000, outputTokens: 1000 },
      ];
      const result = await costCalculator.calculateBatch(traces);
      expect(result.totalCost).toBe(8.0); // 4.0 + 4.0
      expect(result.breakdownByModel['gpt-4']).toBe(4.0);
      expect(result.breakdownByModel['claude-sonnet']).toBe(4.0);
    });
  });

  describe('setCustomPricing', () => {
    it('should use custom pricing', async () => {
      // Need a db mock for CostCalculator with pricing repo
      const mockDbForCost = createMockDb();
      const costCalcWithDb = new CostCalculator(mockDbForCost as any);

      await costCalcWithDb.setCustomPricing('custom-model', 0.01, 0.02);
      const result = await costCalcWithDb.calculate('custom-model', 100, 50);
      expect(result.inputCost).toBe(1.0); // 100 * 0.01
      expect(result.outputCost).toBe(1.0); // 50 * 0.02
      expect(result.totalCost).toBe(2.0);
    });
  });

  describe('estimateMonthlyCost', () => {
    it('should estimate monthly cost', async () => {
      // Daily 1000 tokens, split 50/50 input/output
      const monthly = await costCalculator.estimateMonthlyCost(1000, 'gpt-4');
      // (500 * 0.002 + 500 * 0.004) * 30 = (1.0 + 2.0) * 30 = 90.0
      expect(monthly).toBe(90.0);
    });
  });
});
