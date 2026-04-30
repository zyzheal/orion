/**
 * Tests for CostOverview page
 */
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as aiCostApi from '@/api/ai-cost';

// Mock antd components and hooks
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Typography: {
      Title: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
      Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    message: {
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
    },
  };
});

vi.mock('@/api/ai-cost', () => ({
  getDashboardData: vi.fn(),
  getModelPricing: vi.fn(),
}));

vi.mock('@/tokens/colors', () => ({
  colors: {
    error: { 600: '#ff4d4f' },
    success: { 600: '#52c41a' },
  },
}));

vi.mock('@/tokens/spacing', () => ({
  spacing: [0, 4, 8, 12, 16, 24, 32],
}));

vi.mock('dayjs', () => {
  const dayjs = () => ({
    format: () => '04-30',
    subtract: () => ({ format: () => '04-30' }),
  });
  dayjs.extend = () => {};
  return dayjs;
});

describe('CostOverview', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads from API on mount', async () => {
    vi.mocked(aiCostApi.getDashboardData).mockResolvedValue({
      data: {
        code: 200,
        message: 'success',
        data: {
          todayCost: 100.0,
          totalTokens: 1000000,
          totalRequests: 500,
          budgetUsage: 50.0,
          dailyTrend: [],
          topTenants: [],
          topUsers: [],
          modelDistribution: [],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    vi.mocked(aiCostApi.getModelPricing).mockResolvedValue({
      data: { code: 200, message: 'success', data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    const CostOverview = (await import('../CostOverview')).default;

    render(<CostOverview />);

    await waitFor(() => {
      expect(aiCostApi.getDashboardData).toHaveBeenCalled();
    });
  });

  it('shows error on failure', async () => {
    vi.mocked(aiCostApi.getDashboardData).mockRejectedValue(new Error('Network error'));
    vi.mocked(aiCostApi.getModelPricing).mockRejectedValue(new Error('Network error'));

    const CostOverview = (await import('../CostOverview')).default;

    render(<CostOverview />);

    const { message } = await import('antd');
    await waitFor(() => {
      expect(message.error).toHaveBeenCalled();
    }, { timeout: 10000 });
  });
});
