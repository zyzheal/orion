/**
 * useApkUploadHistoryState.ts - APK 上传历史 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 215)
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  getApkUploadHistory,
  getRecentFailures,
  getApkUploadStats,
  type ApkUploadRecord,
  type ApkUploadStatus,
} from '@/api/apk-upload-history';

export function useApkUploadHistoryState() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ApkUploadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [recentFailures, setRecentFailures] = useState<ApkUploadRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    failed: 0,
    uploading: 0,
  });
  const [filters, setFilters] = useState<{
    market?: string;
    status?: ApkUploadStatus;
  }>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });

  const tenantId = useAuthStore((state) => (state.user as { tenantId?: string } | null)?.tenantId) || 'default-tenant';

  useEffect(() => {
    loadHistory();
    loadRecentFailures();
    loadStats();
  }, [tenantId, pagination.current, pagination.pageSize, filters]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const offset = (pagination.current - 1) * pagination.pageSize;
      const response = await getApkUploadHistory(tenantId, {
        limit: pagination.pageSize,
        offset,
        market: filters.market,
        status: filters.status,
      });

      const resData = response.data as { data?: { data?: ApkUploadRecord[]; total?: number } };
      const data = Array.isArray(resData.data) ? resData.data : [];
      setRecords(data);
      setTotal(resData?.data?.total ?? 0);
    } catch (error) {
      console.error('Failed to load upload history:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentFailures = async () => {
    try {
      const response = await getRecentFailures(tenantId, 5);
      const resData = response.data as { data?: { data?: ApkUploadRecord[] } };
      setRecentFailures(Array.isArray(resData.data) ? resData.data : []);
    } catch (error) {
      console.error('Failed to load recent failures:', error);
      setRecentFailures([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getApkUploadStats(tenantId);
      const resData = response.data as {
        data?: {
          data?: { total?: number; published?: number; failed?: number; uploading?: number };
        };
      };
      if (resData?.data?.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = resData.data as any;
        setStats({
          total: d.total,
          published: d.published,
          failed: d.failed,
          uploading: d.uploading,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleTableChange = (newPagination: { current?: number; pageSize?: number }) => {
    setPagination({
      current: newPagination.current ?? 1,
      pageSize: newPagination.pageSize ?? 20,
    });
  };

  // Statistics - use total data from stats API, not current page
  const displayStats = {
    total: stats.total,
    published: stats.published,
    failed: stats.failed,
    uploading: stats.uploading,
  };

  return {
    loading,
    records,
    total,
    recentFailures,
    stats,
    displayStats,
    filters,
    setFilters,
    pagination,
    setPagination,
    loadHistory,
    loadRecentFailures,
    loadStats,
    handleTableChange,
  };
}
