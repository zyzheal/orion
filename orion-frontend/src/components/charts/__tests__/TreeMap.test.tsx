import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeMap } from '../TreeMap';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="treemap-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('TreeMap', () => {
  const sampleData = [
    { name: 'A', value: 30 },
    { name: 'B', value: 50 },
    { name: 'C', value: 20 },
  ];

  const nestedData = [
    {
      name: 'Group1',
      value: 80,
      children: [
        { name: 'A', value: 30 },
        { name: 'B', value: 50 },
      ],
    },
    { name: 'C', value: 20 },
  ];

  it('renders with title', () => {
    render(wrap(<TreeMap title="资源分布" data={sampleData} />));
    expect(screen.getByText('资源分布')).toBeTruthy();
  });

  it('renders treemap', () => {
    render(wrap(<TreeMap data={sampleData} />));
    const chart = screen.getByTestId('treemap-chart');
    expect(chart).toBeTruthy();
  });

  it('renders nested data', () => {
    render(wrap(<TreeMap data={nestedData} />));
    const chart = screen.getByTestId('treemap-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<TreeMap data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
