/**
 * AlertBanner — 页面级持久化错误组件
 *
 * 用于 useErrorBanner，配合 Google/AWS 最佳实践：
 * - 页面顶部持久化错误条
 * - 带重试/关闭操作
 */
import React from 'react';
import { Alert, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens/spacing';
import type { ErrorBannerState } from './useErrorBanner';

interface AlertBannerProps {
  state: ErrorBannerState | null;
  onClose: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ state, onClose }) => {
  if (!state) return null;

  const messageContent = (
    <Space direction="vertical" size={2}>
      <span style={{ fontWeight: 500 }}>{state.message}</span>
    </Space>
  );

  if (!state.onRetry) {
    return (
      <Alert
        type={state.severity || 'error'}
        message={messageContent}
        closable
        onClose={onClose as React.MouseEventHandler}
        style={{ marginBottom: spacing.md }}
      />
    );
  }

  return (
    <Alert
      type={state.severity || 'error'}
      message={messageContent}
      closable
      onClose={onClose as React.MouseEventHandler}
      style={{ marginBottom: spacing.md }}
      action={
        <Button
          size="small"
          type="primary"
          icon={<ReloadOutlined />}
          onClick={() => {
            onClose();
            state.onRetry?.();
          }}
        >
          {state.actionLabel || '重试'}
        </Button>
      }
    />
  );
};
