/**
 * 运维管理工具 - 主页面
 *
 * 提供系统管理与运维工具的集成入口，包含：
 * - 定时调度管理
 * - 数据库工具
 * - Tagent 管理
 * - 批量操作
 * - 文件管理
 * - 系统配置
 *
 * 遵循 Design Token 体系与交互完整性规范。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Statistic,
  Row,
  Col,
  Typography,
  Progress,
  Popconfirm,
  Tooltip,
} from 'antd';
import type { TabsProps, TableColumnsType } from 'antd';
import {
  ClusterOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  RocketOutlined,
  FileTextOutlined,
  SettingOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ToolOutlined,
  AuditOutlined,
  FileSyncOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import {
  getCronJobs,
  createCronJob,
  deleteCronJob,
  toggleCronJob,
  updateCronJob,
  type CronJob,
  executeSqlDump,
  getSqlDumps,
  getDatabaseFragments,
  getIndexes,
  createIndex,
  deleteIndex,
  type IndexInfo,
  type DatabaseFragment,
  type SqlDumpResult,
  getMQQueues,
  type MQQueue,
  getTagentClients,
  upgradeTagent,
  type TagentClient,
  type TagentStats,
  executeBatch,
  getBatchOperations,
  type BatchOperation,
  uploadFile,
  getFiles,
  distributeFile,
  deleteFile,
  type FileInfo,
  getThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  type ThemeConfig,
  getLicenses,
  type LicenseInfo,
  getSystemModules,
  toggleSystemModule,
  type SystemModule,
  getThreadPools,
  type ThreadPool,
  getAuditEvents,
  type AuditEvent,
  getLogs,
  type LogEntry,
  getSystemInfo,
  type SystemInfo,
} from '@/api/ops-tools';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

// ==================== 状态色映射 ====================

const STATUS_COLORS = {
  online: 'success',
  idle: 'default',
  running: 'processing',
  error: 'error',
  offline: 'default',
  upgrading: 'processing',
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
  active: 'success',
  unused: 'warning',
  redundant: 'error',
  success: 'success',
  pending: 'processing',
  completed: 'success',
  failed: 'error',
  uploaded: 'default',
  distributing: 'processing',
  distributed: 'success',
  normal: 'success',
  busy: 'warning',
  saturated: 'error',
  grace: 'warning',
  expired: 'error',
};

// ==================== 主页面 ====================

const OpsTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cron');
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // ============ CronJob State ============
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [cronEditingJob, setCronEditingJob] = useState<CronJob | null>(null);
  const [cronForm] = Form.useForm();

  // ============ DB Tools State ============
  const [dumps, setDumps] = useState<SqlDumpResult[]>([]);
  const [dumpRunning, setDumpRunning] = useState(false);
  const [fragments, setFragments] = useState<DatabaseFragment[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexForm] = Form.useForm();

  // ============ Tagent State ============
  const [tagentClients, setTagentClients] = useState<TagentClient[]>([]);
  const [tagentStats, setTagentStats] = useState<TagentStats>({ total: 0, online: 0, offline: 0, upgrading: 0 });
  const [tagentLoading, setTagentLoading] = useState(false);

  // ============ Batch State ============
  const [batchOps, setBatchOps] = useState<BatchOperation[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchExecLoading, setBatchExecLoading] = useState(false);

  // ============ File State ============
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadForm] = Form.useForm();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [distributingFile, setDistributingFile] = useState<string | null>(null);
  const [distributeForm] = Form.useForm();

  // ============ Theme State ============
  const [themes, setThemes] = useState<ThemeConfig[]>([]);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [themeForm] = Form.useForm();

  // ============ Module State ============
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);

  // ============ License State ============
  const [licenses, setLicenses] = useState<LicenseInfo[]>([]);

  // ============ Thread Pool State ============
  const [threadPools, setThreadPools] = useState<ThreadPool[]>([]);

  // ============ Audit State ============
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  // ============ MQ State ============
  const [mqQueues, setMqQueues] = useState<MQQueue[]>([]);
  const [mqLoading, setMqLoading] = useState(false);

  // ============ Log State ============
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLevel, setLogLevel] = useState<string>();
  const [logService, setLogService] = useState<string>();

  // ==================== 数据加载 ====================

  const loadSystemInfo = useCallback(async () => {
    try {
      const res = await getSystemInfo();
      setSystemInfo(res.data);
    } catch {
      // 静默失败，不影响主功能
    }
  }, []);

  const loadCronJobs = useCallback(async () => {
    setCronLoading(true);
    try {
      const res = await getCronJobs();
      setCronJobs(res.data ?? []);
    } catch (err: any) {
      message.error('加载定时任务失败');
    } finally {
      setCronLoading(false);
    }
  }, []);

  const loadDBTools = useCallback(async () => {
    setDbLoading(true);
    try {
      const [dumpsRes, fragsRes, idxRes] = await Promise.all([
        getSqlDumps(),
        getDatabaseFragments(),
        getIndexes(),
      ]);
      setDumps(dumpsRes.data ?? []);
      setFragments(fragsRes.data ?? []);
      setIndexes(idxRes.data ?? []);
    } catch {
      message.error('加载数据库工具数据失败');
    } finally {
      setDbLoading(false);
    }
  }, []);

  const loadTagent = useCallback(async () => {
    setTagentLoading(true);
    try {
      const res = await getTagentClients();
      setTagentClients(res.data.data ?? []);
      setTagentStats(res.data.stats ?? { total: 0, online: 0, offline: 0, upgrading: 0 });
    } catch {
      message.error('加载 Tagent 数据失败');
    } finally {
      setTagentLoading(false);
    }
  }, []);

  const loadMqQueues = useCallback(async () => {
    setMqLoading(true);
    try {
      const res = await getMQQueues();
      setMqQueues(res.data ?? []);
    } catch {
      message.error('加载 MQ 队列失败');
    } finally {
      setMqLoading(false);
    }
  }, []);

  const loadBatchOps = useCallback(async () => {
    setBatchLoading(true);
    try {
      const res = await getBatchOperations();
      setBatchOps(res.data ?? []);
    } catch {
      message.error('加载批量操作历史失败');
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setFileLoading(true);
    try {
      const res = await getFiles();
      setFiles(res.data ?? []);
    } catch {
      message.error('加载文件列表失败');
    } finally {
      setFileLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const [themesRes, licRes, modsRes, tpRes] = await Promise.all([
        getThemes(),
        getLicenses(),
        getSystemModules(),
        getThreadPools(),
      ]);
      setThemes(themesRes.data ?? []);
      setLicenses(licRes.data ?? []);
      setModules(modsRes.data ?? []);
      setThreadPools(tpRes.data ?? []);
    } catch {
      message.error('加载系统配置失败');
    }
  }, []);

  const loadAudit = useCallback(async (page: number = 1) => {
    try {
      const res = await getAuditEvents(page);
      setAuditEvents(res.data?.events ?? []);
      setAuditTotal(res.data?.total ?? 0);
      setAuditPage(page);
    } catch {
      message.error('加载审计数据失败');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const params: any = {};
      if (logLevel) params.level = logLevel;
      if (logService) params.service = logService;
      const res = await getLogs(params);
      setLogs(res.data?.logs ?? []);
      setLogTotal(res.data?.total ?? 0);
    } catch {
      message.error('加载日志失败');
    }
  }, [logLevel, logService]);

  // ==================== Tab 切换时加载数据 ====================

  useEffect(() => {
    const loaders: Record<string, () => void> = {
      cron: loadCronJobs,
      db: loadDBTools,
      tagent: loadTagent,
      batch: loadBatchOps,
      file: loadFiles,
      config: loadConfig,
      audit: () => loadAudit(1),
      logs: loadLogs,
    };
    loaders[activeTab]?.();
  }, [activeTab]);

  useEffect(() => {
    loadSystemInfo();
    loadLogs();
  }, [loadSystemInfo, loadLogs]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // ==================== CronJob 操作 ====================

  const handleCronSave = async (values: any) => {
    setLoading(true);
    try {
      if (cronEditingJob) {
        await updateCronJob(cronEditingJob.id, values);
        message.success('定时任务更新成功');
      } else {
        await createCronJob(values);
        message.success('定时任务创建成功');
      }
      setCronModalOpen(false);
      setCronEditingJob(null);
      cronForm.resetFields();
      loadCronJobs();
    } catch {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCronToggle = async (job: CronJob) => {
    try {
      await toggleCronJob(job.id, !job.enabled);
      message.success(job.enabled ? '定时任务已禁用' : '定时任务已启用');
      loadCronJobs();
    } catch {
      message.error('操作失败');
    }
  };

  const handleCronDelete = async (job: CronJob) => {
    try {
      await deleteCronJob(job.id);
      message.success('定时任务已删除');
      loadCronJobs();
    } catch {
      message.error('删除失败');
    }
  };

  const handleCronEdit = (job: CronJob) => {
    setCronEditingJob(job);
    cronForm.setFieldsValue({
      name: job.name,
      cronExpression: job.cronExpression,
      command: job.command,
      description: job.description,
    });
    setCronModalOpen(true);
  };

  // ==================== DB Tools 操作 ====================

  const handleSqlDump = async () => {
    setDumpRunning(true);
    try {
      const res = await executeSqlDump();
      message.success(`SQL Dump 任务已创建: ${res.data.id}`);
      loadDBTools();
    } catch {
      message.error('执行 SQL Dump 失败');
    } finally {
      setDumpRunning(false);
    }
  };

  const handleCreateIndex = async (values: any) => {
    try {
      await createIndex({ ...values, columns: values.columns.split(',') });
      message.success('索引创建成功');
      setIndexModalOpen(false);
      indexForm.resetFields();
      loadDBTools();
    } catch {
      message.error('创建索引失败');
    }
  };

  const handleDeleteIndex = async (idx: IndexInfo) => {
    try {
      await deleteIndex(idx.id);
      message.success('索引已删除');
      loadDBTools();
    } catch {
      message.error('删除索引失败');
    }
  };

  // ==================== Tagent 操作 ====================

  const handleTagentUpgrade = async (client: TagentClient, version: string) => {
    try {
      await upgradeTagent(client.id, version);
      message.success(`正在升级 ${client.hostname} 到版本 ${version}`);
      loadTagent();
    } catch {
      message.error('升级失败');
    }
  };

  // ==================== Batch 操作 ====================

  const handleBatchExecute = async (values: any) => {
    setBatchExecLoading(true);
    try {
      const hosts = values.targetHosts?.split(',') || [];
      const res = await executeBatch({ command: values.command, targetHosts: hosts });
      message.success(`批量操作已提交: ${res.data.id}`);
      setBatchOps([res.data, ...batchOps]);
      batchForm.resetFields();
    } catch {
      message.error('批量操作提交失败');
    } finally {
      setBatchExecLoading(false);
    }
  };

  // ==================== File 操作 ====================

  const handleUpload = async (values: any) => {
    try {
      await uploadFile(values);
      message.success('文件上传成功');
      setUploadModalOpen(false);
      uploadForm.resetFields();
      loadFiles();
    } catch {
      message.error('上传失败');
    }
  };

  const handleDistribute = async (values: any) => {
    if (!distributingFile) return;
    try {
      const hosts = values.targetHosts?.split(',') || [];
      await distributeFile(distributingFile, hosts);
      message.success('文件分发任务已提交');
      setDistributeModalOpen(false);
      distributeForm.resetFields();
      loadFiles();
    } catch {
      message.error('分发失败');
    }
  };

  const handleDeleteFile = async (file: FileInfo) => {
    try {
      await deleteFile(file.id);
      message.success('文件已删除');
      loadFiles();
    } catch {
      message.error('删除失败');
    }
  };

  // ==================== Theme 操作 ====================

  const handleThemeSave = async (values: any) => {
    try {
      await createTheme(values);
      message.success('主题创建成功');
      setThemeModalOpen(false);
      themeForm.resetFields();
      loadConfig();
    } catch {
      message.error('创建主题失败');
    }
  };

  const handleThemeToggle = async (theme: ThemeConfig) => {
    try {
      await updateTheme(theme.id, { enabled: !theme.enabled });
      message.success(theme.enabled ? '主题已禁用' : '主题已启用');
      loadConfig();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteTheme = async (theme: ThemeConfig) => {
    try {
      await deleteTheme(theme.id);
      message.success('主题已删除');
      loadConfig();
    } catch {
      message.error('删除失败');
    }
  };

  // ==================== Module 操作 ====================

  const handleModuleToggle = async (mod: SystemModule) => {
    try {
      await toggleSystemModule(mod.id, !mod.enabled);
      message.success(mod.enabled ? '模块已禁用' : '模块已启用');
      loadConfig();
    } catch {
      message.error('操作失败');
    }
  };

  // ==================== 列定义 ====================

  const cronColumns: TableColumnsType<CronJob> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: 'Cron 表达式', dataIndex: 'cronExpression', key: 'cronExpression', width: 180 },
    { title: '命令', dataIndex: 'command', key: 'command', width: 250 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
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
    { title: '上次运行', dataIndex: 'lastRunAt', key: 'lastRunAt', width: 180, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '下次运行', dataIndex: 'nextRunAt', key: 'nextRunAt', width: 180, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Button
              type="text"
              size="small"
              icon={record.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleCronToggle(record)}
            />
          </Tooltip>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleCronEdit(record)} />
          <Popconfirm title="确认删除该定时任务？" onConfirm={() => handleCronDelete(record)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const dumpColumns: TableColumnsType<SqlDumpResult> = [
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
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
  ];

  const fragmentColumns: TableColumnsType<DatabaseFragment> = [
    { title: '数据库', dataIndex: 'databaseName', key: 'databaseName' },
    { title: '表名', dataIndex: 'tableName', key: 'tableName' },
    { title: '总大小', dataIndex: 'totalSize', key: 'totalSize' },
    { title: '碎片大小', dataIndex: 'fragmentSize', key: 'fragmentSize' },
    {
      title: '碎片率',
      dataIndex: 'fragmentRate',
      key: 'fragmentRate',
      render: (v: number) => <Progress percent={Math.min(v, 100)} size="small" strokeColor={v > 25 ? colors.error[500] : v > 15 ? colors.warning[500] : colors.success[500]} format={() => `${v.toFixed(1)}%`} />,
    },
    { title: '建议操作', dataIndex: 'suggestedAction', key: 'suggestedAction' },
  ];

  const indexColumns: TableColumnsType<IndexInfo> = [
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
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'active' ? '活跃' : v === 'unused' ? '未使用' : '冗余'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm title="确认删除该索引？" onConfirm={() => handleDeleteIndex(record)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const mqColumns: TableColumnsType<MQQueue> = [
    { title: '队列名', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '消息数', dataIndex: 'messageCount', key: 'messageCount' },
    { title: '消费者数', dataIndex: 'consumerCount', key: 'consumerCount' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'healthy' ? '健康' : v === 'warning' ? '警告' : '严重'}</Tag>,
    },
    { title: '死信数', dataIndex: 'deadLetters', key: 'deadLetters', render: (v: number) => v ? <Tag color="error">{v}</Tag> : '0' },
    { title: '最后活跃', dataIndex: 'lastActiveAt', key: 'lastActiveAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ];

  const tagentColumns: TableColumnsType<TagentClient> = [
    { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: 'OS', dataIndex: 'os', key: 'os' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'online' ? '在线' : v === 'offline' ? '离线' : '升级中'}</Tag>,
    },
    { title: 'CPU', dataIndex: 'cpuUsage', key: 'cpuUsage', render: (v: number) => `${v}%` },
    { title: '内存', dataIndex: 'memoryUsage', key: 'memoryUsage', render: (v: number) => `${v}%` },
    { title: '磁盘', dataIndex: 'diskUsage', key: 'diskUsage', render: (v: number) => `${v}%` },
    { title: '最后心跳', dataIndex: 'lastHeartbeat', key: 'lastHeartbeat', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<RocketOutlined />}
          onClick={() => {
            confirm({
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

  const batchColumns: TableColumnsType<BatchOperation> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 160 },
    { title: '命令', dataIndex: 'command', key: 'command', ellipsis: true },
    { title: '目标主机', dataIndex: 'targetHosts', key: 'targetHosts', render: (v: string[]) => v.join(', ') },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'pending' ? '待执行' : v === 'running' ? '运行中' : v === 'completed' ? '已完成' : '失败'}</Tag>,
    },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '完成时间', dataIndex: 'finishedAt', key: 'finishedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '结果', dataIndex: 'result', key: 'result', ellipsis: true, render: (v: string) => v || '-' },
  ];

  const fileColumns: TableColumnsType<FileInfo> = [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'path', key: 'path' },
    { title: '大小', dataIndex: 'size', key: 'size', render: (v: number) => `${(v / 1024).toFixed(2)} KB` },
    { title: '类型', dataIndex: 'mime', key: 'mime' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'uploaded' ? '已上传' : v === 'distributing' ? '分发中' : v === 'distributed' ? '已分发' : '失败'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<SendOutlined />}
            onClick={() => {
              setDistributingFile(record.id);
              setDistributeModalOpen(true);
            }}
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

  const themeColumns: TableColumnsType<ThemeConfig> = [
    { title: '主题名', dataIndex: 'name', key: 'name' },
    {
      title: '主色',
      dataIndex: 'primaryColor',
      key: 'primaryColor',
      width: 120,
      render: (v: string) => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: v, border: `1px solid ${colors.neutral[300]}` }} /><span>{v}</span></div>,
    },
    { title: '圆角', dataIndex: 'borderRadius', key: 'borderRadius', render: (v: number) => `${v}px` },
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
      render: (v: boolean, record) => <Switch checked={v} onChange={() => handleThemeToggle(record)} size="small" disabled={loading} />,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm title="确认删除该主题？" onConfirm={() => handleDeleteTheme(record)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const licenseColumns: TableColumnsType<LicenseInfo> = [
    { title: '产品', dataIndex: 'productName', key: 'productName' },
    { title: '许可证', dataIndex: 'licenseKey', key: 'licenseKey' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag>{v === 'enterprise' ? '企业版' : v === 'standard' ? '标准版' : '社区版'}</Tag>,
    },
    { title: '席位', dataIndex: 'seats', key: 'seats' },
    { title: '已使用', dataIndex: 'usedSeats', key: 'usedSeats' },
    {
      title: '使用率',
      key: 'usageRate',
      render: (_, record) => <Progress percent={record.seats > 0 ? Math.round((record.usedSeats / record.seats) * 100) : 0} size="small" />,
    },
    { title: '到期时间', dataIndex: 'expireAt', key: 'expireAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'active' ? '有效' : v === 'expired' ? '已过期' : '宽限期'}</Tag>,
    },
  ];

  const moduleColumns: TableColumnsType<SystemModule> = [
    { title: '模块名', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '依赖', dataIndex: 'dependencies', key: 'dependencies', render: (v: string[]) => v.join(', ') || '-' },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (v: boolean, record) => <Switch checked={v} onChange={() => handleModuleToggle(record)} size="small" disabled={loading} />,
    },
  ];

  const threadPoolColumns: TableColumnsType<ThreadPool> = [
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
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{v === 'normal' ? '正常' : v === 'busy' ? '繁忙' : '饱和'}</Tag>,
    },
    {
      title: '使用率',
      key: 'usage',
      render: (_, record) => <Progress percent={record.maxSize > 0 ? Math.round((record.activeCount / record.maxSize) * 100) : 0} size="small" />,
    },
  ];

  const auditColumns: TableColumnsType<AuditEvent> = [
    { title: '用户', dataIndex: 'username', key: 'username' },
    { title: '操作', dataIndex: 'action', key: 'action' },
    { title: '资源', dataIndex: 'resource', key: 'resource' },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (v: string) => <Tag color={v === 'success' ? 'success' : 'error'}>{v === 'success' ? '成功' : '失败'}</Tag>,
    },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (v: string) => new Date(v).toLocaleString() },
  ];

  const logColumns: TableColumnsType<LogEntry> = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: string) => {
        const color = v === 'ERROR' ? 'error' : v === 'WARN' ? 'warning' : v === 'DEBUG' ? 'default' : 'blue';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    { title: '服务', dataIndex: 'service', key: 'service' },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (v: string) => new Date(v).toLocaleString() },
  ];

  // ==================== Tab 面板 ====================

  // ---- 定时调度 ----
  const renderCronTab = () => (
    <Card
      title="系统定时调度管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCronJobs}>刷新</Button>
          <Button icon={<PlusOutlined />} onClick={() => { setCronEditingJob(null); cronForm.resetFields(); setCronModalOpen(true); }}>新建定时任务</Button>
        </Space>
      }
      style={{ marginTop: spacing.md }}
    >
      <Table
        columns={cronColumns}
        dataSource={cronJobs}
        loading={cronLoading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  // ---- 数据库工具 ----
  const renderDbTab = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic title="最近 Dump" value={dumps[0]?.filename || '-'} valueStyle={{ color: colors.primary[500], fontSize: 14 }} />
            <Button icon={<DownloadOutlined />} onClick={handleSqlDump} loading={dumpRunning} style={{ marginTop: spacing.md }}>
              执行 SQL Dump
            </Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic title="碎片表数" value={fragments.length} valueStyle={{ color: colors.warning[500] }} />
            <Text type="secondary" style={{ fontSize: 12 }}>建议检查碎片率超过 25% 的表</Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic title="索引总数" value={indexes.length} valueStyle={{ color: colors.success[500] }} />
            <Button type="link" icon={<PlusOutlined />} onClick={() => setIndexModalOpen(true)}>新建索引</Button>
          </Card>
        </Col>
      </Row>

      <Card title="SQL Dump 历史" style={{ marginBottom: spacing.md }}>
        <Table columns={dumpColumns} dataSource={dumps} rowKey="id" size="small" pagination={{ pageSize: 5 }} />
      </Card>

      <Card title="数据库碎片分析" style={{ marginBottom: spacing.md }}>
        <Table columns={fragmentColumns} dataSource={fragments} rowKey="id" size="small" pagination={false} />
      </Card>

      <Card title="索引管理">
        <Table columns={indexColumns} dataSource={indexes} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );

  // ---- MQ 监控 ----
  const renderMqTab = () => (
    <Card title="MQ 消息队列监控" extra={<Button icon={<ReloadOutlined />} onClick={loadDBTools}>刷新</Button>} style={{ marginTop: spacing.md }}>
      <Table columns={mqColumns} dataSource={[]} rowKey="name" size="middle" pagination={false} />
    </Card>
  );

  // ---- Tagent 管理 ----
  const renderTagentTab = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="总客户端" value={tagentStats.total} prefix={<TeamOutlined />} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="在线" value={tagentStats.online} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="离线" value={tagentStats.offline} prefix={<CloseCircleOutlined />} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="升级中" value={tagentStats.upgrading} prefix={<ThunderboltOutlined />} valueStyle={{ color: colors.warning[500] }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Tagent 客户端列表"
        extra={<Button icon={<ReloadOutlined />} onClick={loadTagent}>刷新</Button>}
      >
        <Table columns={tagentColumns} dataSource={tagentClients} loading={tagentLoading} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );

  // ---- 批量操作 ----
  const renderBatchTab = () => (
    <div>
      <Card title="批量命令执行" style={{ marginBottom: spacing.md }}>
        <Form form={batchForm} layout="vertical" onFinish={handleBatchExecute}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="command" label="命令" rules={[{ required: true, message: '请输入命令' }]}>
                <Input placeholder="例如: uptime" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="targetHosts" label="目标主机（逗号分隔）" rules={[{ required: true, message: '请输入目标主机' }]}>
                <Input placeholder="prod-web-01,prod-api-01" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={batchExecLoading}>
              执行批量操作
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="执行历史" extra={<Button icon={<ReloadOutlined />} onClick={loadBatchOps}>刷新</Button>}>
        <Table columns={batchColumns} dataSource={batchOps} loading={batchLoading} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );

  // ---- 文件管理 ----
  const renderFileTab = () => (
    <div>
      <Card
        title="文件上传/下载/分发"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadFiles}>刷新</Button>
            <Button icon={<PlusOutlined />} onClick={() => { uploadForm.resetFields(); setUploadModalOpen(true); }}>上传文件</Button>
          </Space>
        }
      >
        <Table columns={fileColumns} dataSource={files} loading={fileLoading} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );

  // ---- 系统配置 ----
  const renderConfigTab = () => (
    <div>
      <Card title="主题管理" extra={<Button icon={<PlusOutlined />} onClick={() => { themeForm.resetFields(); setThemeModalOpen(true); }}>新建主题</Button>} style={{ marginBottom: spacing.md }}>
        <Table columns={themeColumns} dataSource={themes} loading={themeLoading} rowKey="id" size="middle" pagination={{ pageSize: 5 }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <Col span={12}>
          <Card title="许可证管理">
            <Table columns={licenseColumns} dataSource={licenses} rowKey="id" size="small" pagination={false} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统模块">
            <Table columns={moduleColumns} dataSource={modules} loading={moduleLoading} rowKey="id" size="small" pagination={{ pageSize: 5 }} />
          </Card>
        </Col>
      </Row>

      <Card title="线程池状态">
        <Table columns={threadPoolColumns} dataSource={threadPools} rowKey="name" size="middle" pagination={{ pageSize: 5 }} />
      </Card>
    </div>
  );

  // ---- 审计 ----
  const renderAuditTab = () => (
    <Card title="审计事件" extra={<Button icon={<ReloadOutlined />} onClick={() => loadAudit(auditPage)}>刷新</Button>} style={{ marginTop: spacing.md }}>
      <Table columns={auditColumns} dataSource={auditEvents} rowKey="id" size="middle" pagination={{ current: auditPage, total: auditTotal, onChange: loadAudit, pageSize: 10 }} />
    </Card>
  );

  // ---- 日志 ----
  const renderLogTab = () => (
    <Card title="日志管理" extra={<Button icon={<ReloadOutlined />} onClick={loadLogs}>刷新</Button>} style={{ marginTop: spacing.md }}>
      <Space style={{ marginBottom: spacing.md }}>
        <Text>级别:</Text>
        <Select
          style={{ width: 120 }}
          placeholder="全部"
          allowClear
          value={logLevel}
          onChange={setLogLevel}
          options={[
            { label: 'ERROR', value: 'ERROR' },
            { label: 'WARN', value: 'WARN' },
            { label: 'INFO', value: 'INFO' },
            { label: 'DEBUG', value: 'DEBUG' },
          ]}
        />
        <Text style={{ marginLeft: 16 }}>服务:</Text>
        <Select
          style={{ width: 200 }}
          placeholder="全部"
          allowClear
          value={logService}
          onChange={setLogService}
          options={[
            { label: 'orion-platform', value: 'orion-platform' },
            { label: 'orion-deploy', value: 'orion-deploy' },
            { label: 'orion-ai', value: 'orion-ai' },
            { label: 'orion-monitor', value: 'orion-monitor' },
            { label: 'orion-auth', value: 'orion-auth' },
          ]}
        />
      </Space>
      <Table columns={logColumns} dataSource={logs} rowKey="id" size="middle" pagination={{ total: logTotal, pageSize: 10 }} />
    </Card>
  );

  // ==================== Tab 配置 ====================

  const tabItems: TabsProps['items'] = [
    {
      key: 'cron',
      label: <span><ClockCircleOutlined /> 定时调度</span>,
      children: renderCronTab(),
    },
    {
      key: 'db',
      label: <span><DatabaseOutlined /> 数据库工具</span>,
      children: renderDbTab(),
    },
    {
      key: 'mq',
      label: <span><ClusterOutlined /> MQ监控</span>,
      children: renderMqTab(),
    },
    {
      key: 'tagent',
      label: <span><ToolOutlined /> Tagent管理</span>,
      children: renderTagentTab(),
    },
    {
      key: 'batch',
      label: <span><ConsoleSqlOutlined /> 批量操作</span>,
      children: renderBatchTab(),
    },
    {
      key: 'file',
      label: <span><FileTextOutlined /> 文件管理</span>,
      children: renderFileTab(),
    },
    {
      key: 'config',
      label: <span><SettingOutlined /> 系统配置</span>,
      children: renderConfigTab(),
    },
    {
      key: 'audit',
      label: <span><AuditOutlined /> 审计</span>,
      children: renderAuditTab(),
    },
    {
      key: 'logs',
      label: <span><FileSyncOutlined /> 日志</span>,
      children: renderLogTab(),
    },
  ];

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ToolOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          运维管理工具
        </Title>
        <Text type="secondary">系统定时任务、数据库工具、Tagent管理、批量操作、文件管理与系统配置</Text>
      </div>

      {/* 系统信息概览 */}
      {systemInfo && (
        <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
          <Row gutter={[16, 16]}>
            <Col span={4}>
              <Statistic title="平台版本" value={systemInfo.platformVersion} valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col span={4}>
              <Statistic title="运行时长" value={systemInfo.uptime} valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col span={4}>
              <Statistic title="定时任务" value={`${systemInfo.enabledCronJobs}/${systemInfo.totalCronJobs}`} valueStyle={{ color: colors.success[500], fontSize: 16 }} />
            </Col>
            <Col span={4}>
              <Statistic title="Tagent 在线" value={`${systemInfo.onlineTagentClients}/${systemInfo.totalTagentClients}`} valueStyle={{ color: colors.success[500], fontSize: 16 }} />
            </Col>
            <Col span={4}>
              <Statistic title="MQ 队列" value={systemInfo.mqQueueCount} valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col span={4}>
              <Statistic title="系统模块" value={systemInfo.totalModules} valueStyle={{ fontSize: 16 }} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: 0 }}
      />

      {/* ==================== 弹窗 ==================== */}

      {/* CronJob 创建/编辑弹窗 */}
      <Modal
        title={cronEditingJob ? '编辑定时任务' : '新建定时任务'}
        open={cronModalOpen}
        onCancel={() => { setCronModalOpen(false); setCronEditingJob(null); cronForm.resetFields(); }}
        onOk={() => cronForm.submit()}
        confirmLoading={loading}
        width={500}
      >
        <Form form={cronForm} layout="vertical" onFinish={handleCronSave}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 日志清理" />
          </Form.Item>
          <Form.Item name="cronExpression" label="Cron 表达式" rules={[{ required: true }]}>
            <Input placeholder="例如: 0 2 * * *" />
          </Form.Item>
          <Form.Item name="command" label="执行命令" rules={[{ required: true }]}>
            <Input placeholder="例如: scripts/clean-logs.sh" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="任务描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 索引创建弹窗 */}
      <Modal
        title="新建索引"
        open={indexModalOpen}
        onCancel={() => { setIndexModalOpen(false); indexForm.resetFields(); }}
        onOk={() => indexForm.submit()}
        width={480}
      >
        <Form form={indexForm} layout="vertical" onFinish={handleCreateIndex}>
          <Form.Item name="tableName" label="表名" rules={[{ required: true }]}>
            <Input placeholder="例如: pipelines" />
          </Form.Item>
          <Form.Item name="indexName" label="索引名" rules={[{ required: true }]}>
            <Input placeholder="例如: idx_pipelines_status" />
          </Form.Item>
          <Form.Item name="columns" label="列（逗号分隔）" rules={[{ required: true }]}>
            <Input placeholder="例如: tenant_id,status" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件上传弹窗 */}
      <Modal
        title="上传文件"
        open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); uploadForm.resetFields(); }}
        onOk={() => uploadForm.submit()}
        width={480}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="name" label="文件名" rules={[{ required: true }]}>
            <Input placeholder="例如: config.yaml" />
          </Form.Item>
          <Form.Item name="size" label="文件大小 (bytes)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="例如: 1024" />
          </Form.Item>
          <Form.Item name="mime" label="MIME 类型">
            <Input placeholder="例如: application/octet-stream" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件分发弹窗 */}
      <Modal
        title="分发文件"
        open={distributeModalOpen}
        onCancel={() => { setDistributeModalOpen(false); distributeForm.resetFields(); }}
        onOk={() => distributeForm.submit()}
        width={480}
      >
        <Form form={distributeForm} layout="vertical" onFinish={handleDistribute}>
          <Form.Item name="targetHosts" label="目标主机（逗号分隔）" rules={[{ required: true }]}>
            <Input placeholder="prod-web-01,prod-api-01" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 主题创建弹窗 */}
      <Modal
        title="新建主题"
        open={themeModalOpen}
        onCancel={() => { setThemeModalOpen(false); themeForm.resetFields(); }}
        onOk={() => themeForm.submit()}
        width={480}
      >
        <Form form={themeForm} layout="vertical" onFinish={handleThemeSave}>
          <Form.Item name="name" label="主题名" rules={[{ required: true }]}>
            <Input placeholder="例如: 深紫主题" />
          </Form.Item>
          <Form.Item name="primaryColor" label="主色" rules={[{ required: true }]}>
            <Input placeholder="#7C5CFC" />
          </Form.Item>
          <Form.Item name="borderRadius" label="圆角 (px)">
            <InputNumber min={0} max={20} style={{ width: '100%' }} defaultValue={6} />
          </Form.Item>
          <Form.Item name="mode" label="模式">
            <Select options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }]} defaultValue="light" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OpsTools;
