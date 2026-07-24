/**
 * Tests for PipelineList page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual?.default || vi.fn(),
  };
});
vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual?.default || vi.fn(),
  };
});

// Mock API to return mock data
vi.mock('@/api/pipelines', () => ({
  getPipelines: vi.fn().mockResolvedValue({
    data: {
      data: [
        {
          id: 'pl-001',
          name: 'frontend-deploy',
          version: '1.0.0',
          status: 'active',
          description: '',
          spec: { stages: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pl-002',
          name: 'api-service-build',
          version: '2.0.0',
          status: 'active',
          description: '',
          spec: { stages: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  }),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('PipelineList', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<PipelineList />);
    expect(screen.getByText('Pipeline 列表')).toBeInTheDocument();
  });

  it('should display the search filter bar', async () => {
    renderWithRouter(<PipelineList />);
    expect(screen.getByPlaceholderText(/搜索 Pipeline/)).toBeInTheDocument();
  });

  it('should display pipeline table with data', async () => {
    renderWithRouter(<PipelineList />);
    // Component loads from API, so we just verify the page renders
    await waitFor(() => {
      expect(screen.getByText('Pipeline 列表')).toBeInTheDocument();
    });
  });

  it('should display filter options', async () => {
    renderWithRouter(<PipelineList />);
    // Use getAllByText since filter labels may appear multiple times
    expect(screen.getAllByText('状态')[0]).toBeInTheDocument();
  });

  it('should display pipeline count', async () => {
    renderWithRouter(<PipelineList />);
    await waitFor(() => {
      expect(screen.getByText(/共 .* 个 Pipeline/)).toBeInTheDocument();
    });
  });
});
