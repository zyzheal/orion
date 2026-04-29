/**
 * TicketDetail Page Tests
 * - Detail display tests
 * - Action button tests
 * - History timeline tests
 * - Not found handling
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketDetail from '../index';

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
    expect(screen.getByText('创建工单')).toBeInTheDocument();
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

  it('should display relations section when present', async () => {
    renderWithRoute('/tickets/TKT-001');
    await waitFor(() => {
      expect(screen.getByText('关联工单')).toBeInTheDocument();
    });
  });
});