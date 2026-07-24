/**
 * Tests for useBiDashboard hook
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useBiDashboard } from '../useBiDashboard';
import * as biApi from '@/api/bi';

// Mock the BI API module
vi.mock('@/api/bi', () => ({
  getExecutiveDashboard: vi.fn(),
  getManagerDashboard: vi.fn(),
  getEngineerDashboard: vi.fn(),
}));

const mockExecutiveData = {
  data: {
    data: {
      overview: {
        totalTickets: 100,
        resolvedTickets: 80,
        openTickets: 20,
        overallResolutionRate: 80,
        avgResolutionTimeHours: 4.5,
        slaComplianceRate: 95,
        totalEngineers: 10,
        activeEngineers: 8,
      },
      trends: {
        ticketVolumeTrend: [],
        resolutionTimeTrend: [],
        slaComplianceTrend: [],
      },
      teamRanking: { topPerformers: [], bottomPerformers: [] },
      alerts: { slaBreachedCount: 0, overdueTicketsCount: 0, overloadedEngineers: 0, unassignedOlderThan24h: 0 },
      distribution: { byCategory: {}, byPriority: {} },
    },
  },
};

const mockManagerData = {
  data: {
    data: {
      teamOverview: { totalTickets: 50, resolvedCount: 40, avgResolutionTimeHours: 3.2, slaComplianceRate: 92, teamLoadPercentage: 75 },
      memberMetrics: [],
      weekOverWeek: { ticketsCreatedChange: 5, resolvedChange: 3, avgResolutionTimeChange: -2, slaComplianceChange: 1 },
      transferAnalysis: { totalTransfers: 10, avgTransfersPerTicket: 0.2, topTransferReasons: [] },
    },
  },
};

describe('useBiDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches executive dashboard data correctly', async () => {
    vi.mocked(biApi.getExecutiveDashboard).mockResolvedValue(mockExecutiveData as any);

    const { result } = renderHook(() => useBiDashboard('executive'));

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(biApi.getExecutiveDashboard).toHaveBeenCalledWith({ days: undefined });
    expect(result.current.data).toBeTruthy();
    expect(result.current.error).toBeNull();
  });

  it('fetches manager dashboard data with teamId param', async () => {
    vi.mocked(biApi.getManagerDashboard).mockResolvedValue(mockManagerData as any);

    const { result } = renderHook(() =>
      useBiDashboard('manager', { teamId: 'team-1', days: 7 })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(biApi.getManagerDashboard).toHaveBeenCalledWith({ teamId: 'team-1', days: 7 });
    expect(result.current.data).toBeTruthy();
  });

  it('handles API error gracefully, returns error state', async () => {
    vi.mocked(biApi.getExecutiveDashboard).mockRejectedValue(new Error('API unavailable'));

    const { result } = renderHook(() => useBiDashboard('executive'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('API unavailable');
    expect(result.current.data).toBeNull();
  });
});
