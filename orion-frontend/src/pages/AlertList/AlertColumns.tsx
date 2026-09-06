/**
 * AlertColumns.tsx - Alert 表格列配置 Hook
 * 抽取自 AlertList/index.tsx (P2-9 Phase 64)
 */
import { useMemo } from 'react';
import { Typography, Space, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import { colors, spacing } from '@/tokens';
import { PermissionActions } from '@/components/PermissionActions';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { severityConfig, statusConfig } from './constants';
import type { Alert } from '@/types/pages';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface UseAlertColumnsParams {
  showDetail: (alert: Alert) => void;
  handleAcknowledge: (alertId: string) => void;
  handleResolve: (alertId: string) => void;
  handleAIExplain: (record: Alert) => void;
}

export const useAlertColumns = ({
  showDetail,
  handleAcknowledge,
  handleResolve,
  handleAIExplain,
}: UseAlertColumnsParams): TableColumn<Alert>[] => {
  return useMemo<TableColumn<Alert>[]>(() => [
    {
      key: 'severity',
      title: '级别',
      dataIndex: 'severity',
      width: 90,
      render: (value) => {
        const config = severityConfig[value as keyof typeof severityConfig];
        return (
          <Tag color={config.color} style={{ fontWeight: 600 }}>
            {config.icon} {config.label}
          </Tag>
        );
      },
    },
    {
      key: 'metric',
      title: '指标',
      dataIndex: 'metric',
      width: 160,
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => showDetail(record)}
          >
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {record.source}
          </Text>
        </Space>
      ),
    },
    {
      key: 'value',
      title: '当前值',
      dataIndex: 'value',
      width: 100,
      render: (value) => (
        <Text strong style={{ color: colors.error[600] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'threshold',
      title: '阈值',
      dataIndex: 'threshold',
      width: 100,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'message',
      title: '消息',
      dataIndex: 'message',
      render: (value: unknown) => (
        <Text style={{ fontSize: spacing[3] }} title={String(value)}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => {
        const config = statusConfig[value as keyof typeof statusConfig];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      key: 'lastUpdated',
      title: '更新时间',
      dataIndex: 'lastUpdated',
      width: 140,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_, record) => {
        const isActive = record.status === 'active';
        const isAcknowledged = record.status === 'acknowledged';
        const actions = [];
        if (isActive) {
          actions.push({
            key: 'acknowledge',
            label: '确认',
            icon: <CheckOutlined />,
            onClick: () => handleAcknowledge(record.id),
          });
        }
        if (isActive || isAcknowledged) {
          actions.push({
            key: 'resolve',
            label: '解决',
            icon: <CloseOutlined />,
            onClick: () => handleResolve(record.id),
          });
        }
        actions.push({
          key: 'ai-explain',
          label: 'AI 解释',
          onClick: () => handleAIExplain(record),
        });
        actions.push({ key: 'read', label: '详情', onClick: () => showDetail(record) });
        return <PermissionActions resource="alert" actions={actions} />;
      },
    },
  ], [showDetail, handleAcknowledge, handleResolve, handleAIExplain]);
};
