/**
 * 运维管理工具 - 表格列定义
 *
 * 静态列（无 handler 依赖）直接导出为常量。
 * 需要 handler 的列使用工厂函数，由父组件传入回调。
 */
import { Button, Popconfirm, Progress, Space, Switch, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import { STATUS_COLORS } from './config';
import type {
  CronJob,
  SqlDumpResult,
  DatabaseFragment,
  IndexInfo,
  MQQueue,
  TagentClient,
  BatchOperation,
  FileInfo,
  ThemeConfig,
  LicenseInfo,
  SystemModule,
  ThreadPool,
  AuditEvent,
  LogEntry,
} from '@/api/ops-tools';

// ==================== CronJob 列 ====================

export type CronColumnHandlers = {
  handleCronToggle: (job: CronJob) => void;
  handleCronEdit: (job: CronJob) => void;
  handleCronDelete: (job: CronJob) => void;
};

export function getCronColumns(handlers: CronColumnHandlers): TableColumnsType<CronJob> {
  const { handleCronToggle, handleCronEdit, handleCronDelete } = handlers;
  return [
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: 'Cron 表达式', dataIndex: 'cronExpression', key: 'cronExpression', width: 180 },
    { title: '命令', dataIndex: 'command', key: 'command', width: 250 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record: CronJob) => (
        <Space>
          <Tag color={record.enabled ? 'success' : 'default'}>
            {record.enabled ? '已启用' : '已禁用'}
          </Tag>
          <Tag color={STATUS_COLORS[record.status as keyof typeof STATUS_COLORS]}>
            {record.status === 'idle' ? '空闲' : record.status === 'running' ? '运行中' : '错误'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '上次运行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '下次运行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record: CronJob) => (
        <Space size="small">
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Button
              type="text"
              size="small"
              icon={record.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleCronToggle(record)}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleCronEdit(record)}
          />
          <Popconfirm title="确认删除该定时任务？" onConfirm={() => handleCronDelete(record)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ==================== SQL Dump 列 ====================

export const dumpColumns: TableColumnsType<SqlDumpResult> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 180 },
  { title: '文件名', dataIndex: 'filename', key: 'filename' },
  { title: '大小', dataIndex: 'size', key: 'size' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => (
      <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
        {v === 'success' ? '成功' : v === 'running' ? '运行中' : '失败'}
      </Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

// ==================== 数据库碎片列 ====================

export const fragmentColumns: TableColumnsType<DatabaseFragment> = [
  { title: '数据库', dataIndex: 'databaseName', key: 'databaseName' },
  { title: '表名', dataIndex: 'tableName', key: 'tableName' },
  { title: '总大小', dataIndex: 'totalSize', key: 'totalSize' },
  { title: '碎片大小', dataIndex: 'fragmentSize', key: 'fragmentSize' },
  {
    title: '碎片率',
    dataIndex: 'fragmentRate',
    key: 'fragmentRate',
    render: (v: number) => (
      <Progress
        percent={Math.min(v, 100)}
        size="small"
        strokeColor={
          v > 25 ? colors.error[500] : v > 15 ? colors.warning[500] : colors.success[500]
        }
        format={() => `${v.toFixed(1)}%`}
      />
    ),
  },
  { title: '建议操作', dataIndex: 'suggestedAction', key: 'suggestedAction' },
];

// ==================== 索引列 ====================

export type IndexColumnHandlers = {
  handleDeleteIndex: (idx: IndexInfo) => void;
};

export function getIndexColumns(handlers: IndexColumnHandlers): TableColumnsType<IndexInfo> {
  const { handleDeleteIndex } = handlers;
  return [
    { title: '表名', dataIndex: 'tableName', key: 'tableName' },
    { title: '索引名', dataIndex: 'indexName', key: 'indexName' },
    { title: '列', dataIndex: 'columns', key: 'columns', render: (v: string[]) => v.join(', ') },
    { title: '大小', dataIndex: 'size', key: 'size' },
    { title: '使用次数', dataIndex: 'usageCount', key: 'usageCount' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
          {v === 'active' ? '活跃' : v === 'unused' ? '未使用' : '冗余'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record: IndexInfo) => (
        <Popconfirm title="确认删除该索引？" onConfirm={() => handleDeleteIndex(record)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];
}

// ==================== MQ 队列列 ====================

export const mqColumns: TableColumnsType<MQQueue> = [
  { title: '队列名', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '消息数', dataIndex: 'messageCount', key: 'messageCount' },
  { title: '消费者数', dataIndex: 'consumerCount', key: 'consumerCount' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (v: string) => (
      <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
        {v === 'healthy' ? '健康' : v === 'warning' ? '警告' : '严重'}
      </Tag>
    ),
  },
  {
    title: '死信数',
    dataIndex: 'deadLetters',
    key: 'deadLetters',
    render: (v: number) => (v ? <Tag color="error">{v}</Tag> : '0'),
  },
  {
    title: '最后活跃',
    dataIndex: 'lastActiveAt',
    key: 'lastActiveAt',
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
];

// ==================== Tagent 列 ====================

export type TagentColumnHandlers = {
  handleTagentUpgrade: (client: TagentClient, version: string) => void;
};

export function getTagentColumns(handlers: TagentColumnHandlers): TableColumnsType<TagentClient> {
  const { handleTagentUpgrade } = handlers;
  return [
    { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: 'OS', dataIndex: 'os', key: 'os' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
          {v === 'online' ? '在线' : v === 'offline' ? '离线' : '升级中'}
        </Tag>
      ),
    },
    { title: 'CPU', dataIndex: 'cpuUsage', key: 'cpuUsage', render: (v: number) => `${v}%` },
    { title: '内存', dataIndex: 'memoryUsage', key: 'memoryUsage', render: (v: number) => `${v}%` },
    { title: '磁盘', dataIndex: 'diskUsage', key: 'diskUsage', render: (v: number) => `${v}%` },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      key: 'lastHeartbeat',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record: TagentClient) => (
        <Button
          type="text"
          size="small"
          icon={<RocketOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '升级 Tagent',
              content: `确认将 ${record.hostname} 升级到哪个版本？`,
              onOk: async () => {
                handleTagentUpgrade(record, '2.5.2');
              },
            });
          }}
          disabled={record.status === 'offline' || record.status === 'upgrading'}
        >
          升级
        </Button>
      ),
    },
  ];
}

// ==================== 批量操作列 ====================

export const batchColumns: TableColumnsType<BatchOperation> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 160 },
  { title: '命令', dataIndex: 'command', key: 'command', ellipsis: true },
  {
    title: '目标主机',
    dataIndex: 'targetHosts',
    key: 'targetHosts',
    render: (v: string[]) => v.join(', '),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => (
      <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
        {v === 'pending'
          ? '待执行'
          : v === 'running'
            ? '运行中'
            : v === 'completed'
              ? '已完成'
              : '失败'}
      </Tag>
    ),
  },
  {
    title: '开始时间',
    dataIndex: 'startedAt',
    key: 'startedAt',
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '完成时间',
    dataIndex: 'finishedAt',
    key: 'finishedAt',
    render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
  },
  {
    title: '结果',
    dataIndex: 'result',
    key: 'result',
    ellipsis: true,
    render: (v: string) => v || '-',
  },
];

// ==================== 文件列 ====================

export type FileColumnHandlers = {
  handleDistributeOpen: (fileId: string) => void;
  handleDeleteFile: (file: FileInfo) => void;
};

export function getFileColumns(handlers: FileColumnHandlers): TableColumnsType<FileInfo> {
  const { handleDistributeOpen, handleDeleteFile } = handlers;
  return [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'path', key: 'path' },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (v: number) => `${(v / 1024).toFixed(2)} KB`,
    },
    { title: '类型', dataIndex: 'mime', key: 'mime' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
          {v === 'uploaded'
            ? '已上传'
            : v === 'distributing'
              ? '分发中'
              : v === 'distributed'
                ? '已分发'
                : '失败'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record: FileInfo) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<SendOutlined />}
            onClick={() => handleDistributeOpen(record.id)}
          >
            分发
          </Button>
          <Popconfirm title="确认删除该文件？" onConfirm={() => handleDeleteFile(record)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ==================== 主题列 ====================

export type ThemeColumnHandlers = {
  handleThemeToggle: (theme: ThemeConfig) => void;
  handleDeleteTheme: (theme: ThemeConfig) => void;
};

export function getThemeColumns(
  handlers: ThemeColumnHandlers,
  loading: boolean,
): TableColumnsType<ThemeConfig> {
  const { handleThemeToggle, handleDeleteTheme } = handlers;
  return [
    { title: '主题名', dataIndex: 'name', key: 'name' },
    {
      title: '主色',
      dataIndex: 'primaryColor',
      key: 'primaryColor',
      width: 120,
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: v,
              border: `1px solid ${colors.neutral[300]}`,
            }}
          />
          <span>{v}</span>
        </div>
      ),
    },
    {
      title: '圆角',
      dataIndex: 'borderRadius',
      key: 'borderRadius',
      render: (v: number) => `${v}px`,
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      render: (v: string) => <Tag>{v === 'light' ? '浅色' : '深色'}</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (v: boolean, record: ThemeConfig) => (
        <Switch
          checked={v}
          onChange={() => handleThemeToggle(record)}
          size="small"
          disabled={loading}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record: ThemeConfig) => (
        <Popconfirm title="确认删除该主题？" onConfirm={() => handleDeleteTheme(record)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];
}

// ==================== 许可证列 ====================

export const licenseColumns: TableColumnsType<LicenseInfo> = [
  { title: '产品', dataIndex: 'productName', key: 'productName' },
  { title: '许可证', dataIndex: 'licenseKey', key: 'licenseKey' },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    render: (v: string) => (
      <Tag>{v === 'enterprise' ? '企业版' : v === 'standard' ? '标准版' : '社区版'}</Tag>
    ),
  },
  { title: '席位', dataIndex: 'seats', key: 'seats' },
  { title: '已使用', dataIndex: 'usedSeats', key: 'usedSeats' },
  {
    title: '使用率',
    key: 'usageRate',
    render: (_, record: LicenseInfo) => (
      <Progress
        percent={record.seats > 0 ? Math.round((record.usedSeats / record.seats) * 100) : 0}
        size="small"
      />
    ),
  },
  {
    title: '到期时间',
    dataIndex: 'expireAt',
    key: 'expireAt',
    render: (v: string) => new Date(v).toLocaleString(),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (v: string) => (
      <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
        {v === 'active' ? '有效' : v === 'expired' ? '已过期' : '宽限期'}
      </Tag>
    ),
  },
];

// ==================== 模块列 ====================

export type ModuleColumnHandlers = {
  handleModuleToggle: (mod: SystemModule) => void;
};

export function getModuleColumns(
  handlers: ModuleColumnHandlers,
  loading: boolean,
): TableColumnsType<SystemModule> {
  const { handleModuleToggle } = handlers;
  return [
    { title: '模块名', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '依赖',
      dataIndex: 'dependencies',
      key: 'dependencies',
      render: (v: string[]) => v.join(', ') || '-',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (v: boolean, record: SystemModule) => (
        <Switch
          checked={v}
          onChange={() => handleModuleToggle(record)}
          size="small"
          disabled={loading}
        />
      ),
    },
  ];
}

// ==================== 线程池列 ====================

export const threadPoolColumns: TableColumnsType<ThreadPool> = [
  { title: '线程池名', dataIndex: 'name', key: 'name' },
  { title: '核心数', dataIndex: 'coreSize', key: 'coreSize' },
  { title: '最大数', dataIndex: 'maxSize', key: 'maxSize' },
  { title: '活跃线程', dataIndex: 'activeCount', key: 'activeCount' },
  { title: '队列大小', dataIndex: 'queueSize', key: 'queueSize' },
  { title: '已完成任务', dataIndex: 'completedTasks', key: 'completedTasks' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => (
      <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>
        {v === 'normal' ? '正常' : v === 'busy' ? '繁忙' : '饱和'}
      </Tag>
    ),
  },
  {
    title: '使用率',
    key: 'usage',
    render: (_, record: ThreadPool) => (
      <Progress
        percent={record.maxSize > 0 ? Math.round((record.activeCount / record.maxSize) * 100) : 0}
        size="small"
      />
    ),
  },
];

// ==================== 审计列 ====================

export const auditColumns: TableColumnsType<AuditEvent> = [
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '操作', dataIndex: 'action', key: 'action' },
  { title: '资源', dataIndex: 'resource', key: 'resource' },
  {
    title: '结果',
    dataIndex: 'result',
    key: 'result',
    render: (v: string) => (
      <Tag color={v === 'success' ? 'success' : 'error'}>{v === 'success' ? '成功' : '失败'}</Tag>
    ),
  },
  { title: 'IP', dataIndex: 'ip', key: 'ip' },
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

// ==================== 日志列 ====================

export const logColumns: TableColumnsType<LogEntry> = [
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 80,
    render: (v: string) => {
      const color =
        v === 'ERROR' ? 'error' : v === 'WARN' ? 'warning' : v === 'DEBUG' ? 'default' : 'blue';
      return <Tag color={color}>{v}</Tag>;
    },
  },
  { title: '服务', dataIndex: 'service', key: 'service' },
  { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

// ==================== Modal 导入（用于 getTagentColumns 中的 confirm） ====================

import { Modal } from 'antd';
