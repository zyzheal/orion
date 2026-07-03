/**
 * Tests for NotificationDetail page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationDetail } from '@/pages/NotificationDetail';
import { getNotification, markAsRead, deleteNotification } from '@/api/notifications';
import type { MockNotification } from '@/api/notifications';

vi.mock('@/api/notifications');

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
  return render(<BrowserRouter>{ui}</BrowserRouter>);
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
      expect(screen.getByText('紧急')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('删除'));
    await waitFor(() => {
      expect(deleteNotification).toHaveBeenCalledWith('1');
    });
  });
});
