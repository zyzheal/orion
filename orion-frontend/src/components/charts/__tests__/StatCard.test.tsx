import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-mock" data-option={JSON.stringify(props.option)}>
      Mock Chart
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('StatCard', () => {
  it('renders title and value', () => {
    render(wrap(<StatCard title="Total Users" value={1234} />));
    expect(screen.getByText('Total Users')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
  });

  it('renders suffix', () => {
    render(wrap(<StatCard title="Time" value={48} suffix="h" />));
    expect(screen.getByText('48')).toBeTruthy();
    expect(screen.getByText('h')).toBeTruthy();
  });

  it('shows upward trend with positive direction', () => {
    render(
      wrap(
        <StatCard
          title="Revenue"
          value={1000}
          trend={{ value: 12.5, direction: 'up', good: 'up' }}
        />
      )
    );
    expect(screen.getByText('+12.5%')).toBeTruthy();
  });

  it('shows downward trend with negative direction', () => {
    render(
      wrap(
        <StatCard
          title="Errors"
          value={5}
          trend={{ value: 3.2, direction: 'down', good: 'up' }}
        />
      )
    );
    expect(screen.getByText('-3.2%')).toBeTruthy();
  });

  it('renders sparkline when data provided', () => {
    render(
      wrap(
        <StatCard
          title="Requests"
          value={500}
          sparklineData={[10, 20, 15, 30, 25, 40, 35]}
        />
      )
    );
    const chart = screen.getByTestId('stat-card-sparkline');
    expect(chart).toBeTruthy();
  });
});
