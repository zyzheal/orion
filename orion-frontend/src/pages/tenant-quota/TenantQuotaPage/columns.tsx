/**
 * TenantQuotaPage table columns
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import { Tag, Space, Button, Popconfirm, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { QuotaPlan, QuotaUsage, QuotaAlert } from '@/api/tenantQuota';
import { PLAN_STATUS, QUOTA_METRICS } from './constants';

interface PlanColumnsDeps {
  handleViewDetail: (r: QuotaPlan) => void;
  handleEdit: (r: QuotaPlan) => void;
  handleDelete: (id: string) => void;
}

export const buildPlanColumns = ({
  handleViewDetail,
  handleEdit,
  handleDelete,
}: PlanColumnsDeps): ColumnsType<QuotaPlan> => [
  { title: '计划名', dataIndex: 'name', key: 'name', render: (v: string) => <Tag>{v}</Tag> },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (v: string) => <Tag color={PLAN_STATUS[v]?.color}>{PLAN_STATUS[v]?.label || v}</Tag>,
  },
  { title: 'SLA', dataIndex: 'slaTier', key: 'slaTier', width: 80 },
  { title: 'API/min', dataIndex: 'apiRateLimitPerMin', key: 'apiRateLimitPerMin', width: 90 },
  { title: 'CI', dataIndex: 'maxCIs', key: 'maxCIs', width: 70 },
  { title: '用户', dataIndex: 'maxUsers', key: 'maxUsers', width: 70 },
  { title: '存储MB', dataIndex: 'maxStorageMB', key: 'maxStorageMB', width: 90 },
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
    render: (_: unknown, r?: QuotaPlan) =>
      r ? (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(r)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(r)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ) : null,
  },
];

export const buildUsageColumns = (
  handleCheckQuota: (metric: string) => void
): ColumnsType<QuotaUsage> => [
  {
    title: '指标',
    dataIndex: 'metric',
    key: 'metric',
    render: (v: string) => {
      const m = QUOTA_METRICS.find((x) => x.value === v);
      return <Tag color="blue">{m?.label || v}</Tag>;
    },
  },
  { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', width: 100 },
  { title: '峰值', dataIndex: 'peakValue', key: 'peakValue', width: 100 },
  {
    title: '窗口开始',
    dataIndex: 'windowStart',
    key: 'windowStart',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '窗口结束',
    dataIndex: 'windowEnd',
    key: 'windowEnd',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '操作',
    key: 'action',
    width: 100,
    render: (_: unknown, r?: QuotaUsage) =>
      r ? (
        <Button type="link" size="small" onClick={() => handleCheckQuota(r.metric)}>
          检查
        </Button>
      ) : null,
  },
];

export const buildAlertColumns = (): ColumnsType<QuotaAlert> => [
  {
    title: '指标',
    dataIndex: 'metric',
    key: 'metric',
    render: (v: string) => {
      const m = QUOTA_METRICS.find((x) => x.value === v);
      return <Tag>{m?.label || v}</Tag>;
    },
  },
  { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', width: 90 },
  { title: '限制值', dataIndex: 'limitValue', key: 'limitValue', width: 90 },
  {
    title: '使用率',
    dataIndex: 'usagePct',
    key: 'usagePct',
    width: 100,
    render: (v: number) => (
      <Progress
        percent={Math.round(v)}
        size="small"
        strokeColor={
          v >= 95 ? colors.error[500] : v >= 80 ? colors.warning[500] : colors.success[500]
        }
      />
    ),
  },
  {
    title: '告警级别',
    dataIndex: 'alertLevel',
    key: 'alertLevel',
    width: 100,
    render: (v: string) => <Tag color={v === 'critical' ? 'red' : 'orange'}>{v}</Tag>,
  },
  {
    title: '通知时间',
    dataIndex: 'notifiedAt',
    key: 'notifiedAt',
    width: 160,
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
];
