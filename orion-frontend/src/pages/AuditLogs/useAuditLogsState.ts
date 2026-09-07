/**
 * AuditLogs state hook
 * 抽取自 index.tsx (P2-9 Phase 186)
 */
import { useState, useEffect } from 'react';
import { Form, Modal, message } from 'antd';
import {
  getAuditLogs,
  getRunAuditTrail,
  cleanupAuditLogs,
  type PipelineAuditLog,
  type AuditLogFilter,
  type AuditTrailEntry,
} from '@/api/audit-logs';
import { PAGE_SIZE } from './constants';

export const useAuditLogsState = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<PipelineAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<PipelineAuditLog | null>(null);
  const [trail, setTrail] = useState<PipelineAuditLog[] | AuditTrailEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [form] = Form.useForm();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const params: AuditLogFilter = {
        ...(values.runId && { runId: values.runId }),
        ...(values.action && { action: values.action }),
        ...(values.outcome && { outcome: values.outcome }),
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      };
      if (values.dateRange && values.dateRange.length === 2) {
        params.startTime = values.dateRange[0].toISOString();
        params.endTime = values.dateRange[1].toISOString();
      }
      const res = await getAuditLogs(params);
      setLogs(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {
      message.error('加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    loadLogs();
  };

  const handleReset = () => {
    form.resetFields();
    setPage(1);
    loadLogs();
  };

  const handleViewDetail = async (log: PipelineAuditLog) => {
    if (!log.runId) {
      message.warning('该日志缺少 Run ID，无法查看轨迹');
      return;
    }
    setSelectedLog(log);
    setDetailVisible(true);
    try {
      const res = await getRunAuditTrail(log.runId);
      setTrail(res.data || []);
    } catch {
      setTrail([]);
    }
  };

  const handleCleanup = () => {
    Modal.confirm({
      title: '清理过期日志',
      content: `将删除 ${retentionDays} 天前的审计日志，确认继续？`,
      okText: '清理',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await cleanupAuditLogs(retentionDays);
          message.success(`已清理 ${res.data?.deleted || 0} 条日志`);
          loadLogs();
        } catch {
          message.error('清理失败');
        }
      },
    });
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedLog(null);
  };

  return {
    loading,
    logs,
    total,
    page,
    detailVisible,
    selectedLog,
    trail,
    retentionDays,
    form,
    loadLogs,
    setPage,
    setRetentionDays,
    handleSearch,
    handleReset,
    handleViewDetail,
    handleCleanup,
    closeDetail,
  };
};
