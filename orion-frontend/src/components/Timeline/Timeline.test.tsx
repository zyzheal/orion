import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Timeline from './index';

describe('OrionTimeline', () => {
  const sampleEvents = [
    {
      id: 1,
      time: '2024-01-15T10:00:00Z',
      title: 'Pipeline started',
      description: 'Build triggered by push to main',
      status: 'success' as const,
    },
    {
      id: 2,
      time: '2024-01-15T10:05:00Z',
      title: 'Build completed',
      description: 'All tests passed',
      status: 'success' as const,
    },
    {
      id: 3,
      time: '2024-01-15T10:10:00Z',
      title: 'Deployment in progress',
      description: 'Deploying to production',
      status: 'running' as const,
    },
  ];

  it('should render all events', () => {
    render(<Timeline events={sampleEvents} />);
    expect(screen.getByTestId('orion-timeline')).toBeInTheDocument();
    expect(screen.getByText('Pipeline started')).toBeInTheDocument();
    expect(screen.getByText('Build completed')).toBeInTheDocument();
    expect(screen.getByText('Deployment in progress')).toBeInTheDocument();
  });

  it('should render event descriptions', () => {
    render(<Timeline events={sampleEvents} />);
    expect(screen.getByText('Build triggered by push to main')).toBeInTheDocument();
    expect(screen.getByText('All tests passed')).toBeInTheDocument();
  });

  it('should render timestamps', () => {
    render(<Timeline events={sampleEvents} />);
    expect(screen.getByText('2024-01-15 10:00:00')).toBeInTheDocument();
  });

  it('should render status badges', () => {
    render(<Timeline events={sampleEvents} />);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getAllByText('Success').length).toBeGreaterThanOrEqual(1);
  });

  it('should limit events when maxItems is set', () => {
    render(<Timeline events={sampleEvents} maxItems={2} />);
    expect(screen.getByText('Pipeline started')).toBeInTheDocument();
    expect(screen.getByText('Build completed')).toBeInTheDocument();
    // Third event should not be visible
    expect(screen.queryByText('Deployment in progress')).not.toBeInTheDocument();
  });

  it('should show "Show More" link when truncated', () => {
    render(<Timeline events={sampleEvents} maxItems={2} showMore />);
    expect(screen.getByText(/Show More/)).toBeInTheDocument();
  });

  it('should call onShowMore when clicked', () => {
    const handleShowMore = vi.fn();
    render(
      <Timeline events={sampleEvents} maxItems={2} showMore onShowMore={handleShowMore} />
    );
    screen.getByText(/Show More/).click();
    expect(handleShowMore).toHaveBeenCalled();
  });

  it('should not show "Show More" when showMore is false', () => {
    render(<Timeline events={sampleEvents} maxItems={2} showMore={false} />);
    expect(screen.queryByText(/Show More/)).not.toBeInTheDocument();
  });

  it('should render pending state', () => {
    render(<Timeline events={sampleEvents} pending pendingText="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should render empty events gracefully', () => {
    render(<Timeline events={[]} />);
    expect(screen.getByTestId('orion-timeline')).toBeInTheDocument();
  });

  it('should handle events without status', () => {
    const events = [
      { id: 1, time: '2024-01-15T10:00:00Z', title: 'No status event' },
    ];
    render(<Timeline events={events} />);
    expect(screen.getByText('No status event')).toBeInTheDocument();
  });

  it('should handle events with custom color', () => {
    const events = [
      {
        id: 1,
        time: '2024-01-15T10:00:00Z',
        title: 'Custom color event',
        color: '#9333ea',
      },
    ];
    render(<Timeline events={events} />);
    expect(screen.getByText('Custom color event')).toBeInTheDocument();
  });
});
