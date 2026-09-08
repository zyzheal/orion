/**
 * useAuditLogState.ts - 审计日志状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 208)
 */
import { useState } from 'react';
import { message } from 'antd';
import {
  getAuditLogs,
  getChainInfo,
  verifyChain,
  getStorageStats,
  generateReport,
  type AuditLogEntry,
  type ChainInfo,
  type StorageStats,
} from '@/api/audit';

export function useAuditLogState() {
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, chainRes, storageRes] = await Promise.all([
        getAuditLogs({ limit: 50 }),
        getChainInfo(),
        getStorageStats(),
      ]);
      setAuditLogs(logsRes.data.entries || []);
      setChainInfo(chainRes.data);
      setStorageStats(storageRes.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载审计日志失败：${error.message}`);
      } else {
        message.error('加载审计日志失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verifyChain();
      if (result.data.result.isValid) {
        message.success('审计链完整性验证通过');
      } else {
        message.warning(`发现 ${result.data.result.breaks?.length || 0} 处链断裂`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`验证失败：${error.message}`);
      } else {
        message.error('验证失败，请稍后重试');
      }
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateReport();
      message.success('完整性报告已生成');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`生成报告失败：${error.message}`);
      } else {
        message.error('生成报告失败，请稍后重试');
      }
    }
  };

  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => setDrawerOpen(false);

  return {
    loading,
    auditLogs,
    chainInfo,
    storageStats,
    selectedLog,
    drawerOpen,
    loadData,
    handleVerify,
    handleGenerateReport,
    handleViewDetail,
    handleCloseDrawer,
  };
}
