/**
 * PermissionAudit columns
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuditLogEntry, AuditStats, UEBARiskUser } from '@/api/permission-audit';

export const buildAuditLogColumns = (): ColumnsType<AuditLogEntry> => [
  {
    title: '时间',
    dataIndex: 'evaluated_at',
    key: 'evaluated_at',
    width: 180,
    render: (val) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '用户',
    dataIndex: 'user_id',
    key: 'user_id',
    width: 120,
  },
  {
    title: '租户',
    dataIndex: 'tenant_id',
    key: 'tenant_id',
    width: 140,
    render: (val) => val || '-',
  },
  {
    title: '资源类型',
    dataIndex: 'resource_type',
    key: 'resource_type',
    width: 120,
    render: (val) => <Tag color="blue">{val}</Tag>,
  },
  {
    title: '资源ID',
    dataIndex: 'resource_id',
    key: 'resource_id',
    width: 120,
    ellipsis: true,
  },
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    width: 80,
  },
  {
    title: '决策',
    dataIndex: 'decision',
    key: 'decision',
    width: 80,
    render: (val) => (
      <Tag color={val === 'deny' ? 'red' : 'green'}>{val === 'deny' ? '拒绝' : '允许'}</Tag>
    ),
  },
  {
    title: '来源',
    dataIndex: 'decision_source',
    key: 'decision_source',
    width: 100,
    render: (val) => {
      const colorMap: Record<string, string> = {
        rbac: 'orange',
        abac: 'purple',
        relationship: 'cyan',
        super_admin_bypass: 'gold',
        all: 'green',
      };
      return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
    },
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    ellipsis: true,
  },
];

export const buildStatColumns = (): ColumnsType<AuditStats> => [
  {
    title: '用户',
    dataIndex: 'user_id',
    key: 'user_id',
  },
  {
    title: '拒绝次数',
    dataIndex: 'count',
    key: 'count',
    render: (val) => <Tag color="red">{val}</Tag>,
  },
];

export const buildRiskUserColumns = (): ColumnsType<UEBARiskUser> => [
  {
    title: '用户',
    dataIndex: 'userId',
    key: 'userId',
    width: 160,
  },
  {
    title: '风险等级',
    dataIndex: 'riskLevel',
    key: 'riskLevel',
    width: 100,
    render: (val: string) => {
      const colorMap: Record<string, string> = {
        low: 'green',
        medium: 'orange',
        high: 'red',
        critical: 'magenta',
      };
      return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
    },
  },
  {
    title: '拒绝次数',
    dataIndex: 'denyCount',
    key: 'denyCount',
    width: 100,
  },
  {
    title: '拒绝频率',
    dataIndex: 'denyRate',
    key: 'denyRate',
    width: 100,
    render: (val: number) => `${val.toFixed(1)} 次/小时`,
  },
];
