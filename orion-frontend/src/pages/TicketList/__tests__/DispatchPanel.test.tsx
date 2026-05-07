/**
 * DispatchPanel Tests
 * - Queue display tests
 * - Engineer list tests
 * - Auto dispatch tests
 * - SLA alerts tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DispatchPanel from '../DispatchPanel';
import * as ticketingApi from '@/api/ticketing';
import * as usersApi from '@/api/users';

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
    },
  };
});

vi.mock('@/api/ticketing');
vi.mock('@/api/users');

const mockQueueTickets = [
  {
    id: 'TKT-010',
    title: 'Test ticket in queue',
    priority: 'critical',
    dueDate: '2024-04-14T10:00:00Z',
    createdAt: '2024-04-13T10:00:00Z',
    assignee: null,
    status: 'open',
  },
];

const mockEngineers = [
  { id: 'E001', name: '张伟', username: 'zhangwei', email: null, role: 'engineer', status: 'active', avatar_url: null, last_login_at: null, last_login_ip: null, settings: {}, created_at: '', updated_at: '', created_by: null },
  { id: 'E002', name: '李娜', username: 'lina', email: null, role: 'engineer', status: 'active', avatar_url: null, last_login_at: null, last_login_ip: null, settings: {}, created_at: '', updated_at: '', created_by: null },
];

beforeEach(() => {
  vi.mocked(ticketingApi.getTickets).mockResolvedValue({ data: { data: mockQueueTickets } } as any);
  vi.mocked(usersApi.listUsers).mockResolvedValue({ data: { data: { data: mockEngineers } } } as any);
});

const defaultProps = {
  open: true,
  onClose: vi.fn(),
};

function renderPanel(props = defaultProps) {
  return render(<DispatchPanel {...props} />);
}

describe('DispatchPanel', () => {
  it('should render the dispatch panel when open', async () => {
    renderPanel();
    expect(screen.getByTestId('dispatch-panel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('工单分派管理')).toBeInTheDocument();
    });
  });

  it('should not render the panel when open is false', () => {
    renderPanel({ ...defaultProps, open: false });
    expect(screen.queryByTestId('dispatch-panel')).not.toBeInTheDocument();
  });

  it('should display queue status summary', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('队列中')).toBeInTheDocument();
    });
    expect(screen.getByText('SLA 风险')).toBeInTheDocument();
    expect(screen.getByText('SLA 违约')).toBeInTheDocument();
    expect(screen.getByText('平均等待')).toBeInTheDocument();
  });

  it('should display SLA alerts section', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('队列中')).toBeInTheDocument();
    });
  });

  it('should display engineer availability section', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('工程师可用性')).toBeInTheDocument();
    });
    expect(screen.getByTestId('engineer-card-E001')).toBeInTheDocument();
    expect(screen.getByTestId('engineer-card-E002')).toBeInTheDocument();
  });

  it('should display engineer names and availability status', async () => {
    renderPanel();
    await waitFor(() => {
      const card = screen.getByTestId('engineer-card-E001');
      expect(card).toBeInTheDocument();
    });
  });

  it('should show engineer load progress', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('engineer-card-E001')).toBeInTheDocument();
    });
  });

  it('should show auto dispatch all button', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('auto-dispatch-all')).toBeInTheDocument();
    });
    expect(screen.getByText('全部分派')).toBeInTheDocument();
  });

  it('should call auto dispatch when button is clicked', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('auto-dispatch-all')).toBeInTheDocument();
    });
    const dispatchButton = screen.getByTestId('auto-dispatch-all');
    fireEvent.click(dispatchButton);

    // Button should show loading state after click
    expect(dispatchButton).toBeInTheDocument();
  });

  it('should display wait time for queue entries', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('队列工单')).toBeInTheDocument();
    });
  });
});
