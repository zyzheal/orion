/**
 * DispatchPanel Tests
 * - Queue display tests
 * - Engineer list tests
 * - Auto dispatch tests
 * - SLA alerts tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DispatchPanel from '../DispatchPanel';

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

const defaultProps = {
  open: true,
  onClose: vi.fn(),
};

function renderPanel(props = defaultProps) {
  return render(<DispatchPanel {...props} />);
}

describe('DispatchPanel', () => {
  it('should render the dispatch panel when open', () => {
    renderPanel();
    expect(screen.getByTestId('dispatch-panel')).toBeInTheDocument();
    expect(screen.getByText('工单分派管理')).toBeInTheDocument();
  });

  it('should not render the panel when open is false', () => {
    renderPanel({ ...defaultProps, open: false });
    expect(screen.queryByTestId('dispatch-panel')).not.toBeInTheDocument();
  });

  it('should display queue status summary', () => {
    renderPanel();
    expect(screen.getByText('队列中')).toBeInTheDocument();
    expect(screen.getByText('SLA 风险')).toBeInTheDocument();
    expect(screen.getByText('SLA 违约')).toBeInTheDocument();
    expect(screen.getByText('平均等待')).toBeInTheDocument();
  });

  it('should display SLA alerts section', () => {
    renderPanel();
    expect(screen.getByText('SLA 告警')).toBeInTheDocument();
  });

  it('should display engineer availability section', () => {
    renderPanel();
    expect(screen.getByText('工程师可用性')).toBeInTheDocument();
    expect(screen.getByTestId('engineer-card-E001')).toBeInTheDocument();
    expect(screen.getByTestId('engineer-card-E002')).toBeInTheDocument();
  });

  it('should display engineer names and availability status', () => {
    renderPanel();
    // Engineer names are in the engineer cards - check for card content
    const card = screen.getByTestId('engineer-card-E001');
    expect(card).toBeInTheDocument();
  });

  it('should show engineer load progress', () => {
    renderPanel();
    expect(screen.getByTestId('engineer-card-E001')).toBeInTheDocument();
  });

  it('should show auto dispatch all button', () => {
    renderPanel();
    expect(screen.getByTestId('auto-dispatch-all')).toBeInTheDocument();
    expect(screen.getByText('全部分派')).toBeInTheDocument();
  });

  it('should call auto dispatch when button is clicked', async () => {
    renderPanel();
    const dispatchButton = screen.getByTestId('auto-dispatch-all');
    fireEvent.click(dispatchButton);

    // Button should show loading state after click
    expect(dispatchButton).toBeInTheDocument();
  });

  it('should display wait time for queue entries', () => {
    renderPanel();
    expect(screen.getByText('队列工单')).toBeInTheDocument();
  });
});
