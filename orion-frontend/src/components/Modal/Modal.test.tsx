import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from './index';

describe('OrionModal', () => {
  const defaultProps = {
    visible: true,
    title: 'Test Modal',
    content: <div>Test Content</div>,
    onOk: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should render when visible', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByTestId('orion-modal')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<Modal {...defaultProps} visible={false} />);
    // Modal should not be in the document
    expect(screen.queryByTestId('orion-modal')).not.toBeInTheDocument();
  });

  it('should render confirm type with correct icon and buttons', () => {
    render(<Modal {...defaultProps} type="confirm" />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render info type with OK only', () => {
    render(<Modal {...defaultProps} type="info" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
    // Cancel button should not show for info type
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should render error type', () => {
    render(<Modal {...defaultProps} type="error" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('should render warning type', () => {
    render(<Modal {...defaultProps} type="warning" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('should render success type', () => {
    render(<Modal {...defaultProps} type="success" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('should call onCancel when cancel is clicked', () => {
    const handleCancel = vi.fn();
    render(<Modal {...defaultProps} onCancel={handleCancel} />);

    // Ant Design modal cancel button
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(handleCancel).toHaveBeenCalled();
  });

  it('should call onOk when OK is clicked', async () => {
    const handleOk = vi.fn();
    render(<Modal {...defaultProps} onOk={handleOk} />);

    const okBtn = screen.getByText('Confirm');
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(handleOk).toHaveBeenCalled();
    });
  });

  it('should support async onOk handler', async () => {
    const handleOk = vi.fn().mockResolvedValue(undefined);
    render(<Modal {...defaultProps} onOk={handleOk} />);

    const okBtn = screen.getByText('Confirm');
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(handleOk).toHaveBeenCalled();
    });
  });

  it('should use custom okText and cancelText', () => {
    render(<Modal {...defaultProps} okText="Yes" cancelText="No" type="confirm" />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should hide cancel when showCancel is false', () => {
    render(<Modal {...defaultProps} type="confirm" showCancel={false} />);
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should render custom icon', () => {
    render(<Modal {...defaultProps} icon={<span data-testid="custom-icon">!</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
