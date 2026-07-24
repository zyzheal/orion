import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendLineChart } from '../TrendLineChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, any>) => (
    <div data-testid="trend-line-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
      {props.option?.legend?.data?.map((name: string) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => (
  <ChartProvider>{ui}</ChartProvider>
);

describe('TrendLineChart', () => {
  const sampleData = [
    [
      { period: '2024-01-01', value: 10 },
      { period: '2024-01-02', value: 20 },
      { period: '2024-01-03', value: 15 },
    ],
  ];

  it('renders with title', () => {
    render(wrap(<TrendLineChart title="Test Trend" data={sampleData} />));
    expect(screen.getByText('Test Trend')).toBeTruthy();
  });

  it('renders multiple series', () => {
    const multiData = [
      [
        { period: '2024-01-01', value: 10, label: 'Series A' },
        { period: '2024-01-02', value: 20, label: 'Series A' },
      ],
      [
        { period: '2024-01-01', value: 5, label: 'Series B' },
        { period: '2024-01-02', value: 15, label: 'Series B' },
      ],
    ];
    render(wrap(<TrendLineChart data={multiData} />));
    expect(screen.getByText('Series A')).toBeTruthy();
    expect(screen.getByText('Series B')).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<TrendLineChart data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });

  it('shows error state', () => {
    const err = new Error('Failed to load');
    render(wrap(<TrendLineChart data={sampleData} error={err} />));
    expect(screen.getByText(/Failed to load/)).toBeTruthy();
  });

  it('applies area style when showArea is true', () => {
    render(wrap(<TrendLineChart data={sampleData} showArea={true} />));
    const chart = screen.getByTestId('trend-line-chart');
    expect(chart).toBeTruthy();
    const option = JSON.parse(chart.getAttribute('data-option') || '{}');
    expect(option.series[0].areaStyle).toBeDefined();
  });

  it('applies smooth curve when smooth is true', () => {
    render(wrap(<TrendLineChart data={sampleData} smooth={true} />));
    const chart = screen.getByTestId('trend-line-chart');
    expect(chart).toBeTruthy();
    const option = JSON.parse(chart.getAttribute('data-option') || '{}');
    expect(option.series[0].smooth).toBe(true);
  });
});
