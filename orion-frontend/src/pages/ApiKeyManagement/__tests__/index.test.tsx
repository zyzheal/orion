/**
 * Tests for ApiKeyManagement page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApiKeyManagement from '../index';
import * as apiKeyApi from '@/api/api-key';

vi.mock('@/api/api-key', () => ({
  getApiKeys: vi.fn(),
  getApiKeyStats: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/MetricCard', () => ({
  default: ({ title, value }: any) => (
    <div data-testid="metric-card">{title}: {value}</div>
  ),
}));

const mockKeys = [
  { id: '1', name: 'ci-pipeline-key', key: 'sk_live_abc123def456', userId: 'u1', enabled: true, createdAt: '2026-01-01T00:00:00Z' },
];

const mockStats = { total: 5, active: 4, expired: 1 };

describe('ApiKeyManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(apiKeyApi.getApiKeys).mockResolvedValue({ data: { data: { keys: mockKeys } } } as any);
    vi.mocked(apiKeyApi.getApiKeyStats).mockResolvedValue({ data: { data: { stats: mockStats } } } as any);

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('ci-pipeline-key')).toBeTruthy();
    expect(screen.getByText('API Key 管理')).toBeTruthy();
  });

  it('opens create modal on button click', async () => {
    vi.mocked(apiKeyApi.getApiKeys).mockResolvedValue({ data: { data: { keys: [] } } } as any);
    vi.mocked(apiKeyApi.getApiKeyStats).mockResolvedValue({ data: { data: { stats: mockStats } } } as any);

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByText('新建 Key')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('新建 Key'));

    await waitFor(() => {
      expect(screen.getByText('新建 API Key')).toBeTruthy();
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(apiKeyApi.getApiKeys).mockRejectedValue(new Error('Network error'));
    vi.mocked(apiKeyApi.getApiKeyStats).mockRejectedValue(new Error('Network error'));

    render(<ApiKeyManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载 API Key 列表失败')).toBeTruthy();
    });
  });
});
