// =============================================================================
// PageErrorBoundary — 页面级错误边界
//
// 在 AppRouter 中自动包裹每个路由页面，提供：
// 1. 用户友好的错误提示（含页面名称）
// 2. 重试 / 返回 按钮
// 3. 错误上报到 APM/console
// 4. 开发模式下的详细错误堆栈
// =============================================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  pageName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 开发模式：打印详细错误
    if (import.meta.env.DEV) {
      console.error(`[PageErrorBoundary] ${this.props.pageName || 'Unknown'} 页面出错:`, error);
      console.error('Component Stack:', errorInfo.componentStack);
    }

    // 上报到 APM（生产环境）
    this.props.onError?.(error, errorInfo);
    if (import.meta.env.PROD && typeof window !== 'undefined') {
      // 如果有 Sentry 或其他 APM，在这里上报
      // Sentry.captureException(error, { extra: { pageName: this.props.pageName, componentStack: errorInfo.componentStack } });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <PageErrorFallback
          pageName={this.props.pageName}
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ========================= Fallback UI =========================

interface FallbackProps {
  pageName?: string;
  error?: Error;
  onReset: () => void;
}

function PageErrorFallback({ pageName, error, onReset }: FallbackProps) {
  const navigate = useNavigate();
  const displayName = pageName || '该页面';

  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
      <Result
        status="error"
        title={`${displayName} 加载失败`}
        subTitle={error?.message || '发生了意外错误，请稍后重试'}
        extra={[
          <Button key="retry" type="primary" onClick={onReset}>
            重新加载
          </Button>,
          <Button key="back" onClick={() => navigate(-1)}>
            返回上一页
          </Button>,
          <Button key="home" onClick={() => navigate('/dashboard')}>
            回到首页
          </Button>,
        ]}
      >
        {import.meta.env.DEV && error && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: '#f5f5f5',
              borderRadius: 4,
              textAlign: 'left',
              maxHeight: 300,
              overflow: 'auto',
              fontSize: 12,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error.name}: {error.message}
            {'\n\n'}
            {error.stack}
          </div>
        )}
      </Result>
    </div>
  );
}

// ========================= HOC 便捷包装 =========================

/**
 * withPageErrorBoundary — 为页面组件自动包裹 ErrorBoundary
 *
 * 使用：
 *   export default withPageErrorBoundary(PipelineList, 'Pipeline 列表')
 */
export function withPageErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  pageName?: string
): React.FC<P> {
  const displayName = pageName || WrappedComponent.displayName || WrappedComponent.name || 'Page';

  const Wrapped: React.FC<P> = (props) => (
    <PageErrorBoundary pageName={displayName}>
      <WrappedComponent {...props} />
    </PageErrorBoundary>
  );

  Wrapped.displayName = `withPageErrorBoundary(${displayName})`;
  return Wrapped;
}
