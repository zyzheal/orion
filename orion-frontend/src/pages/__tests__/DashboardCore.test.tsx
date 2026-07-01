/**
 * Tests for DashboardCore page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardCore from '@/pages/DashboardCore';

// Mock API calls to return successful responses
vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/efficiency/dashboard') {
        return Promise.resolve({
          data: {
            dashboard: {
              dora: {
                deploymentFrequency: 3.5,
              },
              summary: {
                totalDeployments: 100,
                successfulDeployments: 85,
                failedDeployments: 15,
              },
            },
          },
        });
      }
      if (url === '/v1/alerts') {
        return Promise.resolve({
          data: {
            activeCount: 3,
            data: [
              {
                id: 'alert-1',
                metric: 'CPU过高',
                message: '服务器CPU使用率超过90%',
                status: 'active',
                created_at: '2026-04-12T10:00:00Z',
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: null });
    }),
  },
}));

// Mock dayjs relativeTime plugin
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  return {
    ...(actual as any),
    extend: vi.fn(() => ({ format: () => '2026-04-12 15:00' })),
  };
});

// Mock the dayjs plugins
vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual?.default || vi.fn(),
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('DashboardCore', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<DashboardCore />);
    await waitFor(() => {
      expect(screen.getByText('工作台')).toBeInTheDocument();
    });
  });

  it('should display KPI metric cards', async () => {
    renderWithRouter(<DashboardCore />);
    await waitFor(() => {
      expect(screen.getByText('Pipeline 成功率')).toBeInTheDocument();
      expect(screen.getByText('部署频率')).toBeInTheDocument();
      expect(screen.getByText('活跃告警')).toBeInTheDocument();
      expect(screen.getByText('系统健康度')).toBeInTheDocument();
    });
  });

  it('should display recent activity section', async () => {
    renderWithRouter(<DashboardCore />);
    await waitFor(() => {
      expect(screen.getByText('最近活动')).toBeInTheDocument();
    });
  });

  it('should display quick actions section', async () => {
    renderWithRouter(<DashboardCore />);
    await waitFor(() => {
      expect(screen.getByText('快速操作')).toBeInTheDocument();
      expect(screen.getByText('创建 Pipeline')).toBeInTheDocument();
      expect(screen.getByText('部署应用')).toBeInTheDocument();
    });
  });

  it('should display system health section', async () => {
    renderWithRouter(<DashboardCore />);
    await waitFor(() => {
      expect(screen.getByText('系统健康')).toBeInTheDocument();
      expect(screen.getByText('API Gateway')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
    });
  });
});
