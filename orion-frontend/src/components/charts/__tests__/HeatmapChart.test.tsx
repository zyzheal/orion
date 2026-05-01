import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeatmapChart } from '../HeatmapChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, any>) => (
    <div data-testid="heatmap-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('HeatmapChart', () => {
  const sampleData = [
    { x: 'Mon', y: '0-4h', value: 5 },
    { x: 'Mon', y: '4-8h', value: 10 },
    { x: 'Tue', y: '0-4h', value: 8 },
    { x: 'Tue', y: '4-8h', value: 3 },
  ];
  const xAxis = ['Mon', 'Tue', 'Wed'];
  const yAxis = ['0-4h', '4-8h', '8-12h'];

  it('renders with title', () => {
    render(wrap(<HeatmapChart title="Risk Heatmap" data={sampleData} xAxis={xAxis} yAxis={yAxis} />));
    expect(screen.getByText('Risk Heatmap')).toBeTruthy();
  });

  it('renders heatmap with data', () => {
    render(wrap(<HeatmapChart data={sampleData} xAxis={xAxis} yAxis={yAxis} />));
    const chart = screen.getByTestId('heatmap-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<HeatmapChart data={sampleData} xAxis={xAxis} yAxis={yAxis} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
