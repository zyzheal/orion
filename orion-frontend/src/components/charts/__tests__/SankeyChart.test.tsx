import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SankeyChart } from '../SankeyChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="sankey-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('SankeyChart', () => {
  const sampleData = {
    nodes: [
      { name: '来源 A' },
      { name: '来源 B' },
      { name: '中转' },
      { name: '目标' },
    ],
    links: [
      { source: '来源 A', target: '中转', value: 10 },
      { source: '来源 B', target: '中转', value: 20 },
      { source: '中转', target: '目标', value: 30 },
    ],
  };

  it('renders with title', () => {
    render(wrap(<SankeyChart title="流转图" nodes={sampleData.nodes} links={sampleData.links} />));
    expect(screen.getByText('流转图')).toBeTruthy();
  });

  it('renders sankey diagram', () => {
    render(wrap(<SankeyChart nodes={sampleData.nodes} links={sampleData.links} />));
    const chart = screen.getByTestId('sankey-chart');
    expect(chart).toBeTruthy();
  });

  it('renders vertical orientation', () => {
    render(wrap(<SankeyChart nodes={sampleData.nodes} links={sampleData.links} orient="vertical" />));
    const chart = screen.getByTestId('sankey-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<SankeyChart nodes={sampleData.nodes} links={sampleData.links} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
