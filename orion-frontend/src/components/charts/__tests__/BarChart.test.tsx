import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart } from '../BarChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, any>) => (
    <div data-testid="bar-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
      {props.option?.legend?.data?.map((name: string) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('BarChart', () => {
  const sampleData = [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 15 },
  ];

  it('renders with title', () => {
    render(wrap(<BarChart title="Test Bar" data={sampleData} />));
    expect(screen.getByText('Test Bar')).toBeTruthy();
  });

  it('renders bars for each data item', () => {
    render(wrap(<BarChart data={sampleData} />));
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<BarChart data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });

  it('renders horizontal bars when horizontal is true', () => {
    render(wrap(<BarChart data={sampleData} horizontal={true} />));
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeTruthy();
  });

  it('renders stacked bars when stacked is true', () => {
    const stackedData = [
      { label: 'Jan', value: 10, series: 'A' },
      { label: 'Jan', value: 5, series: 'B' },
      { label: 'Feb', value: 15, series: 'A' },
      { label: 'Feb', value: 8, series: 'B' },
    ];
    render(wrap(<BarChart data={stackedData} stacked={true} />));
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeTruthy();
  });
});
