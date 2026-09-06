/**
 * WorkbenchColumns.tsx - Workbench 表格列配置 Hook
 * 抽取自 Workbench/WorkbenchPage.tsx (P2-9 Phase 65)
 */
import { useMemo } from 'react';
import { Typography, Space, Tag, Popconfirm, Button, Tooltip } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { type TableColumn } from '@/components/Table';
import {
  StatusBadge,
  severityColor,
  severityName,
  priorityColor,
  priorityName,
  envColor,
  envName,
  formatDuration,
  formatSlaRemaining,
} from './constants';
import type {
  PipelineRunSummary,
  AlertSummary,
  TicketSummary,
  DeploymentSummary,
} from '@/api/workbench';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const usePipelineColumns = (): TableColumn<PipelineRunSummary>[] => {
  return useMemo<TableColumn<PipelineRunSummary>[]>(() => [
    {
      title: '流水线名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (value: unknown, record: PipelineRunSummary) => (
        <a href={`/pipelines/${record.id}/runs/${record.id}`}>{String(value)}</a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: unknown) => <StatusBadge status={String(value)} />,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (value: unknown) => formatDuration(Number(value)),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value: unknown) => (
        <Tooltip title={dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(String(value)).fromNow()}
        </Tooltip>
      ),
    },
  ], []);
};

export const useAlertColumns = ({
  handleAcknowledge,
}: {
  handleAcknowledge: (alertId: string) => void;
}): TableColumn<AlertSummary>[] => {
  return useMemo<TableColumn<AlertSummary>[]>(() => [
    {
      title: '告警内容',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (value: unknown, record: AlertSummary) => (
        <Space direction="vertical" size={2}>
          <Tag color={severityColor(record.severity)} style={{ fontWeight: 600 }}>
            {severityName(record.severity)}
          </Tag>
          <Text>{String(value)}</Text>
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (value: unknown) => dayjs(String(value)).fromNow(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: AlertSummary) =>
        !record.acknowledged ? (
          <Popconfirm title="确认已处理此告警?" onConfirm={() => handleAcknowledge(record.id)}>
            <Button type="link" size="small">
              确认
            </Button>
          </Popconfirm>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
            已确认
          </Tag>
        ),
    },
  ], [handleAcknowledge]);
};

export const useTicketColumns = (): TableColumn<TicketSummary>[] => {
  return useMemo<TableColumn<TicketSummary>[]>(() => [
    {
      title: '工单标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (value: unknown, record: TicketSummary) => (
        <a href={`/tickets/${record.id}`}>{String(value)}</a>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (value: unknown) => (
        <Tag color={priorityColor(String(value))} style={{ fontWeight: 600 }}>
          {priorityName(String(value))}
        </Tag>
      ),
    },
    {
      title: 'SLA剩余',
      dataIndex: 'slaRemaining',
      key: 'slaRemaining',
      width: 100,
      render: (value: unknown) => {
        const hours = Number(value);
        const { text, color } = formatSlaRemaining(hours);
        return <Text style={{ color, fontWeight: hours < 4 ? 600 : 400 }}>{text}</Text>;
      },
    },
  ], []);
};

export const useDeploymentColumns = (): TableColumn<DeploymentSummary>[] => {
  return useMemo<TableColumn<DeploymentSummary>[]>(() => [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      ellipsis: true,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (value: unknown) => (
        <Tag color={envColor(String(value))} style={{ fontWeight: 600 }}>
          {envName(String(value))}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: unknown) => <StatusBadge status={String(value)} />,
    },
    {
      title: '部署时间',
      dataIndex: 'deployedAt',
      key: 'deployedAt',
      width: 130,
      render: (value: unknown) => (
        <Tooltip title={dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(String(value)).fromNow()}
        </Tooltip>
      ),
    },
  ], []);
};
