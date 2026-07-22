/**
 * CollectionList - Vector collection list table with search
 */
import React from 'react';
import { Typography, Space, Tag, Input, Button, Tooltip, Popconfirm, Table } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { VectorCollection } from '@/api/vector-store';
import dayjs from 'dayjs';
import { statusColorMap, indexTypeLabelMap, metricLabelMap } from './utils';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface CollectionListProps {
  collections: VectorCollection[];
  filteredCollections: VectorCollection[];
  loading: boolean;
  searchQuery: string;
  onSearch: (query: string) => void;
  onOpenDetail: (collection: VectorCollection) => void;
  onDeleteCollection: (name: string) => void;
}

const CollectionList: React.FC<CollectionListProps> = ({
  collections: _collections,
  filteredCollections,
  loading,
  searchQuery: _searchQuery,
  onSearch,
  onOpenDetail,
  onDeleteCollection,
}) => {
  const columns: ColumnsType<VectorCollection> = [
    {
      title: '集合名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 180,
      render: (text: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => onOpenDetail(record)}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.name}
          </Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {text || '-'}
        </Text>
      ),
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 100,
      sorter: (a, b) => a.documentCount - b.documentCount,
      render: (val: number) => <Text strong>{val.toLocaleString()}</Text>,
    },
    {
      title: '维度',
      dataIndex: 'dimensions',
      key: 'dimensions',
      width: 90,
      render: (val: number) => <Text code>{val}</Text>,
    },
    {
      title: '索引类型',
      dataIndex: 'indexType',
      key: 'indexType',
      width: 110,
      render: (val: string) => <Tag>{indexTypeLabelMap[val] || val}</Tag>,
    },
    {
      title: '距离度量',
      dataIndex: 'distanceMetric',
      key: 'distanceMetric',
      width: 120,
      render: (val: string) => <Text type="secondary">{metricLabelMap[val] || val}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: string) => (
        <Tag color={statusColorMap[val] || 'default'}>
          {val === 'active' ? '活跃' : val === 'creating' ? '创建中' : '错误'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      sorter: (a, b) => dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix(),
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(val).fromNow()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onOpenDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除该集合？此操作不可撤销。"
              onConfirm={() => onDeleteCollection(record.name)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing[3] }}>
        <Input.Search
          placeholder="搜索集合..."
          allowClear
          style={{ maxWidth: 300 }}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <Table<VectorCollection>
        columns={columns}
        dataSource={filteredCollections}
        rowKey="name"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />
    </div>
  );
};

export default CollectionList;
