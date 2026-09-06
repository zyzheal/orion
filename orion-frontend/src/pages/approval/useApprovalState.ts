/**
 * useApprovalState - 审批页状态容器
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 *
 * 拥有: loading / approvals / 各弹窗可见态 / comment 状态 / 7 个处理函数
 * 表单由主组件 Form.useForm 创建后传入
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormInstance } from 'antd';
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
import type { ApprovalTemplate } from './constants';

const CURRENT_USER_ID = 'current-user';

export interface UseApprovalStateReturn {
  loading: boolean;
  approvals: ApprovalRequest[];
  searchQuery: string;
  statusFilter: ApprovalStatus | 'all';
  createModalVisible: boolean;
  emergencyModalVisible: boolean;
  detailDrawerVisible: boolean;
  selectedApproval: ApprovalRequest | null;
  submitting: boolean;
  commentModalVisible: boolean;
  commentAction: 'approve' | 'reject';
  commentText: string;
  commentSubmitting: boolean;
  filteredData: ApprovalRequest[];
  loadData: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (v: ApprovalStatus | 'all') => void;
  openCreate: () => void;
  closeCreate: () => void;
  handleCreate: () => Promise<void>;
  openEmergency: () => void;
  closeEmergency: () => void;
  handleEmergencyCreate: () => Promise<void>;
  handleTemplateSelect: (t: ApprovalTemplate) => void;
  openDetail: (a: ApprovalRequest) => void;
  closeDetail: () => void;
  openCommentModal: (id: string, action: 'approve' | 'reject') => void;
  closeComment: () => void;
  setCommentText: (t: string) => void;
  handleCommentSubmit: () => Promise<void>;
}

export const useApprovalState = (
  createForm: FormInstance,
  emergencyForm: FormInstance,
): UseApprovalStateReturn => {
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentAction, setCommentAction] = useState<'approve' | 'reject'>('approve');
  const [commentTargetId, setCommentTargetId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

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

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await getApproval(id);
      const detail = res.data;
      if (detail) setSelectedApproval(detail);
    } catch {
      // fallback
    }
  }, []);

  const handleCreate = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const approverList = (values.approverIds as string)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const payload: CreateApprovalInput = {
        title: values.title,
        description: values.description,
        requesterId: values.requesterId || CURRENT_USER_ID,
        approverIds: approverList,
        requiredApprovals: values.requiredApprovals || 1,
        metadata: values.metadata ? { resourceType: values.metadata } : undefined,
      };
      await createApproval(payload);
      message.success('审批请求创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  }, [createForm, loadData]);

  const handleEmergencyCreate = useCallback(async () => {
    try {
      const values = await emergencyForm.validateFields();
      setSubmitting(true);
      const payload: CreateApprovalInput = {
        title: `[紧急] ${values.title}`,
        description: values.description,
        requesterId: values.requesterId || CURRENT_USER_ID,
        approverIds: (values.approverIds as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
        requiredApprovals: 1,
        metadata: { resourceType: values.resourceType, priority: 'urgent' },
      };
      await createApproval(payload);
      message.success('紧急审批已创建，已通知相关审批人');
      setEmergencyModalVisible(false);
      emergencyForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  }, [emergencyForm, loadData]);

  const handleTemplateSelect = useCallback(
    (template: ApprovalTemplate) => {
      createForm.setFieldsValue({
        title: template.name,
        description: template.description,
        approverIds: template.approverRoles.join(', '),
        requiredApprovals: template.requiredApprovals,
        metadata: template.id,
      });
    },
    [createForm],
  );

  const handleApprove = useCallback(
    async (id: string, comment?: string) => {
      try {
        await approveApproval(id, { userId: CURRENT_USER_ID, comment });
        message.success('审批通过');
        loadData();
        if (selectedApproval?.id === id) loadDetail(id);
      } catch (error: unknown) {
        message.error(`审批操作失败: ${(error as Error).message}`);
      }
    },
    [loadData, loadDetail, selectedApproval],
  );

  const handleReject = useCallback(
    async (id: string, comment?: string) => {
      try {
        await rejectApproval(id, { userId: CURRENT_USER_ID, comment });
        message.success('已拒绝');
        loadData();
        if (selectedApproval?.id === id) loadDetail(id);
      } catch (error: unknown) {
        message.error(`拒绝操作失败: ${(error as Error).message}`);
      }
    },
    [loadData, loadDetail, selectedApproval],
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

  const filteredData = useMemo(
    () =>
      approvals.filter((a) => {
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
      }),
    [approvals, statusFilter, searchQuery],
  );

  return {
    filteredData,
    loading,
    approvals,
    searchQuery,
    statusFilter,
    createModalVisible,
    emergencyModalVisible,
    detailDrawerVisible,
    selectedApproval,
    submitting,
    commentModalVisible,
    commentAction,
    commentText,
    commentSubmitting,
    loadData,
    setSearchQuery,
    setStatusFilter,
    openCreate: () => {
      createForm.resetFields();
      setCreateModalVisible(true);
    },
    closeCreate: () => setCreateModalVisible(false),
    handleCreate,
    openEmergency: () => {
      emergencyForm.resetFields();
      setEmergencyModalVisible(true);
    },
    closeEmergency: () => setEmergencyModalVisible(false),
    handleEmergencyCreate,
    handleTemplateSelect,
    openDetail,
    closeDetail: () => setDetailDrawerVisible(false),
    openCommentModal,
    closeComment: () => setCommentModalVisible(false),
    setCommentText,
    handleCommentSubmit,
  };
};
