/**
 * usePipelineListState - Pipeline 列表状态管理
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import dayjs from 'dayjs';
import { usePermissionActions } from '@/hooks/usePermissionActions';
import { usePagination } from '@/hooks/usePagination';
import { getPipelines, deletePipeline, triggerPipeline } from '@/api/pipelines';
import type { Pipeline } from '@/api/pipelines';
import type { PipelineListFilters, SavedView } from './types';
import { DEFAULT_COLUMN_VISIBLE, SAVED_VIEWS_STORAGE_KEY } from './constants';

export const usePipelineListState = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit } = usePermissionActions('pipeline');

  // ---- 搜索与筛选 ----
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<PipelineListFilters>(() => {
    try {
      const saved = searchParams.get('filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [columnVisible, setColumnVisible] = useState<Record<string, boolean>>(
    DEFAULT_COLUMN_VISIBLE
  );

  // ---- 视图管理 ----
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_VIEWS_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewName, setViewName] = useState('');

  // ---- 批量操作 ----
  const [batchLoading, setBatchLoading] = useState(false);

  // ---- 数据获取（使用 usePagination 统一分页）----
  const {
    data: pipelines,
    total,
    loading,
    page,
    pageSize,
    setPage,
    setPageSize,
    refresh,
  } = usePagination<Pipeline>(
    async (p, ps) => {
      const result = await getPipelines({
        page: p,
        pageSize: ps,
        name: searchQuery,
        status: filters.status,
      });
      // 兼容不同响应格式 — client 拦截器已解包 response.data
      const response = result as unknown as {
        data?: Pipeline[];
        total?: number;
        items?: Pipeline[];
      };
      return {
        data: response.data || response.items || [],
        total: response.total || 0,
      };
    },
    { pageSize: 20, deps: [searchQuery, filters] }
  );

  // ---- 同步筛选条件到 URL ----
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (Object.keys(filters).length > 0) params.set('filters', JSON.stringify(filters));
    setSearchParams(params, { replace: true });
  }, [searchQuery, filters, setSearchParams]);

  // ---- 事件处理 ----
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deletePipeline(id);
        message.success('Pipeline 已删除');
        refresh();
      } catch (err: unknown) {
        const error = err as Error;
        message.error(`删除失败：${error.message}`);
      }
    },
    [refresh]
  );

  const handleBatchDelete = useCallback(async () => {
    setBatchLoading(true);
    try {
      await Promise.all(selectedRowKeys.map((id) => deletePipeline(id)));
      message.success(`已删除 ${selectedRowKeys.length} 个 Pipeline`);
      setSelectedRowKeys([]);
      refresh();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(`批量删除失败：${error.message}`);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedRowKeys, refresh]);

  const handleBatchTrigger = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    let succeeded = 0;
    let failed = 0;
    for (const id of selectedRowKeys) {
      try {
        await Promise.race([
          triggerPipeline(id),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
        ]);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    setBatchLoading(false);
    if (failed === 0) {
      message.success(`已成功触发 ${succeeded} 个 Pipeline`);
    } else {
      message.warning(`触发完成：${succeeded} 成功，${failed} 失败`);
    }
    refresh();
  }, [selectedRowKeys, refresh]);

  const handleExport = useCallback(() => {
    try {
      const dataStr = JSON.stringify(pipelines, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pipelines-export-${dayjs().format('YYYY-MM-DD')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  }, [pipelines]);

  const handleSaveView = useCallback(() => {
    if (!viewName.trim()) {
      message.warning('请输入视图名称');
      return;
    }
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      name: viewName.trim(),
      filters,
      columns: Object.keys(columnVisible),
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(updated));
    setViewModalVisible(false);
    setViewName('');
    message.success('视图已保存');
  }, [viewName, filters, columnVisible, savedViews]);

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters);
    setColumnVisible(view.columns.reduce((acc, col) => ({ ...acc, [col]: true }), {}));
    message.success(`已应用视图：${view.name}`);
  }, []);

  return {
    navigate,
    canEdit,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    selectedRowKeys,
    setSelectedRowKeys,
    columnVisible,
    setColumnVisible,
    savedViews,
    setSavedViews,
    viewModalVisible,
    setViewModalVisible,
    viewName,
    setViewName,
    batchLoading,
    pipelines,
    total,
    loading,
    page,
    pageSize,
    setPage,
    setPageSize,
    refresh,
    handleDelete,
    handleBatchDelete,
    handleBatchTrigger,
    handleExport,
    handleSaveView,
    handleApplyView,
  };
};

export type PipelineListState = ReturnType<typeof usePipelineListState>;
