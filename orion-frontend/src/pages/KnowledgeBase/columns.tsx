/**
 * KnowledgeBase columns
 */
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, FolderOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { KnowledgeItem } from './types';

const { Text } = Typography;

interface BuildColumnsDeps {
  openEdit: (record: KnowledgeItem) => void;
  handleDelete: (id: string) => void;
}

export function buildColumns({ openEdit, handleDelete }: BuildColumnsDeps): TableColumn<KnowledgeItem>[] {
  return [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 250,
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'category',
      title: '分类',
      width: 120,
      render: (_: unknown, record: KnowledgeItem) => (
        <Tag icon={<FolderOutlined />} color="blue">
          {record.category}
        </Tag>
      ),
    },
    {
      key: 'tags',
      title: '标签',
      width: 200,
      render: (_: unknown, record: KnowledgeItem) => (
        <Space wrap>
          {record.tags.map((tag, i) => (
            <Tag key={String(i)}>{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'createdBy',
      title: '创建人',
      dataIndex: 'createdBy',
      width: 100,
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value: unknown) => dayjs(String(value)).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: KnowledgeItem) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}
