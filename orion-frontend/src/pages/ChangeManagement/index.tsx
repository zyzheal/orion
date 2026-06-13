/**
 * Change Management Page
 *
 * Comprehensive change lifecycle management with:
 * - Stats bar: total requests, status breakdown, type breakdown
 * - Tab 1: Change requests list with filters, table, CRUD operations
 * - Tab 2: Change detail with status transitions, timeline, timeline event form
 * - Tab 3: RFC management with CRUD
 * - Tab 4: CAB meetings with CRUD and decision recording
 *
 * API: @/api/change
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Tabs,
  Timeline,
  Empty,
  message,
  Form,
  Select,
  Input,
  Descriptions,
  Popconfirm,
  Modal,
  Row,
  Col,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  SendOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CloseCircleOutlined,
  SwapOutlined,
  FileTextOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors, spacing, radius, shadows } from '@/tokens';
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
} from '@/api/change';
import type {
  ChangeRequest,
  CABMeeting,
  ChangeTimelineEvent,
  RFC,
  ChangeStats,
} from '@/api/change';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Configuration Maps
// ============================================================================

/** Change type display config */
const typeConfig: Record<string, { color: string; label: string }> = {
  standard: { color: 'blue', label: '标准' },
  normal: { color: 'cyan', label: '普通' },
  emergency: { color: 'red', label: '紧急' },
};

/** Priority display config */
const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '严重' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'green', label: '低' },
};

/** Risk level display config */
const riskConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高风险' },
  medium: { color: 'orange', label: '中风险' },
  low: { color: 'green', label: '低风险' },
};

/** Change request status display config */
const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  submitted: { color: 'blue', label: '已提交' },
  approved: { color: 'green', label: '已批准' },
  rejected: { color: 'red', label: '已拒绝' },
  in_progress: { color: 'orange', label: '实施中' },
  completed: { color: 'cyan', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
  closed: { color: 'default', label: '已关闭' },
};

/** RFC status display config */
const rfcStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  pending_review: { color: 'orange', label: '待审核' },
  approved: { color: 'green', label: '已批准' },
  rejected: { color: 'red', label: '已拒绝' },
};

/** CAB meeting status display config */
const cabStatusConfig: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: '已安排' },
  in_progress: { color: 'orange', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
};

/** Status transition map: current status -> allowed next statuses */
const statusTransitions: Record<
  string,
  Array<{ status: string; label: string; icon: React.ReactNode; danger?: boolean }>
> = {
  draft: [
    { status: 'submitted', label: '提交审批', icon: <SendOutlined /> },
  ],
  submitted: [
    { status: 'approved', label: '批准', icon: <CheckCircleOutlined /> },
    { status: 'rejected', label: '拒绝', icon: <CloseCircleOutlined />, danger: true },
  ],
  approved: [
    { status: 'in_progress', label: '开始实施', icon: <PlayCircleOutlined /> },
  ],
  in_progress: [
    { status: 'completed', label: '完成', icon: <CheckCircleOutlined /> },
  ],
  completed: [
    { status: 'closed', label: '关闭', icon: <StopOutlined /> },
  ],
  rejected: [],
  cancelled: [],
  closed: [],
};

/** Timeline event type display config */
const eventTypeConfig: Record<string, { color: string; label: string }> = {
  created: { color: 'blue', label: '创建' },
  submitted: { color: 'cyan', label: '提交' },
  approved: { color: 'green', label: '批准' },
  rejected: { color: 'red', label: '拒绝' },
  started: { color: 'orange', label: '开始实施' },
  completed: { color: 'green', label: '完成' },
  closed: { color: 'default', label: '关闭' },
  cancelled: { color: 'default', label: '取消' },
  update: { color: 'blue', label: '更新' },
  comment: { color: 'purple', label: '备注' },
  risk_change: { color: 'orange', label: '风险变更' },
};

// ============================================================================
// ChangeManagement Component
// ============================================================================

