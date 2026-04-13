/**
 * Tests for DeploymentDetail page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeploymentDetail from '@/pages/DeploymentDetail';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: any) => ({
    format: () => '2026-04-12 15:00:00',
    fromNow: () => '10 minutes ago',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/deployments/dep-001']}>
      {ui}
    </MemoryRouter>
  );
};

describe('DeploymentDetail', () => {
  it('should render without crashing', () => {
    renderWithRouter(<DeploymentDetail />);
    expect(screen.getByText('部署详情: api-gateway')).toBeInTheDocument();
  });

  it('should display deployment version', () => {
    renderWithRouter(<DeploymentDetail />);
    expect(screen.getByText('v2.3.1')).toBeInTheDocument();
  });

  it('should display back button', () => {
    renderWithRouter(<DeploymentDetail />);
    expect(screen.getByText('返回列表')).toBeInTheDocument();
  });

  it('should show rollback button for successful deployments', () => {
    renderWithRouter(<DeploymentDetail />);
    expect(screen.getByText('回滚到此版本')).toBeInTheDocument();
  });

  it('should display health check section', () => {
    renderWithRouter(<DeploymentDetail />);
    expect(screen.getByText('健康检查')).toBeInTheDocument();
  });
});
