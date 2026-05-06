/**
 * LLM Trace Dashboard Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the llm-trace API
vi.mock('@/api/llm-trace', () => ({
  getDailyStats: vi.fn().mockResolvedValue({
    data: {
      data: {
        date: '2026-05-04',
        tenantId: 1,
        totalTraces: 150,
        completedTraces: 142,
        failedTraces: 8,
        totalInputTokens: 50000,
        totalOutputTokens: 25000,
        totalCost: 12.5,
        averageLatencyMs: 850,
        topModels: [{ modelId: 'gpt-4', count: 100, cost: 10 }],
        topScenarios: [{ scenarioId: 'autofix', count: 50, cost: 5 }],
      },
    },
  }),
  getPricing: vi.fn().mockResolvedValue({
    data: {
      data: {
        currency: 'CNY',
        pricing: [{ modelId: 'gpt-4', provider: 'openai', inputPricePerToken: 0.03, outputPricePerToken: 0.06 }],
      },
    },
  }),
  getTraces: vi.fn().mockResolvedValue({
    data: {
      data: {
        data: [{ traceId: 'trace-001', scenarioId: 'autofix', modelId: 'gpt-4', status: 'completed' }],
        total: 1,
      },
    },
  }),
  getCostBreakdown: vi.fn().mockResolvedValue({
    data: {
      data: {
        tenantId: 1,
        totalTraces: 500,
        totalCost: 89.5,
        inputCost: 30,
        outputCost: 59.5,
        modelBreakdown: [{ modelId: 'gpt-4', traces: 200, cost: 50 }],
      },
    },
  }),
  getTrackingAccuracy: vi.fn().mockResolvedValue({
    data: {
      data: {
        accuracy: 0.98,
        completed: 1000,
        failed: 20,
        total: 1020,
        targetAccuracy: 0.98,
        meetsTarget: true,
      },
    },
  }),
}));

describe('LLMTraceDashboard', () => {
  it('should render layout with navigation', async () => {
    const LLMTraceDashboardLayout = await import('@/pages/LLMTraceDashboard').then((m) => m.default);
    render(
      <BrowserRouter>
        <LLMTraceDashboardLayout />
      </BrowserRouter>
    );

    // Check menu items exist
    expect(screen.getByText('追踪总览')).toBeDefined();
    expect(screen.getByText('调用记录')).toBeDefined();
    expect(screen.getByText('成本分析')).toBeDefined();
    expect(screen.getByText('追踪精度')).toBeDefined();
  });

  it('should render TraceOverview with stats', async () => {
    const TraceOverview = await import('@/pages/LLMTraceDashboard/TraceOverview').then((m) => m.default);
    render(
      <BrowserRouter>
        <TraceOverview />
      </BrowserRouter>
    );

    // Wait for loading to complete and title to appear
    await waitFor(() => {
      expect(screen.getByText('LLM 追踪总览')).toBeDefined();
    });
  });

  it('should render TraceList with filters', async () => {
    const TraceList = await import('@/pages/LLMTraceDashboard/TraceList').then((m) => m.default);
    render(
      <BrowserRouter>
        <TraceList />
      </BrowserRouter>
    );

    expect(screen.getByText('LLM 调用记录')).toBeDefined();
  });

  it('should render CostAnalysis with date picker', async () => {
    const CostAnalysis = await import('@/pages/LLMTraceDashboard/CostAnalysis').then((m) => m.default);
    render(
      <BrowserRouter>
        <CostAnalysis />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LLM 成本分析')).toBeDefined();
    });
  });

  it('should render TrackingAccuracy with progress', async () => {
    const TrackingAccuracy = await import('@/pages/LLMTraceDashboard/TrackingAccuracy').then((m) => m.default);
    render(
      <BrowserRouter>
        <TrackingAccuracy />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('追踪精度监控')).toBeDefined();
    });
  });
});