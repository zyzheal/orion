/**
 * 运维工具 - Tab items 组装
 *
 * 将 9 个 Tab 内容组件根据配置组装成 Tabs items。
 * 主组件只需传入数据上下文与列定义即可。
 */

import type { TabsProps, TableColumnsType, FormInstance } from 'antd';
import type {
  CronJob,
  IndexInfo,
  TagentClient,
  TagentStats,
  FileInfo,
  ThemeConfig,
  SystemModule,
  AuditEvent,
  LogEntry,
  SqlDumpResult,
  DatabaseFragment,
  BatchOperation,
  LicenseInfo,
  ThreadPool,
} from '@/api/ops-tools';
import { tabConfig } from './config';
import { CronTab } from './tabs/CronTab';
import { DbTab } from './tabs/DbTab';
import { MqTab } from './tabs/MqTab';
import { TagentTab } from './tabs/TagentTab';
import { BatchTab } from './tabs/BatchTab';
import { FileTab } from './tabs/FileTab';
import { ConfigTab } from './tabs/ConfigTab';
import { AuditTab } from './tabs/AuditTab';
import { LogTab } from './tabs/LogTab';

export interface TabItemsCtx {
  // CronTab
  cronColumns: TableColumnsType<CronJob>;
  cronJobs: CronJob[];
  cronLoading: boolean;
  onCronRefresh: () => void;
  onCronCreate: () => void;

  // DbTab
  dumps: SqlDumpResult[];
  fragments: DatabaseFragment[];
  indexes: IndexInfo[];
  dumpRunning: boolean;
  indexColumns: TableColumnsType<IndexInfo>;
  onSqlDump: () => void;
  onCreateIndex: () => void;

  // MqTab (原代码 onClick={loadDBTools}，保持原样)
  onMqRefresh: () => void;

  // TagentTab
  tagentColumns: TableColumnsType<TagentClient>;
  tagentClients: TagentClient[];
  tagentStats: TagentStats;
  tagentLoading: boolean;
  onTagentRefresh: () => void;

  // BatchTab
  batchForm: FormInstance;
  batchOps: BatchOperation[];
  batchLoading: boolean;
  batchExecLoading: boolean;
  onBatchExecute: (values: any) => void;
  onBatchRefresh: () => void;

  // FileTab
  fileColumns: TableColumnsType<FileInfo>;
  files: FileInfo[];
  fileLoading: boolean;
  onFileRefresh: () => void;
  onFileUpload: () => void;

  // ConfigTab
  themeColumns: TableColumnsType<ThemeConfig>;
  themes: ThemeConfig[];
  themeLoading: boolean;
  onNewTheme: () => void;
  licenses: LicenseInfo[];
  moduleColumns: TableColumnsType<SystemModule>;
  modules: SystemModule[];
  moduleLoading: boolean;
  threadPools: ThreadPool[];

  // AuditTab
  auditEvents: AuditEvent[];
  auditPage: number;
  auditTotal: number;
  onAuditPageChange: (page: number) => void;
  onAuditRefresh: () => void;

  // LogTab
  logs: LogEntry[];
  logTotal: number;
  logLevel: string | undefined;
  onLogLevelChange: (v: string | undefined) => void;
  logService: string | undefined;
  onLogServiceChange: (v: string | undefined) => void;
  onLogRefresh: () => void;
}

export function buildTabItems(ctx: TabItemsCtx): TabsProps['items'] {
  return [
    {
      key: 'cron',
      label: tabConfig[0]!.label,
      children: (
        <CronTab
          cronColumns={ctx.cronColumns}
          cronJobs={ctx.cronJobs}
          cronLoading={ctx.cronLoading}
          onRefresh={ctx.onCronRefresh}
          onCreate={ctx.onCronCreate}
        />
      ),
    },
    {
      key: 'db',
      label: tabConfig[1]!.label,
      children: (
        <DbTab
          dumps={ctx.dumps}
          fragments={ctx.fragments}
          indexes={ctx.indexes}
          dumpRunning={ctx.dumpRunning}
          indexColumns={ctx.indexColumns}
          onSqlDump={ctx.onSqlDump}
          onCreateIndex={ctx.onCreateIndex}
        />
      ),
    },
    {
      key: 'mq',
      label: tabConfig[2]!.label,
      // 原代码: onClick={loadDBTools} — 保持原样
      children: <MqTab onRefresh={ctx.onMqRefresh} />,
    },
    {
      key: 'tagent',
      label: tabConfig[3]!.label,
      children: (
        <TagentTab
          tagentColumns={ctx.tagentColumns}
          tagentClients={ctx.tagentClients}
          tagentStats={ctx.tagentStats}
          tagentLoading={ctx.tagentLoading}
          onRefresh={ctx.onTagentRefresh}
        />
      ),
    },
    {
      key: 'batch',
      label: tabConfig[4]!.label,
      children: (
        <BatchTab
          batchForm={ctx.batchForm}
          batchOps={ctx.batchOps}
          batchLoading={ctx.batchLoading}
          batchExecLoading={ctx.batchExecLoading}
          onExecute={ctx.onBatchExecute}
          onRefresh={ctx.onBatchRefresh}
        />
      ),
    },
    {
      key: 'file',
      label: tabConfig[5]!.label,
      children: (
        <FileTab
          fileColumns={ctx.fileColumns}
          files={ctx.files}
          fileLoading={ctx.fileLoading}
          onRefresh={ctx.onFileRefresh}
          onUpload={ctx.onFileUpload}
        />
      ),
    },
    {
      key: 'config',
      label: tabConfig[6]!.label,
      children: (
        <ConfigTab
          themeColumns={ctx.themeColumns}
          themes={ctx.themes}
          themeLoading={ctx.themeLoading}
          onNewTheme={ctx.onNewTheme}
          licenses={ctx.licenses}
          moduleColumns={ctx.moduleColumns}
          modules={ctx.modules}
          moduleLoading={ctx.moduleLoading}
          threadPools={ctx.threadPools}
        />
      ),
    },
    {
      key: 'audit',
      label: tabConfig[7]!.label,
      children: (
        <AuditTab
          auditEvents={ctx.auditEvents}
          auditPage={ctx.auditPage}
          auditTotal={ctx.auditTotal}
          onPageChange={ctx.onAuditPageChange}
          onRefresh={ctx.onAuditRefresh}
        />
      ),
    },
    {
      key: 'logs',
      label: tabConfig[8]!.label,
      children: (
        <LogTab
          logs={ctx.logs}
          logTotal={ctx.logTotal}
          logLevel={ctx.logLevel}
          onLogLevelChange={ctx.onLogLevelChange}
          logService={ctx.logService}
          onLogServiceChange={ctx.onLogServiceChange}
          onRefresh={ctx.onLogRefresh}
        />
      ),
    },
  ];
}
