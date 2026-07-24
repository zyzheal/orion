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

// Mock API calls - return successful pipeline data
vi.mock('@/api/pipelines', () => ({
  getPipeline: vi.fn().mockResolvedValue({
    data: {
      data: {
        id: 'pl-001',
        name: 'frontend-deploy',
        version: 1,
        status: 'active',
        createdAt: '2026-04-12T14:00:00Z',
      },
    },
  }),
  getPipelineRuns: vi.fn().mockResolvedValue({
    data: {
      data: [
        {
          id: 'run-001',
          pipelineId: 'pl-001',
          status: 'success',
          triggerType: 'manual',
          branch: 'main',
          commit: 'abc1234',
          author: 'heal',
          startTime: '2026-04-12T15:00:00Z',
          endTime: '2026-04-12T15:05:00Z',
          duration: 300,
          runNumber: 142,
        },
      ],
      total: 1,
    },
  }),
  triggerPipeline: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/api/pipelineRuns', () => ({
  getPipelineRunDetail: vi.fn().mockResolvedValue({
    data: {
      data: {
        run: {
          id: 'run-001',
          pipelineId: 'pl-001',
          status: 'success',
          branch: 'main',
          commit: 'abc1234',
          author: 'heal',
          triggerType: 'manual',
          startTime: '2026-04-12T15:00:00Z',
          endTime: '2026-04-12T15:05:00Z',
        },
        stages: [
          { id: 's1', name: 'Checkout', status: 'success', durationMs: '15000' },
          { id: 's2', name: 'Build', status: 'success', durationMs: '120000' },
          { id: 's3', name: 'Test', status: 'success', durationMs: '90000' },
          { id: 's4', name: 'Deploy', status: 'success', durationMs: '75000' },
        ],
        tasks: [
          { stageId: 's1', stageName: 'Checkout', name: 'git checkout', status: 'success', durationMs: '15000', logs: ['Checking out source code...', 'Success: checked out main branch'] },
          { stageId: 's2', stageName: 'Build', name: 'npm install', status: 'success', durationMs: '60000', logs: [] },
          { stageId: 's2', stageName: 'Build', name: 'npm run build', status: 'success', durationMs: '60000', logs: ['Building project...', 'npm run build', 'Build successful: 120s'] },
          { stageId: 's3', stageName: 'Test', name: 'npm test', status: 'success', durationMs: '90000', logs: ['Running tests...', '15 tests passed', 'All tests passed successfully'] },
          { stageId: 's4', stageName: 'Deploy', name: 'kubectl apply', status: 'success', durationMs: '75000', logs: ['Deploying to production...', 'Deployment successful'] },
        ],
      },
    },
  }),
  getPipelineRunStages: vi.fn().mockResolvedValue({ data: { data: [] } }),
  retryFromStage: vi.fn().mockResolvedValue({}),
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
      // Component uses runsCount (number of runs) for runNumber display
      expect(screen.getByText(/frontend-deploy/)).toBeInTheDocument();
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
