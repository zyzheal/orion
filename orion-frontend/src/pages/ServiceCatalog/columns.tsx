/**
 * ServiceCatalog columns
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Button, Popconfirm, Space, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ServiceCatalog } from '@/api/service-catalog';
import { STATUS_CONFIG } from './constants';

export interface BuildServiceColumnsDeps {
  onViewDetail: (r: ServiceCatalog) => void;
  onEdit: (r: ServiceCatalog) => void;
  onDelete: (id: string) => void;
}

export const buildServiceColumns = (deps: BuildServiceColumnsDeps) => [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '值', dataIndex: 'value', key: 'value', ellipsis: true },
  {
    title: '启用',
    dataIndex: 'enabled',
    key: 'enabled',
    width: 80,
    render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: 180,
    render: (_: unknown, r: ServiceCatalog) => (
      <Space>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => deps.onViewDetail(r)}>
          详情
        </Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => deps.onEdit(r)}>
          编辑
        </Button>
        <Popconfirm title="确认删除？" onConfirm={() => deps.onDelete(r.id)}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];

export const buildBreachColumns = () => [
  { title: '请求ID', dataIndex: 'requestId', key: 'requestId', ellipsis: true },
  { title: '服务', dataIndex: 'service', key: 'service' },
  { title: 'SLA目标(ms)', dataIndex: 'slaTargetMs', key: 'slaTargetMs', width: 120 },
  { title: '实际(ms)', dataIndex: 'actualMs', key: 'actualMs', width: 100 },
  { title: '超时(ms)', dataIndex: 'overdueMs', key: 'overdueMs', width: 100 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => (
      <Tag color={STATUS_CONFIG[v]?.color || 'default'}>{STATUS_CONFIG[v]?.label || v}</Tag>
    ),
  },
];
