/**
 * useChangeManagementState.ts - Change Management 状态 Hook
 * 抽取自 ChangeManagement/index.tsx (P2-9 Phase 50)
 * 全部 state + 6 loaders + 18 handlers + 3 column hook deps
 * 表单 validateFields 由主页面 wrapper 负责，本 hook handler 接收 values/ID
 */
import { useState, useEffect, useCallback } from 'react';
import { message, Modal } from 'antd';
import {
  getChangeRequests,
  getChangeRequest,
  createChangeRequest,
  updateChangeRequest,
  deleteChangeRequest,
  updateChangeRequestStatus,
  getChangeTimeline,
  addChangeTimelineEvent,
  getRFCs,
  getRFC,
  createRFC,
  updateRFC,
  getCABMeetings,
  getCABMeeting,
  createCABMeeting,
  updateCABMeeting,
  addCABDecision,
  getChangeStats,
  getChangeRiskAnalysis,
} from '@/api/change';
import type {
  ChangeRequest,
  CABMeeting,
  ChangeTimelineEvent,
  RFC,
  ChangeStats,
  ChangeRiskAnalysis,
} from '@/api/change';
import { statusConfig } from './config';

// ============================================================================
// Types
// ============================================================================

export interface CreateChangeInput {
  name?: string;
  description?: string;
  type?: string;
  category?: string;
  priority?: string;
  risk_level?: string;
  impact_description?: string;
  rollback_plan?: string;
  implementation_plan?: string;
  assigned_to?: string;
  affected_services?: string;
  scheduled_start?: unknown;
  scheduled_end?: unknown;
}

export interface CreateRfcInput {
  change_request_id?: string;
  justification?: string;
  risk_assessment?: string;
  test_plan?: string;
  communication_plan?: string;
  backout_plan?: string;
  title?: string;
  status?: string;
  author?: string;
}

export interface CreateCabInput {
  title?: string;
  description?: string;
  scheduled_at: unknown;
  location?: string;
  attendees?: string;
}

export interface TimelineEventInput {
  event_type: string;
  description: string;
}

export interface AddDecisionInput {
  changeRequestId: string;
  decision: "approved" | "rejected" | "deferred";
  notes?: string;
}

// ============================================================================
// Helper
// ============================================================================

const toISO = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (typeof (v as any).toISOString === 'function') return (v as any).toISOString();
  return undefined;
};

const splitCsv = (s: string | undefined): string[] | undefined =>
  s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined;

// ============================================================================
// Hook
// ============================================================================