const ChangeManagement: React.FC = () => {
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

  // Forms
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [statusNoteForm] = Form.useForm();
  const [rfcForm] = Form.useForm();
  const [cabForm] = Form.useForm();
  const [decisionForm] = Form.useForm();

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
      const params: Record<string, unknown> = { limit: pageSize, offset: (page - 1) * pageSize };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (filterPriority) params.priority = filterPriority;
      const res = await getChangeRequests(params as any);
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

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const payload = {
        ...values,
        affected_services: values.affected_services
          ? values.affected_services.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        scheduled_start: values.scheduled_start?.toISOString(),
        scheduled_end: values.scheduled_end?.toISOString(),
      };
      await createChangeRequest(payload);
      message.success('变更请求创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadChanges();
      loadStats();
    } catch (err: any) {
      if (err?.errorFields) return; // form validation
      message.error('创建变更请求失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedChange) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      const payload = {
        ...values,
        affected_services: values.affected_services
          ? (typeof values.affected_services === 'string'
              ? values.affected_services.split(',').map((s: string) => s.trim()).filter(Boolean)
              : values.affected_services)
          : undefined,
        scheduled_start: values.scheduled_start?.toISOString?.() || values.scheduled_start,
        scheduled_end: values.scheduled_end?.toISOString?.() || values.scheduled_end,
      };
      await updateChangeRequest(selectedChange.id, payload);
      message.success('变更请求更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      // Refresh detail
      const updated = await getChangeRequest(selectedChange.id);
      setSelectedChange(updated);
      loadChanges();
    } catch (err: any) {
      if (err?.errorFields) return;
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

  const handleConfirmStatusChange = async () => {
    if (!selectedChange || !pendingStatusChange) return;
    try {
      const values = await statusNoteForm.validateFields();
      const updated = await updateChangeRequestStatus(
        selectedChange.id,
        pendingStatusChange,
        values.note
      );
      setSelectedChange(updated);
      message.success(`状态已变更为: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`);
      setStatusNoteModalOpen(false);
      statusNoteForm.resetFields();
      setPendingStatusChange('');
      loadTimeline(selectedChange.id);
      loadChanges();
      loadStats();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('状态变更失败');
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedChange) return;
    editForm.setFieldsValue({
      title: selectedChange.title,
      description: selectedChange.description,
      type: selectedChange.type,
      category: selectedChange.category,
      priority: selectedChange.priority,
      risk_level: selectedChange.risk_level,
      impact_description: selectedChange.impact_description,
      rollback_plan: selectedChange.rollback_plan,
      implementation_plan: selectedChange.implementation_plan,
      scheduled_start: selectedChange.scheduled_start ? dayjs(selectedChange.scheduled_start) : undefined,
      scheduled_end: selectedChange.scheduled_end ? dayjs(selectedChange.scheduled_end) : undefined,
      assigned_to: selectedChange.assigned_to,
      affected_services: selectedChange.affected_services?.join(', '),
    });
    setEditModalOpen(true);
  };

  // ============================================================================
  // Timeline Handlers
  // ============================================================================

  const handleAddTimelineEvent = async () => {
    if (!selectedChange) return;
    try {
      const values = await eventForm.validateFields();
      await addChangeTimelineEvent(selectedChange.id, {
        event_type: values.event_type,
        description: values.description,
      });
      message.success('时间线事件已添加');
      setAddEventModalOpen(false);
      eventForm.resetFields();
      loadTimeline(selectedChange.id);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('添加时间线事件失败');
    }
  };

  // ============================================================================
  // RFC Handlers
  // ============================================================================

  const handleCreateRfc = async () => {
    try {
      const values = await rfcForm.validateFields();
      await createRFC(values);
      message.success('RFC 创建成功');
      setRfcModalOpen(false);
      rfcForm.resetFields();
      setEditRfcId(null);
      loadRfcs();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('创建 RFC 失败');
    }
  };

  const handleUpdateRfc = async () => {
    if (!editRfcId) return;
    try {
      const values = await rfcForm.validateFields();
      await updateRFC(editRfcId, values);
      message.success('RFC 更新成功');
      setRfcModalOpen(false);
      rfcForm.resetFields();
      setEditRfcId(null);
      loadRfcs();
    } catch (err: any) {
      if (err?.errorFields) return;
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
    rfcForm.setFieldsValue({
      change_request_id: record.change_request_id,
      justification: record.justification,
      risk_assessment: record.risk_assessment,
      test_plan: record.test_plan,
      communication_plan: record.communication_plan,
      backout_plan: record.backout_plan,
    });
    setRfcModalOpen(true);
  };

  // ============================================================================
  // CAB Meeting Handlers
  // ============================================================================

  const handleCreateCab = async () => {
    try {
      const values = await cabForm.validateFields();
      const payload = {
        ...values,
        scheduled_at: values.scheduled_at.toISOString(),
        attendees: values.attendees
          ? values.attendees.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      };
      await createCABMeeting(payload);
      message.success('CAB 会议创建成功');
      setCabModalOpen(false);
      cabForm.resetFields();
      setEditCabId(null);
      loadCabMeetings();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('创建 CAB 会议失败');
    }
  };

  const handleUpdateCab = async () => {
    if (!editCabId) return;
    try {
      const values = await cabForm.validateFields();
      const payload: Record<string, any> = { ...values };
      if (values.scheduled_at?.toISOString) {
        payload.scheduled_at = values.scheduled_at.toISOString();
      }
      if (values.attendees && typeof values.attendees === 'string') {
        payload.attendees = values.attendees.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      await updateCABMeeting(editCabId, payload);
      message.success('CAB 会议更新成功');
      setCabModalOpen(false);
      cabForm.resetFields();
      setEditCabId(null);
      loadCabMeetings();
    } catch (err: any) {
      if (err?.errorFields) return;
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
    cabForm.setFieldsValue({
      title: record.title,
      description: record.description,
      scheduled_at: dayjs(record.scheduled_at),
      location: record.location,
      attendees: record.attendees?.join(', '),
    });
    setCabModalOpen(true);
  };

  const handleAddDecision = async () => {
    if (!selectedCab) return;
    try {
      const values = await decisionForm.validateFields();
      await addCABDecision(selectedCab.id, {
        changeRequestId: values.changeRequestId,
        decision: values.decision,
        notes: values.notes,
      });
      message.success('决策记录已添加');
      setDecisionModalOpen(false);
      decisionForm.resetFields();
      // Refresh CAB detail
      const updated = await getCABMeeting(selectedCab.id);
      setSelectedCab(updated);
      loadCabMeetings();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('添加决策记录失败');
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const changeColumns: TableColumn<ChangeRequest>[] = [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_: unknown, record: ChangeRequest) => (
        <a onClick={() => handleViewDetail(record)}>{record.title}</a>
      ),
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (_: unknown, record: ChangeRequest) => {
        const cfg = typeConfig[record.type];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.type}</Tag>;
      },
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (_: unknown, record: ChangeRequest) => {
        const cfg = priorityConfig[record.priority];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.priority}</Tag>;
      },
    },
    {
      key: 'risk_level',
      title: '风险',
      dataIndex: 'risk_level',
      width: 90,
      render: (_: unknown, record: ChangeRequest) => {
        const cfg = riskConfig[record.risk_level];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.risk_level}</Tag>;
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_: unknown, record: ChangeRequest) => {
        const cfg = statusConfig[record.status];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
      },
    },
    {
      key: 'requester_id',
      title: '申请人',
      dataIndex: 'requester_id',
      width: 100,
      ellipsis: true,
    },
    {
      key: 'scheduled_start',
      title: '计划开始',
      dataIndex: 'scheduled_start',
      width: 140,
      render: (_: unknown, record: ChangeRequest) =>
        record.scheduled_start ? dayjs(record.scheduled_start).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_: unknown, record: ChangeRequest) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedChange(record);
              handleOpenEditModal();
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除此变更请求吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rfcColumns: TableColumn<RFC>[] = [
    {
      key: 'rfc_number',
      title: 'RFC 编号',
      dataIndex: 'rfc_number',
      width: 140,
      render: (_: unknown, record: RFC) => (
        <a onClick={() => handleViewRfc(record)}>{record.rfc_number}</a>
      ),
    },
    {
      key: 'change_request_id',
      title: '关联变更',
      dataIndex: 'change_request_id',
      width: 200,
      ellipsis: true,
    },
    {
      key: 'justification',
      title: '变更理由',
      dataIndex: 'justification',
      ellipsis: true,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_: unknown, record: RFC) => {
        const cfg = rfcStatusConfig[record.status];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
      },
    },
    {
      key: 'reviewed_by',
      title: '审核人',
      dataIndex: 'reviewed_by',
      width: 100,
      ellipsis: true,
      render: (_: unknown, record: RFC) => record.reviewed_by || '-',
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 140,
      render: (_: unknown, record: RFC) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: RFC) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewRfc(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditRfc(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const cabColumns: TableColumn<CABMeeting>[] = [
    {
      key: 'title',
      title: '会议标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_: unknown, record: CABMeeting) => (
        <a onClick={() => handleViewCab(record)}>{record.title}</a>
      ),
    },
    {
      key: 'scheduled_at',
      title: '会议时间',
      dataIndex: 'scheduled_at',
      width: 160,
      render: (_: unknown, record: CABMeeting) =>
        dayjs(record.scheduled_at).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'location',
      title: '地点',
      dataIndex: 'location',
      width: 120,
      ellipsis: true,
      render: (_: unknown, record: CABMeeting) => record.location || '-',
    },
    {
      key: 'attendees',
      title: '参会人',
      dataIndex: 'attendees',
      width: 200,
      render: (_: unknown, record: CABMeeting) =>
        record.attendees?.length ? (
          <Space size={4} wrap>
            {record.attendees.slice(0, 3).map((a) => (
              <Tag key={a}>{a}</Tag>
            ))}
            {record.attendees.length > 3 && <Tag>+{record.attendees.length - 3}</Tag>}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_: unknown, record: CABMeeting) => {
        const cfg = cabStatusConfig[record.status];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: CABMeeting) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewCab(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditCab(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  // ============================================================================
  // Stats Computation
  // ============================================================================

  const statsCards = stats
    ? [
        {
          title: '变更请求总数',
          value: stats.totalRequests,
          icon: <SwapOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
          color: colors.primary[500],
        },
        {
          title: '草稿',
          value: stats.byStatus?.draft || 0,
          icon: <FileTextOutlined style={{ fontSize: 24, color: colors.neutral[500] }} />,
          color: colors.neutral[500],
        },
        {
          title: '已批准',
          value: stats.byStatus?.approved || 0,
          icon: <CheckCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
          color: colors.success[500],
        },
        {
          title: '实施中',
          value: stats.byStatus?.in_progress || 0,
          icon: <PlayCircleOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
          color: colors.warning[500],
        },
        {
          title: '紧急变更',
          value: stats.byType?.emergency || 0,
          icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: colors.error[500] }} />,
          color: colors.error[500],
        },
      ]
    : [];

  // ============================================================================
  // Change Form Content (shared between create and edit modals)
  // ============================================================================

  const renderChangeForm = (form: typeof createForm) => (
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Row gutter={spacing.md}>
        <Col span={24}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入变更标题' }]}>
            <Input placeholder="简要描述变更内容" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="type" label="变更类型" rules={[{ required: true, message: '请选择变更类型' }]}>
            <Select placeholder="选择变更类型">
              {Object.entries(typeConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
            <Select placeholder="选择优先级">
              {Object.entries(priorityConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="risk_level" label="风险等级" rules={[{ required: true, message: '请选择风险等级' }]}>
            <Select placeholder="选择风险等级">
              {Object.entries(riskConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="category" label="分类">
            <Input placeholder="变更分类（可选）" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="描述">
        <TextArea rows={3} placeholder="详细描述变更内容" />
      </Form.Item>
      <Form.Item name="impact_description" label="影响描述">
        <TextArea rows={2} placeholder="描述变更可能产生的影响" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="implementation_plan" label="实施计划">
            <TextArea rows={2} placeholder="变更实施步骤" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="rollback_plan" label="回滚计划">
            <TextArea rows={2} placeholder="变更回滚方案" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="scheduled_start" label="计划开始时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="选择计划开始时间" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="scheduled_end" label="计划结束时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="选择计划结束时间" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="assigned_to" label="负责人">
            <Input placeholder="变更负责人" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="affected_services" label="受影响服务" help="多个服务用逗号分隔">
            <Input placeholder="service-a, service-b" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = [
    {
      key: 'requests',
      label: (
        <span>
          <SwapOutlined />
          变更请求
        </span>
      ),
      children: (
        <>
          {/* Filter Bar */}
          <Card
            size="small"
            style={{
              marginBottom: spacing.md,
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
          >
            <Space size="middle" wrap>
              <Select
                placeholder="状态筛选"
                allowClear
                style={{ width: 130 }}
                value={filterStatus}
                onChange={(v) => { setFilterStatus(v); setPage(1); }}
              >
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
                ))}
              </Select>
              <Select
                placeholder="类型筛选"
                allowClear
                style={{ width: 120 }}
                value={filterType}
                onChange={(v) => { setFilterType(v); setPage(1); }}
              >
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
                ))}
              </Select>
              <Select
                placeholder="优先级筛选"
                allowClear
                style={{ width: 120 }}
                value={filterPriority}
                onChange={(v) => { setFilterPriority(v); setPage(1); }}
              >
                {Object.entries(priorityConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={loadChanges}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  setCreateModalOpen(true);
                }}
              >
                新建变更
              </Button>
            </Space>
          </Card>

          {/* Change Requests Table */}
          <Card
            style={{
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
          >
            <Table<ChangeRequest>
              columns={changeColumns}
              dataSource={changes}
              loading={loading}
              rowKey="id"
              pagination={{
                current: page,
                pageSize,
                total,
              }}
              onPaginationChange={(p: number, ps: number) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </Card>
        </>
      ),
    },
    {
      key: 'detail',
      label: (
        <span>
          <EyeOutlined />
          变更详情
        </span>
      ),
      children: selectedChange ? (
        <>
          {/* Header */}
          <Card
            style={{
              marginBottom: spacing.md,
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
            loading={detailLoading}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Title level={3} style={{ marginBottom: spacing.sm }}>
                  {selectedChange.title}
                </Title>
                <Space size="small" wrap>
                  <Tag color={typeConfig[selectedChange.type]?.color}>
                    {typeConfig[selectedChange.type]?.label || selectedChange.type}
                  </Tag>
                  <Tag color={priorityConfig[selectedChange.priority]?.color}>
                    {priorityConfig[selectedChange.priority]?.label || selectedChange.priority}
                  </Tag>
                  <Tag color={riskConfig[selectedChange.risk_level]?.color}>
                    {riskConfig[selectedChange.risk_level]?.label || selectedChange.risk_level}
                  </Tag>
                  <Tag color={statusConfig[selectedChange.status]?.color}>
                    {statusConfig[selectedChange.status]?.label || selectedChange.status}
                  </Tag>
                </Space>
              </div>
              <Space>
                <Button icon={<EditOutlined />} onClick={handleOpenEditModal}>
                  编辑
                </Button>
              </Space>
            </div>
          </Card>

          {/* Status Transitions */}
          {statusTransitions[selectedChange.status]?.length > 0 && (
            <Card
              title="状态流转"
              size="small"
              style={{
                marginBottom: spacing.md,
                borderRadius: radius.lg,
                boxShadow: shadows.card,
              }}
            >
              <Space wrap>
                {statusTransitions[selectedChange.status].map((t) => (
                  <Button
                    key={t.status}
                    type={t.danger ? 'default' : 'primary'}
                    danger={t.danger}
                    icon={t.icon}
                    onClick={() => handleStatusChange(t.status)}
                  >
                    {t.label}
                  </Button>
                ))}
                {selectedChange.status !== 'closed' &&
                  selectedChange.status !== 'cancelled' &&
                  !['rejected'].includes(selectedChange.status) && (
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleStatusChange('cancelled')}
                    >
                      取消
                    </Button>
                  )}
              </Space>
            </Card>
          )}

          {/* Detail Descriptions */}
          <Card
            title="基本信息"
            style={{
              marginBottom: spacing.md,
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
          >
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="变更 ID">{selectedChange.id}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={typeConfig[selectedChange.type]?.color}>
                  {typeConfig[selectedChange.type]?.label || selectedChange.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityConfig[selectedChange.priority]?.color}>
                  {priorityConfig[selectedChange.priority]?.label || selectedChange.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskConfig[selectedChange.risk_level]?.color}>
                  {riskConfig[selectedChange.risk_level]?.label || selectedChange.risk_level}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[selectedChange.status]?.color}>
                  {statusConfig[selectedChange.status]?.label || selectedChange.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分类">{selectedChange.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请人">{selectedChange.requester_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedChange.assigned_to || '-'}</Descriptions.Item>
              <Descriptions.Item label="审批人">{selectedChange.approved_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="审批时间">
                {selectedChange.approved_at
                  ? dayjs(selectedChange.approved_at).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划开始">
                {selectedChange.scheduled_start
                  ? dayjs(selectedChange.scheduled_start).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划结束">
                {selectedChange.scheduled_end
                  ? dayjs(selectedChange.scheduled_end).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="实际开始">
                {selectedChange.actual_start
                  ? dayjs(selectedChange.actual_start).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="实际结束">
                {selectedChange.actual_end
                  ? dayjs(selectedChange.actual_end).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedChange.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="影响描述" span={2}>
                {selectedChange.impact_description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="实施计划" span={2}>
                {selectedChange.implementation_plan || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="回滚计划" span={2}>
                {selectedChange.rollback_plan || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="受影响服务" span={2}>
                {selectedChange.affected_services?.length ? (
                  <Space size={4} wrap>
                    {selectedChange.affected_services.map((s) => (
                      <Tag key={s} color="blue">{s}</Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              {selectedChange.rejection_reason && (
                <Descriptions.Item label="拒绝原因" span={2}>
                  <Text type="danger">{selectedChange.rejection_reason}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {dayjs(selectedChange.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(selectedChange.updated_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Timeline */}
          <Card
            title="变更时间线"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  eventForm.resetFields();
                  setAddEventModalOpen(true);
                }}
              >
                添加事件
              </Button>
            }
            style={{
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
          >
            {timelineLoading ? (
              <div style={{ textAlign: 'center', padding: spacing.lg }}>
                <Text type="secondary">加载中...</Text>
              </div>
            ) : timeline.length > 0 ? (
              <Timeline
                items={timeline.map((event) => {
                  const cfg = eventTypeConfig[event.event_type] || { color: 'blue', label: event.event_type };
                  return {
                    color: cfg.color,
                    children: (
                      <div>
                        <div style={{ marginBottom: spacing.xs }}>
                          <Tag color={cfg.color}>{cfg.label}</Tag>
                          <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                            {dayjs(event.created_at).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          {event.created_by && (
                            <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                              by {event.created_by}
                            </Text>
                          )}
                        </div>
                        <div>{event.description}</div>
                      </div>
                    ),
                  };
                })}
              />
            ) : (
              <Empty description="暂无时间线事件" />
            )}
          </Card>
        </>
      ) : (
        <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
          <Empty description="请从变更请求列表中选择一条记录查看详情" />
        </Card>
      ),
    },
    {
      key: 'rfc',
      label: (
        <span>
          <FileTextOutlined />
          RFC 管理
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                rfcForm.resetFields();
                setEditRfcId(null);
                setRfcModalOpen(true);
              }}
            >
              新建 RFC
            </Button>
          </div>
          <Card
            style={{
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
          >
            <Table<RFC>
              columns={rfcColumns}
              dataSource={rfcs}
              loading={rfcLoading}
              rowKey="id"
              pagination={{
                current: rfcPage,
                pageSize,
                total: rfcTotal,
              }}
              onPaginationChange={(p: number) => setRfcPage(p)}
            />
          </Card>
        </>
      ),
    },
    {
      key: 'cab',
      label: (
        <span>
          <TeamOutlined />
          CAB 会议
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                cabForm.resetFields();
                setEditCabId(null);
                setCabModalOpen(true);
              }}
            >
              新建 CAB 会议
            </Button>
          </div>
          <Card
            style={{
              borderRadius: radius.lg,
              boxShadow: shadows.card,
            }}
          >
            <Table<CABMeeting>
              columns={cabColumns}
              dataSource={cabMeetings}
              loading={cabLoading}
              rowKey="id"
              pagination={{
                current: cabPage,
                pageSize,
                total: cabTotal,
              }}
              onPaginationChange={(p: number) => setCabPage(p)}
            />
          </Card>
        </>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Layout>
      <div style={{ padding: spacing.lg }}>
        {/* Page Header */}
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            变更管理
          </Title>
          <Text type="secondary">管理变更请求、RFC 审批、CAB 会议与变更生命周期</Text>
        </div>

        {/* Stats Bar */}
        <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
          {statsCards.map((card) => (
            <Col xs={24} sm={12} md={8} lg={4} xl={4} key={card.title}>
              <MetricCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                loading={statsLoading}
                size="small"
              />
            </Col>
          ))}
        </Row>

        {/* Main Tabs */}
        <Card
          style={{
            borderRadius: radius.lg,
            boxShadow: shadows.card,
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Card>

        {/* ===== Modals ===== */}

        {/* Create Change Request Modal */}
        <Modal
          title="新建变更请求"
          open={createModalOpen}
          onOk={handleCreate}
          onCancel={() => {
            setCreateModalOpen(false);
            createForm.resetFields();
          }}
          width={720}
          okText="创建"
          cancelText="取消"
          confirmLoading={createSubmitting}
        >
          {renderChangeForm(createForm)}
        </Modal>

        {/* Edit Change Request Modal */}
        <Modal
          title="编辑变更请求"
          open={editModalOpen}
          onOk={handleEdit}
          onCancel={() => {
            setEditModalOpen(false);
            editForm.resetFields();
          }}
          width={720}
          okText="保存"
          cancelText="取消"
          confirmLoading={editSubmitting}
        >
          {renderChangeForm(editForm)}
        </Modal>

        {/* Status Change Note Modal */}
        <Modal
          title={`状态变更: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`}
          open={statusNoteModalOpen}
          onOk={handleConfirmStatusChange}
          onCancel={() => {
            setStatusNoteModalOpen(false);
            statusNoteForm.resetFields();
            setPendingStatusChange('');
          }}
          width={480}
          okText="确认变更"
          cancelText="取消"
        >
          <Form form={statusNoteForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="note" label="备注（可选）">
              <TextArea rows={3} placeholder="添加状态变更备注" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Add Timeline Event Modal */}
        <Modal
          title="添加时间线事件"
          open={addEventModalOpen}
          onOk={handleAddTimelineEvent}
          onCancel={() => {
            setAddEventModalOpen(false);
            eventForm.resetFields();
          }}
          width={480}
          okText="添加"
          cancelText="取消"
        >
          <Form form={eventForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="event_type"
              label="事件类型"
              rules={[{ required: true, message: '请选择事件类型' }]}
            >
              <Select placeholder="选择事件类型">
                {Object.entries(eventTypeConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="description"
              label="事件描述"
              rules={[{ required: true, message: '请输入事件描述' }]}
            >
              <TextArea rows={4} placeholder="详细描述此事件记录" />
            </Form.Item>
          </Form>
        </Modal>

        {/* RFC Modal (Create/Edit) */}
        <Modal
          title={editRfcId ? '编辑 RFC' : '新建 RFC'}
          open={rfcModalOpen}
          onOk={editRfcId ? handleUpdateRfc : handleCreateRfc}
          onCancel={() => {
            setRfcModalOpen(false);
            rfcForm.resetFields();
            setEditRfcId(null);
          }}
          width={640}
          okText={editRfcId ? '保存' : '创建'}
          cancelText="取消"
        >
          <Form form={rfcForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="change_request_id"
              label="关联变更请求 ID"
              rules={[{ required: true, message: '请输入变更请求 ID' }]}
            >
              <Input placeholder="变更请求 ID" />
            </Form.Item>
            <Form.Item name="justification" label="变更理由">
              <TextArea rows={3} placeholder="说明变更的必要性" />
            </Form.Item>
            <Form.Item name="risk_assessment" label="风险评估">
              <TextArea rows={2} placeholder="评估变更风险" />
            </Form.Item>
            <Form.Item name="test_plan" label="测试计划">
              <TextArea rows={2} placeholder="变更测试方案" />
            </Form.Item>
            <Form.Item name="communication_plan" label="沟通计划">
              <TextArea rows={2} placeholder="变更沟通方案" />
            </Form.Item>
            <Form.Item name="backout_plan" label="退出计划">
              <TextArea rows={2} placeholder="变更退出/回滚方案" />
            </Form.Item>
          </Form>
        </Modal>

        {/* RFC Detail Modal */}
        <Modal
          title="RFC 详情"
          open={rfcDetailModalOpen}
          onCancel={() => {
            setRfcDetailModalOpen(false);
            setSelectedRfc(null);
          }}
          width={640}
          footer={null}
        >
          {selectedRfc && (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="RFC 编号">{selectedRfc.rfc_number}</Descriptions.Item>
              <Descriptions.Item label="关联变更 ID">{selectedRfc.change_request_id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={rfcStatusConfig[selectedRfc.status]?.color}>
                  {rfcStatusConfig[selectedRfc.status]?.label || selectedRfc.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="审核人">{selectedRfc.reviewed_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {selectedRfc.reviewed_at
                  ? dayjs(selectedRfc.reviewed_at).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="变更理由">{selectedRfc.justification || '-'}</Descriptions.Item>
              <Descriptions.Item label="风险评估">{selectedRfc.risk_assessment || '-'}</Descriptions.Item>
              <Descriptions.Item label="测试计划">{selectedRfc.test_plan || '-'}</Descriptions.Item>
              <Descriptions.Item label="沟通计划">{selectedRfc.communication_plan || '-'}</Descriptions.Item>
              <Descriptions.Item label="退出计划">{selectedRfc.backout_plan || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedRfc.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(selectedRfc.updated_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Modal>

        {/* CAB Meeting Modal (Create/Edit) */}
        <Modal
          title={editCabId ? '编辑 CAB 会议' : '新建 CAB 会议'}
          open={cabModalOpen}
          onOk={editCabId ? handleUpdateCab : handleCreateCab}
          onCancel={() => {
            setCabModalOpen(false);
            cabForm.resetFields();
            setEditCabId(null);
          }}
          width={560}
          okText={editCabId ? '保存' : '创建'}
          cancelText="取消"
        >
          <Form form={cabForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="title"
              label="会议标题"
              rules={[{ required: true, message: '请输入会议标题' }]}
            >
              <Input placeholder="CAB 会议标题" />
            </Form.Item>
            <Form.Item name="description" label="会议描述">
              <TextArea rows={2} placeholder="会议描述（可选）" />
            </Form.Item>
            <Form.Item
              name="scheduled_at"
              label="会议时间"
              rules={[{ required: true, message: '请选择会议时间' }]}
            >
              <DatePicker showTime style={{ width: '100%' }} placeholder="选择会议时间" />
            </Form.Item>
            <Form.Item name="location" label="会议地点">
              <Input placeholder="会议地点（可选）" />
            </Form.Item>
            <Form.Item name="attendees" label="参会人" help="多人用逗号分隔">
              <Input placeholder="张三, 李四, 王五" />
            </Form.Item>
          </Form>
        </Modal>

        {/* CAB Meeting Detail Modal */}
        <Modal
          title="CAB 会议详情"
          open={cabDetailModalOpen}
          onCancel={() => {
            setCabDetailModalOpen(false);
            setSelectedCab(null);
          }}
          width={720}
          footer={
            selectedCab ? (
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    decisionForm.resetFields();
                    setDecisionModalOpen(true);
                  }}
                >
                  添加决策
                </Button>
                <Button onClick={() => setCabDetailModalOpen(false)}>关闭</Button>
              </Space>
            ) : null
          }
        >
          {selectedCab && (
            <>
              <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
                <Descriptions.Item label="会议 ID">{selectedCab.id}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={cabStatusConfig[selectedCab.status]?.color}>
                    {cabStatusConfig[selectedCab.status]?.label || selectedCab.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="会议时间" span={2}>
                  {dayjs(selectedCab.scheduled_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="地点">{selectedCab.location || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建人">{selectedCab.created_by || '-'}</Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>
                  {selectedCab.description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="参会人" span={2}>
                  {selectedCab.attendees?.length ? (
                    <Space size={4} wrap>
                      {selectedCab.attendees.map((a) => (
                        <Tag key={a}>{a}</Tag>
                      ))}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(selectedCab.created_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(selectedCab.updated_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              </Descriptions>

              {/* Decisions */}
              <Card title="决策记录" size="small" type="inner">
                {selectedCab.decisions?.length ? (
                  <Timeline
                    items={selectedCab.decisions.map((d) => ({
                      color:
                        d.decision === 'approved'
                          ? 'green'
                          : d.decision === 'rejected'
                          ? 'red'
                          : 'orange',
                      children: (
                        <div>
                          <Space>
                            <Tag
                              color={
                                d.decision === 'approved'
                                  ? 'green'
                                  : d.decision === 'rejected'
                                  ? 'red'
                                  : 'orange'
                              }
                            >
                              {d.decision === 'approved'
                                ? '批准'
                                : d.decision === 'rejected'
                                ? '拒绝'
                                : '推迟'}
                            </Tag>
                            <Text type="secondary">变更请求: {d.changeRequestId}</Text>
                          </Space>
                          {d.notes && <div style={{ marginTop: spacing.xs }}>{d.notes}</div>}
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty description="暂无决策记录" />
                )}
              </Card>
            </>
          )}
        </Modal>

        {/* Add CAB Decision Modal */}
        <Modal
          title="添加 CAB 决策"
          open={decisionModalOpen}
          onOk={handleAddDecision}
          onCancel={() => {
            setDecisionModalOpen(false);
            decisionForm.resetFields();
          }}
          width={480}
          okText="添加"
          cancelText="取消"
        >
          <Form form={decisionForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="changeRequestId"
              label="变更请求 ID"
              rules={[{ required: true, message: '请输入变更请求 ID' }]}
            >
              <Input placeholder="变更请求 ID" />
            </Form.Item>
            <Form.Item
              name="decision"
              label="决策"
              rules={[{ required: true, message: '请选择决策' }]}
            >
              <Select placeholder="选择决策">
                <Select.Option value="approved">批准</Select.Option>
                <Select.Option value="rejected">拒绝</Select.Option>
                <Select.Option value="deferred">推迟</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <TextArea rows={3} placeholder="决策备注（可选）" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
};

export default ChangeManagement;
