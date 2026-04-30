/**
 * Tests for DeploymentList page (TASK-905)
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: actual?.default || vi.fn(),
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('DeploymentList', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<DeploymentList />);
    // Page should render (may be empty if API fails)
    expect(document.body).toBeInTheDocument();
  });
});
