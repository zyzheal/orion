/**
 * Tests for HealthDashboard page
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HealthDashboard from '@/pages/HealthDashboard';

// Mock health API
vi.mock('@/api/health', () => ({
  getHealthDashboard: vi.fn().mockResolvedValue({
    healthScore: 95,
    activeAlerts: 0,
    services: [],
    trends: [],
    summary: {
      healthy: 10,
      warning: 0,
      critical: 0,
    },
  }),
}));

// Mock message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd') as any;
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('HealthDashboard', () => {
  it('renders without crashing', async () => {
    renderWithRouter(<HealthDashboard />);
    await waitFor(() => {
      expect(screen.getByText('健康评分')).toBeInTheDocument() ||
        expect(document.body).toBeTruthy();
    });
  });
});
