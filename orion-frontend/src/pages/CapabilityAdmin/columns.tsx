/**
 * columns.tsx - 能力权限配置表格列定义
 * 抽取自 CapabilityAdmin/index.tsx (P2-9 Phase 86)
 */
import { Badge, Button, Popconfirm, Space, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { RISK_COLORS, RISK_LABELS, AUDIT_ACTION_COLORS } from './constants';
import type { Capability, TemporaryPermission } from '@/api/capability';

export const makeCapabilityColumns = (
  handleEdit: (record: Capability) => void,
  handleDelete: (record: Capability) => void
) => [
  {
    title: '能力标识',
    dataIndex: 'capability_id',
    key: 'capability_id',
    width: 200,
    render: (text: string) => <Tag>{text}</Tag>,
  },
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: 100,
    render: (text: string) => <Tag color="blue">{text}</Tag>,
  },
  {
    title: '风险等级',
    dataIndex: 'risk_level',
    key: 'risk_level',
    width: 100,
    render: (level: number) => (
      <Badge color={RISK_COLORS[level]} text={RISK_LABELS[level]} />
    ),
  },
  {
    title: '需要审批',
    dataIndex: 'requires_approval',
    key: 'requires_approval',
    width: 100,
    render: (val: boolean) => (val ? <Tag color="orange">是</Tag> : <Tag>否</Tag>),
  },
  {
    title: '操作',
    key: 'action',
    width: 150,
    render: (_: unknown, record: Capability) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
          删除
        </Button>
      </Space>
    ),
  },
];

export const makeTempPermColumns = (
  handleRevokeTempPerm: (id: number) => void
) => [
  {
    title: '能力标识',
    dataIndex: 'capability_id',
    key: 'capability_id',
    render: (text: string) => <Tag>{text}</Tag>,
  },
  {
    title: '环境',
    dataIndex: 'environment_suffix',
    key: 'environment_suffix',
    render: (val: string) => val || '-',
  },
  {
    title: '授予人',
    dataIndex: 'granted_by',
    key: 'granted_by',
  },
  {
    title: '授予时间',
    dataIndex: 'granted_at',
    key: 'granted_at',
    render: (val: string) => new Date(val).toLocaleString(),
  },
  {
    title: '过期时间',
    dataIndex: 'expires_at',
    key: 'expires_at',
    render: (val: string) => (
      <Tag icon={<ClockCircleOutlined />} color={new Date(val) < new Date() ? 'error' : 'processing'}>
        {new Date(val).toLocaleString()}
      </Tag>
    ),
  },
  {
    title: '操作',
    key: 'action',
    render: (_: unknown, record: TemporaryPermission) =>
      !record.revoked_at && (
        <Popconfirm
          title="确认撤销"
          description="确定要撤销此临时权限吗？"
          onConfirm={() => handleRevokeTempPerm(record.id)}
        >
          <Button type="link" size="small" danger>
            撤销
          </Button>
        </Popconfirm>
      ),
  },
];

export const auditColumns = [
  {
    title: '用户',
    dataIndex: 'user_id',
    key: 'user_id',
  },
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    render: (val: string) => <Tag color={AUDIT_ACTION_COLORS[val] || 'default'}>{val}</Tag>,
  },
  {
    title: '能力标识',
    dataIndex: 'capability_id',
    key: 'capability_id',
    render: (text: string) => <Tag>{text}</Tag>,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    ellipsis: true,
  },
  {
    title: '时间',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (val: string) => new Date(val).toLocaleString(),
  },
];
