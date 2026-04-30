/**
 * CollectionDetail - Detail drawer for a vector collection
 * Shows basic info and document list tabs
 */
import React, { useMemo } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Table from 'antd/es/table';
import { Typography, Popconfirm, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { VectorCollection, VectorDocument } from '@/api/vector-store';
import dayjs from 'dayjs';
import { statusColorMap, indexTypeLabelMap, metricLabelMap } from './utils';

const { Paragraph, Text } = Typography;

interface CollectionDetailProps {
  collection: VectorCollection | null;
  open: boolean;
  onClose: () => void;
  documents: VectorDocument[];
  docsLoading: boolean;
  onDeleteDoc: (id: string) => void;
}

const CollectionDetail: React.FC<CollectionDetailProps> = ({
  collection,
  open,
  onClose,
  documents,
  docsLoading,
  onDeleteDoc,
}) => {
  const docColumns: ColumnsType<VectorDocument> = useMemo(
    () => [
      {
        title: '文档内容',
        dataIndex: 'content',
        key: 'content',
        ellipsis: true,
        render: (val: string, record) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 13 }}>
              {val}
            </Paragraph>
            {record.metadata && record.metadata.source && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                来源: <code>{record.metadata.source}</code>
                {record.metadata.category && ` | 分类: ${record.metadata.category}`}
              </Text>
            )}
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        render: (val: string) => (
          <Tag color={statusColorMap[val] || 'default'}>
            {val === 'active' ? '就绪' : val === 'processing' ? '处理中' : '失败'}
          </Tag>
        ),
      },
      {
        title: '维度',
        dataIndex: 'dimensions',
        key: 'dimensions',
        width: 80,
        render: (val: number) => (
          <Text code style={{ fontSize: 12 }}>
            {val}
          </Text>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (val: string) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(val).fromNow()}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 80,
        render: (_, record) => (
          <Popconfirm title="确认删除该文档？" onConfirm={() => onDeleteDoc(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
      },
    ],
    [onDeleteDoc]
  );

  const detailTabs = useMemo(() => {
    if (!collection) return [];
    const c = collection;
    return [
      {
        key: 'info',
        label: '基本信息',
        children: (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="集合名称">{c.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{c.displayName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {c.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文档数量">
              {c.documentCount.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="向量维度">{c.dimensions}</Descriptions.Item>
            <Descriptions.Item label="索引类型">
              {indexTypeLabelMap[c.indexType] || c.indexType}
            </Descriptions.Item>
            <Descriptions.Item label="距离度量">
              {metricLabelMap[c.distanceMetric] || c.distanceMetric}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[c.status]}>
                {c.status === 'active' ? '活跃' : c.status === 'creating' ? '创建中' : '错误'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(c.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(c.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'documents',
        label: '文档列表',
        children: (
          <Spin spinning={docsLoading}>
            <Table<VectorDocument>
              columns={docColumns}
              dataSource={documents}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Spin>
        ),
      },
    ];
  }, [collection, documents, docsLoading, docColumns]);

  return (
    <Drawer
      title={collection ? `${collection.displayName}` : '集合详情'}
      open={open}
      onClose={onClose}
      width={800}
      destroyOnClose
    >
      <Tabs items={detailTabs} />
    </Drawer>
  );
};

export default CollectionDetail;
