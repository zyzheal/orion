/**
 * Tests for NotificationRules page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationRules from '../index';
import * as notificationRulesApi from '@/api/notificationRules';

vi.mock('@/api/notificationRules', () => ({
  getIMNotificationRules: vi.fn(),
  createIMNotificationRule: vi.fn(),
  updateIMNotificationRule: vi.fn(),
  deleteIMNotificationRule: vi.fn(),
  toggleIMNotificationRule: vi.fn(),
  testIMNotificationRule: vi.fn(),
}));

vi.mock('@/api/webhook', () => ({
  getWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
  getWebhookLogs: vi.fn(),
}));

vi.mock('@/components/Table', () => ({
  default: ({ dataSource, loading, rowKey }: any) => (
    <div data-testid="orion-table" data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]} data-testid={`row-${item[rowKey]}`}>
          {item.name || item.url}
        </div>
      ))}
    </div>
  ),
}));

const mockIMRules = [
  {
    id: '1',
    platform: 'dingtalk',
    name: '研发群通知',
    webhookUrl: 'https://oapi.dingtalk.com/robot/send',
    events: ['pipeline.complete', 'pipeline.failed'],
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('NotificationRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header with tab navigation', async () => {
    vi.mocked(notificationRulesApi.getIMNotificationRules).mockResolvedValue([]);

    render(<NotificationRules />);

    expect(screen.getByText('通知规则管理')).toBeTruthy();
    expect(screen.getByText('管理平台 Webhook 与 IM 通知规则')).toBeTruthy();
    // Check tabs exist
    expect(screen.getByText(/Webhooks/)).toBeTruthy();
  });

  it('shows IM notification rules when switching to IM tab', async () => {
    vi.mocked(notificationRulesApi.getIMNotificationRules).mockResolvedValue(mockIMRules);

    render(<NotificationRules />);

    // Find the IM notifications tab by role
    const tabs = screen.getAllByRole('tab');
    const imTab = tabs.find((t) => t.textContent?.includes('IM'));
    expect(imTab).toBeTruthy();
    if (!imTab) return;

    fireEvent.click(imTab);

    await waitFor(() => {
      expect(screen.getByText('研发群通知')).toBeTruthy();
    });
  });

  it('opens create modal on button click in IM tab', async () => {
    vi.mocked(notificationRulesApi.getIMNotificationRules).mockResolvedValue([]);

    render(<NotificationRules />);

    // Switch to IM tab
    const tabs = screen.getAllByRole('tab');
    const imTab = tabs.find((t) => t.textContent?.includes('IM'));
    expect(imTab).toBeTruthy();
    if (!imTab) return;
    fireEvent.click(imTab);

    await waitFor(() => {
      expect(screen.getByText('新建 IM 通知')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('新建 IM 通知'));

    await waitFor(() => {
      expect(screen.getByText('新建 IM 通知规则')).toBeTruthy();
    });
  });

  it('shows empty state when no IM rules exist', async () => {
    vi.mocked(notificationRulesApi.getIMNotificationRules).mockResolvedValue([]);

    render(<NotificationRules />);

    const tabs = screen.getAllByRole('tab');
    const imTab = tabs.find((t) => t.textContent?.includes('IM'));
    if (!imTab) return;
    fireEvent.click(imTab);

    await waitFor(() => {
      expect(screen.getByText('暂无 IM 通知规则')).toBeTruthy();
    });
  });
});
