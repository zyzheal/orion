/**
 * 运维管理工具 - 数据状态与操作 Hook
 *
 * 集中管理 9 个 Tab 所需的全部 state、数据加载函数与操作 handler。
 * 主组件只需调用本 Hook 即可获得完整的数据与操作上下文。
 */
import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { message } from 'antd';
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

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface OpsToolsData {
  // ===== 通用 =====
  activeTab: string;
  setActiveTab: Setter<string>;
  loading: boolean;
  setLoading: Setter<boolean>;
  systemInfo: SystemInfo | null;
  setSystemInfo: Setter<SystemInfo | null>;

  // ===== CronJob =====
  cronJobs: CronJob[];
  setCronJobs: Setter<CronJob[]>;
  cronLoading: boolean;
  setCronLoading: Setter<boolean>;
  cronModalOpen: boolean;
  setCronModalOpen: Setter<boolean>;
  cronEditingJob: CronJob | null;
  setCronEditingJob: Setter<CronJob | null>;

  // ===== DB Tools =====
  dumps: SqlDumpResult[];
  setDumps: Setter<SqlDumpResult[]>;
  dumpRunning: boolean;
  setDumpRunning: Setter<boolean>;
  fragments: DatabaseFragment[];
  setFragments: Setter<DatabaseFragment[]>;
  indexes: IndexInfo[];
  setIndexes: Setter<IndexInfo[]>;
  dbLoading: boolean;
  setDbLoading: Setter<boolean>;
  indexModalOpen: boolean;
  setIndexModalOpen: Setter<boolean>;

  // ===== Tagent =====
  tagentClients: TagentClient[];
  setTagentClients: Setter<TagentClient[]>;
  tagentStats: TagentStats;
  setTagentStats: Setter<TagentStats>;
  tagentLoading: boolean;
  setTagentLoading: Setter<boolean>;

  // ===== Batch =====
  batchOps: BatchOperation[];
  setBatchOps: Setter<BatchOperation[]>;
  batchLoading: boolean;
  setBatchLoading: Setter<boolean>;
  batchExecLoading: boolean;
  setBatchExecLoading: Setter<boolean>;

  // ===== File =====
  files: FileInfo[];
  setFiles: Setter<FileInfo[]>;
  fileLoading: boolean;
  setFileLoading: Setter<boolean>;
  uploadModalOpen: boolean;
  setUploadModalOpen: Setter<boolean>;
  distributeModalOpen: boolean;
  setDistributeModalOpen: Setter<boolean>;
  distributingFile: string | null;
  setDistributingFile: Setter<string | null>;

  // ===== Theme =====
  themes: ThemeConfig[];
  setThemes: Setter<ThemeConfig[]>;
  themeLoading: boolean;
  setThemeLoading: Setter<boolean>;
  themeModalOpen: boolean;
  setThemeModalOpen: Setter<boolean>;

  // ===== Module =====
  modules: SystemModule[];
  setModules: Setter<SystemModule[]>;
  moduleLoading: boolean;
  setModuleLoading: Setter<boolean>;

  // ===== License =====
  licenses: LicenseInfo[];
  setLicenses: Setter<LicenseInfo[]>;

  // ===== Thread Pool =====
  threadPools: ThreadPool[];
  setThreadPools: Setter<ThreadPool[]>;

  // ===== Audit =====
  auditEvents: AuditEvent[];
  setAuditEvents: Setter<AuditEvent[]>;
  auditTotal: number;
  setAuditTotal: Setter<number>;
  auditPage: number;
  setAuditPage: Setter<number>;

  // ===== MQ =====
  mqQueues: MQQueue[];
  setMqQueues: Setter<MQQueue[]>;
  mqLoading: boolean;
  setMqLoading: Setter<boolean>;

  // ===== Log =====
  logs: LogEntry[];
  setLogs: Setter<LogEntry[]>;
  logTotal: number;
  setLogTotal: Setter<number>;
  logLevel: string | undefined;
  setLogLevel: Setter<string | undefined>;
  logService: string | undefined;
  setLogService: Setter<string | undefined>;
}

