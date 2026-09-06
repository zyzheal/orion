/**
 * columns.tsx - 向量集合 / 文档表格列定义
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import { Button, Space, Tag, Tooltip, Popconfirm, Typography } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import type { VectorCollection, VectorDocument } from '@/api/vector-store';
import { indexTypeLabelMap, metricLabelMap, statusColorMap, statusLabelMap, docStatusLabelMap } from './constants';

const { Text } = Typography;

export const makeCollectionColumns = (
  openDetail: (c: VectorCollection) => void,
  handleDeleteCollection: (name: string) => void
) => [
  {
    title: '集合名称',
    dataIndex: 'displayName',
    key: 'displayName',
    width: 180,
    render: (text: string, record: VectorCollection) => (
      <Space direction="vertical" size={0}>
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => openDetail(record)}
        >
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
    sorter: (a: VectorCollection, b: VectorCollection) => a.documentCount - b.documentCount,
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
      <Tag color={statusColorMap[val] || 'default'}>{statusLabelMap[val] || val}</Tag>
    ),
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 140,
    sorter: (a: VectorCollection, b: VectorCollection) =>
      dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix(),
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
    render: (_: unknown, record: VectorCollection) => (
      <Space size="small">
        <Tooltip title="详情">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
        </Tooltip>
        <Tooltip title="删除">
          <Popconfirm
            title="确认删除该集合？此操作不可撤销。"
            onConfirm={() => handleDeleteCollection(record.name)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
];

export const makeDocumentColumns = (handleDeleteDoc: (id: string) => void) => [
  {
    title: '文档内容',
    dataIndex: 'content',
    key: 'content',
    ellipsis: true,
    render: (val: string, record: VectorDocument) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Text ellipsis style={{ fontSize: 13 }}>
          {val}
        </Text>
        {(() => {
          const src = record.metadata?.source;
          const cat = record.metadata?.category;
          return src ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              来源: <code>{String(src)}</code>
              {cat ? ` | 分类: ${String(cat)}` : null}
            </Text>
          ) : null;
        })()}
      </div>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (val: string) => (
      <Tag color={statusColorMap[val] || 'default'}>{docStatusLabelMap[val] || val}</Tag>
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
    render: (_: unknown, record: VectorDocument) => (
      <Popconfirm title="确认删除该文档？" onConfirm={() => handleDeleteDoc(record.id)}>
        <Button type="link" size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    ),
  },
];
