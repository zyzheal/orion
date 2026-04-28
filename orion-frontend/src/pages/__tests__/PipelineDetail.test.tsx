/**
 * Tests for PipelineDetail page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter initialEntries={['/pipelines/pl-001']}>{ui}</MemoryRouter>);
};

describe('PipelineDetail', () => {
  it('should render without crashing', () => {
    renderWithRouter(<PipelineDetail />);
    expect(screen.getByText(/#142/)).toBeInTheDocument();
  });

  it('should display pipeline name and run number', () => {
    renderWithRouter(<PipelineDetail />);
    // Text is "frontend-deploy #142", match by pattern
    expect(screen.getByText(/frontend-deploy/)).toBeInTheDocument();
  });

  it('should display re-run button', () => {
    renderWithRouter(<PipelineDetail />);
    expect(screen.getByText('重新运行')).toBeInTheDocument();
  });

  it('should display back button', () => {
    renderWithRouter(<PipelineDetail />);
    expect(screen.getByText('返回列表')).toBeInTheDocument();
  });
});
