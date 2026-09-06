/**
 * useJobTableColumns - 自动化作业表格列配置 Hook
 */
import { useMemo } from 'react';
import { Typography, Tag, Switch, Tooltip, Button, Space, Badge } from 'antd';
import {
  PlayCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AutoJob } from '@/api/automation';
import { JOB_TYPE_MAP, JOB_STATUS_MAP, formatShortDate } from './constants';

const { Text } = Typography;

export interface JobTableColumnsProps {
  executing: string | null;
  togglingId: string | null;
  handleToggle: (job: AutoJob) => void;
  handleExecute: (job: AutoJob) => void;
  handleViewExecutions: (job: AutoJob) => void;
  handleOpenEdit: (job: AutoJob) => void;
  handleDelete: (job: AutoJob) => void;
}

export const useJobTableColumns = ({
  executing,
  togglingId,
  handleToggle,
  handleExecute,
  handleViewExecutions,
  handleOpenEdit,
  handleDelete,
}: JobTableColumnsProps): ColumnsType<AutoJob> =>
  useMemo<ColumnsType<AutoJob>>(
    () => [
      {
        title: '作业名称',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (name: string) => <Text style={{ fontWeight: 500 }}>{name}</Text>,
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 110,
        fixed: 'left' as const,
        render: (type: string) => {
          const t = JOB_TYPE_MAP[type] || JOB_TYPE_MAP.script;
          return (
            <Tag color={t.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {t.icon}
              {t.label}
            </Tag>
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        fixed: 'left' as const,
        render: (status: string) => {
          const s = JOB_STATUS_MAP[status] || JOB_STATUS_MAP.idle;
          const isRunning = status === 'running';
          return (
            <Badge status={isRunning ? 'processing' : 'default'} dot>
              <Tag color={s.color}>{s.label}</Tag>
            </Badge>
          );
        },
      },
      {
        title: '启用',
        dataIndex: 'enabled',
        key: 'enabled',
        width: 70,
        align: 'center' as const,
        render: (_: boolean, record: AutoJob) => (
          <Switch
            size="small"
            checked={record.enabled}
            loading={togglingId === record.id}
            disabled={togglingId === record.id}
            onChange={() => handleToggle(record)}
          />
        ),
      },
      {
        title: '调度',
        dataIndex: 'schedule',
        key: 'schedule',
        width: 130,
        render: (schedule: string | null) =>
          schedule ? (
            <Tooltip title="定时任务 (Cron)">
              <Tag color="cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ClockCircleOutlined />
                <Text code style={{ fontSize: 11 }}>
                  {schedule}
                </Text>
              </Tag>
            </Tooltip>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              手动
            </Text>
          ),
      },
      {
        title: '标签',
        dataIndex: 'tags',
        key: 'tags',
        width: 140,
        render: (tags: string[]) => (
          <Space size={[0, 4]} wrap>
            {tags.slice(0, 2).map((tag) => (
              <Tag key={tag} style={{ fontSize: 11 }}>
                {tag}
              </Tag>
            ))}
            {tags.length > 2 && <Tag style={{ fontSize: 11 }}>+{tags.length - 2}</Tag>}
          </Space>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 150,
        render: (date: string) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatShortDate(date)}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 200,
        fixed: 'right' as const,
        render: (_: unknown, record: AutoJob) => (
          <Space size="small" wrap>
            <Tooltip title="执行">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={executing === record.id}
                disabled={!record.enabled || record.status === 'running' || executing === record.id}
                onClick={() => handleExecute(record)}
              />
            </Tooltip>
            <Tooltip title="查看历史">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewExecutions(record)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEdit(record)}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [
      executing,
      togglingId,
      handleToggle,
      handleExecute,
      handleViewExecutions,
      handleOpenEdit,
      handleDelete,
    ]
  );
