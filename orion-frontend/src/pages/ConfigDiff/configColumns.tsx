/**
 * ConfigDiff column definitions
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Typography, Tag, Button } from 'antd';
import type { ConfigChange } from '@/api/config';
import { operationColor, operationIcon } from './constants';

const { Text } = Typography;

export interface ChangeColumnsDeps {
  setChangeDetail: (detail: ConfigChange | null) => void;
}

export const buildChangeColumns = ({ setChangeDetail }: ChangeColumnsDeps): {
  title: string;
  dataIndex?: string;
  key: string;
  render?: (value: unknown, record?: ConfigChange) => React.ReactNode;
}[] => [
  {
    title: 'Path',
    dataIndex: 'path',
    key: 'path',
    render: (v) => <Text code>{String(v)}</Text>,
  },
  {
    title: 'Operation',
    dataIndex: 'operation',
    key: 'operation',
    render: (v) => (
      <Tag color={operationColor[String(v)]}>
        {operationIcon[String(v)]} {String(v).toUpperCase()}
      </Tag>
    ),
  },
  {
    title: 'Old Value',
    dataIndex: 'oldValue',
    key: 'oldValue',
    render: (v) => {
      if (v === undefined || v === null) return <Text type="secondary">—</Text>;
      return <Text code>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>;
    },
  },
  {
    title: 'New Value',
    dataIndex: 'newValue',
    key: 'newValue',
    render: (v) => {
      if (v === undefined || v === null) return <Text type="secondary">—</Text>;
      return <Text code>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>;
    },
  },
  {
    title: 'Action',
    key: 'action',
    render: (_: unknown, record?: ConfigChange) =>
      record ? (
        <Button size="small" onClick={() => setChangeDetail(record)}>
          Details
        </Button>
      ) : null,
  },
];

export const reportColumns: {
  title: string;
  dataIndex?: string;
  key: string;
  render?: (value: unknown) => React.ReactNode;
}[] = [
  { title: 'Key', dataIndex: 'key', key: 'key' },
  { title: 'Environment', dataIndex: 'environment', key: 'environment' },
  {
    title: 'Latest',
    dataIndex: 'latestVersion',
    key: 'latestVersion',
    render: (v) => <Tag>v{String(v)}</Tag>,
  },
  {
    title: 'Changes',
    dataIndex: 'changes',
    key: 'changes',
    render: (changes: unknown) => <Tag color="blue">{Array.isArray(changes) ? changes.length : 0}</Tag>,
  },
];
