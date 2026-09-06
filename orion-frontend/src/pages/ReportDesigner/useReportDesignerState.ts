/**
 * useReportDesignerState.ts - Report Designer 状态 Hook
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 51)
 * 全部 state + 4 loaders (reports/datasources/schedules/executions)
 * + 12 handlers (report/datasource/schedule CRUD + preview + execute)
 * 表单 validateFields 由主页面 wrapper 负责，本 hook handler 接收 values/ID
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import {
  listReports,
  createReport,
  updateReport,
  deleteReport,
  previewReport,
  executeReport,
  getReportExecutions,
  listDatasources,
  createDatasource,
  updateDatasource,
  deleteDatasource,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ReportDefinition,
  type ReportDatasource,
  type ReportSchedule,
  type ReportExecution,
  type CreateReportInput,
  type CreateDatasourceInput,
  type CreateScheduleInput,
} from '@/api/reports';

// ============================================================================
// Input Types (loose form values; cast to strict API types at API boundary)
// ============================================================================

export interface SaveReportInput {
  name: string;
  description?: string;
  category?: string;
}

export interface SaveDatasourceInput {
  name: string;
  type: string;
  connectionConfig?: string;
  enabled?: boolean;
}

export interface SaveScheduleInput {
  reportId: string;
  cronExpression: string;
  exportFormat: string;
  recipients: string;
  enabled?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export const useReportDesignerState = () => {
  // --- State ---
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [datasources, setDatasources] = useState<ReportDatasource[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('reports');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  // Report modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportConfirmLoading, setReportConfirmLoading] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportDefinition | null>(null);

  // Datasource modal
  const [datasourceModalVisible, setDatasourceModalVisible] = useState(false);
  const [editingDatasource, setEditingDatasource] = useState<ReportDatasource | null>(null);

  // Schedule modal
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);

  // Preview drawer
  const [previewDrawerVisible, setPreviewDrawerVisible] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [selectedReportForPreview, setSelectedReportForPreview] = useState<ReportDefinition | null>(
    null,
  );

  // ============================================================================
  // Data Loaders
  // ============================================================================

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReports(categoryFilter ? { category: categoryFilter } : undefined);
      setReports(res.data ?? []);
    } catch {
      message.error('获取报表列表失败');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const fetchDatasources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDatasources();
      setDatasources(res.data ?? []);
    } catch {
      message.error('获取数据源列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSchedules();
      setSchedules(res.data ?? []);
    } catch {
      message.error('获取调度列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReportExecutions(undefined, 100);
      setExecutions(res.data ?? []);
    } catch {
      message.error('获取执行历史失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
    else if (activeTab === 'datasources') fetchDatasources();
    else if (activeTab === 'schedules') fetchSchedules();
    else if (activeTab === 'executions') fetchExecutions();
  }, [activeTab, categoryFilter, fetchReports, fetchDatasources, fetchSchedules, fetchExecutions]);

  // ============================================================================
  // Report Handlers
  // ============================================================================

  const handleCreateReport = () => {
    setEditingReport(null);
    setReportModalVisible(true);
  };

  const handleEditReport = (record: ReportDefinition) => {
    setEditingReport(record);
    setReportModalVisible(true);
  };

  const handleSaveReport = async (values: SaveReportInput) => {
    setReportConfirmLoading(true);
    try {
      const input: CreateReportInput = {
        name: values.name,
        description: values.description,
        category: values.category,
      };
      if (editingReport) {
        await updateReport(editingReport.id, input);
        message.success('报表更新成功');
      } else {
        await createReport(input);
        message.success('报表创建成功');
      }
      setReportModalVisible(false);
      fetchReports();
    } catch {
      message.error('保存失败');
    } finally {
      setReportConfirmLoading(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteReport(id);
      message.success('报表删除成功');
      fetchReports();
    } catch {
      message.error('删除失败');
    }
  };

  const handlePreviewReport = async (record: ReportDefinition) => {
    setSelectedReportForPreview(record);
    setPreviewDrawerVisible(true);
    try {
      const res = await previewReport(record.id);
      setPreviewData(res.data ?? null);
    } catch {
      setPreviewData(null);
    }
  };

  const handleExecuteReport = async (id: string) => {
    try {
      await executeReport(id, { triggeredBy: 'ui' });
      message.success('报表执行已启动');
    } catch {
      message.error('执行失败');
    }
  };

  // ============================================================================
  // Datasource Handlers
  // ============================================================================

  const handleCreateDatasource = () => {
    setEditingDatasource(null);
    setDatasourceModalVisible(true);
  };

  const handleEditDatasource = (record: ReportDatasource) => {
    setEditingDatasource(record);
    setDatasourceModalVisible(true);
  };

  const handleSaveDatasource = async (values: SaveDatasourceInput) => {
    let config: Record<string, unknown> = {};
    try {
      config = values.connectionConfig ? JSON.parse(values.connectionConfig) : {};
    } catch {
      message.error('连接配置格式错误，请输入合法 JSON');
      return;
    }
    const input: CreateDatasourceInput = {
      name: values.name,
      type: values.type as CreateDatasourceInput['type'],
      connectionConfig: config,
    };
    try {
      if (editingDatasource) {
        await updateDatasource(editingDatasource.id, input);
        message.success('数据源更新成功');
      } else {
        await createDatasource(input);
        message.success('数据源创建成功');
      }
      setDatasourceModalVisible(false);
      fetchDatasources();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteDatasource = async (id: string) => {
    try {
      await deleteDatasource(id);
      message.success('数据源删除成功');
      fetchDatasources();
    } catch {
      message.error('删除失败');
    }
  };

  // ============================================================================
  // Schedule Handlers
  // ============================================================================

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setScheduleModalVisible(true);
  };

  const handleEditSchedule = (record: ReportSchedule) => {
    setEditingSchedule(record);
    setScheduleModalVisible(true);
  };

  const handleSaveSchedule = async (values: SaveScheduleInput) => {
    const recipients = (values.recipients as string)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const input: CreateScheduleInput = {
      reportId: values.reportId,
      cronExpression: values.cronExpression,
      exportFormat: values.exportFormat as CreateScheduleInput['exportFormat'],
      recipients,
      enabled: values.enabled,
    };
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, input);
        message.success('调度更新成功');
      } else {
        await createSchedule(input);
        message.success('调度创建成功');
      }
      setScheduleModalVisible(false);
      fetchSchedules();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteSchedule(id);
      message.success('调度删除成功');
      fetchSchedules();
    } catch {
      message.error('删除失败');
    }
  };

  return {
    // State
    reports, setReports,
    datasources, setDatasources,
    schedules, setSchedules,
    executions, setExecutions,
    loading, setLoading,
    activeTab, setActiveTab,
    categoryFilter, setCategoryFilter,
    reportModalVisible, setReportModalVisible,
    reportConfirmLoading, setReportConfirmLoading,
    editingReport, setEditingReport,
    datasourceModalVisible, setDatasourceModalVisible,
    editingDatasource, setEditingDatasource,
    scheduleModalVisible, setScheduleModalVisible,
    editingSchedule, setEditingSchedule,
    previewDrawerVisible, setPreviewDrawerVisible,
    previewData, setPreviewData,
    selectedReportForPreview, setSelectedReportForPreview,
    // Loaders
    fetchReports, fetchDatasources, fetchSchedules, fetchExecutions,
    // Report handlers
    handleCreateReport, handleEditReport, handleSaveReport,
    handleDeleteReport, handlePreviewReport, handleExecuteReport,
    // Datasource handlers
    handleCreateDatasource, handleEditDatasource, handleSaveDatasource,
    handleDeleteDatasource,
    // Schedule handlers
    handleCreateSchedule, handleEditSchedule, handleSaveSchedule,
    handleDeleteSchedule,
  };
};
