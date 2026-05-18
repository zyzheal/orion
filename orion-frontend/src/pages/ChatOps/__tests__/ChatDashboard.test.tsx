import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ChatDashboard from '../ChatDashboard';
import * as chatopsApi from '@/api/chatops';

vi.mock('@/api/chatops');
vi.mock('echarts-for-react', () => ({
  __esModule: true,
  default: () => <div data-testid="echarts" />,
}));

const mockStats = {
  metrics: { totalExecutions: 128, successRate: 94, failedCount: 8, avgResponseTime: 4.2 },
  trends: [{ date: '2026-05-13', executions: 15, successRate: 93 }],
  topCommands: [{ command: 'deploy', count: 72, successRate: 96 }],
  platformDistribution: [{ platform: 'web', count: 56 }],
  recentExecutions: [
    { id: '1', commandId: 'deploy', userId: 'user1', platform: 'web', status: 'completed', startTime: '2026-05-19T10:00:00Z', endTime: '2026-05-19T10:00:05Z' },
  ],
  comparison: { totalExecutions: 12, successRate: 3, failedCount: -5, avgResponseTime: -0.8 },
};

describe('ChatDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render metric cards when data is loaded', async () => {
    (chatopsApi.getDashboardStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: mockStats } });

    render(<ChatDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/总执行数/)).toBeInTheDocument();
      expect(screen.getByText('128')).toBeInTheDocument();
    });
  });

  it('should render empty state on API error', async () => {
    (chatopsApi.getDashboardStats as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    render(<ChatDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/后端服务暂不可用/)).toBeInTheDocument();
    });
  });

  it('should show loading skeleton on initial load', () => {
    (chatopsApi.getDashboardStats as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<ChatDashboard />);
    expect(screen.getByText(/ChatOps 总览看板/)).toBeInTheDocument();
  });
});