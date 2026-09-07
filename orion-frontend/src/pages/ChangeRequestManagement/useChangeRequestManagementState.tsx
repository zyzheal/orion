/**
 * ChangeRequestManagement 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 110)
 */
import { useState, useEffect, useCallback } from 'react';
import { message, Form } from 'antd';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import {
  listChangeRequests,
  createChangeRequest,
  updateChangeRequest,
  deleteChangeRequest,
  submitForApproval,
  getApprovalChain,
  approveChange,
  rejectChange,
  startExecution,
  getExecutionProgress,
  getChangeRiskAnalysis,
  type ChangeRequest,
  type ChangeApproval,
  type ChangeExecution,
  type CreateChangeRequestInput,
  type ChangeRiskAnalysis,
} from '@/api/change-requests';

export const useChangeRequestManagementState = () => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ChangeRequest | null>(null);
  const [form] = Form.useForm();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<ChangeRiskAnalysis | null>(null);
  const [approvalChain, setApprovalChain] = useState<ChangeApproval[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionApprovalId, setActionApprovalId] = useState<string>('');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ChangeExecution[]>([]);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [selectedExecutionRequest, setSelectedExecutionRequest] = useState<ChangeRequest | null>(
    null
  );

  const fetchRisk = useCallback(async (id: string) => {
    setRiskLoading(true);
    setRiskAnalysis(null);
    try {
      const res = await getChangeRiskAnalysis(id);
      setRiskAnalysis(res?.data ?? null);
    } catch {
      message.error('获取 AI 风险评估失败，请稍后重试');
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string } = {};
      if (statusFilter) params.status = statusFilter;
      const res = await listChangeRequests(params);
      setRequests(res.data ?? []);
    } catch {
      message.error('获取变更请求列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const fetchApprovalChain = useCallback(async (changeRequestId: string) => {
    setApprovalLoading(true);
    try {
      const res = await getApprovalChain(changeRequestId);
      setApprovalChain(res.data ?? []);
    } catch {
      message.error('获取审批链失败');
    } finally {
      setApprovalLoading(false);
    }
  }, []);

  const fetchExecutionProgress = useCallback(async (changeRequestId: string) => {
    setExecutionLoading(true);
    try {
      const res = await getExecutionProgress(changeRequestId);
      setExecutionSteps(res.data ?? []);
    } catch {
      message.error('获取执行进度失败');
    } finally {
      setExecutionLoading(false);
    }
  }, []);

  const handleCreate = useCallback(() => {
    setEditingRequest(null);
    form.resetFields();
    form.setFieldsValue({ riskLevel: 'low', changeType: 'normal', impactScope: 'minor' });
    setModalVisible(true);
  }, [form]);

  const handleEdit = useCallback(
    (record: ChangeRequest) => {
      setEditingRequest(record);
      form.setFieldsValue({
        title: record.title,
        description: record.description,
        changeType: record.changeType,
        riskLevel: record.riskLevel,
        impactScope: record.impactScope,
        rollbackPlan: record.rollbackPlan,
        scheduledStart: record.scheduledStart ? dayjs(record.scheduledStart) : null,
        scheduledEnd: record.scheduledEnd ? dayjs(record.scheduledEnd) : null,
      });
      setModalVisible(true);
    },
    [form]
  );

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      const input: CreateChangeRequestInput = {
        title: values.title,
        description: values.description,
        changeType: values.changeType,
        riskLevel: values.riskLevel,
        impactScope: values.impactScope,
        rollbackPlan: values.rollbackPlan,
        scheduledStart: values.scheduledStart?.toISOString(),
        scheduledEnd: values.scheduledEnd?.toISOString(),
      };
      if (editingRequest) {
        await updateChangeRequest(editingRequest.id, input);
        message.success('变更请求更新成功');
      } else {
        await createChangeRequest(input);
        message.success('变更请求创建成功');
      }
      setModalVisible(false);
      fetchRequests();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setConfirmLoading(false);
    }
  }, [form, editingRequest, fetchRequests]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteChangeRequest(id);
        message.success('删除成功');
        fetchRequests();
      } catch {
        message.error('删除失败');
      }
    },
    [fetchRequests]
  );

  const handleSubmitForApproval = useCallback(
    async (id: string) => {
      try {
        await submitForApproval(id);
        message.success('已提交审批');
        fetchRequests();
      } catch {
        message.error('提交审批失败');
      }
    },
    [fetchRequests]
  );

  const handleAIRisk = useCallback(async (record: ChangeRequest) => {
    try {
      const risk = await getChangeRiskAnalysis(record.id);
      const analysis = (risk && 'data' in risk ? risk.data : risk) as unknown as {
        riskScore?: string;
        risk_score?: string;
        riskLevel?: string;
        risk_level?: string;
        riskAssessment?: string;
        risk_assessment?: string;
      };
      if (analysis) {
        message.success({
          content: (
            <div>
              <strong style={{ display: 'block', marginBottom: 4 }}>AI 变更风险评估</strong>
              <div>变更: {record.title}</div>
              <div>
                风险分:{' '}
                <span style={{ fontWeight: 600 }}>
                  {String(analysis.riskScore ?? analysis.risk_score ?? '-')}
                </span>
              </div>
              <div>
                风险等级:{' '}
                <span style={{ fontWeight: 600 }}>
                  {String(analysis.riskLevel ?? analysis.risk_level ?? '-')}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: colors.neutral[600] }}>
                {String(analysis.riskAssessment ?? analysis.risk_assessment ?? '暂无详细评估')}
              </div>
            </div>
          ),
          duration: 8,
          key: `ai-risk-${record.id}`,
        });
      }
    } catch (err: unknown) {
      message.error('AI 风险评估失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const handleViewDetail = useCallback(
    async (record: ChangeRequest) => {
      setSelectedRequest(record);
      setDetailDrawerVisible(true);
      fetchApprovalChain(record.id);
    },
    [fetchApprovalChain]
  );

  const handleOpenAction = useCallback((type: 'approve' | 'reject', approvalId: string) => {
    setActionType(type);
    setActionApprovalId(approvalId);
    setActionComment('');
    setActionModalVisible(true);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        await approveChange(selectedRequest.id, actionApprovalId, actionComment);
        message.success('审批通过');
      } else {
        await rejectChange(selectedRequest.id, actionApprovalId, actionComment);
        message.success('已拒绝');
      }
      setActionModalVisible(false);
      fetchApprovalChain(selectedRequest.id);
      fetchRequests();
    } catch {
      message.error(actionType === 'approve' ? '审批操作失败' : '拒绝操作失败');
    } finally {
      setActionLoading(false);
    }
  }, [selectedRequest, actionType, actionApprovalId, actionComment, fetchApprovalChain, fetchRequests]);

  const handleStartExecution = useCallback(
    async (record: ChangeRequest) => {
      try {
        await startExecution(record.id);
        message.success('执行已启动');
        fetchRequests();
      } catch {
        message.error('启动执行失败');
      }
    },
    [fetchRequests]
  );

  const handleViewExecution = useCallback(
    async (record: ChangeRequest) => {
      setSelectedExecutionRequest(record);
      setExecutionDrawerVisible(true);
      fetchExecutionProgress(record.id);
    },
    [fetchExecutionProgress]
  );

  return {
    // state
    requests,
    setRequests,
    loading,
    statusFilter,
    setStatusFilter,
    modalVisible,
    setModalVisible,
    confirmLoading,
    editingRequest,
    setEditingRequest,
    form,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedRequest,
    setSelectedRequest,
    riskLoading,
    setRiskLoading,
    riskAnalysis,
    approvalChain,
    approvalLoading,
    actionModalVisible,
    setActionModalVisible,
    actionType,
    setActionType,
    actionApprovalId,
    setActionApprovalId,
    actionComment,
    setActionComment,
    actionLoading,
    executionDrawerVisible,
    setExecutionDrawerVisible,
    executionSteps,
    executionLoading,
    selectedExecutionRequest,
    setSelectedExecutionRequest,
    // callbacks
    fetchRequests,
    fetchApprovalChain,
    fetchExecutionProgress,
    fetchRisk,
    handleCreate,
    handleEdit,
    handleSave,
    handleDelete,
    handleSubmitForApproval,
    handleAIRisk,
    handleViewDetail,
    handleOpenAction,
    handleConfirmAction,
    handleStartExecution,
    handleViewExecution,
  };
};

export type ChangeRequestManagementState = ReturnType<typeof useChangeRequestManagementState>;