export const useChangeManagementState = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<string>('requests');
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterPriority, setFilterPriority] = useState<string | undefined>();

  // Detail state
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // AI Risk Analysis (TR-03)
  const [riskAnalysis, setRiskAnalysis] = useState<ChangeRiskAnalysis | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  // Timeline state
  const [timeline, setTimeline] = useState<ChangeTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // RFC state
  const [rfcs, setRfcs] = useState<RFC[]>([]);
  const [rfcTotal, setRfcTotal] = useState(0);
  const [rfcLoading, setRfcLoading] = useState(false);
  const [rfcPage, setRfcPage] = useState(1);

  // CAB state
  const [cabMeetings, setCabMeetings] = useState<CABMeeting[]>([]);
  const [cabTotal, setCabTotal] = useState(0);
  const [cabLoading, setCabLoading] = useState(false);
  const [cabPage, setCabPage] = useState(1);

  // Stats state
  const [stats, setStats] = useState<ChangeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);
  const [statusNoteModalOpen, setStatusNoteModalOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string>('');
  const [rfcModalOpen, setRfcModalOpen] = useState(false);
  const [rfcDetailModalOpen, setRfcDetailModalOpen] = useState(false);
  const [selectedRfc, setSelectedRfc] = useState<RFC | null>(null);
  const [editRfcId, setEditRfcId] = useState<string | null>(null);
  const [cabModalOpen, setCabModalOpen] = useState(false);
  const [cabDetailModalOpen, setCabDetailModalOpen] = useState(false);
  const [selectedCab, setSelectedCab] = useState<CABMeeting | null>(null);
  const [editCabId, setEditCabId] = useState<string | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);

  // Submitting states
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getChangeStats();
      setStats(data);
    } catch {
      // API may not be fully ready
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadChanges = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        status?: string;
        type?: string;
        priority?: string;
        limit: number;
        offset: number;
      } = { limit: pageSize, offset: (page - 1) * pageSize };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (filterPriority) params.priority = filterPriority;
      const res = await getChangeRequests(params);
      setChanges(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total || 0);
    } catch {
      message.error('加载变更请求列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, filterType, filterPriority]);

  const loadTimeline = useCallback(async (changeId: string) => {
    setTimelineLoading(true);
    try {
      const data = await getChangeTimeline(changeId);
      setTimeline(Array.isArray(data) ? data : []);
    } catch {
      // Timeline may not exist yet
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadRfcs = useCallback(async () => {
    setRfcLoading(true);
    try {
      const res = await getRFCs({ limit: pageSize, offset: (rfcPage - 1) * pageSize });
      setRfcs(Array.isArray(res.data) ? res.data : []);
      setRfcTotal(res.total || 0);
    } catch {
      message.error('加载 RFC 列表失败');
    } finally {
      setRfcLoading(false);
    }
  }, [rfcPage, pageSize]);

  const loadCabMeetings = useCallback(async () => {
    setCabLoading(true);
    try {
      const res = await getCABMeetings({ limit: pageSize, offset: (cabPage - 1) * pageSize });
      setCabMeetings(Array.isArray(res.data) ? res.data : []);
      setCabTotal(res.total || 0);
    } catch {
      message.error('加载 CAB 会议列表失败');
    } finally {
      setCabLoading(false);
    }
  }, [cabPage, pageSize]);

  useEffect(() => {
    loadStats();
    loadChanges();
  }, [loadChanges, loadStats]);

  useEffect(() => {
    if (activeTab === 'rfc') loadRfcs();
    if (activeTab === 'cab') loadCabMeetings();
  }, [activeTab, loadRfcs, loadCabMeetings]);

  // ============================================================================
  // Change Request Handlers
  // ============================================================================

  const handleCreate = async (values: CreateChangeInput) => {
    setCreateSubmitting(true);
    try {
      const payload = {
        ...values,
        affected_services: splitCsv(values.affected_services),
        scheduled_start: toISO(values.scheduled_start),
        scheduled_end: toISO(values.scheduled_end),
      };
      await createChangeRequest(payload as any);
      message.success('变更请求创建成功');
      setCreateModalOpen(false);
      loadChanges();
      loadStats();
    } catch {
      message.error('创建变更请求失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEdit = async (values: CreateChangeInput) => {
    if (!selectedChange) return;
    setEditSubmitting(true);
    try {
      const payload = {
        ...values,
        affected_services: splitCsv(values.affected_services),
        scheduled_start: toISO(values.scheduled_start),
        scheduled_end: toISO(values.scheduled_end),
      };
      await updateChangeRequest(selectedChange.id, payload as any);
      message.success('变更请求更新成功');
      setEditModalOpen(false);
      // Refresh detail
      const updated = await getChangeRequest(selectedChange.id);
      setSelectedChange(updated);
      loadChanges();
    } catch {
      message.error('更新变更请求失败');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteChangeRequest(id);
      message.success('变更请求已删除');
      if (selectedChange?.id === id) {
        setSelectedChange(null);
        setActiveTab('requests');
      }
      loadChanges();
      loadStats();
    } catch {
      message.error('删除变更请求失败');
    }
  };

  const handleViewDetail = async (record: ChangeRequest) => {
    setDetailLoading(true);
    setActiveTab('detail');
    try {
      const detail = await getChangeRequest(record.id);
      setSelectedChange(detail);
      loadTimeline(record.id);
    } catch {
      message.error('加载变更详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'cancelled') {
      // Cancel requires confirmation but no special note
      Modal.confirm({
        title: '确认取消变更',
        content: '确定要取消此变更请求吗？此操作不可撤销。',
        okText: '确认取消',
        cancelText: '返回',
        okButtonProps: { danger: true },
        onOk: async () => {
          if (!selectedChange) return;
          try {
            const updated = await updateChangeRequestStatus(selectedChange.id, 'cancelled');
            setSelectedChange(updated);
            message.success('变更请求已取消');
            loadChanges();
            loadStats();
          } catch {
            message.error('取消变更请求失败');
          }
        },
      });
      return;
    }
    setPendingStatusChange(newStatus);
    setStatusNoteModalOpen(true);
  };

  const handleConfirmStatusChange = async (note: string) => {
    if (!selectedChange || !pendingStatusChange) return;
    try {
      const updated = await updateChangeRequestStatus(
        selectedChange.id,
        pendingStatusChange,
        note
      );
      setSelectedChange(updated);
      message.success(
        `状态已变更为: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`
      );
      setStatusNoteModalOpen(false);
      setPendingStatusChange('');
      loadTimeline(selectedChange.id);
      loadChanges();
      loadStats();
    } catch {
      message.error('状态变更失败');
    }
  };

  const handleOpenEditModal = () => {
    setEditModalOpen(true);
  };

  const handleRiskAnalysis = async () => {
    if (!selectedChange) return;
    setRiskLoading(true);
    try {
      const analysis = await getChangeRiskAnalysis(selectedChange.id);
      setRiskAnalysis(analysis);
      message.success('AI 风险分析完成');
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : 'AI 风险分析失败，请稍后重试'
      );
    } finally {
      setRiskLoading(false);
    }
  };

  // ============================================================================
  // Timeline Handlers
  // ============================================================================

  const handleAddTimelineEvent = async (values: TimelineEventInput) => {
    if (!selectedChange) return;
    try {
      await addChangeTimelineEvent(selectedChange.id, {
        event_type: values.event_type,
        description: values.description,
      });
      message.success('时间线事件已添加');
      setAddEventModalOpen(false);
      loadTimeline(selectedChange.id);
    } catch {
      message.error('添加时间线事件失败');
    }
  };

  // ============================================================================
  // RFC Handlers
  // ============================================================================

  const handleCreateRfc = async (values: CreateRfcInput) => {
    try {
      await createRFC(values as any);
      message.success('RFC 创建成功');
      setRfcModalOpen(false);
      setEditRfcId(null);
      loadRfcs();
    } catch {
      message.error('创建 RFC 失败');
    }
  };

  const handleUpdateRfc = async (values: CreateRfcInput) => {
    if (!editRfcId) return;
    try {
      await updateRFC(editRfcId, values as any);
      message.success('RFC 更新成功');
      setRfcModalOpen(false);
      setEditRfcId(null);
      loadRfcs();
    } catch {
      message.error('更新 RFC 失败');
    }
  };

  const handleViewRfc = async (record: RFC) => {
    try {
      const detail = await getRFC(record.id);
      setSelectedRfc(detail);
      setRfcDetailModalOpen(true);
    } catch {
      message.error('加载 RFC 详情失败');
    }
  };

  const handleEditRfc = (record: RFC) => {
    setEditRfcId(record.id);
    setRfcModalOpen(true);
  };

  // ============================================================================
  // CAB Meeting Handlers
  // ============================================================================

  const handleCreateCab = async (values: CreateCabInput) => {
    try {
      const payload = {
        ...values,
        scheduled_at: toISO(values.scheduled_at) || (values.scheduled_at as any).toISOString(),
        attendees: splitCsv(values.attendees),
      };
      await createCABMeeting(payload as any);
      message.success('CAB 会议创建成功');
      setCabModalOpen(false);
      setEditCabId(null);
      loadCabMeetings();
    } catch {
      message.error('创建 CAB 会议失败');
    }
  };

  const handleUpdateCab = async (values: CreateCabInput) => {
    if (!editCabId) return;
    try {
      const payload: Record<string, unknown> = { ...values };
      payload.scheduled_at = toISO(values.scheduled_at) || (values.scheduled_at as any).toISOString();
      payload.attendees = splitCsv(values.attendees);
      await updateCABMeeting(editCabId, payload);
      message.success('CAB 会议更新成功');
      setCabModalOpen(false);
      setEditCabId(null);
      loadCabMeetings();
    } catch {
      message.error('更新 CAB 会议失败');
    }
  };

  const handleViewCab = async (record: CABMeeting) => {
    try {
      const detail = await getCABMeeting(record.id);
      setSelectedCab(detail);
      setCabDetailModalOpen(true);
    } catch {
      message.error('加载 CAB 会议详情失败');
    }
  };

  const handleEditCab = (record: CABMeeting) => {
    setEditCabId(record.id);
    setCabModalOpen(true);
  };

  const handleAddDecision = async (values: AddDecisionInput) => {
    if (!selectedCab) return;
    try {
      await addCABDecision(selectedCab.id, {
        changeRequestId: values.changeRequestId,
        decision: values.decision,
        notes: values.notes,
      });
      message.success('决策记录已添加');
      setDecisionModalOpen(false);
      // Refresh CAB detail
      const updated = await getCABMeeting(selectedCab.id);
      setSelectedCab(updated);
      loadCabMeetings();
    } catch {
      message.error('添加决策记录失败');
    }
  };

  return {
    // State
    activeTab, setActiveTab,
    changes, setChanges,
    total, setTotal,
    loading,
    page, setPage,
    pageSize, setPageSize,
    filterStatus, setFilterStatus,
    filterType, setFilterType,
    filterPriority, setFilterPriority,
    selectedChange, setSelectedChange,
    detailLoading,
    riskAnalysis, setRiskAnalysis,
    riskLoading,
    timeline, setTimeline,
    timelineLoading,
    rfcs, setRfcs,
    rfcTotal, setRfcTotal,
    rfcLoading,
    rfcPage, setRfcPage,
    cabMeetings, setCabMeetings,
    cabTotal, setCabTotal,
    cabLoading,
    cabPage, setCabPage,
    stats, setStats,
    statsLoading,
    createModalOpen, setCreateModalOpen,
    editModalOpen, setEditModalOpen,
    addEventModalOpen, setAddEventModalOpen,
    statusNoteModalOpen, setStatusNoteModalOpen,
    pendingStatusChange, setPendingStatusChange,
    rfcModalOpen, setRfcModalOpen,
    rfcDetailModalOpen, setRfcDetailModalOpen,
    selectedRfc, setSelectedRfc,
    editRfcId, setEditRfcId,
    cabModalOpen, setCabModalOpen,
    cabDetailModalOpen, setCabDetailModalOpen,
    selectedCab, setSelectedCab,
    editCabId, setEditCabId,
    decisionModalOpen, setDecisionModalOpen,
    createSubmitting,
    editSubmitting,
    // Loaders
    loadChanges,
    loadTimeline,
    loadRfcs,
    loadCabMeetings,
    loadStats,
    // Change handlers
    handleCreate,
    handleEdit,
    handleDelete,
    handleViewDetail,
    handleStatusChange,
    handleConfirmStatusChange,
    handleOpenEditModal,
    handleRiskAnalysis,
    // Timeline
    handleAddTimelineEvent,
    // RFC
    handleCreateRfc,
    handleUpdateRfc,
    handleViewRfc,
    handleEditRfc,
    // CAB
    handleCreateCab,
    handleUpdateCab,
    handleViewCab,
    handleEditCab,
    handleAddDecision,
  };
};
