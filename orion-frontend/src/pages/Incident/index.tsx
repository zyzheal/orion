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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  BugOutlined,
  FireOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
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
import dayjs from 'dayjs';
import {
  severityConfig,
  statusConfig,
  priorityConfig,
  eventTypeConfig,
  statusTransitions,
  severityOptions,
  incidentTypeOptions,
  urgencyOptions,
  priorityOptions,
  escalationLevelOptions,
  postmortemStatusConfig,
} from './config';
import { buildIncidentColumns, incidentFilterDefs } from './columns';
import { IncidentModals } from './IncidentModals';

const { Title, Text } = Typography;
const { TextArea } = Input;

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

  // ============================================================================
  // Render Helpers
  // ============================================================================

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
            icon={
              <ExclamationCircleOutlined style={{ fontSize: 24, color: colors.warning[500] }} />
            }
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

  const renderIncidentList = () => (
    <div>
      {renderStatsBar()}
      <Card
        style={{ borderRadius: radius.lg, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={incidentFilterDefs}
          searchPlaceholder="搜索事件标题、描述、负责人..."
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  loadIncidents();
                  loadStats();
                }}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
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
            pagination={{ current: page, pageSize, total }}
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
        <Card
          style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: spacing.sm,
            }}
          >
            <div>
              <Space style={{ marginBottom: spacing.sm }}>
                <Button
                  icon={<ArrowUpOutlined />}
                  onClick={handleBackToList}
                  style={{ transform: 'rotate(-90deg)' }}
                />
                <Title level={3} style={{ margin: 0 }}>
                  {incident.title}
                </Title>
              </Space>
              <Space>
                <Tag color={severityConfig[incident.severity]?.color}>
                  {severityConfig[incident.severity]?.label}
                </Tag>
                <Tag color={statusConfig[incident.status]?.color}>
                  {statusConfig[incident.status]?.label}
                </Tag>
                {incident.priority && (
                  <Tag color={priorityConfig[incident.priority]?.color}>
                    {priorityConfig[incident.priority]?.label}
                  </Tag>
                )}
                {incident.sla_breach && <Tag color="red">SLA 违规</Tag>}
              </Space>
            </div>
            <Space wrap>
              <Button icon={<FileTextOutlined />} onClick={() => handleOpenEdit(incident)}>
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
          <Col xs={24} lg={16}>
            <Card
              title="事件信息"
              style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
            >
              <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                <Descriptions.Item label="类型">{incident.type || '-'}</Descriptions.Item>
                <Descriptions.Item label="严重程度">
                  <Tag color={severityConfig[incident.severity]?.color}>
                    {severityConfig[incident.severity]?.label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  {incident.priority ? (
                    <Tag color={priorityConfig[incident.priority]?.color}>
                      {priorityConfig[incident.priority]?.label}
                    </Tag>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusConfig[incident.status]?.color}>
                    {statusConfig[incident.status]?.label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>
                  {incident.description || <Text type="secondary">无描述</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="影响">{incident.impact || '-'}</Descriptions.Item>
                <Descriptions.Item label="紧急度">{incident.urgency || '-'}</Descriptions.Item>
                <Descriptions.Item label="负责人">
                  {incident.assigned_to || '未分配'}
                </Descriptions.Item>
                <Descriptions.Item label="指挥官">
                  {incident.commander_id || '未指定'}
                </Descriptions.Item>
                <Descriptions.Item label="检测来源">
                  {incident.detected_by || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="升级层级">
                  <Badge
                    count={incident.escalation_level ?? 0}
                    style={{ backgroundColor: colors.primary[500] }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="受影响服务" span={2}>
                  {incident.affected_services?.length ? (
                    <Space wrap>
                      {incident.affected_services.map((s) => (
                        <Tag key={s} color="blue">{s}</Tag>
                      ))}
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="标签" span={2}>
                  {incident.tags?.length ? (
                    <Space wrap>
                      {incident.tags.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </Space>
                  ) : (
                    '-'
                  )}
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

  const renderTimeline = () => {
    if (!selectedIncident) return <Empty description="请选择一个事件" />;

    return (
      <div>
        <Card
          style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Title level={4} style={{ margin: 0 }}>事件时间线</Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => loadTimeline(selectedIncident.id)}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddEventModalOpen(true)}
              >
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
                      <Text>{event.description}</Text>
                    </div>
                  ),
                };
              })}
            />
          ) : (
            <Empty description="暂无时间线记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddEventModalOpen(true)}
              >
                添加第一条记录
              </Button>
            </Empty>
          )}
        </Card>
      </div>
    );
  };

  const renderPostmortem = () => {
    if (!selectedIncident) return <Empty description="请选择一个事件" />;

    return (
      <div>
        <Card
          style={{ borderRadius: radius.lg, boxShadow: shadows.card, marginBottom: spacing.md }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Title level={4} style={{ margin: 0 }}>复盘文档</Title>
            <Space>
              {!postmortem && (
                <Button
                  type="default"
                  icon={<RobotOutlined />}
                  loading={aiDraftLoading}
                  onClick={handleGenerateDraft}
                  style={{ borderColor: colors.purple[500], color: colors.purple[500] }}
                >
                  AI 生成复盘草稿
                </Button>
              )}
              {postmortem && postmortem.status === 'draft' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handlePublishPostmortem}
                >
                  发布复盘
                </Button>
              )}
            </Space>
          </div>
          {postmortemLoading ? (
            <div style={{ textAlign: 'center', padding: spacing.xl }}>
              <Text type="secondary">加载中...</Text>
            </div>
          ) : postmortem ? (
            <div>
              <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
                <Descriptions.Item label="标题">{postmortem.title}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={postmortemStatusConfig[postmortem.status]?.color || 'default'}>
                    {postmortemStatusConfig[postmortem.status]?.label || postmortem.status}
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
                        <li key={String(idx)}>{item.description || item}</li>
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
            <div>
              {aiDraftLoading && (
                <div style={{ textAlign: 'center', padding: spacing.xl }}>
                  <Text type="secondary">AI 正在生成复盘草稿...</Text>
                </div>
              )}
              {aiDraft && (
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    marginBottom: spacing.md,
                    background: 'rgba(114, 46, 209, 0.04)',
                    borderColor: colors.purple[500],
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text strong>
                        <RobotOutlined style={{ color: colors.purple[500], marginRight: 6 }} />
                        AI 复盘草稿
                      </Text>
                      <Tag color="purple">AI 生成</Tag>
                    </div>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="标题">{aiDraft.title}</Descriptions.Item>
                      <Descriptions.Item label="摘要">{aiDraft.summary}</Descriptions.Item>
                      <Descriptions.Item label="根因分析">{aiDraft.root_cause}</Descriptions.Item>
                      {aiDraft.contributing_factors && aiDraft.contributing_factors.length > 0 && (
                        <Descriptions.Item label="促成因素">
                          <ul style={{ margin: 0, paddingLeft: spacing.md }}>
                            {aiDraft.contributing_factors.map((f, i) => (
                              <li key={String(i)}>{f}</li>
                            ))}
                          </ul>
                        </Descriptions.Item>
                      )}
                      {aiDraft.timeline_summary && (
                        <Descriptions.Item label="时间线摘要">{aiDraft.timeline_summary}</Descriptions.Item>
                      )}
                      {aiDraft.action_items && aiDraft.action_items.length > 0 && (
                        <Descriptions.Item label="行动项">
                          <ul style={{ margin: 0, paddingLeft: spacing.md }}>
                            {aiDraft.action_items.map((item, i) => (
                              <li key={String(i)}>{item}</li>
                            ))}
                          </ul>
                        </Descriptions.Item>
                      )}
                      {aiDraft.lessons_learned && (
                        <Descriptions.Item label="经验教训">{aiDraft.lessons_learned}</Descriptions.Item>
                      )}
                    </Descriptions>
                    <Button
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={handleFillDraftToForm}
                      style={{
                        backgroundColor: colors.purple[500],
                        borderColor: colors.purple[500],
                      }}
                    >
                      使用草稿创建复盘
                    </Button>
                  </Space>
                </Card>
              )}
              {!aiDraft && !aiDraftLoading && (
                <Empty description="暂无复盘文档" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => setPostmortemModalOpen(true)}
                  >
                    创建复盘文档
                  </Button>
                </Empty>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  };

  // ============================================================================
  // Tab Items & Render
  // ============================================================================

  const tabItems = selectedIncident
    ? [
        { key: 'list', label: '事件列表', children: renderIncidentList() },
        { key: 'detail', label: '事件详情', children: renderIncidentDetail() },
        { key: 'timeline', label: '时间线', children: renderTimeline() },
        { key: 'postmortem', label: '复盘', children: renderPostmortem() },
      ]
    : [{ key: 'list', label: '事件列表', children: renderIncidentList() }];

  return (
    <Layout>
      <div style={{ padding: spacing.lg }}>
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BugOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            事件管理
          </Title>
          <Text type="secondary">管理生产事件的完整生命周期，从发现到复盘</Text>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <IncidentModals
        selectedIncident={selectedIncident}
        setSelectedIncident={setSelectedIncident}
        timeline={timeline}
        setTimeline={setTimeline}
        postmortem={postmortem}
        setPostmortem={setPostmortem}
        aiDraft={aiDraft}
        setAiDraft={setAiDraft}
        createModalOpen={createModalOpen}
        setCreateModalOpen={setCreateModalOpen}
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        assignModalOpen={assignModalOpen}
        setAssignModalOpen={setAssignModalOpen}
        escalateModalOpen={escalateModalOpen}
        setEscalateModalOpen={setEscalateModalOpen}
        postmortemModalOpen={postmortemModalOpen}
        setPostmortemModalOpen={setPostmortemModalOpen}
        addEventModalOpen={addEventModalOpen}
        setAddEventModalOpen={setAddEventModalOpen}
        statusNoteModalOpen={statusNoteModalOpen}
        setStatusNoteModalOpen={setStatusNoteModalOpen}
        pendingStatusChange={pendingStatusChange}
        setPendingStatusChange={setPendingStatusChange}
        createSubmitting={createSubmitting}
        setCreateSubmitting={setCreateSubmitting}
        editSubmitting={editSubmitting}
        setEditSubmitting={setEditSubmitting}
        createForm={createForm}
        editForm={editForm}
        assignForm={assignForm}
        escalateForm={escalateForm}
        postmortemForm={postmortemForm}
        eventForm={eventForm}
        statusNoteForm={statusNoteForm}
        handleCreate={handleCreate}
        handleEdit={handleEdit}
        handleAssign={handleAssign}
        handleEscalate={handleEscalate}
        handleAddEvent={handleAddEvent}
        handleCreatePostmortem={handleCreatePostmortem}
        handlePublishPostmortem={handlePublishPostmortem}
        handleGenerateDraft={handleGenerateDraft}
        handleFillDraftToForm={handleFillDraftToForm}
        handleConfirmStatusChange={handleConfirmStatusChange}
        handleOpenEdit={handleOpenEdit}
        handleOpenAssign={handleOpenAssign}
        handleOpenEscalate={handleOpenEscalate}
        handleStatusChange={handleStatusChange}
        handleBackToList={handleBackToList}
        handleDelete={handleDelete}
        handleViewDetail={handleViewDetail}
      />
      </div>
    </Layout>
  );
};

export default IncidentManagement;
