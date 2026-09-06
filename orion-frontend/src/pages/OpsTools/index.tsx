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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Form,
  Input,
  Select,
  message,
  Statistic,
  Row,
  Col,
  Typography,
} from 'antd';
import type { TabsProps } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ToolOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import {
  tabConfig,
  LOG_LEVEL_OPTIONS,
  LOG_SERVICE_OPTIONS,
} from './config';
import { OpsToolsModals } from './OpsToolsModals';
import {
  dumpColumns,
  fragmentColumns,
  mqColumns,
  batchColumns,
  licenseColumns,
  threadPoolColumns,
  auditColumns,
  logColumns,
  getCronColumns,
  getIndexColumns,
  getTagentColumns,
  getFileColumns,
  getThemeColumns,
  getModuleColumns,
} from './columns';
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
  const [_dbLoading, setDbLoading] = useState(false);
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexForm] = Form.useForm();

  // ============ Tagent State ============
  const [tagentClients, setTagentClients] = useState<TagentClient[]>([]);
  const [tagentStats, setTagentStats] = useState<TagentStats>({
    total: 0,
    online: 0,
    offline: 0,
    upgrading: 0,
  });
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
  const [themeLoading, _setThemeLoading] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [themeForm] = Form.useForm();

  // ============ Module State ============
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [moduleLoading, _setModuleLoading] = useState(false);

  // ============ License State ============
  const [licenses, setLicenses] = useState<LicenseInfo[]>([]);

  // ============ Thread Pool State ============
  const [threadPools, setThreadPools] = useState<ThreadPool[]>([]);

  // ============ Audit State ============
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  // ============ MQ State ============
  const [_mqQueues, setMqQueues] = useState<MQQueue[]>([]);
  const [_mqLoading, setMqLoading] = useState(false);

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
    } catch (err: unknown) {
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

  const _loadMqQueues = useCallback(async () => {
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
  void _loadMqQueues;

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

  // ==================== 列定义 (从 columns.tsx 导入) ====================

  const cronColumns = useMemo(
    () =>
      getCronColumns({
        handleCronToggle,
        handleCronEdit,
        handleCronDelete,
      }),
    [handleCronToggle, handleCronEdit, handleCronDelete],
  );

  const indexColumns = useMemo(
    () =>
      getIndexColumns({
        handleDeleteIndex,
      }),
    [handleDeleteIndex],
  );

  const tagentColumns = useMemo(
    () =>
      getTagentColumns({
        handleTagentUpgrade,
      }),
    [handleTagentUpgrade],
  );

  const fileColumns = useMemo(
    () =>
      getFileColumns({
        handleDistributeOpen: (fileId: string) => {
          setDistributingFile(fileId);
          setDistributeModalOpen(true);
        },
        handleDeleteFile,
      }),
    [handleDeleteFile],
  );

  const themeColumns = useMemo(
    () =>
      getThemeColumns(
        {
          handleThemeToggle,
          handleDeleteTheme,
        },
        loading,
      ),
    [handleThemeToggle, handleDeleteTheme, loading],
  );

  const moduleColumns = useMemo(
    () =>
      getModuleColumns(
        {
          handleModuleToggle,
        },
        loading,
      ),
    [handleModuleToggle, loading],
  );

  // ==================== Tab 面板 ====================

  // ---- 定时调度 ----
  const renderCronTab = () => (
    <Card
      title="系统定时调度管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCronJobs}>
            刷新
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setCronEditingJob(null);
              cronForm.resetFields();
              setCronModalOpen(true);
            }}
          >
            新建定时任务
          </Button>
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
            <Statistic
              title="最近 Dump"
              value={dumps[0]?.filename || '-'}
              valueStyle={{ color: colors.primary[500], fontSize: 14 }}
            />
            <Button
              icon={<DownloadOutlined />}
              onClick={handleSqlDump}
              loading={dumpRunning}
              style={{ marginTop: spacing.md }}
            >
              执行 SQL Dump
            </Button>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic
              title="碎片表数"
              value={fragments.length}
              valueStyle={{ color: colors.warning[500] }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              建议检查碎片率超过 25% 的表
            </Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic
              title="索引总数"
              value={indexes.length}
              valueStyle={{ color: colors.success[500] }}
            />
            <Button type="link" icon={<PlusOutlined />} onClick={() => setIndexModalOpen(true)}>
              新建索引
            </Button>
          </Card>
        </Col>
      </Row>

      <Card title="SQL Dump 历史" style={{ marginBottom: spacing.md }}>
        <Table
          columns={dumpColumns}
          dataSource={dumps}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Card title="数据库碎片分析" style={{ marginBottom: spacing.md }}>
        <Table
          columns={fragmentColumns}
          dataSource={fragments}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>

      <Card title="索引管理">
        <Table
          columns={indexColumns}
          dataSource={indexes}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );

  // ---- MQ 监控 ----
  const renderMqTab = () => (
    <Card
      title="MQ 消息队列监控"
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadDBTools}>
          刷新
        </Button>
      }
      style={{ marginTop: spacing.md }}
    >
      <Table columns={mqColumns} dataSource={[]} rowKey="name" size="middle" pagination={false} />
    </Card>
  );

  // ---- Tagent 管理 ----
  const renderTagentTab = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总客户端"
              value={tagentStats.total}
              prefix={<TeamOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线"
              value={tagentStats.online}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="离线"
              value={tagentStats.offline}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="升级中"
              value={tagentStats.upgrading}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Tagent 客户端列表"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadTagent}>
            刷新
          </Button>
        }
      >
        <Table
          columns={tagentColumns}
          dataSource={tagentClients}
          loading={tagentLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10 }}
        />
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
              <Form.Item
                name="command"
                label="命令"
                rules={[{ required: true, message: '请输入命令' }]}
              >
                <Input placeholder="例如: uptime" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="targetHosts"
                label="目标主机（逗号分隔）"
                rules={[{ required: true, message: '请输入目标主机' }]}
              >
                <Input placeholder="prod-web-01,prod-api-01" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={batchExecLoading}
            >
              执行批量操作
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="执行历史"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadBatchOps}>
            刷新
          </Button>
        }
      >
        <Table
          columns={batchColumns}
          dataSource={batchOps}
          loading={batchLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10 }}
        />
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
            <Button icon={<ReloadOutlined />} onClick={loadFiles}>
              刷新
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                uploadForm.resetFields();
                setUploadModalOpen(true);
              }}
            >
              上传文件
            </Button>
          </Space>
        }
      >
        <Table
          columns={fileColumns}
          dataSource={files}
          loading={fileLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );

  // ---- 系统配置 ----
  const renderConfigTab = () => (
    <div>
      <Card
        title="主题管理"
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              themeForm.resetFields();
              setThemeModalOpen(true);
            }}
          >
            新建主题
          </Button>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          columns={themeColumns}
          dataSource={themes}
          loading={themeLoading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <Col span={12}>
          <Card title="许可证管理">
            <Table
              columns={licenseColumns}
              dataSource={licenses}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统模块">
            <Table
              columns={moduleColumns}
              dataSource={modules}
              loading={moduleLoading}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="线程池状态">
        <Table
          columns={threadPoolColumns}
          dataSource={threadPools}
          rowKey="name"
          size="middle"
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );

  // ---- 审计 ----
  const renderAuditTab = () => (
    <Card
      title="审计事件"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => loadAudit(auditPage)}>
          刷新
        </Button>
      }
      style={{ marginTop: spacing.md }}
    >
      <Table
        columns={auditColumns}
        dataSource={auditEvents}
        rowKey="id"
        size="middle"
        pagination={{ current: auditPage, total: auditTotal, onChange: loadAudit, pageSize: 10 }}
      />
    </Card>
  );

  // ---- 日志 ----
  const renderLogTab = () => (
    <Card
      title="日志管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadLogs}>
          刷新
        </Button>
      }
      style={{ marginTop: spacing.md }}
    >
      <Space style={{ marginBottom: spacing.md }}>
        <Text>级别:</Text>
        <Select
          style={{ width: 120 }}
          placeholder="全部"
          allowClear
          value={logLevel}
          onChange={setLogLevel}
          options={LOG_LEVEL_OPTIONS}
        />
        <Text style={{ marginLeft: 16 }}>服务:</Text>
        <Select
          style={{ width: 200 }}
          placeholder="全部"
          allowClear
          value={logService}
          onChange={setLogService}
          options={LOG_SERVICE_OPTIONS}
        />
      </Space>
      <Table
        columns={logColumns}
        dataSource={logs}
        rowKey="id"
        size="middle"
        pagination={{ total: logTotal, pageSize: 10 }}
      />
    </Card>
  );

  // ==================== Tab 配置 ====================

  const tabItems: TabsProps['items'] = [
    { ...tabConfig[0]!, children: renderCronTab() },
    { ...tabConfig[1]!, children: renderDbTab() },
    { ...tabConfig[2]!, children: renderMqTab() },
    { ...tabConfig[3]!, children: renderTagentTab() },
    { ...tabConfig[4]!, children: renderBatchTab() },
    { ...tabConfig[5]!, children: renderFileTab() },
    { ...tabConfig[6]!, children: renderConfigTab() },
    { ...tabConfig[7]!, children: renderAuditTab() },
    { ...tabConfig[8]!, children: renderLogTab() },
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
        <Text type="secondary">
          系统定时任务、数据库工具、Tagent管理、批量操作、文件管理与系统配置
        </Text>
      </div>

      {/* 系统信息概览 */}
      {systemInfo && (
        <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
          <Row gutter={[16, 16]}>
            <Col span={4}>
              <Statistic
                title="平台版本"
                value={systemInfo.platformVersion}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={4}>
              <Statistic title="运行时长" value={systemInfo.uptime} valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col span={4}>
              <Statistic
                title="定时任务"
                value={`${systemInfo.enabledCronJobs}/${systemInfo.totalCronJobs}`}
                valueStyle={{ color: colors.success[500], fontSize: 16 }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="Tagent 在线"
                value={`${systemInfo.onlineTagentClients}/${systemInfo.totalTagentClients}`}
                valueStyle={{ color: colors.success[500], fontSize: 16 }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="MQ 队列"
                value={systemInfo.mqQueueCount}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="系统模块"
                value={systemInfo.totalModules}
                valueStyle={{ fontSize: 16 }}
              />
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

      <OpsToolsModals
        loading={loading}
        setLoading={setLoading}
        systemInfo={systemInfo}
        setSystemInfo={setSystemInfo}
        cronJobs={cronJobs}
        setCronJobs={setCronJobs}
        cronModalOpen={cronModalOpen}
        setCronModalOpen={setCronModalOpen}
        cronEditingJob={cronEditingJob}
        setCronEditingJob={setCronEditingJob}
        cronForm={cronForm}
        handleCronSave={handleCronSave}
        handleCronToggle={handleCronToggle}
        handleCronDelete={handleCronDelete}
        handleCronEdit={handleCronEdit}
        dumps={dumps}
        setDumps={setDumps}
        dumpRunning={dumpRunning}
        setDumpRunning={setDumpRunning}
        fragments={fragments}
        setFragments={setFragments}
        indexes={indexes}
        setIndexes={setIndexes}
        indexModalOpen={indexModalOpen}
        setIndexModalOpen={setIndexModalOpen}
        indexForm={indexForm}
        handleSqlDump={handleSqlDump}
        handleCreateIndex={handleCreateIndex}
        handleDeleteIndex={handleDeleteIndex}
        tagentClients={tagentClients}
        setTagentClients={setTagentClients}
        tagentStats={tagentStats}
        setTagentStats={setTagentStats}
        tagentLoading={tagentLoading}
        setTagentLoading={setTagentLoading}
        handleTagentUpgrade={handleTagentUpgrade}
        batchOps={batchOps}
        setBatchOps={setBatchOps}
        batchLoading={batchLoading}
        setBatchLoading={setBatchLoading}
        batchForm={batchForm}
        batchExecLoading={batchExecLoading}
        setBatchExecLoading={setBatchExecLoading}
        handleBatchExecute={handleBatchExecute}
        files={files}
        setFiles={setFiles}
        fileLoading={fileLoading}
        setFileLoading={setFileLoading}
        uploadForm={uploadForm}
        uploadModalOpen={uploadModalOpen}
        setUploadModalOpen={setUploadModalOpen}
        distributeModalOpen={distributeModalOpen}
        setDistributeModalOpen={setDistributeModalOpen}
        distributingFile={distributingFile}
        setDistributingFile={setDistributingFile}
        distributeForm={distributeForm}
        handleUpload={handleUpload}
        handleDeleteFile={handleDeleteFile}
        handleDistribute={handleDistribute}
        themes={themes}
        setThemes={setThemes}
        themeForm={themeForm}
        themeModalOpen={themeModalOpen}
        setThemeModalOpen={setThemeModalOpen}
        handleThemeSave={handleThemeSave}
        handleThemeToggle={handleThemeToggle}
        handleDeleteTheme={handleDeleteTheme}
        handleModuleToggle={handleModuleToggle}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbLoading={_dbLoading}
        setDbLoading={setDbLoading}
      />
    </div>
  );
};

export default OpsTools;
