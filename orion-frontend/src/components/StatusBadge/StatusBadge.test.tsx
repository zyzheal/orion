import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from './index';

describe('StatusBadge', () => {
  it('should render with running status', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByTestId('status-dot')).toBeInTheDocument();
  });

  it('should render with success status', () => {
    render(<StatusBadge status="success" />);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByTestId('status-dot')).toBeInTheDocument();
  });

  it('should render with failed status', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should render with pending status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('should render with warning status', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('should render with cancelled status', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('should render with unknown status for invalid values', () => {
    render(<StatusBadge status="unknown" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should use custom label', () => {
    render(<StatusBadge status="running" label="In Progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('should hide dot when showDot is false', () => {
    render(<StatusBadge status="success" showDot={false} />);
    expect(screen.queryByTestId('status-dot')).not.toBeInTheDocument();
  });

  it('should apply small size', () => {
    render(<StatusBadge status="success" size="small" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
  });

  it('should apply large size', () => {
    render(<StatusBadge status="success" size="large" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
  });

  it('should apply outlined variant', () => {
    render(<StatusBadge status="success" variant="outlined" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
  });

  it('should apply subtle variant', () => {
    render(<StatusBadge status="warning" variant="subtle" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
  });

  it('should set data-status attribute', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'running');
  });
});
