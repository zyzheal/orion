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
  Card,
  Tabs,
  message,
  Form,
  Modal,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SwapOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import Table from '@/components/Table';
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
import dayjs from 'dayjs';
import {
  statusConfig,
} from './config';
import {
  useChangeColumns,
  useRFCColumns,
  useCABColumns,
} from './columns';
import { ChangeForm } from './ChangeForm';
import { ChangeDetailPanel } from './ChangeDetailPanel';
import { RFCForm } from './RFCForm';
import { CABForm } from './CABForm';
import { DecisionForm } from './DecisionForm';
import { CABDetailContent } from './CABDetailContent';
import { RFCDetailContent } from './RFCDetailContent';
import { buildStatsCards } from './stats';
import { StatusNoteForm } from './StatusNoteForm';
import { TimelineEventForm } from './TimelineEventForm';
import { RequestsTab } from './RequestsTab';

const { Title, Text } = Typography;

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

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const payload = {
        ...values,
        affected_services: values.affected_services
          ? values.affected_services
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation
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
          ? typeof values.affected_services === 'string'
            ? values.affected_services
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : values.affected_services
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
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
      message.success(
        `状态已变更为: ${statusConfig[pendingStatusChange]?.label || pendingStatusChange}`
      );
      setStatusNoteModalOpen(false);
      statusNoteForm.resetFields();
      setPendingStatusChange('');
      loadTimeline(selectedChange.id);
      loadChanges();
      loadStats();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
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
      scheduled_start: selectedChange.scheduled_start
        ? dayjs(selectedChange.scheduled_start)
        : undefined,
      scheduled_end: selectedChange.scheduled_end ? dayjs(selectedChange.scheduled_end) : undefined,
      assigned_to: selectedChange.assigned_to,
      affected_services: selectedChange.affected_services?.join(', '),
    });
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
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
          ? values.attendees
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined,
      };
      await createCABMeeting(payload);
      message.success('CAB 会议创建成功');
      setCabModalOpen(false);
      cabForm.resetFields();
      setEditCabId(null);
      loadCabMeetings();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('创建 CAB 会议失败');
    }
  };

  const handleUpdateCab = async () => {
    if (!editCabId) return;
    try {
      const values = await cabForm.validateFields();
      const payload: Record<string, unknown> = { ...values };
      if (values.scheduled_at?.toISOString) {
        payload.scheduled_at = values.scheduled_at.toISOString();
      }
      if (values.attendees && typeof values.attendees === 'string') {
        payload.attendees = values.attendees
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      await updateCABMeeting(editCabId, payload);
      message.success('CAB 会议更新成功');
      setCabModalOpen(false);
      cabForm.resetFields();
      setEditCabId(null);
      loadCabMeetings();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
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
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('添加决策记录失败');
    }
  };

  // ============================================================================
  // Table Columns (factories from ./columns)
  // ============================================================================

  const changeColumns = useChangeColumns({
    handleDelete,
    handleViewDetail,
    handleOpenEditModal,
    setSelectedChange,
  });

  const rfcColumns = useRFCColumns({
    handleViewRfc,
    handleEditRfc,
  });

  const cabColumns = useCABColumns({
    handleViewCab,
    handleEditCab,
  });

  // ============================================================================
  // Stats Computation
  // ============================================================================

  const statsCards = buildStatsCards(stats);

  // Change Form: rendered by ChangeForm component in modals

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
        <RequestsTab
          changes={changes}
          loading={loading}
          total={total}
          page={page}
          pageSize={pageSize}
          filterStatus={filterStatus}
          filterType={filterType}
          filterPriority={filterPriority}
          changeColumns={changeColumns}
          onFilterStatusChange={(v) => {
            setFilterStatus(v || undefined);
            setPage(1);
          }}
          onFilterTypeChange={(v) => {
            setFilterType(v || undefined);
            setPage(1);
          }}
          onFilterPriorityChange={(v) => {
            setFilterPriority(v || undefined);
            setPage(1);
          }}
          onRefresh={loadChanges}
          onCreate={() => {
            createForm.resetFields();
            setCreateModalOpen(true);
          }}
          onPageChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
        />
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
      children: (
        <ChangeDetailPanel
          change={selectedChange}
          detailLoading={detailLoading}
          riskLoading={riskLoading}
          riskAnalysis={riskAnalysis}
          timeline={timeline}
          timelineLoading={timelineLoading}
          onRiskAnalysis={handleRiskAnalysis}
          onEdit={handleOpenEditModal}
          onStatusChange={handleStatusChange}
          onAddEvent={() => {
            eventForm.resetFields();
            setAddEventModalOpen(true);
          }}
        />
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
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
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
          <ChangeForm formInstance={createForm} />
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
          <ChangeForm formInstance={editForm} />
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
          <StatusNoteForm formInstance={statusNoteForm} />
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
          <TimelineEventForm formInstance={eventForm} />
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
          <RFCForm formInstance={rfcForm} />
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
          {selectedRfc && <RFCDetailContent rfc={selectedRfc} />}
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
          <CABForm formInstance={cabForm} />
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
          {selectedCab && <CABDetailContent cab={selectedCab} />}
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
          <DecisionForm formInstance={decisionForm} />
        </Modal>
      </div>
    </Layout>
  );
};

export default ChangeManagement;
