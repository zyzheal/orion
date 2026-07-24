import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScatterChart } from '../ScatterChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, any>) => (
    <div data-testid="scatter-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('ScatterChart', () => {
  const sampleData = [
    { x: 10, y: 20, label: 'A' },
    { x: 30, y: 40, label: 'B' },
    { x: 50, y: 60, label: 'C' },
  ];

  it('renders with title', () => {
    render(wrap(<ScatterChart title="Test Scatter" data={sampleData} />));
    expect(screen.getByText('Test Scatter')).toBeTruthy();
  });

  it('renders scatter chart', () => {
    render(wrap(<ScatterChart data={sampleData} />));
    const chart = screen.getByTestId('scatter-chart');
    expect(chart).toBeTruthy();
  });

  it('renders bubble mode with value', () => {
    const bubbleData = [
      { x: 10, y: 20, value: 5, label: 'A' },
      { x: 30, y: 40, value: 15, label: 'B' },
    ];
    render(wrap(<ScatterChart data={bubbleData} showBubble={true} />));
    const chart = screen.getByTestId('scatter-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<ScatterChart data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
