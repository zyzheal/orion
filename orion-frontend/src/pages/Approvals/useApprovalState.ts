/**
 * useApprovalState.ts - Approval Management 状态 Hook
 * 抽取自 Approvals/index.tsx (P2-9 Phase 56)
 * 全部 state + loadData + 8 handlers + filteredData/stats memo
 * 表单 validateFields 由主页面 wrapper 负责，本 hook handler 接收 values
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  getApprovals,
  getApproval,
  createApproval,
  approveApproval,
  rejectApproval,
  type ApprovalRequest,
  type CreateApprovalInput,
  type ApprovalStatus,
} from '@/api/approvals';

// ============================================================================
// Types
// ============================================================================

export interface ApprovalFilterState {
  searchQuery: string;
  statusFilter: ApprovalStatus | 'all';
}

// ============================================================================
// Hook
// ============================================================================

export const useApprovalState = () => {
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId] = useState('current-user');

  // Comment modal state
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentAction, setCommentAction] = useState<'approve' | 'reject'>('approve');
  const [commentTargetId, setCommentTargetId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // --- Loaders ---

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApprovals();
      const list = res.data?.approvals;
      setApprovals(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setApprovals([]);
      message.error(`加载审批数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Memos ---

  const filteredData = useMemo(() => {
    return approvals.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !(a.description && a.description.toLowerCase().includes(q)) &&
          !a.requesterId.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [searchQuery, statusFilter, approvals]);

  const stats = useMemo(
    () => ({
      total: approvals.length,
      pending: approvals.filter((a) => a.status === 'pending').length,
      approved: approvals.filter((a) => a.status === 'approved').length,
      rejected: approvals.filter((a) => a.status === 'rejected').length,
    }),
    [approvals],
  );

  // --- Handlers ---

  const handleCreate = useCallback(
    async (values: {
      title: string;
      description: string;
      requesterId: string;
      approverIds: string;
      requiredApprovals: number;
      metadata?: string;
    }) => {
      setSubmitting(true);
      try {
        const approverList = values.approverIds
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        const payload: CreateApprovalInput = {
          title: values.title,
          description: values.description,
          requesterId: values.requesterId || currentUserId,
          approverIds: approverList,
          requiredApprovals: values.requiredApprovals || 1,
          metadata: values.metadata ? { resourceType: values.metadata } : undefined,
        };
        await createApproval(payload);
        message.success('审批请求创建成功');
        setCreateModalVisible(false);
        loadData();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`创建失败：${error.message}`);
        } else {
          message.error('创建失败');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [currentUserId, loadData],
  );

  const handleApprove = useCallback(
    async (id: string, comment?: string) => {
      try {
        await approveApproval(id, { userId: currentUserId, comment });
        message.success('审批通过');
        loadData();
        if (selectedApproval?.id === id) loadDetail(id);
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`审批操作失败：${error.message}`);
        } else {
          message.error('审批操作失败');
        }
      }
    },
    [currentUserId, loadData, selectedApproval],
  );

  const handleReject = useCallback(
    async (id: string, comment?: string) => {
      try {
        await rejectApproval(id, { userId: currentUserId, comment });
        message.success('已拒绝');
        loadData();
        if (selectedApproval?.id === id) loadDetail(id);
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`拒绝操作失败：${error.message}`);
        } else {
          message.error('拒绝操作失败');
        }
      }
    },
    [currentUserId, loadData, selectedApproval],
  );

  const openCommentModal = useCallback((id: string, action: 'approve' | 'reject') => {
    setCommentTargetId(id);
    setCommentAction(action);
    setCommentText('');
    setCommentModalVisible(true);
  }, []);

  const handleCommentSubmit = useCallback(async () => {
    setCommentSubmitting(true);
    try {
      if (commentAction === 'approve') {
        await handleApprove(commentTargetId, commentText.trim() || undefined);
      } else {
        await handleReject(commentTargetId, commentText.trim() || undefined);
      }
      setCommentModalVisible(false);
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentAction, commentTargetId, commentText, handleApprove, handleReject]);

  const openDetail = useCallback((a: ApprovalRequest) => {
    setSelectedApproval(a);
    setDetailDrawerVisible(true);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await getApproval(id);
      const detail = res.data;
      if (detail) setSelectedApproval(detail);
    } catch {
      // Keep existing data - optional detail refresh
    }
  }, []);

  // --- Returns ---

  return {
    // State
    loading,
    approvals,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    createModalVisible, setCreateModalVisible,
    detailDrawerVisible, setDetailDrawerVisible,
    selectedApproval, setSelectedApproval,
    submitting,
    commentModalVisible, setCommentModalVisible,
    commentAction,
    commentTargetId,
    commentText, setCommentText,
    commentSubmitting,
    // Memos
    filteredData,
    stats,
    // Handlers
    loadData,
    handleCreate,
    handleApprove,
    handleReject,
    openCommentModal,
    handleCommentSubmit,
    openDetail,
    loadDetail,
  };
};
