/**
 * Tests for SbomDashboard page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import SbomDashboard from '@/pages/SbomDashboard';

vi.mock('@/api/sbom', async () => {
  const actual = await vi.importActual<typeof import('@/api/sbom')>('@/api/sbom');
  return {
    ...actual,
    getSbomDocuments: vi.fn().mockResolvedValue({ data: { data: [
      { id: '1', documentId: 'DOC-001', buildId: 'build-1', format: 'cyclonedx', packageCount: 50, status: 'active', createdAt: '2024-01-01' },
      { id: '2', documentId: 'DOC-002', buildId: 'build-2', format: 'spdx', packageCount: 30, status: 'active', createdAt: '2024-02-01' },
    ]}}),
    getSbomWaivers: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getSbomComplianceReport: vi.fn().mockResolvedValue({ data: { data: { totalSboms: 2, compliantSboms: 2, criticalVulns: 0, complianceRate: 95.5 } } }),
  };
});

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('SbomDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard title', async () => {
    renderWithProviders(<SbomDashboard />);
    await waitFor(() => expect(screen.getByText('SBOM 供应链仪表盘')).toBeTruthy());
  });

  it('renders ECharts components', async () => {
    renderWithProviders(<SbomDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });

  it('renders summary cards', async () => {
    renderWithProviders(<SbomDashboard />);
    await waitFor(() => {
      expect(screen.getByText('SBOM 总数')).toBeTruthy();
      expect(screen.getByText('覆盖率')).toBeTruthy();
      expect(screen.getByText('总包数')).toBeTruthy();
      // GaugeChart title is in mocked option
      expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0);
    });
  });
});
