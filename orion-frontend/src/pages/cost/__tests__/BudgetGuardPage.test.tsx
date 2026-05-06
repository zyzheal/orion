/**
 * Tests for BudgetGuardPage
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BudgetGuardPage from '../BudgetGuardPage';
import * as costOpsApi from '@/api/cost-operations';

vi.mock('@/api/cost-operations', () => ({
  getBudgetGuards: vi.fn(),
  createBudgetGuard: vi.fn(),
  evaluateBudgetGuard: vi.fn(),
  getCostForecast: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey, columns }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

const mockGuards = [
  {
    id: 'guard-1',
    name: 'Production Budget Guard',
    description: 'Block pipelines that exceed production budget',
    budgetAmount: 10000,
    currency: 'CNY',
    action: 'block' as const,
    scope: { projectIds: ['proj-1'], environment: 'production' },
    status: 'active' as const,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-04-20T00:00:00Z',
  },
  {
    id: 'guard-2',
    name: 'Dev Budget Guard',
    description: null,
    budgetAmount: 5000,
    currency: 'CNY',
    action: 'warn' as const,
    scope: null,
    status: 'inactive' as const,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-03-10T00:00:00Z',
  },
];

const mockForecast = {
  predictedEndOfMonthCost: 15000,
  currentSpend: 8000,
  projectedOverage: 2000,
  confidence: 0.85,
  dailyForecast: [
    { date: '2026-05-08', predicted: 8500 },
    { date: '2026-05-09', predicted: 9000 },
  ],
};

const emptyApiResponse = { data: { data: [] } };
const guardApiResponse = { data: { data: mockGuards } };
const forecastApiResponse = { data: { data: mockForecast } };

describe('BudgetGuardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockResolvedValue(guardApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue(forecastApiResponse as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Budget Guard')).toBeTruthy();
    });

    expect(screen.getByText('Production Budget Guard')).toBeTruthy();
    expect(screen.getByText('Dev Budget Guard')).toBeTruthy();
  });

  it('displays empty state when no guards exist', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockResolvedValue(emptyApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue({ data: { data: null } } as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Budget Guard')).toBeTruthy();
    });

    expect(screen.queryByText('Production Budget Guard')).toBeNull();
  });

  it('displays error message when API fails', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockRejectedValue(new Error('Network error'));
    vi.mocked(costOpsApi.getCostForecast).mockRejectedValue(new Error('Network error'));

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText(/加载 Budget Guard 列表失败/)).toBeTruthy();
    });
  });

  it('opens create modal when Create Guard button is clicked', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockResolvedValue(emptyApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue({ data: { data: null } } as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Create Guard')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Create Guard'));

    await waitFor(() => {
      expect(screen.getByText('Create Budget Guard')).toBeTruthy();
    });
  });

  it('opens evaluation modal when Evaluate button is clicked', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockResolvedValue(emptyApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue({ data: { data: null } } as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Evaluate')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Evaluate'));

    await waitFor(() => {
      expect(screen.getByText('Budget Evaluation')).toBeTruthy();
    });
  });

  it('displays forecast data when available', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockResolvedValue(emptyApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue(forecastApiResponse as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Cost Forecast')).toBeTruthy();
    });

    expect(screen.getByText('Current Spend')).toBeTruthy();
    expect(screen.getByText('Predicted End of Month')).toBeTruthy();
  });

  it('filters guards by search query', async () => {
    vi.mocked(costOpsApi.getBudgetGuards).mockResolvedValue(guardApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue({ data: { data: null } } as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Production Budget Guard')).toBeTruthy();
    });

    // Find search input and filter
    const searchInput = screen.getByPlaceholderText('Search guards...');
    fireEvent.change(searchInput, { target: { value: 'Production' } });

    // Table should re-render with filtered data (via useMemo)
    expect(screen.getByText('Production Budget Guard')).toBeTruthy();
  });

  it('refreshes data when Refresh button is clicked', async () => {
    vi.mocked(costOpsApi.getBudgetGuards)
      .mockResolvedValueOnce(emptyApiResponse as any)
      .mockResolvedValueOnce(guardApiResponse as any);
    vi.mocked(costOpsApi.getCostForecast).mockResolvedValue({ data: { data: null } } as any);

    render(<BudgetGuardPage />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(costOpsApi.getBudgetGuards).toHaveBeenCalledTimes(2);
    });
  });
});
