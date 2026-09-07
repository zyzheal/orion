/**
 * Dashboard loading and error states
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { Alert, Spin } from 'antd';
import type { DashboardState } from '../types';

export const DashboardLoading = () => (
  <div
    style={{
      padding: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 400,
    }}
  >
    <Spin size="large" tip="加载工作台数据..." />
  </div>
);

interface DashboardErrorProps {
  error: Error;
}

export const DashboardError = ({ error }: DashboardErrorProps) => (
  <div style={{ padding: 0 }}>
    <Alert
      message="加载失败"
      description={`无法加载工作台数据：${error.message}`}
      type="error"
      showIcon
      action={<a onClick={() => window.location.reload()}>重新加载</a>}
    />
  </div>
);

export const shouldShowLoading = (state: DashboardState) => state.loading;
export const shouldShowError = (state: DashboardState) =>
  Boolean(state.error && state.kpis.length === 0);
