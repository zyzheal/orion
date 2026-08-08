import React from 'react';
import { Empty, Button, Space } from 'antd';
import type { OrionEmptyProps } from './types';
import { spacing } from '@/tokens/spacing';

const OrionEmpty: React.FC<OrionEmptyProps> = ({
  description,
  actionLabel,
  onAction,
}) => {
  const actionButton = actionLabel && onAction ? (
    <Button type="primary" onClick={onAction} style={{ marginTop: spacing.md }}>
      {actionLabel}
    </Button>
  ) : null;

  return (
    <Empty description={description}>
      {actionButton ? <Space>{actionButton}</Space> : null}
    </Empty>
  );
};

export default OrionEmpty;
