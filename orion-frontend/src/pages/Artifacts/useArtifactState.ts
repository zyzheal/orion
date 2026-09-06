/**
 * useArtifactState.ts - 制品管理状态 Hook
 * 抽取自 Artifacts/index.tsx (P2-9 Phase 75)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message, Form } from 'antd';
import {
  getArtifacts,
  createArtifact,
  updateArtifact,
  deleteArtifact,
  getArtifactTags,
  addArtifactTags,
  downloadArtifact,
  promoteArtifact,
  getPromotionHistory,
  deprecateArtifact,
  quarantineArtifact,
  getArtifactStats,
  getNamespaces,
  type Artifact,
  type CreateArtifactInput,
  type UpdateArtifactInput,
  type PromotionRecord,
  type Tag as TagType,
  type ArtifactStats as ArtifactStatsType,
} from '@/api/artifacts';
import { typeLabelMap, promotionStageOrder } from './constants';

export const useArtifactState = () => {
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [promotionModalVisible, setPromotionModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [stats, setStats] = useState<ArtifactStatsType | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [promotionForm] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const typeOptions = useMemo(
    () => [
      { label: '全部', value: 'all' },
      ...Object.entries(typeLabelMap)
        .slice(0, 8)
        .map(([v, l]) => ({ label: l, value: v })),
    ],
    []
  );

  const loadData = useCallback(
    async (page?: number, size?: number) => {
      const p = page ?? currentPage;
      const s = size ?? pageSize;
      setLoading(true);
      try {
        const res = await getArtifacts({ page: p, perPage: s });
        const raw = res.data;
        if (Array.isArray(raw)) {
          setArtifacts(raw);
          const respTotal = (res.data as { total?: number })?.total ?? raw.length;
          setTotal(respTotal);
        } else {
          setArtifacts([]);
          setTotal(0);
        }
      } catch (error: unknown) {
        setArtifacts([]);
        setTotal(0);
        message.error(`加载制品数据失败: ${(error as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, pageSize]
  );

  const loadStats = useCallback(async () => {
    try {
      const res = await getArtifactStats();
      setStats(res.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  const loadNamespaces = useCallback(async () => {
    try {
      const res = await getNamespaces();
      setNamespaces(res.data || []);
    } catch {
      setNamespaces([]);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStats();
    loadNamespaces();
  }, [loadData, loadStats, loadNamespaces]);

  const filteredData = useMemo(() => {
    return artifacts.filter((a) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !a.name.toLowerCase().includes(q) &&
          !(a.displayName && a.displayName.toLowerCase().includes(q)) &&
          !(a.description && a.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.type && filters.type !== 'all' && a.type !== filters.type) return false;
      if (filters.stage && filters.stage !== 'all' && a.stage !== filters.stage) return false;
      if (filters.status && filters.status !== 'all' && a.status !== filters.status) return false;
      if (filters.namespace && filters.namespace !== 'all' && a.namespace !== filters.namespace)
        return false;
      return true;
    });
  }, [searchQuery, filters, artifacts]);

  // ---- Handlers ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateArtifactInput = {
        name: values.name,
        namespace: values.namespace,
        version: values.version,
        type: values.type,
        displayName: values.displayName,
        description: values.description,
        storagePath: values.storagePath,
        storageBackend: values.storageBackend || 'local',
        sizeBytes: 0,
        labels: values.labels
          ? Object.fromEntries(
              values.labels.split(',').map((s: string) => s.split(':').map((x: string) => x.trim()))
            )
          : undefined,
      };
      await createArtifact(payload);
      message.success('制品创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败: ${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingArtifact) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateArtifactInput = {
        displayName: values.displayName,
        description: values.description,
        retentionDays: values.retentionDays ? parseInt(values.retentionDays) : undefined,
      };
      await updateArtifact(editingArtifact.id, payload);
      message.success('制品更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`更新失败: ${error.message}`);
        } else {
          message.error('更新失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteArtifact(id);
      message.success('制品已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败: ${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleDeprecate = async (id: string) => {
    try {
      await deprecateArtifact(id);
      message.success('制品已废弃');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`废弃失败: ${error.message}`);
      } else {
        message.error('废弃失败');
      }
    }
  };

  const handleQuarantine = async (id: string) => {
    try {
      await quarantineArtifact(id);
      message.success('制品已隔离');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`隔离失败: ${error.message}`);
      } else {
        message.error('隔离失败');
      }
    }
  };

  const handleDownload = async (record: Artifact) => {
    try {
      const res = await downloadArtifact(record.id);
      const url = res.data?.url;
      if (url) {
        window.open(url, '_blank');
        message.success('下载链接已打开');
      } else {
        message.warning('未获取到下载链接');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`下载失败: ${error.message}`);
      } else {
        message.error('下载失败');
      }
    }
  };

  const handlePromote = async () => {
    if (!selectedArtifact) return;
    try {
      const values = await promotionForm.validateFields();
      setSubmitting(true);
      const payload: { promotedBy: string; approvedBy?: string; reason?: string } = {
        promotedBy: values.promotedBy || 'current-user',
        reason: values.reason,
      };
      if (values.approvedBy) payload.approvedBy = values.approvedBy;
      await promoteArtifact(selectedArtifact.id, payload);
      message.success('制品晋升成功');
      setPromotionModalVisible(false);
      promotionForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`晋升失败: ${error.message}`);
        } else {
          message.error('晋升失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTags = async () => {
    if (!selectedArtifact) return;
    try {
      const values = await tagForm.validateFields();
      setSubmitting(true);
      const tagList = values.tags
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      await addArtifactTags(selectedArtifact.id, tagList);
      message.success('标签添加成功');
      setTagModalVisible(false);
      tagForm.resetFields();
      loadTags(selectedArtifact.id);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`添加标签失败: ${error.message}`);
        } else {
          message.error('添加标签失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (a: Artifact) => {
    setEditingArtifact(a);
    editForm.setFieldsValue({
      displayName: a.displayName,
      description: a.description,
      retentionDays: a.retentionDays,
    });
    setEditModalVisible(true);
  };

  const openDetail = async (a: Artifact) => {
    setSelectedArtifact(a);
    setDetailDrawerVisible(true);
    loadTags(a.id);
    loadPromotionHistory(a.id);
  };

  const openPromotion = (a: Artifact) => {
    setSelectedArtifact(a);
    promotionForm.setFieldsValue({ promotedBy: 'current-user' });
    setPromotionModalVisible(true);
  };

  const openTagModal = (a: Artifact) => {
    setSelectedArtifact(a);
    setTagModalVisible(true);
  };

  const loadTags = async (id: string) => {
    try {
      const res = await getArtifactTags(id);
      setTags(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTags([]);
    }
  };

  const loadPromotionHistory = async (id: string) => {
    try {
      const res = await getPromotionHistory(id);
      setPromotionHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPromotionHistory([]);
    }
  };

  // ---- Derived Memos ----

  const namespaceOptions = useMemo(
    () => [{ label: '全部', value: 'all' }, ...namespaces.map((n) => ({ label: n, value: n }))],
    [namespaces]
  );

  const filterDefs = useMemo(
    () => [
      { key: 'namespace', label: '命名空间', options: namespaceOptions },
      { key: 'type', label: '类型', options: typeOptions },
      {
        key: 'stage',
        label: '阶段',
        options: [
          { label: '全部', value: 'all' },
          { label: 'Snapshot', value: 'snapshot' },
          { label: 'RC', value: 'release_candidate' },
          { label: 'Stable', value: 'stable' },
          { label: 'Production', value: 'production' },
          { label: 'Archived', value: 'archived' },
        ],
      },
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: 'Available', value: 'available' },
          { label: 'Deprecated', value: 'deprecated' },
          { label: 'Quarantined', value: 'quarantined' },
          { label: 'Uploading', value: 'uploading' },
        ],
      },
    ],
    [namespaceOptions, typeOptions]
  );

  return {
    loading,
    artifacts,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    editingArtifact,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedArtifact,
    promotionModalVisible,
    setPromotionModalVisible,
    tagModalVisible,
    setTagModalVisible,
    stats,
    namespaces,
    tags,
    promotionHistory,
    createForm,
    editForm,
    promotionForm,
    tagForm,
    submitting,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    total,
    typeOptions,
    filteredData,
    filterDefs,
    loadData,
    loadStats,
    handleCreate,
    handleEdit,
    handleDelete,
    handleDeprecate,
    handleQuarantine,
    handleDownload,
    handlePromote,
    handleAddTags,
    openEdit,
    openDetail,
    openPromotion,
    openTagModal,
  };
};
