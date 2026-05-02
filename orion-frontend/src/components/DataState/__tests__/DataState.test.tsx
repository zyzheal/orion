import { render, screen, fireEvent } from '@testing-library/react';
import { DataState } from '../index';

describe('DataState', () => {
  it('renders loading spinner when loading is true', () => {
    const { container } = render(<DataState loading={true}>Content</DataState>);
    expect(container.querySelector('.ant-spin-spinning')).toBeInTheDocument();
  });

  it('renders custom loading text', () => {
    const { container } = render(
      <DataState loading={true} loadingText="Fetching data...">
        Content
      </DataState>
    );
    expect(container.querySelector('.ant-spin-spinning')).toBeInTheDocument();
    expect(container.textContent).toContain('Fetching data...');
  });

  it('renders error state with retry button', () => {
    const error = new Error('Network error');
    const retry = vi.fn();
    render(
      <DataState loading={false} error={error} retry={retry}>
        Content
      </DataState>
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
    fireEvent.click(screen.getByText('重试'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders empty state with default text', () => {
    render(<DataState loading={false} empty={true}>Content</DataState>);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('renders empty state with custom text and action', () => {
    render(
      <DataState
        loading={false}
        empty={true}
        emptyText="没有找到结果"
        emptyAction={<button>创建新项</button>}
      >
        Content
      </DataState>
    );
    expect(screen.getByText('没有找到结果')).toBeInTheDocument();
    expect(screen.getByText('创建新项')).toBeInTheDocument();
  });

  it('renders children when no loading, error, or empty', () => {
    render(<DataState loading={false}>Hello World</DataState>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
