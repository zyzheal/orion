/**
 * ReportDesignerColumns.tsx - 报表设计器列定义
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 51)
 * 4 column builders: report/datasource/schedule/execution
 * 通过 useMemo 缓存列定义，减少重渲染开销
 */
import { useMemo } from 'react';
import { Typography, Tag, Space, Button, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import type {
  ReportDefinition,
  ReportDatasource,
  ReportSchedule,
  ReportExecution,
} from '@/api/reports';

const { Text } = Typography;

// ============================================================================
// Shared labels / colors
// ============================================================================

export const categoryLabel: Record<string, string> = {
  operations: '运维报表',
  performance: '性能报表',
  business: '业务报表',
  security: '安全报表',
  custom: '自定义',
};

export const categoryColor: Record<string, string> = {
  operations: 'blue',
  performance: 'cyan',
  business: 'green',
  security: 'red',
  custom: 'default',
};

export const datasourceTypeLabel: Record<string, string> = {
  sql: 'SQL',
  api: 'API',
  promql: 'PromQL',
};

export const datasourceTypeColor: Record<string, string> = {
  sql: 'blue',
  api: 'orange',
  promql: 'purple',
};

export const exportFormatLabel: Record<string, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  csv: 'CSV',
};

export const executionStatusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

const executionStatusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

// ============================================================================
// Report Columns
// ============================================================================

export interface ReportColumnsHandlers {
  handlePreviewReport: (r: ReportDefinition) => void;
  handleExecuteReport: (id: string) => void;
  handleEditReport: (r: ReportDefinition) => void;
  handleDeleteReport: (id: string) => void;
}

export function useReportColumns(h: ReportColumnsHandlers): ColumnsType<ReportDefinition> {
  return useMemo(
    (): ColumnsType<ReportDefinition> => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        render: (cat: string) => (
          <Tag color={categoryColor[cat] ?? 'default'}>{categoryLabel[cat] ?? cat ?? '-'}</Tag>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (text: string) => text || '-',
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 280,
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EyeOutlined />} onClick={() => h.handlePreviewReport(record)}>
              预览
            </Button>
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => h.handleExecuteReport(record.id)}
            >
              执行
            </Button>
            <Button type="link" icon={<EditOutlined />} onClick={() => h.handleEditReport(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除此报表？" onConfirm={() => h.handleDeleteReport(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [h],
  );
}

// ============================================================================
// Datasource Columns
// ============================================================================

export interface DatasourceColumnsHandlers {
  handleEditDatasource: (r: ReportDatasource) => void;
  handleDeleteDatasource: (id: string) => void;
}

export function useDatasourceColumns(h: DatasourceColumnsHandlers): ColumnsType<ReportDatasource> {
  return useMemo(
    (): ColumnsType<ReportDatasource> => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <Tag color={datasourceTypeColor[type] ?? 'default'}>
            {datasourceTypeLabel[type] ?? type}
          </Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={() => h.handleEditDatasource(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确认删除此数据源？"
              onConfirm={() => h.handleDeleteDatasource(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [h],
  );
}

// ============================================================================
// Schedule Columns
// ============================================================================

export interface ScheduleColumnsHandlers {
  handleEditSchedule: (r: ReportSchedule) => void;
  handleDeleteSchedule: (id: string) => void;
}

export function useScheduleColumns(h: ScheduleColumnsHandlers): ColumnsType<ReportSchedule> {
  return useMemo(
    (): ColumnsType<ReportSchedule> => [
      { title: '报表 ID', dataIndex: 'reportId', key: 'reportId', ellipsis: true },
      {
        title: 'Cron 表达式',
        dataIndex: 'cronExpression',
        key: 'cronExpression',
        render: (text: string) => <Text code>{text}</Text>,
      },
      {
        title: '导出格式',
        dataIndex: 'exportFormat',
        key: 'exportFormat',
        render: (fmt: string) => <Tag>{exportFormatLabel[fmt] ?? fmt}</Tag>,
      },
      {
        title: '接收人',
        dataIndex: 'recipients',
        key: 'recipients',
        render: (recipients: string[]) =>
          recipients?.length ? recipients.map((r) => <Tag key={r}>{r}</Tag>) : '-',
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
        ),
      },
      {
        title: '上次执行',
        dataIndex: 'lastRunAt',
        key: 'lastRunAt',
        render: (text: string | null) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={() => h.handleEditSchedule(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除此调度？" onConfirm={() => h.handleDeleteSchedule(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [h],
  );
}

// ============================================================================
// Execution Columns
// ============================================================================

export function useExecutionColumns(): ColumnsType<ReportExecution> {
  return useMemo(
    (): ColumnsType<ReportExecution> => [
      { title: '报表 ID', dataIndex: 'reportId', key: 'reportId', ellipsis: true },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => (
          <Tag color={executionStatusColor[status]}>{executionStatusLabel[status] ?? status}</Tag>
        ),
      },
      {
        title: '导出格式',
        dataIndex: 'exportFormat',
        key: 'exportFormat',
        render: (fmt: string | null) => <Tag>{fmt ? (exportFormatLabel[fmt] ?? fmt) : '-'}</Tag>,
      },
      {
        title: '错误信息',
        dataIndex: 'error',
        key: 'error',
        ellipsis: true,
        render: (text: string | null) => (text ? <Text type="danger">{text}</Text> : '-'),
      },
      {
        title: '开始时间',
        dataIndex: 'startedAt',
        key: 'startedAt',
        render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '完成时间',
        dataIndex: 'completedAt',
        key: 'completedAt',
        render: (text: string | null) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
    ],
    [],
  );
}
