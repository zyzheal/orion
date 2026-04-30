/**
 * Tests for PipelineDetail page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PipelineDetail from '@/pages/PipelineDetail';

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

vi.mock('dayjs/plugin/duration', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual?.default || vi.fn(),
  };
});

// Mock API calls - fail so component falls back to mock data
vi.mock('@/api/pipelines', () => ({
  getPipelineRun: vi.fn().mockRejectedValue(new Error('Network error')),
  retryPipelineRun: vi.fn().mockResolvedValue({}),
}));

// Mock window.location to prevent navigation errors
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/pipelines/pl-001']}>
      <Routes>
        <Route path="/pipelines/:id" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('PipelineDetail', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<PipelineDetail />);
    await waitFor(() => {
      expect(screen.getByText(/#142/)).toBeInTheDocument();
    });
  });

  it('should display pipeline name and run number', async () => {
    renderWithRouter(<PipelineDetail />);
    await waitFor(() => {
      expect(screen.getByText(/frontend-deploy/)).toBeInTheDocument();
    });
  });

  it('should display re-run button', async () => {
    renderWithRouter(<PipelineDetail />);
    await waitFor(() => {
      expect(screen.getByText('重新运行')).toBeInTheDocument();
    });
  });

  it('should display back button', async () => {
    renderWithRouter(<PipelineDetail />);
    await waitFor(() => {
      expect(screen.getByText('返回列表')).toBeInTheDocument();
    });
  });
});
