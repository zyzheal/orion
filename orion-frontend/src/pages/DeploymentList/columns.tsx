/**
 * DeploymentList table columns
 * 抽取自 index.tsx (P2-9 Phase 198)
 */
import { message, Space, Tag, Typography } from 'antd';
import type { TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import { PermissionActions } from '@/components/PermissionActions';
import { rollbackDeployment } from '@/api/deployments';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ENV_COLORS, STRATEGY_LABELS } from './constants';
import type { DeploymentRecord } from './types';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface ColumnDeps {
  navigate: (path: string) => void;
  onRollbackSuccess: () => void;
}

export const buildColumns = (deps: ColumnDeps): TableColumn<DeploymentRecord>[] => [
  {
    key: 'appName',
    title: '应用',
    dataIndex: 'appName',
    width: 180,
    sortable: true,
    filterable: true,
    render: (_value: unknown, record: any) => (
      <Space direction="vertical" size={0}>
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => deps.navigate(`/deployments/${record.id}`)}
        >
          {record.appName}
        </Text>
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {record.version}
        </Text>
      </Space>
    ),
  },
  {
    key: 'version',
    title: '版本',
    dataIndex: 'version',
    width: 140,
    render: (value: unknown) => <Tag color="purple">{String(value)}</Tag>,
  },
  {
    key: 'environment',
    title: '环境',
    dataIndex: 'environment',
    width: 120,
    render: (value: unknown) => (
      <Tag color={ENV_COLORS[String(value)] || 'default'}>
        {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
      </Tag>
    ),
  },
  {
    key: 'strategy',
    title: '策略',
    dataIndex: 'strategy',
    width: 120,
    render: (value: unknown) => (
      <Text style={{ fontSize: spacing[3] }}>
        {STRATEGY_LABELS[String(value)] || String(value)}
      </Text>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 120,
    render: (value: unknown) => <StatusBadge status={value as StatusType} size="small" />,
  },
  {
    key: 'triggeredBy',
    title: '触发人',
    dataIndex: 'triggeredBy',
    width: 100,
    render: (value: unknown) => <Text code>{String(value)}</Text>,
  },
  {
    key: 'duration',
    title: '耗时',
    dataIndex: 'duration',
    width: 100,
    sortable: true,
    render: (value: unknown) => {
      if (!value) return <Text type="secondary">-</Text>;
      const seconds = Number(value);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return <Text>{minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`}</Text>;
    },
  },
  {
    key: 'startTime',
    title: '部署时间',
    dataIndex: 'startTime',
    width: 160,
    sortable: true,
    render: (value: unknown) => (
      <Space direction="vertical" size={0}>
        <Text style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).format('MM-DD HH:mm')}
        </Text>
        <Text type="secondary" style={{ fontSize: spacing[2] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      </Space>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    render: (_: unknown, record: any) => (
      <PermissionActions
        resource="deployment"
        actions={[
          { key: 'read', label: '详情', onClick: () => deps.navigate(`/deployments/${record.id}`) },
          ...(record.status === 'success'
            ? [
                {
                  key: 'execute',
                  label: '回滚',
                  danger: true,
                  confirm: true,
                  confirmText: '确定要回滚此部署吗？',
                  onClick: async () => {
                    try {
                      await rollbackDeployment(record.id);
                      message.success('部署回滚已提交');
                      deps.onRollbackSuccess();
                    } catch (err) {
                      message.error(err instanceof Error ? err.message : '回滚失败');
                    }
                  },
                },
              ]
            : []),
        ]}
      />
    ),
  },
];

