/**
 * useProductLineState.ts - ProductLine 页面状态钩子
 * 抽取自 ProductLine/index.tsx (P2-9 Phase 95)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getProductLines,
  createProductLine,
  updateProductLine,
  deleteProductLine,
  activateProductLine,
  suspendProductLine,
  getReleaseTrains,
  createReleaseTrain,
  getHotfixChannels,
  createHotfixChannel,
  type ProductLine,
  type ProductLineCreateInput,
  type ProductLineUpdateInput,
  type ReleaseTrain,
  type HotfixChannel,
  type ReleaseTrainInput,
  type HotfixChannelInput,
} from '@/api/product-lines';

export const useProductLineState = () => {
  const [loading, setLoading] = useState(false);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPL, setEditingPL] = useState<ProductLine | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPL, setSelectedPL] = useState<ProductLine | null>(null);
  const [releaseTrains, setReleaseTrains] = useState<ReleaseTrain[]>([]);
  const [hotfixChannels, setHotfixChannels] = useState<HotfixChannel[]>([]);
  const [rtModalVisible, setRtModalVisible] = useState(false);
  const [hfModalVisible, setHfModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [rtForm] = Form.useForm();
  const [hfForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProductLines();
      setProductLines(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setProductLines([]);
      message.error(`加载产品线数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return productLines.filter((pl) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !pl.name.toLowerCase().includes(q) &&
          !pl.displayName.toLowerCase().includes(q) &&
          !(pl.description && pl.description.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.phase && filters.phase !== 'all' && pl.status.phase !== filters.phase)
        return false;
      if (
        filters.branchMode &&
        filters.branchMode !== 'all' &&
        pl.branchPolicies.mode !== filters.branchMode
      )
        return false;
      return true;
    });
  }, [searchQuery, filters, productLines]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: ProductLineCreateInput = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        gitRepo: {
          url: values.gitUrl,
          provider: values.gitProvider || 'github',
          defaultBranch: values.gitDefaultBranch || 'main',
        },
        branchPolicies: {
          mode: values.branchMode || 'gitflow',
          protectedBranches: [],
        },
        environmentMappings: {
          defaultEnvironment: values.defaultEnvironment || 'dev',
          mappings: [
            {
              branch: 'main',
              patternType: 'exact' as const,
              environment: 'prod' as const,
              requireApproval: true,
            },
            {
              branch: 'develop',
              patternType: 'exact' as const,
              environment: 'test' as const,
              requireApproval: false,
            },
            {
              branch: 'feature/*',
              patternType: 'glob' as const,
              environment: 'dev' as const,
              requireApproval: false,
            },
          ],
        },
        tenantId: values.tenantId,
      };
      await createProductLine(payload);
      message.success('产品线创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingPL) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: ProductLineUpdateInput = {
        displayName: values.displayName,
        description: values.description,
        branchPolicies: {
          mode: values.branchMode || editingPL.branchPolicies.mode,
          protectedBranches: editingPL.branchPolicies.protectedBranches,
        },
        environmentMappings: editingPL.environmentMappings,
      };
      await updateProductLine(editingPL.id, payload);
      message.success('产品线更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`更新失败：${error.message}`);
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
      await deleteProductLine(id);
      message.success('产品线已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateProductLine(id);
      message.success('产品线已激活');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`激活失败：${error.message}`);
      } else {
        message.error('激活失败');
      }
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await suspendProductLine(id);
      message.success('产品线已暂停');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`暂停失败：${error.message}`);
      } else {
        message.error('暂停失败');
      }
    }
  };

  const openEdit = (pl: ProductLine) => {
    setEditingPL(pl);
    editForm.setFieldsValue({
      displayName: pl.displayName,
      description: pl.description,
      branchMode: pl.branchPolicies.mode,
    });
    setEditModalVisible(true);
  };

  const openDetail = async (pl: ProductLine) => {
    setSelectedPL(pl);
    setDetailDrawerVisible(true);
    try {
      const [rtRes, hfRes] = await Promise.all([getReleaseTrains(pl.id), getHotfixChannels(pl.id)]);
      setReleaseTrains(rtRes?.data || []);
      setHotfixChannels(hfRes?.data || []);
    } catch (error: unknown) {
      setReleaseTrains([]);
      setHotfixChannels([]);
    }
  };

  const handleCreateRT = async () => {
    if (!selectedPL) return;
    try {
      const values = await rtForm.validateFields();
      setSubmitting(true);
      const payload: ReleaseTrainInput = {
        name: values.rtName,
        schedule: values.rtSchedule,
        targetBranch: values.rtTargetBranch || 'main',
        sourceBranch: values.rtSourceBranch || 'develop',
        autoPromote: values.rtAutoPromote || false,
        approvalRequired: values.rtApprovalRequired !== undefined ? values.rtApprovalRequired : true,
        approvers: values.rtApprovers
          ? values.rtApprovers.split(',').map((s: string) => s.trim())
          : [],
      };
      await createReleaseTrain(selectedPL.id, payload);
      message.success('发布列车创建成功');
      setRtModalVisible(false);
      rtForm.resetFields();
      try {
        const res = await getReleaseTrains(selectedPL.id);
        setReleaseTrains(res.data || []);
      } catch {
        /* optional reload, ignore */
      }
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHF = async () => {
    if (!selectedPL) return;
    try {
      const values = await hfForm.validateFields();
      setSubmitting(true);
      const payload: HotfixChannelInput = {
        name: values.hfName,
        enabled: values.hfEnabled !== undefined ? values.hfEnabled : true,
        branchPattern: values.hfBranchPattern || '^hotfix/.*$',
        approvalRequired:
          values.hfApprovalRequired !== undefined ? values.hfApprovalRequired : true,
        approvalTimeout: values.hfApprovalTimeout || 30,
        autoMerge: values.hfAutoMerge || false,
        notifyOnCall: values.hfNotifyOnCall !== undefined ? values.hfNotifyOnCall : true,
        maxDuration: values.hfMaxDuration || 60,
      };
      await createHotfixChannel(selectedPL.id, payload);
      message.success('紧急修复通道创建成功');
      setHfModalVisible(false);
      hfForm.resetFields();
      try {
        const res = await getHotfixChannels(selectedPL.id);
        setHotfixChannels(res.data || []);
      } catch {
        /* optional reload, ignore */
      }
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isInitialLoading = loading && productLines.length === 0;

  return {
    // State
    loading,
    productLines,
    setProductLines,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    editingPL,
    setEditingPL,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedPL,
    setSelectedPL,
    releaseTrains,
    setReleaseTrains,
    hotfixChannels,
    setHotfixChannels,
    rtModalVisible,
    setRtModalVisible,
    hfModalVisible,
    setHfModalVisible,
    submitting,
    setSubmitting,
    // Forms
    createForm,
    editForm,
    rtForm,
    hfForm,
    // Data / filtered
    filteredData,
    isInitialLoading,
    // Actions
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleActivate,
    handleSuspend,
    openEdit,
    openDetail,
    handleCreateRT,
    handleCreateHF,
  };
};

export type ProductLineState = ReturnType<typeof useProductLineState>;
