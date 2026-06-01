/**
 * TicketDetail Page Tests
 * - Detail display tests
 * - Action button tests
 * - History timeline tests
 * - Not found handling
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketDetail from '../index';
import * as ticketingApi from '@/api/ticketing';
import * as usersApi from '@/api/users';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

const mockTicket = {
  id: 'TKT-001',
  title: '生产数据库 CPU 使用率过高 (95%)',
  description: '监控显示 prod-db-01 的 CPU 使用率持续超过 95%',
  status: 'in-progress',
  priority: 'critical',
  category: 'database',
  source: 'alert',
  reporter: '监控系统',
  assignee: '张伟',
  tags: { host: 'prod-db-01', service: 'postgresql' },
  createdAt: '2024-04-13T10:00:00Z',
  updatedAt: '2024-04-13T10:30:00Z',
  dueDate: '2024-04-14T10:00:00Z',
  escalationLevel: 1,
};

const mockTicketTKT004 = {
  ...mockTicket,
  id: 'TKT-004',
  title: 'Test ticket without assignee',
  assignee: null,
  status: 'open',
};

beforeEach(() => {
  vi.mocked(ticketingApi.getTicket).mockResolvedValue({ data: { data: mockTicket } } as any);
  vi.mocked(ticketingApi.getComments).mockResolvedValue({ data: { items: [] } } as any);
  vi.mocked(ticketingApi.getAttachments).mockResolvedValue({ data: { items: [] } } as any);
  vi.mocked(ticketingApi.getTicketRelations).mockResolvedValue({ data: { items: [] } } as any);
  vi.mocked(ticketingApi.getTransferHistory).mockResolvedValue({ data: { items: [] } } as any);
  vi.mocked(usersApi.listUsers).mockResolvedValue({ data: { data: [] } } as any);
});

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/tickets" element={<div>Ticket List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TicketDetail', () => {
  it('should render ticket detail page', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('ticket-detail-page')).toBeInTheDocument();
    });
  });

  it('should display ticket ID and title', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('TKT-001')).toBeInTheDocument();
    });
    expect(screen.getByText('生产数据库 CPU 使用率过高 (95%)')).toBeInTheDocument();
  });

  it('should display status and priority badges', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getAllByText('处理中').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('紧急').length).toBeGreaterThanOrEqual(1);
  });

  it('should display ticket description', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText(/监控显示 prod-db-01 的 CPU 使用率持续超过 95%/)).toBeInTheDocument();
    });
  });

  it('should display tags section', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('标签')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/host/).length).toBeGreaterThanOrEqual(1);
  });

  it('should display SLA section', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('SLA 信息')).toBeInTheDocument();
    });
  });

  it('should display basic info card', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('基本信息')).toBeInTheDocument();
    });
    expect(screen.getByText('数据库')).toBeInTheDocument();
    expect(screen.getByText('告警')).toBeInTheDocument();
  });

  it('should display assignee information', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getAllByText('张伟').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should show unassigned for tickets without assignee', async () => {
    vi.mocked(ticketingApi.getTicket).mockResolvedValue({ data: { data: mockTicketTKT004 } } as any);
    renderWithRoute('/tickets/TKT-004');
    await waitFor(() => {
      expect(screen.getAllByText('未分配').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should display workflow history timeline', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('工作流历史')).toBeInTheDocument();
    });
    // History is currently empty (no API integration)
    expect(screen.getByText('暂无历史记录')).toBeInTheDocument();
  });

  it('should display escalation info for escalated tickets', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('升级信息')).toBeInTheDocument();
    });
  });

  it('should show back button that navigates to tickets list', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('back-to-tickets')).toBeInTheDocument();
    });
    const backButton = screen.getByTestId('back-to-tickets');
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/tickets');
  });

  it('should show resolve action for in-progress tickets', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('action-resolve')).toBeInTheDocument();
    });
  });

  it('should show escalate action for non-closed tickets', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('action-escalate')).toBeInTheDocument();
    });
  });

  it('should show transfer action for in-progress tickets', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('action-transfer')).toBeInTheDocument();
    });
  });

  it('should show not found for non-existent ticket', async () => {
    vi.mocked(ticketingApi.getTicket).mockResolvedValue({ data: null } as any);
    render(
      <MemoryRouter initialEntries={['/tickets/TKT-999']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/未找到工单/)).toBeInTheDocument();
    });
  });

  it('should not display relations section when empty', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByTestId('ticket-detail-page')).toBeInTheDocument();
    });
    // Relations is currently empty (no API integration)
    expect(screen.queryByText('关联工单')).not.toBeInTheDocument();
  });
});
