/**
 * columns.tsx - UserSettings Token 表格列
 * 抽取自 UserSettings/index.tsx (P2-9 Phase 101)
 */
import { Button, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UserToken } from '@/api/user';

export const buildTokenColumns = (handleDeleteToken: (id: string) => void): ColumnsType<UserToken> => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (text: string) => new Date(text).toLocaleString('zh-CN'),
  },
  {
    title: '过期时间',
    dataIndex: 'expiresAt',
    key: 'expiresAt',
    render: (text?: string) => (text ? new Date(text).toLocaleString('zh-CN') : '永不过期'),
  },
  {
    title: '操作',
    key: 'action',
    render: (_, record) => (
      <Popconfirm
        title="确定要删除这个 Token 吗？"
        onConfirm={() => handleDeleteToken(record.id)}
        okText="确定"
        cancelText="取消"
      >
        <Button type="link" danger icon={<DeleteOutlined />}>
          删除
        </Button>
      </Popconfirm>
    ),
  },
];
