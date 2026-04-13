/**
 * Tests for PipelineList page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PipelineList from '@/pages/PipelineList';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: any) => ({
    format: () => '2026-04-12 15:00:00',
    fromNow: () => '2 minutes ago',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  dayjsFn.duration = vi.fn((seconds: number) => ({
    asMinutes: () => Math.floor(seconds / 60),
    seconds: () => seconds % 60,
  }));
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

// Mock dayjs plugins
vi.mock('dayjs/plugin/duration', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual.default || vi.fn(),
  };
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

describe('PipelineList', () => {
  it('should render without crashing', () => {
    renderWithRouter(<PipelineList />);
    expect(screen.getByText('Pipeline 列表')).toBeInTheDocument();
  });

  it('should display the search filter bar', () => {
    renderWithRouter(<PipelineList />);
    expect(screen.getByPlaceholderText('搜索 Pipeline 名称、分支、提交...')).toBeInTheDocument();
  });

  it('should display pipeline table with data', () => {
    renderWithRouter(<PipelineList />);
    expect(screen.getByText('frontend-deploy')).toBeInTheDocument();
    expect(screen.getByText('api-service-build')).toBeInTheDocument();
    expect(screen.getByText('test-suite')).toBeInTheDocument();
  });

  it('should display filter options', () => {
    renderWithRouter(<PipelineList />);
    // Use getAllByText since filter labels may appear multiple times
    expect(screen.getAllByText('状态')[0]).toBeInTheDocument();
    expect(screen.getAllByText('分支')[0]).toBeInTheDocument();
  });

  it('should display pipeline count', () => {
    renderWithRouter(<PipelineList />);
    expect(screen.getByText(/共 .* 个 Pipeline 运行记录/)).toBeInTheDocument();
  });
});
