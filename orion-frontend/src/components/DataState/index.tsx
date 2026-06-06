import React from 'react';
import { Spin, Result, Empty, Button } from 'antd';
import { LoadingOutlined, SyncOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export interface DataStateProps {
  loading: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyText?: string;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
  retry?: () => void;
  loadingText?: string;
}

/**
 * Unified data state component for loading/error/empty states.
 * Priority: loading > error > empty > children
 */
export const DataState: React.FC<DataStateProps> = ({
  loading,
  error = null,
  empty = false,
  emptyText = '暂无数据',
  emptyAction,
  children,
  retry,
  loadingText = '加载中...',
}) => {
  // Loading state
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} size="large" />
        <div style={{ marginTop: spacing[3], color: colors.neutral[600] }}>{loadingText}</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Result
        status="error"
        title={error.message || '加载失败'}
        extra={
          retry && (
            <Button type="primary" icon={<SyncOutlined />} onClick={retry}>
              重试
            </Button>
          )
        }
      />
    );
  }

  // Empty state
  if (empty) {
    return (
      <Empty description={emptyText}>
        {emptyAction}
      </Empty>
    );
  }

  // Normal state
  return <>{children}</>;
};

export default DataState;
