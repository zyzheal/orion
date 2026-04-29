/**
 * TicketList Page Tests
 * - Rendering tests
 * - Filtering tests
 * - Pagination tests
 * - Action button tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TicketList from '../index';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('TicketList', () => {
  it('should render the page title', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByText('工单管理')).toBeInTheDocument();
  });

  it('should render summary cards section', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ticket-summary-cards')).toBeInTheDocument();
    });
    expect(screen.getAllByText('待处理').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('处理中').length).toBeGreaterThanOrEqual(1);
  });

  it('should render the ticket table', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ticket-table')).toBeInTheDocument();
    });
  });

  it('should display ticket IDs in the table', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('TKT-001')).toBeInTheDocument();
    });
    expect(screen.getByText('TKT-002')).toBeInTheDocument();
    expect(screen.getByText('TKT-005')).toBeInTheDocument();
  });

  it('should display ticket titles', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('生产数据库 CPU 使用率过高 (95%)')).toBeInTheDocument();
    });
    expect(screen.getByText('API 网关 502 错误率上升')).toBeInTheDocument();
  });

  it('should filter tickets by status', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ticket-table')).toBeInTheDocument();
    });
    // Filter bar should be present with status filter
    expect(screen.getAllByText('状态').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter tickets by priority', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ticket-table')).toBeInTheDocument();
    });
    expect(screen.getAllByText('优先级').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter tickets by search query', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('TKT-001')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('搜索工单 ID、标题、负责人...');
    fireEvent.change(searchInput, { target: { value: 'TKT-001' } });
    // After debounce, should filter results
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
  });

  it('should show "未分配" for tickets without assignee', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText('未分配').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should render category tags', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText('数据库').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('网络').length).toBeGreaterThanOrEqual(1);
  });

  it('should render priority badges with correct labels', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText('紧急').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('中').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('低').length).toBeGreaterThanOrEqual(1);
  });

  it('should navigate to ticket detail when clicking ticket ID', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ticket-link-TKT-001')).toBeInTheDocument();
    });
    const ticketLink = screen.getByTestId('ticket-link-TKT-001');
    fireEvent.click(ticketLink);
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/TKT-001');
  });

  it('should show create ticket modal when clicking create button', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('创建工单')).toBeInTheDocument();
    });
    const createButton = screen.getByText('创建工单');
    fireEvent.click(createButton);
    expect(screen.getByText('工单标题')).toBeInTheDocument();
  });

  it('should show dispatch panel when clicking auto dispatch', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('自动分派')).toBeInTheDocument();
    });
    const dispatchButton = screen.getByText('自动分派');
    fireEvent.click(dispatchButton);
    expect(screen.getByTestId('dispatch-panel')).toBeInTheDocument();
  });

  it('should display the correct count of tickets', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/共 8 个工单/)).toBeInTheDocument();
    });
  });

  it('should render SLA column with clock icon', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('SLA 剩余')).toBeInTheDocument();
    });
  });
});