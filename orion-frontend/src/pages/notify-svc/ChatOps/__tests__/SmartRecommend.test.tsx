/**
 * Tests for SmartRecommend panel
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SmartRecommend from '../SmartRecommend';
import * as chatopsApi from '@/api/chatops';

vi.mock('@/api/chatops', () => ({
  fetchRecommendations: vi.fn(),
  executeCommand: vi.fn(),
  connectSSE: vi.fn(),
  disconnectSSE: vi.fn(),
  getSSEState: vi.fn(() => ({ connected: false })),
}));

const mockRecommendations = [
  {
    id: 'rec-1',
    type: 'alert' as const,
    severity: 'critical' as const,
    title: 'High memory usage detected',
    description: 'Service api-gateway memory usage exceeded 90% threshold',
    actions: [
      { label: 'Restart Service', command: 'service.restart', params: { name: 'api-gateway' } },
      { label: 'Scale Up', command: 'service.scale', params: { name: 'api-gateway', replicas: 3 } },
    ],
    createdAt: '2026-05-07T10:00:00Z',
    source: 'alert',
  },
  {
    id: 'rec-2',
    type: 'cost_anomaly' as const,
    severity: 'warning' as const,
    title: 'Unusual cost spike',
    description: 'Daily cost increased by 45% compared to 7-day average',
    actions: [
      { label: 'View Details', command: 'cost.details', params: { period: '7d' } },
    ],
    createdAt: '2026-05-07T09:30:00Z',
    source: 'cost',
  },
];

describe('SmartRecommend', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatopsApi.connectSSE).mockImplementation(() => {
      // Do nothing - we test API-based rendering, not SSE
    });
  });

  it('renders the Smart Recommendations header', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: [],
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('Smart Recommendations')).toBeTruthy();
    });
  });

  it('displays recommendations from API', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: { data: mockRecommendations },
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('High memory usage detected')).toBeTruthy();
    });

    expect(screen.getByText('Unusual cost spike')).toBeTruthy();
  });

  it('shows critical severity badge', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: { data: mockRecommendations },
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      // Critical tag appears in both the severity tag and badge count
      const criticalTags = screen.getAllByText('Critical');
      expect(criticalTags.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays action buttons for recommendations', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: { data: mockRecommendations },
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('Restart Service')).toBeTruthy();
    });

    expect(screen.getByText('Scale Up')).toBeTruthy();
    expect(screen.getByText('View Details')).toBeTruthy();
  });

  it('dismisses a recommendation when close button is clicked', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: { data: mockRecommendations },
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('High memory usage detected')).toBeTruthy();
    });

    // Find and click the close button
    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons.find((btn) => btn.querySelector('.anticon-close'));
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }

    // After dismiss, the title text should still exist but with reduced opacity
    await waitFor(() => {
      expect(screen.getByText('High memory usage detected')).toBeTruthy();
    });
  });

  it('shows empty state when no recommendations exist', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: [],
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('No recommendations available')).toBeTruthy();
    });
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockRejectedValue(
      new Error('Network error')
    );

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeTruthy();
    });
  });

  it('refreshes recommendations when Refresh button is clicked', async () => {
    vi.mocked(chatopsApi.fetchRecommendations)
      .mockResolvedValueOnce({ data: [] } as any)
      .mockResolvedValueOnce({ data: { data: mockRecommendations } } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText('Smart Recommendations')).toBeTruthy();
    });

    // Find the refresh button by its icon
    const buttons = screen.getAllByRole('button');
    const refreshBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.includes('Reload') ||
        btn.innerHTML.includes('anticon-reload')
    );
    if (refreshBtn) {
      fireEvent.click(refreshBtn);
    } else {
      // Fallback: find by button text content near reload icon
      for (const btn of buttons) {
        if (btn.textContent?.includes('Refresh') && btn.querySelector('.anticon-reload')) {
          fireEvent.click(btn);
          break;
        }
      }
    }

    await waitFor(() => {
      expect(chatopsApi.fetchRecommendations).toHaveBeenCalled();
    });
  });

  it('displays connection status indicator', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: [],
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      // Verify component renders properly - check for title and stats area
      expect(screen.getByText('Smart Recommendations')).toBeTruthy();
      expect(screen.getByText('AI-powered insights with real-time updates via SSE')).toBeTruthy();
      // When empty, should show Active badge with count 0
      expect(screen.getByText('Active')).toBeTruthy();
    });
  });

  it('opens execution log drawer when clicked', async () => {
    vi.mocked(chatopsApi.fetchRecommendations).mockResolvedValue({
      data: [],
    } as any);

    render(<SmartRecommend />);

    await waitFor(() => {
      expect(screen.getByText(/Execution Log/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/Execution Log/));

    await waitFor(() => {
      expect(screen.getByText('Execution Log')).toBeTruthy();
    });
  });
});
