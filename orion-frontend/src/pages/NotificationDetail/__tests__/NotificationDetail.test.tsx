/**
 * Tests for NotificationDetail page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotificationDetail from '@/pages/NotificationDetail';
import { getNotification, markAsRead, deleteNotification } from '@/api/notifications';
import type { MockNotification } from '@/api/notifications';

vi.mock('@/api/notifications');
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    // Mock Popconfirm to expose onConfirm directly (jsdom doesn't support React Portal well)
    Popconfirm: ({ onConfirm, okText, children }: {
      onConfirm?: () => void;
      okText?: string;
      children: React.ReactNode;
    }) => (
      <div>
        {children}
        <button onClick={() => onConfirm?.()}>Popconfirm-{okText}</button>
      </div>
    ),
  };
});

const mockNotification: MockNotification = {
  id: '1',
  title: 'Detail Test Notification',
  content: 'Full content here',
  type: 'system_alert',
  priority: 'critical',
  read: false,
  createdAt: new Date().toISOString(),
  sender: 'System',
  actions: [{ label: 'View Ticket', type: 'primary' }],
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/notifications/1']}>
      <Routes>
        <Route path="/notifications/:id" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('NotificationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getNotification as any).mockResolvedValue(mockNotification);
    (markAsRead as any).mockResolvedValue({ ...mockNotification, read: true });
    (deleteNotification as any).mockResolvedValue(undefined);
  });

  it('should render notification detail', async () => {
    renderWithRouter(<NotificationDetail />);
    await waitFor(() => {
      expect(screen.getByText('Detail Test Notification')).toBeInTheDocument();
    });
  });

  it('should display notification metadata', async () => {
    renderWithRouter(<NotificationDetail />);
    await waitFor(() => {
      expect(screen.getByText('通知详情')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getAllByText('紧急')[0]).toBeInTheDocument();
    });
  });

  it('should mark as read', async () => {
    renderWithRouter(<NotificationDetail />);
    await waitFor(() => {
      expect(screen.getByText('Detail Test Notification')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('标记已读'));
    await waitFor(() => {
      expect(markAsRead).toHaveBeenCalledWith('1');
    });
  });

  it('should delete notification and navigate back', async () => {
    renderWithRouter(<NotificationDetail />);
    await waitFor(() => {
      expect(screen.getByText('Detail Test Notification')).toBeInTheDocument();
    });

    // Click delete to open Popconfirm, then confirm
    fireEvent.click(screen.getByText('删除'));
    fireEvent.click(screen.getByText('Popconfirm-确定'));
    await waitFor(() => {
      expect(deleteNotification).toHaveBeenCalledWith('1');
    });
  });
});