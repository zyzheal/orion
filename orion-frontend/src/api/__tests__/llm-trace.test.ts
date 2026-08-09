/**
 * LLM Trace API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTrace,
  getTraces,
  getDailyStats,
  getCostBreakdown,
  getTrackingAccuracy,
  getPricing,
  estimateCost,
} from '../llm-trace';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('LLM Trace API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trace Operations', () => {
    it('should get trace by ID', async () => {
      const mockTrace = {
        traceId: 'trace-001',
        tenantId: 1,
        scenarioId: 'code-review',
        modelId: 'gpt-4',
        providerId: 'openai',
        status: 'completed',
      };
      vi.mocked(api.get).mockResolvedValue({
        data: mockTrace,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getTrace('trace-001');
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/traces/trace-001');
      expect(result.data).toEqual(mockTrace);
    });

    it('should get traces with filters', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getTraces({ tenantId: 1, limit: 50 });
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/traces', {
        params: { tenantId: 1, limit: 50 },
      });
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get traces by scenario', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: [{ traceId: 'trace-002' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getTraces({ scenarioId: 'autofix' });
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/traces', {
        params: { scenarioId: 'autofix' },
      });
      expect(result.data.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should get daily stats', async () => {
      const mockStats = {
        date: '2026-05-04',
        tenantId: 1,
        totalTraces: 150,
        completedTraces: 142,
        failedTraces: 8,
        totalCost: 12.5,
      };
      vi.mocked(api.get).mockResolvedValue({
        data: mockStats,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getDailyStats({ tenantId: 1, date: '2026-05-04' });
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/stats/daily', {
        params: { tenantId: 1, date: '2026-05-04' },
      });
      expect(result.data).toEqual(mockStats);
    });

    it('should get daily stats without date', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { date: '2026-05-04', tenantId: 1, totalTraces: 100 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      await getDailyStats({ tenantId: 1 });
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/stats/daily', {
        params: { tenantId: 1 },
      });
    });
  });

  describe('Cost Analysis', () => {
    it('should get cost breakdown', async () => {
      const mockBreakdown = {
        tenantId: 1,
        totalTraces: 500,
        totalCost: 89.5,
        modelBreakdown: [
          { modelId: 'gpt-4', traces: 200, cost: 50 },
          { modelId: 'claude-3', traces: 300, cost: 39.5 },
        ],
      };
      vi.mocked(api.get).mockResolvedValue({
        data: mockBreakdown,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getCostBreakdown({
        tenantId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/cost/breakdown', {
        params: { tenantId: 1, startDate: '2026-04-01', endDate: '2026-04-30' },
      });
      expect(result.data).toEqual(mockBreakdown);
    });

    it('should get tracking accuracy', async () => {
      const mockAccuracy = {
        accuracy: 0.98,
        completed: 1000,
        failed: 20,
        total: 1020,
        targetAccuracy: 0.98,
        meetsTarget: true,
      };
      vi.mocked(api.get).mockResolvedValue({
        data: mockAccuracy,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getTrackingAccuracy();
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/tracking/accuracy');
      expect(result.data).toEqual(mockAccuracy);
    });
  });

  describe('Pricing', () => {
    it('should get pricing table', async () => {
      const mockPricing = {
        currency: 'CNY',
        unit: 'per token',
        pricing: [
          { modelId: 'gpt-4', provider: 'openai', inputPricePerToken: 0.03, outputPricePerToken: 0.06 },
        ],
      };
      vi.mocked(api.get).mockResolvedValue({
        data: mockPricing,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await getPricing();
      expect(api.get).toHaveBeenCalledWith('/api/v1/llm/pricing');
      expect(result.data).toEqual(mockPricing);
    });

    it('should estimate cost', async () => {
      const mockEstimate = {
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
        inputCost: 0.03,
        outputCost: 0.03,
        totalCost: 0.06,
      };
      vi.mocked(api.post).mockResolvedValue({
        data: mockEstimate,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await estimateCost({
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });
      expect(api.post).toHaveBeenCalledWith('/api/v1/llm/cost/estimate', {
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });
      expect(result.data).toEqual(mockEstimate);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent trace', async () => {
      vi.mocked(api.get).mockRejectedValue({
        response: { status: 404, data: { error: 'Trace not found' } },
      } as any);

      await expect(getTrace('non-existent')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle 400 for missing cost estimate fields', async () => {
      vi.mocked(api.post).mockRejectedValue({
        response: { status: 400, data: { error: 'Missing required fields' } },
      } as any);

      await expect(estimateCost({ modelId: '', inputTokens: 0, outputTokens: 0 })).rejects.toMatchObject({
        response: { status: 400 },
      });
    });
  });
});
