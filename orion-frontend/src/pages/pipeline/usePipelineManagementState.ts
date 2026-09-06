/**
 * usePipelineManagementState.ts - 数据管道状态 Hook
 * 抽取自 PipelineManagementPage.tsx (P2-9 Phase 90)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Modal, Form } from 'antd';
import {
  listDataPipelines,
  createDataPipeline,
  updateDataPipeline,
  deleteDataPipeline,
  runDataPipeline,
  pauseDataPipeline,
  resumeDataPipeline,
  getDataPipelineLogs,
  getDataPipelineLineage,
  type DataPipeline,
  type CreateDataPipelineRequest,
} from '@/api/data-pipeline';

export const usePipelineManagementState = () => {
  const [pipelines, setPipelines] = useState<DataPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 创建/编辑弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<DataPipeline | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm<CreateDataPipelineRequest>();

  // 日志/血缘抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerContent, setDrawerContent] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedPipelineName, setSelectedPipelineName] = useState('');

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDataPipelines();
      const data = Array.isArray(result.data) ? result.data : [];
      setPipelines(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载数据管道列表失败';
      message.error(msg);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // ==================== CRUD ====================

  const handleCreateOrEdit = async (values: CreateDataPipelineRequest) => {
    setModalLoading(true);
    try {
      if (editingPipeline) {
        await updateDataPipeline(editingPipeline.id, values);
        message.success('数据管道更新成功');
      } else {
        await createDataPipeline(values);
        message.success('数据管道创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingPipeline(null);
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : editingPipeline ? '更新失败' : '创建失败';
      message.error(msg);
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPipeline(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (pipeline: DataPipeline) => {
    setEditingPipeline(pipeline);
    form.setFieldsValue({
      name: pipeline.name,
      description: pipeline.description,
      sourceTable: pipeline.sourceTable,
      targetTable: pipeline.targetTable,
      transformationScript: pipeline.transformationScript,
      schedule: pipeline.schedule,
    });
    setModalOpen(true);
  };

  const handleDelete = (pipeline: DataPipeline) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除数据管道「${pipeline.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteDataPipeline(pipeline.id);
          message.success('删除成功');
          loadPipelines();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  // ==================== 运行操作 ====================

  const setAction = (id: string, isLoading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [id]: isLoading }));
  };

  const handleRun = async (pipeline: DataPipeline) => {
    setAction(pipeline.id, true);
    try {
      await runDataPipeline(pipeline.id);
      message.success('管道运行已触发');
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '运行失败';
      message.error(msg);
    } finally {
      setAction(pipeline.id, false);
    }
  };

  const handlePause = async (pipeline: DataPipeline) => {
    setAction(pipeline.id, true);
    try {
      await pauseDataPipeline(pipeline.id);
      message.success('管道已暂停');
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '暂停失败';
      message.error(msg);
    } finally {
      setAction(pipeline.id, false);
    }
  };

  const handleResume = async (pipeline: DataPipeline) => {
    setAction(pipeline.id, true);
    try {
      await resumeDataPipeline(pipeline.id);
      message.success('管道已恢复');
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '恢复失败';
      message.error(msg);
    } finally {
      setAction(pipeline.id, false);
    }
  };

  // ==================== 日志/血缘 ====================

  const handleViewLogs = async (pipeline: DataPipeline) => {
    setDrawerTitle(`日志 - ${pipeline.name}`);
    setSelectedPipelineName(pipeline.name);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const result = await getDataPipelineLogs(pipeline.id);
      setDrawerContent(result.logs && result.logs.length > 0 ? result.logs.join('\n') : '暂无日志');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载日志失败';
      message.error(msg);
      setDrawerContent('加载失败，请稍后重试');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleViewLineage = async (pipeline: DataPipeline) => {
    setDrawerTitle(`数据血缘 - ${pipeline.name}`);
    setSelectedPipelineName(pipeline.name);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const result = await getDataPipelineLineage(pipeline.id);
      const lineage = result.lineage || {};
      setDrawerContent(JSON.stringify(lineage, null, 2));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载血缘失败';
      message.error(msg);
      setDrawerContent('加载失败，请稍后重试');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingPipeline(null);
    form.resetFields();
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setDrawerContent('');
  };

  // ==================== 筛选 ====================

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [p.name, p.description, p.sourceTable, p.targetTable]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [searchQuery, statusFilter, pipelines]);

  return {
    pipelines,
    loading,
    actionLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    modalOpen,
    setModalOpen,
    editingPipeline,
    modalLoading,
    form,
    drawerOpen,
    drawerTitle,
    drawerContent,
    drawerLoading,
    selectedPipelineName,
    loadPipelines,
    handleCreateOrEdit,
    handleOpenCreate,
    handleOpenEdit,
    handleDelete,
    handleRun,
    handlePause,
    handleResume,
    handleViewLogs,
    handleViewLineage,
    handleCloseModal,
    handleCloseDrawer,
    filteredPipelines,
  };
};
