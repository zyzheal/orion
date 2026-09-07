/**
 * ConfigDiff constants
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { PlusOutlined, DeleteOutlined, CheckSquareOutlined } from '@ant-design/icons';

export const operationColor: Record<string, string> = {
  add: 'green',
  remove: 'red',
  update: 'blue',
};

export const operationIcon: Record<string, React.ReactNode> = {
  add: <PlusOutlined />,
  remove: <DeleteOutlined />,
  update: <CheckSquareOutlined />,
};
