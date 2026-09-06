/**
 * columns.tsx - 告警闭环与升级策略 表格列定义
 * 抽取自 AlertClosurePage/index.tsx (P2-9 Phase 88)
 */
import { Button, Space, Tag, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { EscalationPolicy, EscalationTrigger, AlertClosure } from '@/api/alertEscalation';
import { SEVERITY_MAP, CLOSURE_STATUS } from './constants';

export const makePolicyColumns = (
  handleViewDetail: (r: EscalationPolicy) => void,
  handleEvaluate: (r: EscalationPolicy) => void,
  handleEdit: (r: EscalationPolicy) => void,
  handleDelete: (id: string) => void
) => [
  { title: '策略名', dataIndex: 'name', key: 'name' },
  {
    title: '严重度',
    dataIndex: 'severity',
    key: 'severity',
    render: (v: string) => <Tag color={SEVERITY_MAP[v]?.color}>{SEVERITY_MAP[v]?.label || v}</Tag>,
  },
  {
    title: '规则数',
    key: 'rulesCount',
    render: (_: unknown, r: EscalationPolicy) => r.rules?.length || 0,
  },
  { title: '创建者', dataIndex: 'createdBy', key: 'createdBy', width: 100 },
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
    width: 240,
    render: (_: unknown, r: EscalationPolicy) => (
      <Space>
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(r)}
        >
          详情
        </Button>
        <Button type="link" size="small" onClick={() => handleEvaluate(r)}>
          模拟
        </Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
          编辑
        </Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];

export const makeTriggerColumns = (
  handleTriggerResolve: (trigger: EscalationTrigger) => void
) => [
  { title: '触发器ID', dataIndex: 'id', key: 'id', width: 80, ellipsis: true },
  { title: '策略ID', dataIndex: 'policyId', key: 'policyId', width: 100, ellipsis: true },
  { title: '告警ID', dataIndex: 'alertId', key: 'alertId', width: 100, ellipsis: true },
  { title: '层级', dataIndex: 'level', key: 'level', width: 60 },
  { title: '目标', dataIndex: 'target', key: 'target' },
  { title: '渠道', dataIndex: 'channel', key: 'channel', width: 80 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (v: string) => <Tag>{v}</Tag>,
  },
  {
    title: '触发时间',
    dataIndex: 'triggeredAt',
    key: 'triggeredAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: 80,
    render: (_: unknown, r: EscalationTrigger) =>
      r.status === 'pending' ? (
        <Button type="link" size="small" onClick={() => handleTriggerResolve(r)}>
          解决
        </Button>
      ) : null,
  },
];

export const makeClosureColumns = (
  handleAcknowledge: (closure: AlertClosure) => void,
  handleResolve: (closure: AlertClosure) => void
) => [
  { title: '告警ID', dataIndex: 'alertId', key: 'alertId', width: 120, ellipsis: true },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (v: string) => (
      <Tag color={CLOSURE_STATUS[v]?.color}>{CLOSURE_STATUS[v]?.label || v}</Tag>
    ),
  },
  {
    title: '确认人',
    dataIndex: 'acknowledgedBy',
    key: 'acknowledgedBy',
    width: 90,
    render: (v: string) => v || '-',
  },
  {
    title: '确认时间',
    dataIndex: 'acknowledgedAt',
    key: 'acknowledgedAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '解决人',
    dataIndex: 'resolvedBy',
    key: 'resolvedBy',
    width: 90,
    render: (v: string) => v || '-',
  },
  {
    title: '解决时间',
    dataIndex: 'resolvedAt',
    key: 'resolvedAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: 'MTTR',
    dataIndex: 'mttrSeconds',
    key: 'mttrSeconds',
    width: 90,
    render: (v: number) => (v > 0 ? `${v}s` : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: 160,
    render: (_: unknown, r: AlertClosure) => (
      <Space>
        {r.status === 'pending' && (
          <Button type="link" size="small" onClick={() => handleAcknowledge(r)}>
            确认
          </Button>
        )}
        {(r.status === 'pending' || r.status === 'acknowledged') && (
          <Button type="link" size="small" onClick={() => handleResolve(r)}>
            解决
          </Button>
        )}
      </Space>
    ),
  },
];
