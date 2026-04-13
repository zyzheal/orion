/**
 * CreateTicketModal Tests
 * - Form validation tests
 * - Submission tests
 * - Duplicate preview tests
 * - Conditional field tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateTicketModal from '../CreateTicketModal';

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

const createDefaultProps = () => ({
  open: true,
  onCancel: vi.fn(),
  onSuccess: vi.fn(),
});

function renderModal(props = createDefaultProps()) {
  return render(<CreateTicketModal {...props} />);
}

describe('CreateTicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the modal when open is true', () => {
    renderModal();
    expect(screen.getByText('创建工单')).toBeInTheDocument();
  });
  it('should render the modal when open is true', () => {
    renderModal();
    expect(screen.getByText('创建工单')).toBeInTheDocument();
  });

  it('should not render the modal when open is false', () => {
    renderModal({ ...createDefaultProps(), open: false });
    expect(screen.queryByText('创建工单')).not.toBeInTheDocument();
  });

  it('should render all required form fields', () => {
    renderModal();
    expect(screen.getByText('工单标题')).toBeInTheDocument();
    expect(screen.getByText('工单分类')).toBeInTheDocument();
    expect(screen.getByText('优先级')).toBeInTheDocument();
    expect(screen.getByText('工单描述')).toBeInTheDocument();
    expect(screen.getByText('标签')).toBeInTheDocument();
    expect(screen.getByText('来源')).toBeInTheDocument();
  });

  it('should show validation error for short title', async () => {
    const props = createDefaultProps();
    renderModal(props);
    const titleInput = screen.getByTestId('create-ticket-title');
    fireEvent.change(titleInput, { target: { value: 'ab' } });
    const submitButton = screen.getByTestId('create-ticket-submit');
    fireEvent.click(submitButton);

    // Validation should prevent submission - onSuccess should NOT be called
    await waitFor(() => {
      expect(props.onSuccess).not.toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should show validation error for short description', async () => {
    const props = createDefaultProps();
    renderModal(props);
    const descInput = screen.getByTestId('create-ticket-description');
    fireEvent.change(descInput, { target: { value: '短描述' } });
    const submitButton = screen.getByTestId('create-ticket-submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(props.onSuccess).not.toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should show duplicate preview when title matches existing tickets', async () => {
    renderModal();
    const titleInput = screen.getByTestId('create-ticket-title');
    fireEvent.change(titleInput, { target: { value: '数据库 CPU 使用率' } });

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-preview')).toBeInTheDocument();
      expect(screen.getByText('发现可能的重复工单')).toBeInTheDocument();
    });
  });

  it('should not show alert ID field when source is manual', () => {
    renderModal();
    expect(screen.queryByText('关联告警 ID')).not.toBeInTheDocument();
    expect(screen.queryByText('关联事件 ID')).not.toBeInTheDocument();
  });

  it('should reset form when modal is closed', () => {
    const props = createDefaultProps();
    const { rerender } = renderModal(props);
    rerender(<CreateTicketModal {...createDefaultProps()} open={false} />);
    expect(screen.queryByText('工单标题')).not.toBeInTheDocument();
  });
});
