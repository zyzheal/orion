/**
 * Columns.tsx - Digital Twin 表格列
 * 抽取自 index.tsx (P2-9 Phase 244)
 */
import { Button, Tag } from 'antd';
import type { TrafficRecording } from '@/api/digital-twin';

interface SnapshotRenderProps {
  onStopRecording: (id: string) => void;
}

export function buildSnapshotColumns(): { title: string; dataIndex?: string; key?: string; width?: number; render?: (v: any) => React.ReactNode }[] {
  return [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ready' ? 'green' : status === 'creating' ? 'blue' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Components',
      dataIndex: 'components',
      key: 'components',
      render: (c: unknown[]) => c.length,
    },
    {
      title: 'Size',
      dataIndex: 'size_bytes',
      key: 'size_bytes',
      render: (s: number) => `${(s / 1024).toFixed(1)} KB`,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => new Date(d).toLocaleString(),
    },
  ];
}

export function buildRecordingColumns({ onStopRecording }: SnapshotRenderProps) {
  return [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'Source', dataIndex: 'source_env', key: 'source_env' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'recording' ? 'blue' : status === 'completed' ? 'green' : 'default'}>
          {status}
        </Tag>
      ),
    },
    { title: 'Requests', dataIndex: 'request_count', key: 'request_count' },
    {
      title: 'Size',
      dataIndex: 'size_bytes',
      key: 'size_bytes',
      render: (s: number) => `${(s / 1024).toFixed(1)} KB`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: TrafficRecording) => (
        <Button onClick={() => onStopRecording(record.id)} disabled={record.status !== 'recording'}>
          Stop
        </Button>
      ),
    },
  ];
}
