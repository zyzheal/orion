/**
 * usePipelineListState.ts - Pipeline List 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 217)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import { getPipelines, triggerPipeline, type Pipeline } from '@/api/pipelines';
import { useNavigate } from 'react-router-dom';

export function usePipelineListState() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [runModalVisible, setRunModalVisible] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [runBranch, setRunBranch] = useState('main');
  const [variablesText, setVariablesText] = useState('{}');
  const [running, setRunning] = useState(false);

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPipelines();
      // wrapper: {success, data: {data: [...], total}, meta}
      const payload = response.data as { data?: Pipeline[]; total?: number };
      setPipelines(Array.isArray(payload) ? payload : payload.data || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Pipeline 列表失败：${error.message}`);
      } else {
        message.error('加载 Pipeline 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // Filter pipelines based on search and filters
  const filteredPipelines = useMemo(
    () =>
      pipelines.filter((pipeline) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const searchable = [pipeline.name, pipeline.version, pipeline.description || '']
            .join(' ')
            .toLowerCase();
          if (!searchable.includes(query)) return false;
        }
        // Status filter
        const statusFilter = filters.status;
        if (statusFilter && statusFilter !== 'all' && pipeline.status !== statusFilter) {
          return false;
        }
        return true;
      }),
    [pipelines, searchQuery, filters]
  );

  // Filter definitions for SearchFilterBar
  const filterDefs: FilterDefinition[] = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '启用', value: 'active' },
          { label: '停用', value: 'inactive' },
          { label: '已删除', value: 'deleted' },
        ],
      },
    ],
    []
  );

  // Handle run pipeline
  const handleRun = useCallback((record: Pipeline) => {
    setSelectedPipeline(record);
    setRunBranch('main');
    setRunModalVisible(true);
  }, []);

  const confirmRun = useCallback(async () => {
    if (!selectedPipeline) return;
    setRunning(true);
    try {
      let variables: Record<string, string> = {};
      try {
        variables = JSON.parse(variablesText);
      } catch {
        message.error('参数格式错误，请输入有效的 JSON');
        setRunning(false);
        return;
      }
      const response = await triggerPipeline(selectedPipeline.id, { branch: runBranch, variables });
      const wrapperData = response.data as { data?: { id?: string } };
      const apiData = wrapperData?.data ?? wrapperData;
      const runId = (apiData as { id?: string }).id;
      message.success(`Pipeline "${selectedPipeline.name}" 已触发运行`);
      setRunModalVisible(false);
      if (runId) {
        navigate(`/pipelines/${selectedPipeline.id}/runs/${runId}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`触发运行失败：${error.message}`);
      } else {
        message.error('触发运行失败，请稍后重试');
      }
    } finally {
      setRunning(false);
    }
  }, [selectedPipeline, variablesText, runBranch, navigate]);

  const handleRefresh = useCallback(() => loadPipelines(), [loadPipelines]);

  const handleCreate = useCallback(() => navigate('/pipelines/new'), [navigate]);
  const handleView = useCallback(
    (record: Pipeline) => navigate(`/pipelines/${record.id}`),
    [navigate]
  );
  const handleEdit = useCallback(
    (record: Pipeline) => navigate(`/pipelines/${record.id}/edit`),
    [navigate]
  );
  const handleViewRuns = useCallback(
    (record: Pipeline) => navigate(`/pipelines/${record.id}/runs`),
    [navigate]
  );

  const handleClearSelection = useCallback(() => setSelectedRowKeys([]), []);

  return {
    // State
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    loading,
    pipelines,
    filteredPipelines,
    selectedRowKeys,
    setSelectedRowKeys,
    runModalVisible,
    setRunModalVisible,
    selectedPipeline,
    runBranch,
    setRunBranch,
    variablesText,
    setVariablesText,
    running,
    filterDefs,
    // Actions
    loadPipelines,
    handleRefresh,
    handleRun,
    confirmRun,
    handleCreate,
    handleView,
    handleEdit,
    handleViewRuns,
    handleClearSelection,
  };
}
