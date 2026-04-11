import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// 测试用组件
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('测试错误');
  }
  return <div>正常内容</div>;
};

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>测试内容</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('测试内容')).toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    // 抑制控制台错误输出
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
    }).not.toThrow();

    // 错误边界会捕获错误并显示错误页面
    expect(screen.getByText('出错了')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>自定义错误页面</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('自定义错误页面')).toBeInTheDocument();
  });
});
