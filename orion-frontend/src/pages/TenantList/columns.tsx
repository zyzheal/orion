/**
 * Tenant List 列定义
 * 抽取自 index.tsx (P2-9 Phase 109)
 */
import { Button, Space, Tag, Typography, Tooltip, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, SwapOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TenantEntity } from '@/api/tenant';
import { STATUS_COLOR_MAP } from './constants';

const { Text } = Typography;

interface TenantColumnDeps {
  handleSwitchTenant: (tenantId: string) => void;
  handleOpenEditModal: (record: TenantEntity) => void;
  handleOpenUserModal: (record: TenantEntity) => void;
  handleDelete: (id: string) => void;
}

export const buildTenantColumns = ({
  handleSwitchTenant,
  handleOpenEditModal,
  handleOpenUserModal,
  handleDelete,
}: TenantColumnDeps): ColumnsType<TenantEntity> => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    render: (_: unknown, record: TenantEntity) => (
      <Space>
        <Text strong>{record.display_name || record.name}</Text>
        {record.display_name && (
          <Text type="secondary" code>
            {record.name}
          </Text>
        )}
      </Space>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={STATUS_COLOR_MAP[status] || 'default'}>{status}</Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (ts: string) => new Date(ts).toLocaleString(),
  },
  {
    title: '操作',
    key: 'actions',
    render: (_: unknown, record: TenantEntity) => (
      <Space>
        <Tooltip title="切换到此租户">
          <Button
            type="link"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => handleSwitchTenant(record.id)}
          >
            切换
          </Button>
        </Tooltip>
        <Tooltip title="编辑租户">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditModal(record)}
          >
            编辑
          </Button>
        </Tooltip>
        <Tooltip title="用户管理">
          <Button
            type="link"
            size="small"
            icon={<TeamOutlined />}
            onClick={() => handleOpenUserModal(record)}
          >
            用户
          </Button>
        </Tooltip>
        <Popconfirm
          title="确认删除"
          description={`确定要删除租户 "${record.name}" 吗？此操作将软删除该租户。`}
          onConfirm={() => handleDelete(record.id)}
          okText="确认删除"
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
