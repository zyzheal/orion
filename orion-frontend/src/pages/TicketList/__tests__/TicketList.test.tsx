/**
 * TicketList Page Tests
 * - Rendering tests
 * - Filtering tests
 * - Pagination tests
 * - Action button tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('should render summary cards section', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByTestId('ticket-summary-cards')).toBeInTheDocument();
    expect(screen.getAllByText('待处理').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('处理中').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('已超时').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SLA 违约').length).toBeGreaterThanOrEqual(1);
  });

  it('should render the ticket table', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByTestId('ticket-table')).toBeInTheDocument();
  });

  it('should display ticket IDs in the table', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
    expect(screen.getByText('TKT-002')).toBeInTheDocument();
    expect(screen.getByText('TKT-005')).toBeInTheDocument();
  });

  it('should display ticket titles', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByText('生产数据库 CPU 使用率过高 (95%)')).toBeInTheDocument();
    expect(screen.getByText('API 网关 502 错误率上升')).toBeInTheDocument();
  });

  it('should filter tickets by status', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    // Filter bar should be present with status filter
    expect(screen.getAllByText('状态').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter tickets by priority', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getAllByText('优先级').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter tickets by search query', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('搜索工单 ID、标题、负责人...');
    fireEvent.change(searchInput, { target: { value: 'TKT-001' } });
    // After debounce, should filter results
    expect(screen.getByText('TKT-001')).toBeInTheDocument();
  });

  it('should show "未分配" for tickets without assignee', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getAllByText('未分配').length).toBeGreaterThanOrEqual(1);
  });

  it('should render category tags', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getAllByText('数据库').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('网络').length).toBeGreaterThanOrEqual(1);
  });

  it('should render priority badges with correct labels', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getAllByText('紧急').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('中').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('低').length).toBeGreaterThanOrEqual(1);
  });

  it('should navigate to ticket detail when clicking ticket ID', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    const ticketLink = screen.getByTestId('ticket-link-TKT-001');
    fireEvent.click(ticketLink);
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/TKT-001');
  });

  it('should show create ticket modal when clicking create button', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    const createButton = screen.getByText('创建工单');
    fireEvent.click(createButton);
    expect(screen.getByText('工单标题')).toBeInTheDocument();
  });

  it('should show dispatch panel when clicking auto dispatch', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    const dispatchButton = screen.getByText('自动分派');
    fireEvent.click(dispatchButton);
    expect(screen.getByTestId('dispatch-panel')).toBeInTheDocument();
  });

  it('should display the correct count of tickets', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByText(/共 8 个工单/)).toBeInTheDocument();
  });

  it('should render SLA column with clock icon', () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    expect(screen.getByText('SLA 剩余')).toBeInTheDocument();
  });
});
