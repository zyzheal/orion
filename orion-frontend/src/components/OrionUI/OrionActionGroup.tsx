import React from 'react';
import { Button, Space } from 'antd';
import type { OrionActionGroupProps } from './types';

const OrionActionGroup: React.FC<OrionActionGroupProps> = ({ items }) => (
  <Space>
    {items.map((item) => (
      <Button
        key={item.key}
        icon={item.icon}
        onClick={item.onClick}
        danger={item.danger}
      >
        {item.label}
      </Button>
    ))}
  </Space>
);

export default OrionActionGroup;
