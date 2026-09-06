/**
 * useIncidentState — hook owning all state, data loading, and event handlers
 * for the Incident Management page. Extracted from index.tsx to reduce line
 * count and improve readability.
 *
 * The hook is the single source of truth for incident lifecycle state: list,
 * detail, timeline, postmortem, stats, modal visibility, form instances, and
 * all CRUD/status/assign/escalate/timeline/postmortem handlers.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { message, Form } from 'antd';
import {
  getIncidents,
  getIncident,
  createIncident,
  updateIncident,
  deleteIncident,
  updateIncidentStatus,
  assignIncident,
  escalateIncident,
  getIncidentTimeline,
  addTimelineEvent,
  getPostmortem,
  createPostmortem,
  publishPostmortem,
  getPostmortemDraft,
  getIncidentStats,
} from '@/api/incident';
import type {
  Incident,
  IncidentStats,
  TimelineEvent,
  Postmortem,
  PostmortemDraft,
} from '@/api/incident';
import { statusConfig } from './config';
import { buildIncidentColumns } from './columns';
import type { TableColumn } from '@/components/Table';

export type IncidentFormInstance = ReturnType<typeof Form.useForm>[0];

export interface UseIncidentStateResult {
  // State
  activeTab: string;
  setActiveTab: (v: string) => void;
  incidents: Incident[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  searchQuery: string;
  filters: Record<string, string | string[] | undefined>;
  selectedIncident: Incident | null;
  detailLoading: boolean;
  timeline: TimelineEvent[];
  timelineLoading: boolean;
  postmortem: Postmortem | null;
  postmortemLoading: boolean;
  aiDraft: PostmortemDraft | null;
  aiDraftLoading: boolean;
  stats: IncidentStats | null;
  statsLoading: boolean;
  createModalOpen: boolean;
  editModalOpen: boolean;
  assignModalOpen: boolean;
  escalateModalOpen: boolean;
  postmortemModalOpen: boolean;
  addEventModalOpen: boolean;
  statusNoteModalOpen: boolean;
  pendingStatusChange: string;
  createSubmitting: boolean;
  editSubmitting: boolean;
  // Setters
  setTotal: (v: number) => void;
  setPage: (v: number) => void;
  setPageSize: (v: number) => void;
  setSearchQuery: (v: string) => void;
  setFilters: (v: Record<string, string | string[] | undefined>) => void;
  setSelectedIncident: (v: Incident | null) => void;
  setTimeline: (v: TimelineEvent[]) => void;
  setPostmortem: (v: Postmortem | null) => void;
  setAiDraft: (v: PostmortemDraft | null) => void;
  setCreateModalOpen: (v: boolean) => void;
  setEditModalOpen: (v: boolean) => void;
  setAssignModalOpen: (v: boolean) => void;
  setEscalateModalOpen: (v: boolean) => void;
  setPostmortemModalOpen: (v: boolean) => void;
  setAddEventModalOpen: (v: boolean) => void;
  setStatusNoteModalOpen: (v: boolean) => void;
  setPendingStatusChange: (v: string) => void;
  setCreateSubmitting: (v: boolean) => void;
  setEditSubmitting: (v: boolean) => void;
  // Loaders
  loadIncidents: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadTimeline: (id: string) => Promise<void>;
  // Handlers
  handleViewDetail: (record: Incident) => void;
  handleBackToList: () => void;
  handleCreate: () => Promise<void>;
  handleOpenEdit: (record: Incident) => void;
  handleEdit: () => Promise<void>;
  handleDelete: (record: Incident) => Promise<void>;
  handleStatusChange: (newStatus: string) => void;
  handleConfirmStatusChange: () => Promise<void>;
  handleOpenAssign: () => void;
  handleAssign: () => Promise<void>;
  handleOpenEscalate: () => void;
  handleEscalate: () => Promise<void>;
  handleAddEvent: () => Promise<void>;
  handleCreatePostmortem: () => Promise<void>;
  handlePublishPostmortem: () => Promise<void>;
  handleGenerateDraft: () => Promise<void>;
  handleFillDraftToForm: () => void;
  // Memoized columns
  columns: TableColumn<Incident>[];
  // Forms
  createForm: IncidentFormInstance;
  editForm: IncidentFormInstance;
  assignForm: IncidentFormInstance;
  escalateForm: IncidentFormInstance;
  postmortemForm: IncidentFormInstance;
  eventForm: IncidentFormInstance;
  statusNoteForm: IncidentFormInstance;
}

export function useIncidentState(): UseIncidentStateResult {
  // --- State ---
  const [activeTab, setActiveTab] = useState<string>('list');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Detail state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Timeline state
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Postmortem state
  const [postmortem, setPostmortem] = useState<Postmortem | null>(null);
  const [postmortemLoading, setPostmortemLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<PostmortemDraft | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);

  // Stats state
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [postmortemModalOpen, setPostmortemModalOpen] = useState(false);
  const [addEventModalOpen, setAddEventModalOpen] = useState(false);
  const [statusNoteModalOpen, setStatusNoteModalOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string>('');

  // Submitting states
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Forms
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [postmortemForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [statusNoteForm] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (filters.severity && filters.severity !== 'all') params.severity = filters.severity;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      const result = await getIncidents(params);
      let filtered = result.incidents;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q) ||
            i.assigned_to?.toLowerCase().includes(q) ||
            i.id.toLowerCase().includes(q)
        );
      }
      setIncidents(filtered);
      setTotal(result.total);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`加载事件列表失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, searchQuery]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getIncidentStats();
      setStats(data);
    } catch {
      // Stats are non-critical; fail silently
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadIncidentDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await getIncident(id);
      setSelectedIncident(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`加载事件详情失败: ${msg}`);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async (id: string) => {
    setTimelineLoading(true);
    try {
      const data = await getIncidentTimeline(id);
      setTimeline(data);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadPostmortem = useCallback(async (id: string) => {
    setPostmortemLoading(true);
    try {
      const data = await getPostmortem(id);
      setPostmortem(data);
    } catch {
      setPostmortem(null);
    } finally {
      setPostmortemLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (selectedIncident) {
      if (activeTab === 'detail') {
        loadIncidentDetail(selectedIncident.id);
      } else if (activeTab === 'timeline') {
        loadTimeline(selectedIncident.id);
      } else if (activeTab === 'postmortem') {
        loadPostmortem(selectedIncident.id);
      }
    }
  }, [activeTab, selectedIncident?.id, loadIncidentDetail, loadTimeline, loadPostmortem]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleViewDetail = useCallback((record: Incident) => {
    setSelectedIncident(record);
    setActiveTab('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedIncident(null);
    setActiveTab('list');
    loadIncidents();
  }, [loadIncidents]);

  const handleCreate = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      await createIncident({
        title: values.title,
        type: values.type || 'incident',
        severity: values.severity,
        description: values.description,
        impact: values.impact,
        urgency: values.urgency,
        assigned_to: values.assigned_to,
        detected_by: values.detected_by,
        affected_services: values.affected_services
          ? values.affected_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        tags: values.tags
          ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      });
      message.success('事件创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadIncidents();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('validate')) {
        message.error(`创建失败: ${error.message}`);
      }
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, loadIncidents, loadStats]);

  const handleOpenEdit = useCallback(
    (record: Incident) => {
      setSelectedIncident(record);
      editForm.setFieldsValue({
        title: record.title,
        severity: record.severity,
        priority: record.priority,
        description: record.description,
        impact: record.impact,
        urgency: record.urgency,
        assigned_to: record.assigned_to,
        detected_by: record.detected_by,
        affected_services: record.affected_services?.join(', '),
        tags: record.tags?.join(', '),
      });
      setEditModalOpen(true);
    },
    [editForm]
  );

  const handleEdit = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      await updateIncident(selectedIncident.id, {
        title: values.title,
        severity: values.severity,
        priority: values.priority,
        description: values.description,
        impact: values.impact,
        urgency: values.urgency,
        assigned_to: values.assigned_to,
        detected_by: values.detected_by,
        affected_services: values.affected_services
          ? values.affected_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        tags: values.tags
          ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      });
      message.success('事件更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      loadIncidents();
      if (activeTab === 'detail') {
        loadIncidentDetail(selectedIncident.id);
      }
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('validate')) {
        message.error(`更新失败: ${error.message}`);
      }
    } finally {
      setEditSubmitting(false);
    }
  }, [selectedIncident, editForm, activeTab, loadIncidents, loadIncidentDetail]);

  const handleDelete = useCallback(
    async (record: Incident) => {
      try {
        await deleteIncident(record.id);
        message.success('事件已删除');
        if (selectedIncident?.id === record.id) {
          setSelectedIncident(null);
          setActiveTab('list');
        }
        loadIncidents();
        loadStats();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`删除失败: ${msg}`);
      }
    },
    [selectedIncident, loadIncidents, loadStats]
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      setPendingStatusChange(newStatus);
      statusNoteForm.resetFields();
      setStatusNoteModalOpen(true);
    },
    [statusNoteForm]
  );

  const handleConfirmStatusChange = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const note = statusNoteForm.getFieldValue('note');
      await updateIncidentStatus(selectedIncident.id, pendingStatusChange, note);
      message.success(
        `状态已变更为: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`
      );
      setStatusNoteModalOpen(false);
      statusNoteForm.resetFields();
      loadIncidentDetail(selectedIncident.id);
      loadIncidents();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`状态变更失败: ${msg}`);
    }
  }, [
    selectedIncident,
    pendingStatusChange,
    statusNoteForm,
    loadIncidentDetail,
    loadIncidents,
    loadStats,
  ]);

  const handleOpenAssign = useCallback(() => {
    assignForm.resetFields();
    if (selectedIncident?.commander_id) {
      assignForm.setFieldsValue({ commander_id: selectedIncident.commander_id });
    }
    setAssignModalOpen(true);
  }, [selectedIncident, assignForm]);

  const handleAssign = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const values = await assignForm.validateFields();
      await assignIncident(selectedIncident.id, values.commander_id);
      message.success('指挥官已分配');
      setAssignModalOpen(false);
      assignForm.resetFields();
      loadIncidentDetail(selectedIncident.id);
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('validate')) {
        message.error(`分配失败: ${error.message}`);
      }
    }
  }, [selectedIncident, assignForm, loadIncidentDetail]);

  const handleOpenEscalate = useCallback(() => {
    escalateForm.resetFields();
    setEscalateModalOpen(true);
  }, [escalateForm]);

  const handleEscalate = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const values = await escalateForm.validateFields();
      await escalateIncident(selectedIncident.id, {
        to_level: values.to_level,
        reason: values.reason,
      });
      message.success('事件已升级');
      setEscalateModalOpen(false);
      escalateForm.resetFields();
      loadIncidentDetail(selectedIncident.id);
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('validate')) {
        message.error(`升级失败: ${error.message}`);
      }
    }
  }, [selectedIncident, escalateForm, loadIncidentDetail]);

  const handleAddEvent = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const values = await eventForm.validateFields();
      await addTimelineEvent(selectedIncident.id, {
        event_type: values.event_type,
        description: values.description,
      });
      message.success('事件记录已添加');
      setAddEventModalOpen(false);
      eventForm.resetFields();
      loadTimeline(selectedIncident.id);
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('validate')) {
        message.error(`添加失败: ${error.message}`);
      }
    }
  }, [selectedIncident, eventForm, loadTimeline]);

  const handleCreatePostmortem = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const values = await postmortemForm.validateFields();
      await createPostmortem(selectedIncident.id, {
        title: values.title,
        summary: values.summary,
        root_cause: values.root_cause,
        impact_description: values.impact_description,
        timeline_summary: values.timeline_summary,
        action_items: values.action_items
          ? values.action_items.split('\n').filter(Boolean).map((item: string) => ({ description: item.trim() }))
          : [],
        lessons_learned: values.lessons_learned,
      });
      message.success('复盘文档已创建');
      setPostmortemModalOpen(false);
      postmortemForm.resetFields();
      loadPostmortem(selectedIncident.id);
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('validate')) {
        message.error(`创建复盘失败: ${error.message}`);
      }
    }
  }, [selectedIncident, postmortemForm, loadPostmortem]);

  const handlePublishPostmortem = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      await publishPostmortem(selectedIncident.id);
      message.success('复盘文档已发布');
      loadPostmortem(selectedIncident.id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`发布失败: ${msg}`);
    }
  }, [selectedIncident, loadPostmortem]);

  const handleGenerateDraft = useCallback(async () => {
    if (!selectedIncident) return;
    setAiDraftLoading(true);
    setAiDraft(null);
    try {
      const draft = await getPostmortemDraft(selectedIncident.id);
      setAiDraft(draft);
      message.success('AI 复盘草稿已生成');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`生成复盘草稿失败: ${msg}`);
    } finally {
      setAiDraftLoading(false);
    }
  }, [selectedIncident]);

  const handleFillDraftToForm = useCallback(() => {
    if (!aiDraft) return;
    postmortemForm.setFieldsValue({
      title: aiDraft.title,
      summary: aiDraft.summary,
      root_cause: aiDraft.root_cause,
      timeline_summary: aiDraft.timeline_summary,
      action_items: aiDraft.action_items?.join('\n'),
      lessons_learned: aiDraft.lessons_learned,
    });
    setPostmortemModalOpen(true);
    setAiDraft(null);
    message.info('草稿已填入表单，请审核后创建');
  }, [aiDraft, postmortemForm]);

  // ============================================================================
  // Memoized columns & filters
  // ============================================================================

  const columns = useMemo(
    () => buildIncidentColumns({ handleViewDetail, handleOpenEdit, handleDelete }),
    [handleViewDetail, handleOpenEdit, handleDelete]
  );

  return {
    // State
    activeTab,
    setActiveTab,
    incidents,
    total,
    loading,
    page,
    pageSize,
    searchQuery,
    filters,
    selectedIncident,
    detailLoading,
    timeline,
    timelineLoading,
    postmortem,
    postmortemLoading,
    aiDraft,
    aiDraftLoading,
    stats,
    statsLoading,
    createModalOpen,
    editModalOpen,
    assignModalOpen,
    escalateModalOpen,
    postmortemModalOpen,
    addEventModalOpen,
    statusNoteModalOpen,
    pendingStatusChange,
    createSubmitting,
    editSubmitting,
    // Setters
    setTotal,
    setPage,
    setPageSize,
    setSearchQuery,
    setFilters,
    setSelectedIncident,
    setTimeline,
    setPostmortem,
    setAiDraft,
    setCreateModalOpen,
    setEditModalOpen,
    setAssignModalOpen,
    setEscalateModalOpen,
    setPostmortemModalOpen,
    setAddEventModalOpen,
    setStatusNoteModalOpen,
    setPendingStatusChange,
    setCreateSubmitting,
    setEditSubmitting,
    // Loaders
    loadIncidents,
    loadStats,
    loadTimeline,
    // Handlers
    handleViewDetail,
    handleBackToList,
    handleCreate,
    handleOpenEdit,
    handleEdit,
    handleDelete,
    handleStatusChange,
    handleConfirmStatusChange,
    handleOpenAssign,
    handleAssign,
    handleOpenEscalate,
    handleEscalate,
    handleAddEvent,
    handleCreatePostmortem,
    handlePublishPostmortem,
    handleGenerateDraft,
    handleFillDraftToForm,
    // Memoized columns
    columns,
    // Forms
    createForm,
    editForm,
    assignForm,
    escalateForm,
    postmortemForm,
    eventForm,
    statusNoteForm,
  };
}
