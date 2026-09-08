/**
 * PermissionAudit state hook
 * 抽取自 index.tsx (P2-9 Phase 192)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  queryDeniedLogs,
  queryDeniedStats,
  getAnomalies,
  getHighRiskUsers,
  type AuditLogEntry,
  type AuditStats,
  type UEBAAnomaly,
  type UEBARiskUser,
} from '@/api/permission-audit';

export const usePermissionAuditState = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(100);
  const [hours, setHours] = useState(24);

  const [anomalies, setAnomalies] = useState<UEBAAnomaly[]>([]);
  const [riskUsers, setRiskUsers] = useState<UEBARiskUser[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await queryDeniedLogs(limit);
      setLogs(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      message.error('获取审计日志失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await queryDeniedStats(hours);
      setStats(res.data);
    } catch (err: unknown) {
      message.error('获取统计信息失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const fetchAnomalies = async () => {
    try {
      const [anomalyRes, riskRes] = await Promise.all([
        getAnomalies(hours),
        getHighRiskUsers(hours, 10),
      ]);
      setAnomalies(anomalyRes || []);
      setRiskUsers(riskRes || []);
    } catch (err: unknown) {
      message.error('获取 UEBA 数据失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchAnomalies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, hours]);

  const refreshAll = () => {
    fetchStats();
    fetchAnomalies();
  };

  return {
    loading,
    logs,
    stats,
    total,
    limit,
    hours,
    anomalies,
    riskUsers,
    fetchLogs,
    setLimit,
    setHours,
    refreshAll,
  };
};
