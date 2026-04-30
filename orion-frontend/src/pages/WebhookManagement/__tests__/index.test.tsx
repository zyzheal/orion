/**
 * Tests for WebhookManagement page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebhookManagement from '../index';
import * as webhookApi from '@/api/webhook';

vi.mock('@/api/webhook', () => ({
  getWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
  getWebhookLogs: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, columns, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.url}
        </div>
      ))}
    </div>
  ),
}));

const mockWebhooks = [
  { id: '1', url: 'https://example.com/hook', events: ['pipeline.completed'], enabled: true, failureCount: 0, lastStatus: 200, lastTriggeredAt: '2026-04-29T10:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-04-29T10:00:00Z' },
];

describe('WebhookManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then displays data', async () => {
    vi.mocked(webhookApi.getWebhooks).mockResolvedValue({ data: { data: { webhooks: mockWebhooks } } } as any);

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('orion-table')).toBeTruthy();
    });

    expect(screen.getByText('https://example.com/hook')).toBeTruthy();
    expect(screen.getByText('Webhook 管理')).toBeTruthy();
  });

  it('opens create modal on button click', async () => {
    vi.mocked(webhookApi.getWebhooks).mockResolvedValue({ data: { data: { webhooks: [] } } } as any);

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('新建 Webhook')).toBeTruthy();
    });

    // Use getAllByText since both button and modal title contain "新建 Webhook"
    const buttons = screen.getAllByText('新建 Webhook');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getAllByText('新建 Webhook').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(webhookApi.getWebhooks).mockRejectedValue(new Error('Network error'));

    render(<WebhookManagement />);

    await waitFor(() => {
      expect(screen.getByText('加载 Webhook 列表失败')).toBeTruthy();
    });
  });
});
