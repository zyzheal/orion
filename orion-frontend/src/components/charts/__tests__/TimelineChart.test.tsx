import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineChart } from '../TimelineChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="timeline-chart" data-option={JSON.stringify(props.option)}>
      {props.option?.title?.text}
    </div>
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('TimelineChart', () => {
  const sampleEvents = [
    { name: '部署 v1.0', start: '2024-03-20T10:00:00Z', end: '2024-03-20T10:30:00Z', status: 'success' as const },
    { name: '部署 v1.1', start: '2024-03-20T14:00:00Z', end: '2024-03-20T14:45:00Z', status: 'error' as const },
  ];

  it('renders with title', () => {
    render(wrap(<TimelineChart title="部署时间线" events={sampleEvents} />));
    expect(screen.getByText('部署时间线')).toBeTruthy();
  });

  it('renders timeline', () => {
    render(wrap(<TimelineChart events={sampleEvents} />));
    const chart = screen.getByTestId('timeline-chart');
    expect(chart).toBeTruthy();
  });

  it('renders with group lanes', () => {
    const groupedEvents = [
      { name: '部署 A', start: '2024-03-20T10:00:00Z', end: '2024-03-20T10:30:00Z', group: '服务A', status: 'success' as const },
      { name: '部署 B', start: '2024-03-20T11:00:00Z', end: '2024-03-20T11:20:00Z', group: '服务B', status: 'warning' as const },
    ];
    render(wrap(<TimelineChart events={groupedEvents} showGroup={true} />));
    const chart = screen.getByTestId('timeline-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<TimelineChart events={sampleEvents} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
