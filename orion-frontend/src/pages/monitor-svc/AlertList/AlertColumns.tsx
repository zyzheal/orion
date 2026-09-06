/**
 * AlertColumns.tsx - Alert List 表格列配置
 * 抽取自 AlertList/index.tsx (P2-9 Phase 53)
 * 1 useMemo 列 builder: useAlertColumns (依赖 handlers + explaining + severityConfig + statusConfig)
 */
import { useMemo } from 'react';
import { Typography, Button, Space, Tag } from 'antd';
import { CheckOutlined, CloseOutlined, BulbOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { TableColumn } from '@/components/Table';
import type { Alert, AlertSeverity, AlertStatus } from '@/types/pages';
import { colors, spacing } from '@/tokens';
import { severityConfig, statusConfig } from './useAlertListState';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface AlertColumnsHandlers {
  handleAcknowledge: (alertId: string) => void;
  handleResolve: (alertId: string) => void;
  handleExplain: (alertId: string) => void;
  showDetail: (alert: Alert) => void;
}

export function useAlertColumns(
  h: AlertColumnsHandlers,
  explaining: boolean,
): TableColumn<Alert>[] {
  return useMemo<TableColumn<Alert>[]>(
    () => [
      {
        key: 'severity',
        title: '级别',
        dataIndex: 'severity',
        width: 90,
        render: (value) => {
          const config = severityConfig[value as AlertSeverity];
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
              onClick={() => h.showDetail(record)}
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
          const config = statusConfig[value as AlertStatus];
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
        width: 230,
        render: (_, record) => {
          const isActive = record.status === 'active';
          const isAcknowledged = record.status === 'acknowledged';
          return (
            <Space size="small">
              {isActive && (
                <Button
                  type="link"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => h.handleAcknowledge(record.id)}
                >
                  确认
                </Button>
              )}
              {(isActive || isAcknowledged) && (
                <Button
                  type="link"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => h.handleResolve(record.id)}
                >
                  解决
                </Button>
              )}
              <Button type="link" size="small" onClick={() => h.showDetail(record)}>
                详情
              </Button>
              <Button
                type="link"
                size="small"
                icon={<BulbOutlined />}
                loading={explaining}
                onClick={() => h.handleExplain(record.id)}
              >
                AI 解释
              </Button>
            </Space>
          );
        },
      },
    ],
    [h, explaining],
  );
}
