/**
 * Tests for Console page - Phase 6 integration verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Console from '@/pages/Console';

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Console - Phase 6 Integration', { timeout: 15000 }, () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders Phase 6 service governance section', async () => {
    renderWithProviders(<Console />);
    await waitFor(() => {
      expect(screen.getByText('Phase 6 服务治理')).toBeTruthy();
    });
  });

  it('renders service registry card', async () => {
    renderWithProviders(<Console />);
    await waitFor(() => {
      expect(screen.getByText('服务注册中心')).toBeTruthy();
    });
  });

  it('renders gateway routes management card', async () => {
    renderWithProviders(<Console />);
    await waitFor(() => {
      expect(screen.getByText('网关路由管理')).toBeTruthy();
    });
  });

  it('renders health dashboard card', async () => {
    renderWithProviders(<Console />);
    await waitFor(() => {
      expect(screen.getByText('健康仪表盘')).toBeTruthy();
    });
  });

  it('renders service topology card', async () => {
    renderWithProviders(<Console />);
    await waitFor(() => {
      expect(screen.getByText('服务拓扑')).toBeTruthy();
    });
  });

  it('Phase 6 cards have correct navigation links', async () => {
    renderWithProviders(<Console />);
    await waitFor(() => {
      const cards = screen.getAllByRole('link');
      const hrefs = cards.map(c => c.getAttribute('href'));
      expect(hrefs).toContain('/service-registry');
      expect(hrefs).toContain('/gateway-routes');
      expect(hrefs).toContain('/health-dashboard');
      expect(hrefs).toContain('/service-topology');
    });
  });
});
