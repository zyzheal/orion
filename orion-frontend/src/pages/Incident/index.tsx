/**
 * Incident Management Page
 *
 * Comprehensive incident lifecycle management with:
 * - Stats bar: total incidents, severity breakdown, MTTR, 7d trend
 * - Tab 1: Incident list with filters, table, CRUD operations
 * - Tab 2: Incident detail with status transitions, assignment, escalation
 * - Tab 3: Timeline view with add event form
 * - Tab 4: Postmortem view/create/publish
 *
 * API: @/api/incident (getIncidents, getIncident, createIncident, updateIncident,
 *       deleteIncident, updateIncidentStatus, assignIncident, escalateIncident,
 *       getIncidentTimeline, addTimelineEvent, getPostmortem, createPostmortem,
 *       publishPostmortem, getIncidentStats)
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
  Badge,
  Popconfirm,
  Modal,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  BugOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing, radius, shadows } from '@/tokens';
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
  getIncidentStats,
} from '@/api/incident';
import type { Incident, IncidentStats, TimelineEvent, Postmortem } from '@/api/incident';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Configuration Maps
// ============================================================================

/** Severity display config: color + Chinese label */
const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '严重' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'green', label: '低' },
};

/** Status display config: tag color + Chinese label */
const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: 'blue', label: '待处理' },
  acknowledged: { color: 'cyan', label: '已确认' },
  investigating: { color: 'orange', label: '调查中' },
  on_hold: { color: 'default', label: '挂起' },
  resolved: { color: 'green', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

/** Priority display config: tag color + Chinese label */
const priorityConfig: Record<string, { color: string; label: string }> = {
  p1: { color: 'red', label: 'P1' },
  p2: { color: 'orange', label: 'P2' },
  p3: { color: 'blue', label: 'P3' },
  p4: { color: 'default', label: 'P4' },
};

/** Timeline event type display config */
const eventTypeConfig: Record<string, { color: string; label: string }> = {
  created: { color: 'blue', label: '创建' },
  status_change: { color: 'orange', label: '状态变更' },
  assignment: { color: 'cyan', label: '分配' },
  escalation: { color: 'red', label: '升级' },
  update: { color: 'default', label: '更新' },
  comment: { color: 'purple', label: '备注' },
  resolution: { color: 'green', label: '解决' },
  postmortem: { color: 'magenta', label: '复盘' },
};

/** Status transition map: current status -> allowed next statuses */
const statusTransitions: Record<string, Array<{ status: string; label: string; icon: React.ReactNode }>> = {
  open: [
    { status: 'acknowledged', label: '确认', icon: <CheckCircleOutlined /> },
  ],
  acknowledged: [
    { status: 'investigating', label: '开始调查', icon: <SearchOutlined /> },
  ],
  investigating: [
    { status: 'resolved', label: '解决', icon: <CheckCircleOutlined /> },
    { status: 'on_hold', label: '挂起', icon: <ClockCircleOutlined /> },
  ],
  on_hold: [
    { status: 'investigating', label: '恢复调查', icon: <SearchOutlined /> },
  ],
  resolved: [
    { status: 'closed', label: '关闭', icon: <CheckCircleOutlined /> },
  ],
  closed: [],
};

// ============================================================================
// IncidentManagement Component
// ============================================================================

const IncidentManagement: React.FC = () => {
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

  /** Load incidents list with filters and pagination */
  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (filters.severity && filters.severity !== 'all') params.severity = filters.severity;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      const result = await getIncidents(params);
      // Apply client-side search filter
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

  /** Load incident statistics */
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

  /** Load single incident detail */
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

  /** Load incident timeline */
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

  /** Load postmortem for incident */
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

  // --- Effects ---
  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // When switching to detail/timeline/postmortem tab, load the data
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

  /** Open detail view for an incident */
  const handleViewDetail = useCallback(
    (record: Incident) => {
      setSelectedIncident(record);
      setActiveTab('detail');
    },
    []
  );

  /** Go back to list view */
  const handleBackToList = useCallback(() => {
    setSelectedIncident(null);
    setActiveTab('list');
    loadIncidents();
  }, [loadIncidents]);

  /** Create incident */
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

  /** Open edit modal */
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

  /** Submit edit */
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

  /** Delete incident with confirmation */
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

  /** Initiate status change (may require a note) */
  const handleStatusChange = useCallback(
    (newStatus: string) => {
      setPendingStatusChange(newStatus);
      statusNoteForm.resetFields();
      setStatusNoteModalOpen(true);
    },
    [statusNoteForm]
  );

  /** Confirm status change with optional note */
  const handleConfirmStatusChange = useCallback(async () => {
    if (!selectedIncident) return;
    try {
      const note = statusNoteForm.getFieldValue('note');
      await updateIncidentStatus(selectedIncident.id, pendingStatusChange, note);
      message.success(`状态已变更为: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`);
      setStatusNoteModalOpen(false);
      statusNoteForm.resetFields();
      loadIncidentDetail(selectedIncident.id);
      loadIncidents();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`状态变更失败: ${msg}`);
    }
  }, [selectedIncident, pendingStatusChange, statusNoteForm, loadIncidentDetail, loadIncidents, loadStats]);

  /** Open assign modal */
  const handleOpenAssign = useCallback(() => {
    assignForm.resetFields();
    if (selectedIncident?.commander_id) {
      assignForm.setFieldsValue({ commander_id: selectedIncident.commander_id });
    }
    setAssignModalOpen(true);
  }, [selectedIncident, assignForm]);

  /** Submit assignment */
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

  /** Open escalate modal */
  const handleOpenEscalate = useCallback(() => {
    escalateForm.resetFields();
    setEscalateModalOpen(true);
  }, [escalateForm]);

  /** Submit escalation */
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

  /** Add timeline event */
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

  /** Create postmortem */
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

  /** Publish postmortem */
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

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /** Render stats bar */
  const renderStatsBar = () => {
    const criticalCount = stats?.bySeverity?.critical ?? 0;
    const highCount = stats?.bySeverity?.high ?? 0;
    const openCount = stats?.byStatus?.open ?? 0;
    const mttr = stats?.mttr ?? 0;

    return (
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="总事件数"
            value={stats?.total ?? 0}
            icon={<BugOutlined style={{ fontSize: 24, color: colors.primary[500] }} />}
            loading={statsLoading}
            color={colors.primary[500]}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="严重/高"
            value={`${criticalCount}/${highCount}`}
            icon={<FireOutlined style={{ fontSize: 24, color: colors.error[500] }} />}
            loading={statsLoading}
            color={colors.error[500]}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="待处理"
            value={openCount}
            icon={<ExclamationCircleOutlined style={{ fontSize: 24, color: colors.warning[500] }} />}
            loading={statsLoading}
            color={colors.warning[500]}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <MetricCard
            title="平均恢复时间"
            value={mttr > 0 ? `${Math.round(mttr)}min` : '-'}
            icon={<ClockCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />}
            loading={statsLoading}
            color={colors.success[500]}
          />
        </Col>
      </Row>
    );
  };

  /** Table columns for incident list */
  const columns: TableColumn<Incident>[] = [
    {
      key: 'title',
      title: '事件标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_val: unknown, record: Incident) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 500 }}
          onClick={() => handleViewDetail(record)}
        >
          {record.title}
        </Button>
      ),
    },
    {
      key: 'severity',
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      render: (_val: unknown, record: Incident) => {
        const cfg = severityConfig[record.severity];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.severity}</Tag>;
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_val: unknown, record: Incident) => {
        const cfg = statusConfig[record.status];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
      },
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (_val: unknown, record: Incident) => {
        const cfg = priorityConfig[record.priority ?? ''];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>-</Tag>;
      },
    },
    {
      key: 'assigned_to',
      title: '负责人',
      dataIndex: 'assigned_to',
      width: 120,
      render: (_val: unknown, record: Incident) => (
        record.assigned_to ? (
          <Space size={4}>
            <UserOutlined style={{ color: colors.neutral[500] }} />
            <Text>{record.assigned_to}</Text>
          </Space>
        ) : (
          <Text type="secondary">未分配</Text>
        )
      ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (_val: unknown, record: Incident) => (
        <Text type="secondary">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_val: unknown, record: Incident) => (
        <Space size={spacing.xs}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此事件?"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /** Filter definitions for SearchFilterBar */
  const filterDefs: FilterDefinition[] = [
    {
      key: 'severity',
      label: '严重程度',
      options: [
        { label: '全部', value: 'all' },
        { label: '严重', value: 'critical' },
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '待处理', value: 'open' },
        { label: '已确认', value: 'acknowledged' },
        { label: '调查中', value: 'investigating' },
        { label: '挂起', value: 'on_hold' },
        { label: '已解决', value: 'resolved' },
        { label: '已关闭', value: 'closed' },
      ],
    },
  ];

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  /** Tab 1: Incident list */
  const renderIncidentList = () => (
    <div>
      {renderStatsBar()}
      <Card
        style={{
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索事件标题、描述、负责人..."
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => { loadIncidents(); loadStats(); }}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                创建事件
              </Button>
            </Space>
          }
        />
        <div style={{ marginTop: spacing.md }}>
          <Table<Incident>
            columns={columns}
            dataSource={incidents}
            loading={loading}
            rowKey="id"
            pagination={{
              current: page,
              pageSize,
              total,
            }}
            showTotal
            pageSizeOptions={[10, 20, 50, 100]}
            onPaginationChange={(p: number, ps: number) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        </div>
      </Card>
    </div>
  );

  /** Tab 2: Incident detail */
  const renderIncidentDetail = () => {
    if (!selectedIncident) return <Empty description="请选择一个事件" />;
    if (detailLoading) {
      return (
        <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Text type="secondary">加载中...</Text>
          </div>
        </Card>
      );
    }
    const incident = selectedIncident;
    const transitions = statusTransitions[incident.status] || [];

    return (
      <div>
        {/* Header */}
        <Card
          style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.sm }}>
            <div>
              <Space style={{ marginBottom: spacing.sm }}>
                <Button icon={<ArrowUpOutlined />} onClick={handleBackToList} style={{ transform: 'rotate(-90deg)' }}>
                </Button>
                <Title level={3} style={{ margin: 0 }}>{incident.title}</Title>
              </Space>
              <Space>
                <Tag color={severityConfig[incident.severity]?.color}>{severityConfig[incident.severity]?.label}</Tag>
                <Tag color={statusConfig[incident.status]?.color}>{statusConfig[incident.status]?.label}</Tag>
                {incident.priority && (
                  <Tag color={priorityConfig[incident.priority]?.color}>{priorityConfig[incident.priority]?.label}</Tag>
                )}
                {incident.sla_breach && <Tag color="red">SLA 违规</Tag>}
              </Space>
            </div>
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={() => handleOpenEdit(incident)}>
                编辑
              </Button>
              <Button icon={<UserOutlined />} onClick={handleOpenAssign}>
                分配指挥官
              </Button>
              <Button icon={<ArrowUpOutlined />} onClick={handleOpenEscalate}>
                升级
              </Button>
            </Space>
          </div>
        </Card>

        <Row gutter={[spacing.md, spacing.md]}>
          {/* Left: Details */}
          <Col xs={24} lg={16}>
            <Card
              title="事件信息"
              style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
            >
              <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                <Descriptions.Item label="类型">{incident.type || '-'}</Descriptions.Item>
                <Descriptions.Item label="严重程度">
                  <Tag color={severityConfig[incident.severity]?.color}>{severityConfig[incident.severity]?.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  {incident.priority ? (
                    <Tag color={priorityConfig[incident.priority]?.color}>{priorityConfig[incident.priority]?.label}</Tag>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusConfig[incident.status]?.color}>{statusConfig[incident.status]?.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>
                  {incident.description || <Text type="secondary">无描述</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="影响">{incident.impact || '-'}</Descriptions.Item>
                <Descriptions.Item label="紧急度">{incident.urgency || '-'}</Descriptions.Item>
                <Descriptions.Item label="负责人">{incident.assigned_to || '未分配'}</Descriptions.Item>
                <Descriptions.Item label="指挥官">{incident.commander_id || '未指定'}</Descriptions.Item>
                <Descriptions.Item label="检测来源">{incident.detected_by || '-'}</Descriptions.Item>
                <Descriptions.Item label="升级层级">
                  <Badge count={incident.escalation_level ?? 0} style={{ backgroundColor: colors.primary[500] }} />
                </Descriptions.Item>
                <Descriptions.Item label="受影响服务" span={2}>
                  {incident.affected_services?.length ? (
                    <Space wrap>
                      {incident.affected_services.map((s) => (
                        <Tag key={s} color="blue">{s}</Tag>
                      ))}
                    </Space>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="标签" span={2}>
                  {incident.tags?.length ? (
                    <Space wrap>
                      {incident.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                    </Space>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(incident.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(incident.updated_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Right: Status transitions */}
          <Col xs={24} lg={8}>
            <Card
              title="状态流转"
              style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
            >
              {transitions.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {transitions.map((t) => (
                    <Button
                      key={t.status}
                      block
                      icon={t.icon}
                      onClick={() => handleStatusChange(t.status)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Empty description="无可用状态流转" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  /** Tab 3: Timeline */
  const renderTimeline = () => {
    if (!selectedIncident) return <Empty description="请选择一个事件" />;

    return (
      <div>
        <Card
          style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Title level={4} style={{ margin: 0 }}>事件时间线</Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => loadTimeline(selectedIncident.id)}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddEventModalOpen(true)}>
                添加记录
              </Button>
            </Space>
          </div>
          {timelineLoading ? (
            <div style={{ textAlign: 'center', padding: spacing.xl }}>
              <Text type="secondary">加载中...</Text>
            </div>
          ) : timeline.length > 0 ? (
            <Timeline
              items={timeline.map((event) => {
                const cfg = eventTypeConfig[event.event_type] || { color: 'gray', label: event.event_type };
                return {
                  color: cfg.color,
                  children: (
                    <div>
                      <Space style={{ marginBottom: spacing.xs }}>
                        <Tag color={cfg.color}>{cfg.label}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(event.created_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                        {event.created_by && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            by {event.created_by}
                          </Text>
                        )}
                      </Space>
                      <div>
                        <Text>{event.description}</Text>
                      </div>
                    </div>
                  ),
                };
              })}
            />
          ) : (
            <Empty description="暂无时间线记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddEventModalOpen(true)}>
                添加第一条记录
              </Button>
            </Empty>
          )}
        </Card>
      </div>
    );
  };

  /** Tab 4: Postmortem */
  const renderPostmortem = () => {
    if (!selectedIncident) return <Empty description="请选择一个事件" />;

    return (
      <div>
        <Card
          style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Title level={4} style={{ margin: 0 }}>复盘文档</Title>
            {postmortem && postmortem.status === 'draft' && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handlePublishPostmortem}>
                发布复盘
              </Button>
            )}
          </div>
          {postmortemLoading ? (
            <div style={{ textAlign: 'center', padding: spacing.xl }}>
              <Text type="secondary">加载中...</Text>
            </div>
          ) : postmortem ? (
            <div>
              <Descriptions
                column={1}
                bordered
                size="small"
                style={{ marginBottom: spacing.md }}
              >
                <Descriptions.Item label="标题">{postmortem.title}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={postmortem.status === 'published' ? 'green' : postmortem.status === 'draft' ? 'orange' : 'default'}>
                    {postmortem.status === 'published' ? '已发布' : postmortem.status === 'draft' ? '草稿' : '已归档'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="摘要">{postmortem.summary}</Descriptions.Item>
                <Descriptions.Item label="根因分析">{postmortem.root_cause}</Descriptions.Item>
                {postmortem.impact_description && (
                  <Descriptions.Item label="影响描述">{postmortem.impact_description}</Descriptions.Item>
                )}
                {postmortem.timeline_summary && (
                  <Descriptions.Item label="时间线摘要">{postmortem.timeline_summary}</Descriptions.Item>
                )}
                {postmortem.lessons_learned && (
                  <Descriptions.Item label="经验教训">{postmortem.lessons_learned}</Descriptions.Item>
                )}
                <Descriptions.Item label="行动项">
                  {postmortem.action_items?.length ? (
                    <ul style={{ margin: 0, paddingLeft: spacing.md }}>
                      {postmortem.action_items.map((item: any, idx: number) => (
                        <li key={idx}>{item.description || item}</li>
                      ))}
                    </ul>
                  ) : (
                    <Text type="secondary">无</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建者">{postmortem.created_by}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {dayjs(postmortem.created_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                {postmortem.published_at && (
                  <Descriptions.Item label="发布时间">
                    {dayjs(postmortem.published_at).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          ) : (
            <Empty description="暂无复盘文档" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<FileTextOutlined />} onClick={() => setPostmortemModalOpen(true)}>
                创建复盘文档
              </Button>
            </Empty>
          )}
        </Card>
      </div>
    );
  };

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = selectedIncident
    ? [
        { key: 'list', label: '事件列表', children: renderIncidentList() },
        { key: 'detail', label: '事件详情', children: renderIncidentDetail() },
        { key: 'timeline', label: '时间线', children: renderTimeline() },
        { key: 'postmortem', label: '复盘', children: renderPostmortem() },
      ]
    : [
        { key: 'list', label: '事件列表', children: renderIncidentList() },
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
            <BugOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            事件管理
          </Title>
          <Text type="secondary">管理生产事件的完整生命周期，从发现到复盘</Text>
        </div>

        {/* Tabs */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        {/* ============ Modals ============ */}

        {/* Create Incident Modal */}
        <Modal
          title="创建事件"
          open={createModalOpen}
          onOk={handleCreate}
          onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
          confirmLoading={createSubmitting}
          width={640}
          okText="创建"
          cancelText="取消"
        >
          <Form form={createForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="title" label="事件标题" rules={[{ required: true, message: '请输入事件标题' }]}>
              <Input placeholder="简要描述事件" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item name="severity" label="严重程度" rules={[{ required: true, message: '请选择严重程度' }]}>
                  <Select placeholder="选择严重程度">
                    <Select.Option value="critical">严重</Select.Option>
                    <Select.Option value="high">高</Select.Option>
                    <Select.Option value="medium">中</Select.Option>
                    <Select.Option value="low">低</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="type" label="事件类型" initialValue="incident">
                  <Select>
                    <Select.Option value="incident">事件</Select.Option>
                    <Select.Option value="outage">中断</Select.Option>
                    <Select.Option value="degradation">降级</Select.Option>
                    <Select.Option value="security">安全</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="urgency" label="紧急度">
                  <Select placeholder="选择紧急度" allowClear>
                    <Select.Option value="high">高</Select.Option>
                    <Select.Option value="medium">中</Select.Option>
                    <Select.Option value="low">低</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="描述">
              <TextArea rows={3} placeholder="详细描述事件情况" />
            </Form.Item>
            <Form.Item name="impact" label="影响范围">
              <TextArea rows={2} placeholder="描述事件影响的范围和用户" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item name="assigned_to" label="负责人">
                  <Input placeholder="负责人用户名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="detected_by" label="检测来源">
                  <Input placeholder="如: monitoring, alert, manual" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="affected_services" label="受影响服务" help="多个服务用逗号分隔">
              <Input placeholder="service-a, service-b" />
            </Form.Item>
            <Form.Item name="tags" label="标签" help="多个标签用逗号分隔">
              <Input placeholder="tag1, tag2" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Incident Modal */}
        <Modal
          title="编辑事件"
          open={editModalOpen}
          onOk={handleEdit}
          onCancel={() => { setEditModalOpen(false); editForm.resetFields(); }}
          confirmLoading={editSubmitting}
          width={640}
          okText="保存"
          cancelText="取消"
        >
          <Form form={editForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="title" label="事件标题" rules={[{ required: true, message: '请输入事件标题' }]}>
              <Input placeholder="简要描述事件" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item name="severity" label="严重程度" rules={[{ required: true, message: '请选择严重程度' }]}>
                  <Select placeholder="选择严重程度">
                    <Select.Option value="critical">严重</Select.Option>
                    <Select.Option value="high">高</Select.Option>
                    <Select.Option value="medium">中</Select.Option>
                    <Select.Option value="low">低</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="priority" label="优先级">
                  <Select placeholder="选择优先级" allowClear>
                    <Select.Option value="p1">P1</Select.Option>
                    <Select.Option value="p2">P2</Select.Option>
                    <Select.Option value="p3">P3</Select.Option>
                    <Select.Option value="p4">P4</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="urgency" label="紧急度">
                  <Select placeholder="选择紧急度" allowClear>
                    <Select.Option value="high">高</Select.Option>
                    <Select.Option value="medium">中</Select.Option>
                    <Select.Option value="low">低</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="描述">
              <TextArea rows={3} placeholder="详细描述事件情况" />
            </Form.Item>
            <Form.Item name="impact" label="影响范围">
              <TextArea rows={2} placeholder="描述事件影响的范围和用户" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item name="assigned_to" label="负责人">
                  <Input placeholder="负责人用户名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="detected_by" label="检测来源">
                  <Input placeholder="如: monitoring, alert, manual" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="affected_services" label="受影响服务" help="多个服务用逗号分隔">
              <Input placeholder="service-a, service-b" />
            </Form.Item>
            <Form.Item name="tags" label="标签" help="多个标签用逗号分隔">
              <Input placeholder="tag1, tag2" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Assign Commander Modal */}
        <Modal
          title="分配指挥官"
          open={assignModalOpen}
          onOk={handleAssign}
          onCancel={() => { setAssignModalOpen(false); assignForm.resetFields(); }}
          width={400}
          okText="分配"
          cancelText="取消"
        >
          <Form form={assignForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="commander_id"
              label="指挥官"
              rules={[{ required: true, message: '请输入指挥官ID' }]}
            >
              <Input placeholder="输入指挥官用户名或ID" prefix={<UserOutlined />} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Escalate Modal */}
        <Modal
          title="升级事件"
          open={escalateModalOpen}
          onOk={handleEscalate}
          onCancel={() => { setEscalateModalOpen(false); escalateForm.resetFields(); }}
          width={480}
          okText="升级"
          cancelText="取消"
        >
          <Form form={escalateForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item
              name="to_level"
              label="升级到层级"
              rules={[{ required: true, message: '请选择升级层级' }]}
            >
              <Select placeholder="选择目标层级">
                <Select.Option value={1}>L1 - 一线支持</Select.Option>
                <Select.Option value={2}>L2 - 二线支持</Select.Option>
                <Select.Option value={3}>L3 - 专家团队</Select.Option>
                <Select.Option value={4}>L4 - 管理层</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="reason"
              label="升级原因"
              rules={[{ required: true, message: '请输入升级原因' }]}
            >
              <TextArea rows={3} placeholder="说明升级原因" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Add Timeline Event Modal */}
        <Modal
          title="添加事件记录"
          open={addEventModalOpen}
          onOk={handleAddEvent}
          onCancel={() => { setAddEventModalOpen(false); eventForm.resetFields(); }}
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

        {/* Status Change Note Modal */}
        <Modal
          title={`状态变更: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`}
          open={statusNoteModalOpen}
          onOk={handleConfirmStatusChange}
          onCancel={() => { setStatusNoteModalOpen(false); statusNoteForm.resetFields(); }}
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

        {/* Create Postmortem Modal */}
        <Modal
          title="创建复盘文档"
          open={postmortemModalOpen}
          onOk={handleCreatePostmortem}
          onCancel={() => { setPostmortemModalOpen(false); postmortemForm.resetFields(); }}
          width={640}
          okText="创建"
          cancelText="取消"
        >
          <Form form={postmortemForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="title" label="复盘标题" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="事件复盘标题" />
            </Form.Item>
            <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
              <TextArea rows={3} placeholder="事件概要描述" />
            </Form.Item>
            <Form.Item name="root_cause" label="根因分析" rules={[{ required: true, message: '请输入根因分析' }]}>
              <TextArea rows={3} placeholder="深入分析事件根因" />
            </Form.Item>
            <Form.Item name="impact_description" label="影响描述">
              <TextArea rows={2} placeholder="描述事件影响范围和程度" />
            </Form.Item>
            <Form.Item name="timeline_summary" label="时间线摘要">
              <TextArea rows={2} placeholder="关键时间节点概述" />
            </Form.Item>
            <Form.Item name="action_items" label="行动项" help="每行一个行动项">
              <TextArea rows={3} placeholder={"修复监控告警阈值\n增加自动化巡检\n优化容灾切换流程"} />
            </Form.Item>
            <Form.Item name="lessons_learned" label="经验教训">
              <TextArea rows={3} placeholder="总结经验教训" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
};

export default IncidentManagement;
