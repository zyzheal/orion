import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from './index';

describe('MetricCard', () => {
  it('should render title and value', () => {
    render(<MetricCard title="Total Users" value={1234} />);
    expect(screen.getByTestId('metric-title')).toHaveTextContent('Total Users');
    expect(screen.getByTestId('metric-value')).toHaveTextContent('1.2K');
  });

  it('should render unit', () => {
    render(<MetricCard title="CPU Usage" value={85} unit="%" />);
    expect(screen.getByTestId('metric-unit')).toHaveTextContent('%');
  });

  it('should format large numbers', () => {
    const { rerender } = render(<MetricCard title="Requests" value={1500} />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('1.5K');

    rerender(<MetricCard title="Requests" value={1500000} />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('1.5M');

    rerender(<MetricCard title="Requests" value={1500000000} />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('1.5B');
  });

  it('should show trend up indicator', () => {
    render(<MetricCard title="Revenue" value={5000} previousValue={4000} />);
    expect(screen.getByTestId('metric-trend')).toBeInTheDocument();
    expect(screen.getByTestId('metric-trend')).toHaveTextContent('+25%');
  });

  it('should show trend down indicator', () => {
    render(<MetricCard title="Errors" value={3} previousValue={10} />);
    expect(screen.getByTestId('metric-trend')).toHaveTextContent('-70%');
  });

  it('should use explicit trendPercent', () => {
    render(
      <MetricCard title="Latency" value={120} trend="up" trendPercent={15} previousValue={100} />
    );
    expect(screen.getByTestId('metric-trend')).toHaveTextContent('+15%');
  });

  it('should show stable trend when values are equal', () => {
    render(<MetricCard title="Users" value={100} previousValue={100} />);
    expect(screen.getByTestId('metric-trend')).toHaveTextContent('0%');
  });

  it('should not show trend when previousValue is not provided', () => {
    render(<MetricCard title="Users" value={100} />);
    expect(screen.queryByTestId('metric-trend')).not.toBeInTheDocument();
  });

  it('should render custom icon', () => {
    render(<MetricCard title="Storage" value={512} unit="GB" icon={<span>💾</span>} />);
    expect(screen.getByText('💾')).toBeInTheDocument();
  });

  it('should render footer content', () => {
    render(<MetricCard title="API Calls" value={10000} footer="Last 24 hours" />);
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<MetricCard title="Loading Metric" value={0} loading={true} />);
    expect(screen.getByTestId('metric-card')).toBeInTheDocument();
  });

  it('should be clickable', () => {
    const handleClick = vi.fn();
    render(<MetricCard title="Clickable" value={42} onClick={handleClick} />);
    screen.getByTestId('metric-card').click();
    expect(handleClick).toHaveBeenCalled();
  });

  it('should support different sizes', () => {
    const { rerender } = render(<MetricCard title="Small" value={1} size="small" />);
    expect(screen.getByTestId('metric-card')).toBeInTheDocument();

    rerender(<MetricCard title="Large" value={1} size="large" />);
    expect(screen.getByTestId('metric-card')).toBeInTheDocument();
  });

  it('should support string values', () => {
    render(<MetricCard title="Status" value="Healthy" />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('Healthy');
  });

  it('should support custom color', () => {
    render(<MetricCard title="Custom" value={100} color="#9333ea" />);
    expect(screen.getByTestId('metric-card')).toBeInTheDocument();
  });
});
