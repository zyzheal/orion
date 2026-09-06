/**
 * columns.tsx - 主机 / 脚本表格列定义
 * 抽取自 VisorPage.tsx (P2-9 Phase 94)
 */
import { Button, Space, Tag, Popconfirm, Badge, Typography } from 'antd';
import { CloudServerOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { Host, ScriptExecution } from '@/api/visor';
import { colors } from '@/tokens/colors';
import { hostStatusLabelMap, scriptStatusColorMap, scriptStatusLabelMap } from './constants';

const { Text } = Typography;

export const makeHostColumns = (
  handleRemoveHost: (id: string) => void,
  handleViewHostStatus: (id: string) => void
): TableColumn<Host>[] => [
  {
    key: 'hostname',
    title: '主机名',
    dataIndex: 'hostname',
    width: 180,
    render: (v: unknown) => (
      <Space>
        <CloudServerOutlined style={{ color: colors.primary[500] }} />
        <Text strong>{String(v)}</Text>
      </Space>
    ),
  },
  {
    key: 'ip',
    title: 'IP地址',
    dataIndex: 'ip',
    width: 150,
    render: (v: unknown) => <Text code>{String(v)}</Text>,
  },
  {
    key: 'os',
    title: '操作系统',
    dataIndex: 'os',
    width: 120,
    render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (v: unknown) => {
      const status = v as Host['status'];
      return (
        <Badge
          status={status === 'online' ? 'success' : status === 'error' ? 'error' : 'default'}
          text={hostStatusLabelMap[status]}
        />
      );
    },
  },
  {
    key: 'cpuUsage',
    title: 'CPU',
    dataIndex: 'cpuUsage',
    width: 80,
    render: (v: unknown) =>
      v != null ? (
        <Tag color={(v as number) > 80 ? 'red' : (v as number) > 50 ? 'orange' : 'green'}>
          {String(v)}%
        </Tag>
      ) : (
        <Text type="secondary">-</Text>
      ),
  },
  {
    key: 'memoryUsage',
    title: '内存',
    dataIndex: 'memoryUsage',
    width: 80,
    render: (v: unknown) =>
      v != null ? (
        <Tag color={(v as number) > 80 ? 'red' : (v as number) > 50 ? 'orange' : 'green'}>
          {String(v)}%
        </Tag>
      ) : (
        <Text type="secondary">-</Text>
      ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    render: (_: unknown, record: Host) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewHostStatus(record.id)}
        >
          状态
        </Button>
        <Popconfirm title="确认移除此主机？" onConfirm={() => handleRemoveHost(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];

export const makeScriptColumns = (
  handleViewScriptResult: (id: string) => void
): TableColumn<ScriptExecution>[] => [
  {
    key: 'id',
    title: '执行ID',
    dataIndex: 'id',
    width: 120,
    render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
  },
  {
    key: 'hostname',
    title: '目标主机',
    dataIndex: 'hostname',
    width: 150,
    render: (v: unknown) => (
      <Space>
        <CloudServerOutlined style={{ color: colors.primary[500] }} />
        <Text>{v ? String(v) : '-'}</Text>
      </Space>
    ),
  },
  {
    key: 'script',
    title: '脚本',
    dataIndex: 'script',
    ellipsis: true,
    render: (v: unknown) => (
      <Text code style={{ fontSize: 12 }}>
        {String(v).slice(0, 50)}
        {String(v).length > 50 ? '...' : ''}
      </Text>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (v: unknown) => (
      <Tag color={scriptStatusColorMap[v as ScriptExecution['status']]}>
        {scriptStatusLabelMap[v as ScriptExecution['status']]}
      </Tag>
    ),
  },
  {
    key: 'createdAt',
    title: '执行时间',
    dataIndex: 'createdAt',
    width: 160,
    render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    render: (_: unknown, record: ScriptExecution) =>
      record.status === 'success' || record.status === 'failed' ? (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewScriptResult(record.id)}
        >
          查看结果
        </Button>
      ) : null,
  },
];
