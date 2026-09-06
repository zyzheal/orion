/**
 * BatchExecPage table column definitions.
 * Extracted from BatchExecPage.tsx (P2-9 refactor).
 *
 * Column arrays are exported as factory functions accepting the minimal
 * set of callback handlers they need (stateful operations remain in the page).
 */
import {
  Typography,
  Button,
  Space,
  Tag,
  Popconfirm,
  Tooltip,
  Switch,
  type TableProps,
} from 'antd';
import {
  PlayCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  CloudServerOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import {
  type ScriptTemplate,
  type CronJob,
  type UploadTask,
} from '@/api/visor-exec';
import { colors } from '@/tokens';

import {
  EXEC_STATUS_COLOR_MAP,
  EXEC_STATUS_LABEL_MAP,
  formatFileSize,
  renderUploadTaskStatusTag,
  renderUploadTaskProgress,
  renderHostTags,
} from './BatchExecConfig';

const { Text } = Typography;

// ============================================================================
// Shared types
// ============================================================================

export interface ExecRecord {
  id: string;
  command: string;
  hosts: string[];
  hostnames: string[];
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  output: string;
  errorOutput: string;
  startTime: string;
  endTime?: string;
  operator: string;
}

export type { ScriptTemplate, CronJob, UploadTask };

// ============================================================================
// Command Exec Tab Columns
// ============================================================================

export interface ExecColumnsProps {
  onViewResult: (record: ExecRecord) => void;
}

export function buildExecColumns(
  props: ExecColumnsProps,
): TableProps<ExecRecord>['columns'] {
  return [
    {
      title: '执行ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v.slice(0, 12)}
        </Text>
      ),
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      ellipsis: true,
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '目标主机',
      dataIndex: 'hostnames',
      key: 'hostnames',
      width: 200,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 2).map((name, i) => (
            <Tag key={String(i)} icon={<CloudServerOutlined />}>
              {name}
            </Tag>
          ))}
          {v.length > 2 && <Tag>+{v.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: ExecRecord['status']) => (
        <Tag color={EXEC_STATUS_COLOR_MAP[v]}>{EXEC_STATUS_LABEL_MAP[v]}</Tag>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 170,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: ExecRecord) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => props.onViewResult(record)}
        >
          查看结果
        </Button>
      ),
    },
  ];
}

// ============================================================================
// Script Template Tab Columns
// ============================================================================

export interface TemplateColumnsProps {
  onUse: (tpl: ScriptTemplate) => void;
  onCopy: (tpl: ScriptTemplate) => void;
  onDelete: (id: string) => void;
}

export function buildTemplateColumns(
  props: TemplateColumnsProps,
): TableProps<ScriptTemplate>['columns'] {
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: ScriptTemplate) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => props.onUse(record)}>
            使用
          </Button>
          <Tooltip title="复制脚本内容">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => props.onCopy(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除此模板？" onConfirm={() => props.onDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ============================================================================
// Cron Job Tab Columns
// ============================================================================

export interface CronJobColumnsProps {
  onToggle: (id: string, enabled: boolean) => void;
  onRunNow: (id: string) => void;
  onDelete: (id: string) => void;
}

export function buildCronJobColumns(
  props: CronJobColumnsProps,
): TableProps<CronJob>['columns'] {
  return [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (v: string) => (
        <Space>
          <ScheduleOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      ellipsis: true,
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v.slice(0, 50)}
          {v.length > 50 ? '...' : ''}
        </Text>
      ),
    },
    {
      title: '目标主机',
      dataIndex: 'hostnames',
      key: 'hostnames',
      width: 180,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 2).map((name, i) => (
            <Tag key={String(i)} icon={<CloudServerOutlined />}>
              {name}
            </Tag>
          ))}
          {v.length > 2 && <Tag>+{v.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      width: 140,
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '下次执行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 160,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean, record: CronJob) => (
        <Switch
          size="small"
          checked={v}
          onChange={(checked) => props.onToggle(record.id, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: CronJob) => (
        <Space size="small">
          <Tooltip title="立即执行">
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => props.onRunNow(record.id)}
            />
          </Tooltip>
          <Popconfirm title="确认删除此任务？" onConfirm={() => props.onDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ============================================================================
// File Upload Tab Columns
// ============================================================================

export interface UploadColumnsProps {
  onCancel: (id: string) => void;
}

export function buildUploadColumns(
  props: UploadColumnsProps,
): TableProps<UploadTask>['columns'] {
  return [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (v: number) => <Text code>{formatFileSize(v)}</Text>,
    },
    {
      title: '目标主机',
      dataIndex: 'hostnames',
      key: 'hostnames',
      width: 200,
      render: (v: string[]) => renderHostTags(v),
    },
    {
      title: '目标路径',
      dataIndex: 'targetPath',
      key: 'targetPath',
      width: 160,
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (v: number, record: UploadTask) =>
        renderUploadTaskProgress(v, record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: UploadTask['status']) => renderUploadTaskStatusTag(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: UploadTask) =>
        record.status === 'running' || record.status === 'pending' ? (
          <Popconfirm title="取消此上传任务？" onConfirm={() => props.onCancel(record.id)}>
            <Button type="link" size="small" danger icon={<PauseCircleOutlined />}>
              取消
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];
}
