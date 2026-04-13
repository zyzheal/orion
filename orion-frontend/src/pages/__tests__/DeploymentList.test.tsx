/**
 * Tests for DeploymentList page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DeploymentList from '@/pages/DeploymentList';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: any) => ({
    format: () => '04-12 15:00',
    fromNow: () => '10 minutes ago',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual.default || vi.fn(),
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('DeploymentList', () => {
  it('should render without crashing', () => {
    renderWithRouter(<DeploymentList />);
    expect(screen.getByText('部署管理')).toBeInTheDocument();
  });

  it('should display deployment table with data', () => {
    renderWithRouter(<DeploymentList />);
    expect(screen.getByText('api-gateway')).toBeInTheDocument();
    expect(screen.getByText('platform-service')).toBeInTheDocument();
  });

  it('should display search filter bar', () => {
    renderWithRouter(<DeploymentList />);
    expect(screen.getByPlaceholderText('搜索应用名称、版本、提交...')).toBeInTheDocument();
  });

  it('should display deployment count', () => {
    renderWithRouter(<DeploymentList />);
    expect(screen.getByText(/共 .* 条部署记录/)).toBeInTheDocument();
  });
});
