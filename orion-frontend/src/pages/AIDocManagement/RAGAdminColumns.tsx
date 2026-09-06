/**
 * RAGAdminColumns.tsx - RAG Prompt 模板表格列
 * 抽取自 AIDocManagement/RAGAdmin.tsx (P2-9 Phase 98)
 */
import { Button, Space, Popconfirm, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { PromptTemplate } from './RAGAdminConstants';

const { Text } = Typography;

interface RAGTemplateColumnDeps {
  onEdit: (record: PromptTemplate) => void;
  onDelete: (record: PromptTemplate) => void;
}

export const buildRAGTemplateColumns = (
  deps: RAGTemplateColumnDeps,
): ColumnsType<PromptTemplate> => {
  const { onEdit, onDelete } = deps;
  return [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (version: string) => <Tag color="blue">{version}</Tag>,
    },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
          {content}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: PromptTemplate) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除此模板？"
            onConfirm={() => onDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
};
