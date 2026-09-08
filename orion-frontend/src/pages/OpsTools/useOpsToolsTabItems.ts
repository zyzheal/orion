import { useMemo } from 'react';
import { Form } from 'antd';
import { useOpsToolsData } from './useOpsToolsData';
import { buildTabItems } from './tabItems';

interface Props {
  d: ReturnType<typeof useOpsToolsData>;
  cronForm: ReturnType<typeof Form.useForm>[0];
  indexForm: ReturnType<typeof Form.useForm>[0];
  batchForm: ReturnType<typeof Form.useForm>[0];
  uploadForm: ReturnType<typeof Form.useForm>[0];
  distributeForm: ReturnType<typeof Form.useForm>[0];
  themeForm: ReturnType<typeof Form.useForm>[0];
  cronColumns: any;
  indexColumns: any;
  tagentColumns: any;
  fileColumns: any;
  themeColumns: any;
  moduleColumns: any;
}

export function useOpsToolsTabItems(p: Props) {
  const { d, cronForm, batchForm, uploadForm, themeForm, cronColumns, indexColumns, tagentColumns, fileColumns, themeColumns, moduleColumns } = p;

  return useMemo(
    () =>
      buildTabItems({
        cronColumns,
        cronJobs: d.cronJobs,
        cronLoading: d.cronLoading,
        onCronRefresh: d.loadCronJobs,
        onCronCreate: () => {
          d.setCronEditingJob(null);
          cronForm.resetFields();
          d.setCronModalOpen(true);
        },

        dumps: d.dumps,
        fragments: d.fragments,
        indexes: d.indexes,
        dumpRunning: d.dumpRunning,
        indexColumns,
        onSqlDump: d.handleSqlDump,
        onCreateIndex: () => d.setIndexModalOpen(true),
        onMqRefresh: d.loadDBTools,

        tagentColumns,
        tagentClients: d.tagentClients,
        tagentStats: d.tagentStats,
        tagentLoading: d.tagentLoading,
        onTagentRefresh: d.loadTagent,

        batchForm,
        batchOps: d.batchOps,
        batchLoading: d.batchLoading,
        batchExecLoading: d.batchExecLoading,
        onBatchExecute: d.handleBatchExecute,
        onBatchRefresh: d.loadBatchOps,

        fileColumns,
        files: d.files,
        fileLoading: d.fileLoading,
        onFileRefresh: d.loadFiles,
        onFileUpload: () => {
          uploadForm.resetFields();
          d.setUploadModalOpen(true);
        },

        themeColumns,
        themes: d.themes,
        themeLoading: d.themeLoading,
        onNewTheme: () => {
          themeForm.resetFields();
          d.setThemeModalOpen(true);
        },
        licenses: d.licenses,
        moduleColumns,
        modules: d.modules,
        moduleLoading: d.moduleLoading,
        threadPools: d.threadPools,

        auditEvents: d.auditEvents,
        auditPage: d.auditPage,
        auditTotal: d.auditTotal,
        onAuditPageChange: d.loadAudit,
        onAuditRefresh: () => d.loadAudit(d.auditPage),

        logs: d.logs,
        logTotal: d.logTotal,
        logLevel: d.logLevel,
        onLogLevelChange: d.setLogLevel,
        logService: d.logService,
        onLogServiceChange: d.setLogService,
        onLogRefresh: d.loadLogs,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cronColumns,
      indexColumns,
      tagentColumns,
      fileColumns,
      themeColumns,
      moduleColumns,
      d,
    ],
  );
}
