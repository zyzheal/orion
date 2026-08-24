import React from 'react';
import { Button, Space } from 'antd';
import type { OrionActionGroupProps } from './types';

/**
 * OrionActionGroup — 统一操作按钮组
 * 支持 loading/disabled（修复 18+ 页重复点击问题）
 */
const OrionActionGroup: React.FC<OrionActionGroupProps> = ({ items }) => (
  <Space>
    {items.map((item) => (
      <Button
        key={item.key}
        icon={item.icon}
        onClick={item.onClick}
        danger={item.danger}
        loading={item.loading}
        disabled={item.disabled || item.loading}
      >
        {item.label}
      </Button>
    ))}
  </Space>
);

export default OrionActionGroup;
