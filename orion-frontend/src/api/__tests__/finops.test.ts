import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostOverview, getBudgets, getBudget, createBudget, updateBudget, deleteBudget,
  getBudgetStatus, getRecommendations, getReports, getFinOpsMetrics } from '../finops';
import { api } from '../client';

vi.mock('../client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

describe('FinOps API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should get cost overview', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { total: 1000 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getCostOverview({ period: 'monthly' });
    expect(api.get).toHaveBeenCalledWith('/finops/cost-overview', { params: { period: 'monthly' } });
  });

  it('should list budgets', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { budgets: [] } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getBudgets();
    expect(api.get).toHaveBeenCalledWith('/finops/budgets', { params: undefined });
  });

  it('should get budget by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { budget: { id: '1' } } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getBudget('1');
    expect(api.get).toHaveBeenCalledWith('/finops/budgets/1');
  });

  it('should create budget', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { budget: { id: '1' } } }, status: 201, statusText: 'Created', headers: {}, config: {} } as any);
    await createBudget({ name: 'test-budget', limit: 10000 });
    expect(api.post).toHaveBeenCalledWith('/finops/budgets', { name: 'test-budget', limit: 10000 });
  });

  it('should update budget', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { budget: { id: '1' } } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await updateBudget('1', { limit: 20000 });
    expect(api.put).toHaveBeenCalledWith('/finops/budgets/1', { limit: 20000 });
  });

  it('should delete budget', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await deleteBudget('1');
    expect(api.delete).toHaveBeenCalledWith('/finops/budgets/1');
  });

  it('should get budget status', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { status: { percentUsed: 0.8 } } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getBudgetStatus('1');
    expect(api.get).toHaveBeenCalledWith('/finops/budgets/1/status');
  });

  it('should get recommendations', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { optimizations: [] } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getRecommendations();
    expect(api.get).toHaveBeenCalledWith('/finops/recommendations', { params: undefined });
  });

  it('should get reports', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { reports: [] } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getReports();
    expect(api.get).toHaveBeenCalledWith('/finops/reports', { params: undefined });
  });

  it('should get FinOps metrics', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { totalCost: 1000 } }, status: 200, statusText: 'OK', headers: {}, config: {} } as any);
    await getFinOpsMetrics();
    expect(api.get).toHaveBeenCalledWith('/finops/metrics');
  });
});