export function useOpsToolsData(): OpsToolsData & {
  // 数据加载
  loadSystemInfo: () => Promise<void>;
  loadCronJobs: () => Promise<void>;
  loadDBTools: () => Promise<void>;
  loadTagent: () => Promise<void>;
  _loadMqQueues: () => Promise<void>;
  loadBatchOps: () => Promise<void>;
  loadFiles: () => Promise<void>;
  loadConfig: () => Promise<void>;
  loadAudit: (page?: number) => Promise<void>;
  loadLogs: () => Promise<void>;

  // 操作
  handleCronSave: (values: any) => Promise<void>;
  handleCronToggle: (job: CronJob) => Promise<void>;
  handleCronDelete: (job: CronJob) => Promise<void>;
  handleCronEdit: (job: CronJob) => void;
  handleSqlDump: () => Promise<void>;
  handleCreateIndex: (values: any) => Promise<void>;
  handleDeleteIndex: (idx: IndexInfo) => Promise<void>;
  handleTagentUpgrade: (client: TagentClient, version: string) => Promise<void>;
  handleBatchExecute: (values: any) => Promise<void>;
  handleUpload: (values: any) => Promise<void>;
  handleDistribute: (values: any) => Promise<void>;
  handleDeleteFile: (file: FileInfo) => Promise<void>;
  handleThemeSave: (values: any) => Promise<void>;
  handleThemeToggle: (theme: ThemeConfig) => Promise<void>;
  handleDeleteTheme: (theme: ThemeConfig) => Promise<void>;
  handleModuleToggle: (mod: SystemModule) => Promise<void>;
} {
  const [activeTab, setActiveTab] = useState('cron');
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // ============ CronJob State ============
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [cronEditingJob, setCronEditingJob] = useState<CronJob | null>(null);

  // ============ DB Tools State ============
  const [dumps, setDumps] = useState<SqlDumpResult[]>([]);
  const [dumpRunning, setDumpRunning] = useState(false);
  const [fragments, setFragments] = useState<DatabaseFragment[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [indexModalOpen, setIndexModalOpen] = useState(false);

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
  const [batchExecLoading, setBatchExecLoading] = useState(false);

  // ============ File State ============
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [distributingFile, setDistributingFile] = useState<string | null>(null);

  // ============ Theme State ============
  const [themes, setThemes] = useState<ThemeConfig[]>([]);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

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
    } catch {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 保持 API 兼容性: 原代码以 `_loadMqQueues` 命名（未使用），此处保留命名
  const _loadMqQueues = loadMqQueues;

  return {
    // 通用
    activeTab,
    setActiveTab,
    loading,
    setLoading,
    systemInfo,
    setSystemInfo,

    // CronJob
    cronJobs,
    setCronJobs,
    cronLoading,
    setCronLoading,
    cronModalOpen,
    setCronModalOpen,
    cronEditingJob,
    setCronEditingJob,

    // DB Tools
    dumps,
    setDumps,
    dumpRunning,
    setDumpRunning,
    fragments,
    setFragments,
    indexes,
    setIndexes,
    dbLoading,
    setDbLoading,
    indexModalOpen,
    setIndexModalOpen,

    // Tagent
    tagentClients,
    setTagentClients,
    tagentStats,
    setTagentStats,
    tagentLoading,
    setTagentLoading,

    // Batch
    batchOps,
    setBatchOps,
    batchLoading,
    setBatchLoading,
    batchExecLoading,
    setBatchExecLoading,

    // File
    files,
    setFiles,
    fileLoading,
    setFileLoading,
    uploadModalOpen,
    setUploadModalOpen,
    distributeModalOpen,
    setDistributeModalOpen,
    distributingFile,
    setDistributingFile,

    // Theme
    themes,
    setThemes,
    themeLoading,
    setThemeLoading,
    themeModalOpen,
    setThemeModalOpen,

    // Module
    modules,
    setModules,
    moduleLoading,
    setModuleLoading,

    // License
    licenses,
    setLicenses,

    // Thread Pool
    threadPools,
    setThreadPools,

    // Audit
    auditEvents,
    setAuditEvents,
    auditTotal,
    setAuditTotal,
    auditPage,
    setAuditPage,

    // MQ
    mqQueues,
    setMqQueues,
    mqLoading,
    setMqLoading,

    // Log
    logs,
    setLogs,
    logTotal,
    setLogTotal,
    logLevel,
    setLogLevel,
    logService,
    setLogService,

    // 数据加载
    loadSystemInfo,
    loadCronJobs,
    loadDBTools,
    loadTagent,
    _loadMqQueues,
    loadBatchOps,
    loadFiles,
    loadConfig,
    loadAudit,
    loadLogs,

    // 操作
    handleCronSave,
    handleCronToggle,
    handleCronDelete,
    handleCronEdit,
    handleSqlDump,
    handleCreateIndex,
    handleDeleteIndex,
    handleTagentUpgrade,
    handleBatchExecute,
    handleUpload,
    handleDistribute,
    handleDeleteFile,
    handleThemeSave,
    handleThemeToggle,
    handleDeleteTheme,
    handleModuleToggle,
  };
}
