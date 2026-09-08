/**
 * Columns.tsx - UEBA 表格列定义
 * 抽取自 index.tsx (P2-9 Phase 242)
 */
import { Tag, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UEBAStats, AnomalyAlert } from '@/api/ueba';

const RISK_COLOR: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue',
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  frequent_denial: '频繁拒绝',
  unusual_resource_access: '异常访问',
  off_hours_access: '非工作时间访问',
  cross_tenant_attempt: '跨租户尝试',
};

export const riskColumns: ColumnsType<UEBAStats> = [
  {
    title: '用户ID',
    dataIndex: 'userId',
    key: 'userId',
    render: (val) => (
      <Space>
        <UserOutlined />
        {val}
      </Space>
    ),
  },
  {
    title: '拒绝次数',
    dataIndex: 'denyCount',
    key: 'denyCount',
    sorter: (a, b) => a.denyCount - b.denyCount,
    render: (val) => <Tag color="red">{val}</Tag>,
  },
  {
    title: '拒绝率',
    dataIndex: 'denyRate',
    key: 'denyRate',
    render: (val) => `${val.toFixed(2)}次/小时`,
  },
  {
    title: '风险等级',
    dataIndex: 'riskLevel',
    key: 'riskLevel',
    render: (val) => <Tag color={RISK_COLOR[val]}>{val.toUpperCase()}</Tag>,
  },
  {
    title: '最后拒绝',
    dataIndex: 'lastDenyAt',
    key: 'lastDenyAt',
    render: (val) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
  },
];

export const alertColumns: ColumnsType<AnomalyAlert> = [
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    render: (val) => new Date(val).toLocaleString('zh-CN'),
  },
  {
    title: '用户',
    dataIndex: 'userId',
    key: 'userId',
  },
  {
    title: '告警类型',
    dataIndex: 'alertType',
    key: 'alertType',
    render: (val) => <Tag>{ALERT_TYPE_LABEL[val] || val}</Tag>,
  },
  {
    title: '严重程度',
    dataIndex: 'severity',
    key: 'severity',
    render: (val) => <Tag color={SEVERITY_COLOR[val]}>{val.toUpperCase()}</Tag>,
  },
  {
    title: '描述',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
];
