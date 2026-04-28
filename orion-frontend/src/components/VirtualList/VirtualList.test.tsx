/**
 * Tests for VirtualList component (TASK-907)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VirtualList from '@/components/VirtualList';

describe('VirtualList', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: `item-${i}`,
    data: { title: `Item ${i}`, description: `Description ${i}` },
  }));

  const renderMock = vi.fn((item) => <div data-testid={`item-${item.id}`}>{item.data.title}</div>);

  it('should render without crashing', () => {
    render(
      <VirtualList items={mockItems.slice(0, 5)} renderItem={renderMock} containerHeight={200} />
    );
    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });

  it('should only render visible items', () => {
    render(
      <VirtualList
        items={mockItems}
        renderItem={renderMock}
        containerHeight={200}
        itemHeight={50}
      />
    );
    // With overscanCount=3 and containerHeight=200, should render ~7-10 items
    const renderedItems = screen.getAllByTestId(/^item-/);
    expect(renderedItems.length).toBeLessThan(mockItems.length);
    expect(renderedItems.length).toBeGreaterThan(0);
  });

  it('should show empty state when no items', () => {
    render(<VirtualList items={[]} renderItem={renderMock} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('should show custom empty text', () => {
    render(<VirtualList items={[]} renderItem={renderMock} emptyText="自定义空状态" />);
    expect(screen.getByText('自定义空状态')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { container } = render(
      <VirtualList items={mockItems} renderItem={renderMock} loading={true} />
    );
    // Spin component renders an ant-spin container
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should call onScroll when scrolling', () => {
    const onScrollMock = vi.fn();
    const { container } = render(
      <VirtualList
        items={mockItems}
        renderItem={renderMock}
        containerHeight={200}
        onScroll={onScrollMock}
      />
    );
    const scrollContainer = container.firstChild as HTMLElement;
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
    expect(onScrollMock).toHaveBeenCalledWith(100);
  });

  it('should use custom item height when provided', () => {
    const itemsWithHeight = mockItems.slice(0, 5).map((item, i) => ({
      ...item,
      height: 80 + i * 10,
    }));
    render(<VirtualList items={itemsWithHeight} renderItem={renderMock} containerHeight={300} />);
    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });
});
