/**
 * Library Table - Internal library list with columns and action buttons
 */
import React from 'react';
import { Tag, Space, Button, Popconfirm, Tooltip, Typography } from 'antd';
import {
  DeleteOutlined, PlayCircleOutlined, CodeOutlined, TeamOutlined,
  StopOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import type {
  InternalLibrary,
  LibraryLanguage, LibraryStatus,
} from '@/api/internal-library';
import dayjs from 'dayjs';

const { Text } = Typography;

// ---- Constants ----

const languageLabels: Record<LibraryLanguage, string> = {
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET',
};

const statusColorMap: Record<LibraryStatus, string> = {
  active: 'green',
  deprecated: 'orange',
  archived: 'default',
  development: 'blue',
};

export { languageLabels, statusColorMap };

interface LibraryTableProps {
  dataSource: InternalLibrary[];
  loading: boolean;
  onDetail: (record: InternalLibrary) => void;
  onActivate: (id: string) => void;
  onDeprecate: (record: InternalLibrary) => void;
  onDelete: (id: string) => void;
}

const LibraryTable: React.FC<LibraryTableProps> = ({
  dataSource, loading, onDetail, onActivate, onDeprecate, onDelete,
}) => {
  const columns: TableColumn<InternalLibrary>[] = [
    {
      key: 'displayName', title: '二方库', dataIndex: 'displayName', width: 180, sortable: true,
      render: (v: unknown, record: InternalLibrary) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => onDetail(record)}>{String(v || record.name)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}><CodeOutlined /> {record.name}</Text>
        </Space>
      ),
    },
    {
      key: 'description', title: '描述', dataIndex: 'description', width: 200,
      render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text>,
    },
    {
      key: 'language', title: '语言', width: 90,
      render: (_: unknown, record: InternalLibrary) => <Tag color="cyan">{languageLabels[record.language] || record.language}</Tag>,
    },
    {
      key: 'version', title: '当前版本', width: 100,
      render: (_: unknown, record: InternalLibrary) => <Text code>{record.currentVersion}</Text>,
    },
    {
      key: 'owner', title: '团队', width: 120,
      render: (_: unknown, record: InternalLibrary) => <Space><TeamOutlined /> <Text>{record.owner}</Text></Space>,
    },
    {
      key: 'dependents', title: '依赖项目', width: 100,
      render: (_: unknown, record: InternalLibrary) => {
        const d = record.dependents;
        return <Text style={{ fontSize: 12 }}>{d?.totalRepos ?? 0} 个项目<br />{d?.totalTeams ?? 0} 个团队</Text>;
      },
    },
    {
      key: 'quality', title: '质量', width: 90,
      render: (_: unknown, record: InternalLibrary) => {
        const q = record.quality;
        if (!q) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>覆盖 {q.testCoverage ?? '-'}%</Text>
            <Text type={q.securityScore && q.securityScore >= 90 ? 'success' : q.securityScore && q.securityScore >= 70 ? 'warning' : 'danger'} style={{ fontSize: 12 }}>安全 {q.securityScore ?? '-'}</Text>
          </Space>
        );
      },
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (_: unknown, record: InternalLibrary) => <Tag color={statusColorMap[record.status]}>{record.status}</Tag>,
    },
    {
      key: 'updatedAt', title: '更新', width: 110,
      render: (_: unknown, record: InternalLibrary) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(record.updatedAt).fromNow()}</Text>,
    },
    {
      key: 'actions', title: '操作', width: 200,
      render: (_: unknown, record: InternalLibrary) => (
        <Space size="small" wrap>
          <Tooltip title="详情"><Button type="link" size="small" onClick={() => onDetail(record)}>详情</Button></Tooltip>
          {record.status === 'deprecated' || record.status === 'archived' ? (
            <Tooltip title="激活"><Popconfirm title="确认激活?" onConfirm={() => onActivate(record.id)}><Button type="link" size="small" icon={<PlayCircleOutlined />} /></Popconfirm></Tooltip>
          ) : record.status === 'active' ? (
            <Tooltip title="废弃"><Popconfirm title="确认废弃?" onConfirm={() => onDeprecate(record)}><Button type="link" size="small" danger icon={<StopOutlined />} /></Popconfirm></Tooltip>
          ) : null}
          <Tooltip title="删除"><Popconfirm title="确认删除?" onConfirm={() => onDelete(record.id)}><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table columns={columns} dataSource={dataSource} loading={loading} rowKey="id" size="middle" striped />
  );
};

export default LibraryTable;
