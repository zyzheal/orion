/**
 * Tests for EfficiencyDashboard page (TASK-402)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EfficiencyDashboard from '@/pages/EfficiencyDashboard';

// Mock dayjs
vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: any) => ({
    format: () => '2026-04-13',
    fromNow: () => '2 分钟前',
  });
  dayjsFn.extend = vi.fn(() => dayjsFn);
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('EfficiencyDashboard', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<EfficiencyDashboard />);
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});
