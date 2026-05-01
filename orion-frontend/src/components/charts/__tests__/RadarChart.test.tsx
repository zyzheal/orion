import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RadarChart } from '../RadarChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="radar-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('RadarChart', () => {
  const indicators = [
    { name: '速度', max: 100 },
    { name: '质量', max: 100 },
    { name: '效率', max: 100 },
    { name: '协作', max: 100 },
    { name: '创新', max: 100 },
  ];
  const series = [
    { name: '张伟', values: [85, 90, 78, 88, 72] },
  ];

  it('renders with title', () => {
    render(wrap(<RadarChart title="能力画像" indicators={indicators} series={series} />));
    expect(screen.getByText('能力画像')).toBeTruthy();
  });

  it('renders radar chart', () => {
    render(wrap(<RadarChart indicators={indicators} series={series} />));
    const chart = screen.getByTestId('radar-chart');
    expect(chart).toBeTruthy();
  });

  it('renders multiple series', () => {
    const multiSeries = [
      { name: '张伟', values: [85, 90, 78, 88, 72] },
      { name: '李娜', values: [75, 85, 92, 70, 80] },
    ];
    render(wrap(<RadarChart indicators={indicators} series={multiSeries} />));
    const chart = screen.getByTestId('radar-chart');
    expect(chart).toBeTruthy();
  });

  it('renders circle shape', () => {
    render(wrap(<RadarChart indicators={indicators} series={series} shape="circle" />));
    const chart = screen.getByTestId('radar-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<RadarChart indicators={indicators} series={series} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
