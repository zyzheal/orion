import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PieChart } from '../PieChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="pie-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('PieChart', () => {
  const sampleData = [
    { name: 'A', value: 30 },
    { name: 'B', value: 50 },
    { name: 'C', value: 20 },
  ];

  it('renders with title', () => {
    render(wrap(<PieChart title="Test Pie" data={sampleData} />));
    expect(screen.getByText('Test Pie')).toBeTruthy();
  });

  it('renders pie chart', () => {
    render(wrap(<PieChart data={sampleData} />));
    const chart = screen.getByTestId('pie-chart');
    expect(chart).toBeTruthy();
  });

  it('renders donut variant', () => {
    render(wrap(<PieChart data={sampleData} variant="donut" />));
    const chart = screen.getByTestId('pie-chart');
    expect(chart).toBeTruthy();
  });

  it('shows center label in donut mode', () => {
    render(wrap(<PieChart data={sampleData} variant="donut" centerLabel={true} />));
    const chart = screen.getByTestId('pie-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<PieChart data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
