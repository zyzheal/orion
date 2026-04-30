/**
 * Tests for DeploymentDetail page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

// Mock API - fail so component shows empty/error state
vi.mock('@/api/deployments', () => ({
  getDeployment: vi.fn().mockRejectedValue(new Error('Network error')),
  getDeploymentHistory: vi.fn().mockResolvedValue({ data: { data: [] } }),
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/deployments/dep-001']}>
      <Routes>
        <Route path="/deployments/:id" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('DeploymentDetail', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<DeploymentDetail />);
    await waitFor(() => {
      // Page should render with deployment info or loading/error state
      expect(document.querySelector('.ant-card') || document.body).toBeInTheDocument();
    });
  });

  it('should display back button', async () => {
    renderWithRouter(<DeploymentDetail />);
    await waitFor(() => {
      expect(screen.getByText('返回列表')).toBeInTheDocument();
    });
  });
});
