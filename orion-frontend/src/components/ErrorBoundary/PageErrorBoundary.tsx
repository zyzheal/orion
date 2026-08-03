import { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/** PageErrorBoundary — wraps every route so 200+ pages get error handling for free. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[PageErrorBoundary] ${this.props.pageName || 'Unknown'}:`, error);
    if (import.meta.env.DEV) {
      console.error('Stack:', errorInfo.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <PageErrorFallback pageName={this.props.pageName} error={this.state.error} />;
    }
    return this.props.children;
  }
}

function PageErrorFallback({ pageName, error }: { pageName?: string; error?: Error }) {
  const navigate = useNavigate();
  const name = pageName || '该页面';
  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
      <Result
        status="error"
        title={`${name} 加载失败`}
        subTitle={error?.message || '发生了意外错误，请稍后重试'}
        extra={[
          <Button key="retry" type="primary" onClick={() => navigate(0)}>重新加载</Button>,
          <Button key="back" onClick={() => navigate(-1)}>返回</Button>,
          <Button key="home" onClick={() => navigate('/dashboard')}>首页</Button>,
        ]}
      />
    </div>
  );
}

/** Derive a human-friendly page name from a route path like "/pipeline-runs" → "Pipeline Runs" */
export function pathToPageName(path: string | undefined): string {
  const clean = (path || "page").replace(/:.*$/, '').split('/').pop() || 'Page';
  return clean.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}
