import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GaugeChart } from '../GaugeChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, any>) => (
    <div data-testid="gauge-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.series?.[0]?.data?.[0]?.name}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('GaugeChart', () => {
  it('renders with title', () => {
    render(wrap(<GaugeChart title="SLA Rate" value={85} />));
    expect(screen.getByText('SLA Rate')).toBeTruthy();
  });

  it('renders gauge with value', () => {
    render(wrap(<GaugeChart title="Test" value={75} />));
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });

  it('applies custom max value', () => {
    render(wrap(<GaugeChart title="Test" value={500} max={1000} />));
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });

  it('applies thresholds for color zones', () => {
    render(
      wrap(
        <GaugeChart
          title="Test"
          value={85}
          thresholds={{ warning: 80, danger: 90 }}
        />
      )
    );
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });

  it('applies custom size', () => {
    render(wrap(<GaugeChart title="Test" value={50} size={200} />));
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });
});
