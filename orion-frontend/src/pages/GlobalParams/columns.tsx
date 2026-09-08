/**
 * GlobalParams columns
 * 抽取自 index.tsx (P2-9 Phase 201)
 */
import { Button, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { GlobalParam } from '@/api/global-params';
import { SCOPE_COLORS } from './constants';

const { Text } = Typography;

interface Props {
  onEdit: (record: GlobalParam) => void;
  onDelete: (record: GlobalParam) => void;
}

export function buildColumns({ onEdit, onDelete }: Props): ColumnsType<GlobalParam> {
  return [
    {
      title: 'Key',
      dataIndex: 'key',
      width: 200,
      render: (v: string) => <Text code strong>{v}</Text>,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      ellipsis: true,
      render: (v: string, r: GlobalParam) => (r.isSecret ? '••••••••' : v),
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      width: 100,
      render: (s: string) => <Tag color={SCOPE_COLORS[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, r: GlobalParam) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(r)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(r)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
}
