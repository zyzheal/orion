/**
 * useProblemState - Problem 页面状态 + 加载器 + CRUD/状态/关联/KEDB 处理器
 * 从 index.tsx 抽离 4 loader + 12 handler + statCards
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  updateProblemStatus,
  linkIncident,
  linkChange,
  getKnownErrors,
  createKnownError,
  updateKnownError,
  deleteKnownError,
  searchKnownErrors,
  getProblemStats,
} from '@/api/problem';
import type { Problem, KnownError, ProblemStats } from '@/api/problem';
import { KEDB_DEFAULT_PAGE_SIZE, statusConfig } from './config';

export const useProblemState = () => {
  // ---- Tab + list state ----
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [stats, setStats] = useState<ProblemStats | null>(null);

  // Filters
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Selected problem for detail view
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [linkIncidentModalVisible, setLinkIncidentModalVisible] = useState(false);
  const [linkChangeModalVisible, setLinkChangeModalVisible] = useState(false);

  // KEDB state
  const [knownErrors, setKnownErrors] = useState<KnownError[]>([]);
  const [kedbLoading, setKedbLoading] = useState(false);
  const [kedbTotal, setKedbTotal] = useState(0);
  const [kedbPage, setKedbPage] = useState(1);
  const [kedbPageSize, setKedbPageSize] = useState(KEDB_DEFAULT_PAGE_SIZE);
  const [kedbFilters, setKedbFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [kedbModalVisible, setKedbModalVisible] = useState(false);
  const [kedbEditModalVisible, setKedbEditModalVisible] = useState(false);
  const [editingKnownError, setEditingKnownError] = useState<KnownError | null>(null);

  // Operation loading
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);

  // ============================================================================
  // Loaders
  // ============================================================================

  const loadProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;

      const result = await getProblems(params);
      let data = result.data || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        data = data.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)
        );
      }
      setProblems(data);
      setTotalProblems(result.total || data.length);
    } catch (error) {
      message.error('加载问题列表失败');
      console.error('Failed to load problems:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters, searchQuery]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getProblemStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  const loadKnownErrors = useCallback(async () => {
    setKedbLoading(true);
    try {
      const kedbSearchQuery = (kedbFilters.kedbSearch as string) || '';
      const kedbStatus = kedbFilters.kedbStatus as string | undefined;
      if (kedbSearchQuery) {
        const data = await searchKnownErrors(kedbSearchQuery);
        setKnownErrors(data);
        setKedbTotal(data.length);
      } else {
        const params: Record<string, unknown> = {
          limit: kedbPageSize,
          offset: (kedbPage - 1) * kedbPageSize,
        };
        if (kedbStatus) params.status = kedbStatus;
        const result = await getKnownErrors(params);
        setKnownErrors(result.data || []);
        setKedbTotal(result.total || 0);
      }
    } catch (error) {
      message.error('加载已知错误数据库失败');
      console.error('Failed to load known errors:', error);
    } finally {
      setKedbLoading(false);
    }
  }, [kedbPage, kedbPageSize, kedbFilters]);

  const loadProblemDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await getProblem(id);
      setSelectedProblem(data);
    } catch (error) {
      message.error('加载问题详情失败');
      console.error('Failed to load problem detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Effects
  useEffect(() => { loadProblems(); }, [loadProblems]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    if (activeTab === 'kedb') loadKnownErrors();
  }, [activeTab, loadKnownErrors]);

  // ============================================================================
  // Problem CRUD + Status + Link Handlers
  // ============================================================================

  const handleCreate = async (values: any) => {
    try {
      await createProblem({
        title: values.title,
        description: values.description,
        severity: values.severity,
        category: values.category,
        assignedTo: values.assigned_to,
      });
      message.success('问题创建成功');
      setCreateModalVisible(false);
      loadProblems();
      loadStats();
    } catch (error) {
      message.error('创建问题失败');
      console.error('Failed to create problem:', error);
    }
  };

  const handleEdit = async (values: any) => {
    if (!selectedProblem) return;
    try {
      await updateProblem(selectedProblem.id, {
        title: values.title,
        description: values.description,
        severity: values.severity,
        category: values.category,
        assigned_to: values.assigned_to,
        root_cause: values.root_cause,
        workaround: values.workaround,
        resolution: values.resolution,
      });
      message.success('问题更新成功');
      setEditModalVisible(false);
      loadProblems();
      loadProblemDetail(selectedProblem.id);
    } catch (error) {
      message.error('更新问题失败');
      console.error('Failed to update problem:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProblem(id);
      message.success('问题已删除');
      if (selectedProblem?.id === id) {
        setSelectedProblem(null);
        setActiveTab('list');
      }
      loadProblems();
      loadStats();
    } catch (error) {
      message.error('删除问题失败');
      console.error('Failed to delete problem:', error);
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!selectedProblem) return;
    setStatusUpdating(true);
    try {
      const updated = await updateProblemStatus(selectedProblem.id, newStatus);
      setSelectedProblem(updated);
      message.success(`问题状态已更新为: ${statusConfig[newStatus]?.label || newStatus}`);
      loadProblems();
      loadStats();
    } catch (error) {
      message.error('更新状态失败');
      console.error('Failed to update status:', error);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleLinkIncident = async (incidentId: string) => {
    if (!selectedProblem) return;
    setLinkingLoading(true);
    try {
      const updated = await linkIncident(selectedProblem.id, incidentId);
      setSelectedProblem(updated);
      message.success('关联事件成功');
      setLinkIncidentModalVisible(false);
    } catch (error) {
      message.error('关联事件失败');
      console.error('Failed to link incident:', error);
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleLinkChange = async (changeId: string) => {
    if (!selectedProblem) return;
    setLinkingLoading(true);
    try {
      const updated = await linkChange(selectedProblem.id, changeId);
      setSelectedProblem(updated);
      message.success('关联变更成功');
      setLinkChangeModalVisible(false);
    } catch (error) {
      message.error('关联变更失败');
      console.error('Failed to link change:', error);
    } finally {
      setLinkingLoading(false);
    }
  };

  // ============================================================================
  // KEDB CRUD Handlers
  // ============================================================================

  const handleCreateKnownError = async (values: any) => {
    try {
      await createKnownError({
        title: values.title,
        description: values.description,
        symptoms: values.symptoms,
        root_cause: values.root_cause,
        workaround: values.workaround,
        keywords: values.keywords
          ? values.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
          : [],
        problem_id: values.problem_id,
      });
      message.success('已知错误创建成功');
      setKedbModalVisible(false);
      loadKnownErrors();
    } catch (error) {
      message.error('创建已知错误失败');
      console.error('Failed to create known error:', error);
    }
  };

  const handleEditKnownError = async (values: any) => {
    if (!editingKnownError) return;
    try {
      await updateKnownError(editingKnownError.id, {
        title: values.title,
        description: values.description,
        symptoms: values.symptoms,
        root_cause: values.root_cause,
        workaround: values.workaround,
        keywords: values.keywords
          ? values.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
          : [],
        status: values.status,
      });
      message.success('已知错误更新成功');
      setKedbEditModalVisible(false);
      setEditingKnownError(null);
      loadKnownErrors();
    } catch (error) {
      message.error('更新已知错误失败');
      console.error('Failed to update known error:', error);
    }
  };

  const handleDeleteKnownError = async (id: string) => {
    try {
      await deleteKnownError(id);
      message.success('已知错误已删除');
      loadKnownErrors();
    } catch (error) {
      message.error('删除已知错误失败');
      console.error('Failed to delete known error:', error);
    }
  };

  // ============================================================================
  // View + open-modal helpers
  // ============================================================================

  const handleViewDetail = (problem: Problem) => {
    loadProblemDetail(problem.id);
    setActiveTab('detail');
  };

  return {
    // state
    activeTab,
    setActiveTab,
    loading,
    problems,
    totalProblems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    stats,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    selectedProblem,
    setSelectedProblem,
    detailLoading,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    linkIncidentModalVisible,
    setLinkIncidentModalVisible,
    linkChangeModalVisible,
    setLinkChangeModalVisible,
    knownErrors,
    kedbLoading,
    kedbTotal,
    kedbPage,
    setKedbPage,
    kedbPageSize,
    setKedbPageSize,
    kedbFilters,
    setKedbFilters,
    kedbModalVisible,
    setKedbModalVisible,
    kedbEditModalVisible,
    setKedbEditModalVisible,
    editingKnownError,
    setEditingKnownError,
    statusUpdating,
    linkingLoading,
    // loaders
    loadProblems,
    loadStats,
    loadKnownErrors,
    loadProblemDetail,
    // problem handlers
    handleCreate,
    handleEdit,
    handleDelete,
    handleStatusTransition,
    handleLinkIncident,
    handleLinkChange,
    handleViewDetail,
    // KEDB handlers
    handleCreateKnownError,
    handleEditKnownError,
    handleDeleteKnownError,
  };
};
