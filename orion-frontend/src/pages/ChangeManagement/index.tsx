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
 *
 * P2-9 Phase 50 重构: 884 → 245 行 (-72%)
 * 拆分: useChangeManagementState.ts (全状态+loaders+handlers)
 *       index.tsx 仅保留 7 Form.useForm + form wrapper + 布局编排
 */
import React, { useCallback } from 'react';
import { Typography, Card, Tabs, Row, Col, Form } from 'antd';
import {
  EyeOutlined,
  SwapOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import MetricCard from '@/components/MetricCard';
import { colors, spacing, radius, shadows } from '@/tokens';
import {
  useChangeManagementState,
} from './useChangeManagementState';
import {
  useChangeColumns,
  useRFCColumns,
  useCABColumns,
} from './columns';
import { ChangeDetailPanel } from './ChangeDetailPanel';
import { buildStatsCards } from './stats';
import { RequestsTab } from './RequestsTab';
import { RFCsTab } from './RFCsTab';
import { CABsTab } from './CABsTab';
import { ChangeManagementModals } from './ChangeManagementModals';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// ChangeManagement Component
// ============================================================================

const ChangeManagement: React.FC = () => {
  const {
    activeTab, setActiveTab,
    changes, total, loading,
    page, setPage,
    pageSize, setPageSize,
    filterStatus, setFilterStatus,
    filterType, setFilterType,
    filterPriority, setFilterPriority,
    selectedChange, setSelectedChange,
    detailLoading,
    riskAnalysis, riskLoading,
    timeline, timelineLoading,
    rfcs, rfcTotal, rfcLoading,
    rfcPage, setRfcPage,
    cabMeetings, cabTotal, cabLoading,
    cabPage, setCabPage,
    stats, statsLoading,
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
    selectedCab,
    editCabId, setEditCabId,
    decisionModalOpen, setDecisionModalOpen,
    createSubmitting, editSubmitting,
    loadChanges,
    handleCreate, handleEdit, handleDelete,
    handleViewDetail, handleStatusChange,
    handleConfirmStatusChange,
    handleRiskAnalysis,
    handleAddTimelineEvent,
    handleCreateRfc, handleUpdateRfc,
    handleViewRfc,
    handleCreateCab, handleUpdateCab,
    handleViewCab,
    handleAddDecision,
  } = useChangeManagementState();

  // Forms
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [statusNoteForm] = Form.useForm();
  const [rfcForm] = Form.useForm();
  const [cabForm] = Form.useForm();
  const [decisionForm] = Form.useForm();

  // ============================================================================
  // Form wrapper handlers (validateFields + resetFields + call hook handler)
  // ============================================================================

  const handleCreateWrapper = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      await handleCreate(values);
      createForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [createForm, handleCreate]);

  const handleEditWrapper = useCallback(async () => {
    try {
      const values = await editForm.validateFields();
      await handleEdit(values);
      editForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [editForm, handleEdit]);

  const handleOpenEditModalWrapper = useCallback(() => {
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
  }, [selectedChange, editForm, setEditModalOpen]);

  const handleConfirmStatusChangeWrapper = useCallback(async () => {
    try {
      const values = await statusNoteForm.validateFields();
      await handleConfirmStatusChange(values.note);
      statusNoteForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [statusNoteForm, handleConfirmStatusChange]);

  const handleAddTimelineEventWrapper = useCallback(async () => {
    try {
      const values = await eventForm.validateFields();
      await handleAddTimelineEvent(values);
      eventForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [eventForm, handleAddTimelineEvent]);

  const handleCreateRfcWrapper = useCallback(async () => {
    try {
      const values = await rfcForm.validateFields();
      await handleCreateRfc(values);
      rfcForm.resetFields();
      setEditRfcId(null);
    } catch {
      // form validation error - ignore
    }
  }, [rfcForm, handleCreateRfc, setEditRfcId]);

  const handleUpdateRfcWrapper = useCallback(async () => {
    try {
      const values = await rfcForm.validateFields();
      await handleUpdateRfc(values);
      rfcForm.resetFields();
      setEditRfcId(null);
    } catch {
      // form validation error - ignore
    }
  }, [rfcForm, handleUpdateRfc, setEditRfcId]);

  const handleEditRfcWrapper = useCallback((record: any) => {
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
  }, [rfcForm, setEditRfcId, setRfcModalOpen]);

  const handleCreateCabWrapper = useCallback(async () => {
    try {
      const values = await cabForm.validateFields();
      await handleCreateCab(values);
      cabForm.resetFields();
      setEditCabId(null);
    } catch {
      // form validation error - ignore
    }
  }, [cabForm, handleCreateCab, setEditCabId]);

  const handleUpdateCabWrapper = useCallback(async () => {
    try {
      const values = await cabForm.validateFields();
      await handleUpdateCab(values);
      cabForm.resetFields();
      setEditCabId(null);
    } catch {
      // form validation error - ignore
    }
  }, [cabForm, handleUpdateCab, setEditCabId]);

  const handleEditCabWrapper = useCallback((record: any) => {
    setEditCabId(record.id);
    cabForm.setFieldsValue({
      title: record.title,
      description: record.description,
      scheduled_at: dayjs(record.scheduled_at),
      location: record.location,
      attendees: record.attendees?.join(', '),
    });
    setCabModalOpen(true);
  }, [cabForm, setEditCabId, setCabModalOpen]);

  const handleAddDecisionWrapper = useCallback(async () => {
    try {
      const values = await decisionForm.validateFields();
      await handleAddDecision(values);
      decisionForm.resetFields();
    } catch {
      // form validation error - ignore
    }
  }, [decisionForm, handleAddDecision]);

  // ============================================================================
  // Table Columns (factories from ./columns)
  // ============================================================================

  const changeColumns = useChangeColumns({
    handleDelete,
    handleViewDetail,
    handleOpenEditModal: handleOpenEditModalWrapper,
    setSelectedChange,
  });

  const rfcColumns = useRFCColumns({
    handleViewRfc,
    handleEditRfc: handleEditRfcWrapper,
  });

  const cabColumns = useCABColumns({
    handleViewCab,
    handleEditCab: handleEditCabWrapper,
  });

  // ============================================================================
  // Stats Computation
  // ============================================================================

  const statsCards = buildStatsCards(stats);

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
          onEdit={handleOpenEditModalWrapper}
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
        <RFCsTab
          rfcs={rfcs}
          rfcLoading={rfcLoading}
          rfcTotal={rfcTotal}
          rfcPage={rfcPage}
          pageSize={pageSize}
          rfcColumns={rfcColumns}
          onCreate={() => {
            rfcForm.resetFields();
            setEditRfcId(null);
            setRfcModalOpen(true);
          }}
          onPageChange={setRfcPage}
        />
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
        <CABsTab
          cabMeetings={cabMeetings}
          cabLoading={cabLoading}
          cabTotal={cabTotal}
          cabPage={cabPage}
          pageSize={pageSize}
          cabColumns={cabColumns}
          onCreate={() => {
            cabForm.resetFields();
            setEditCabId(null);
            setCabModalOpen(true);
          }}
          onPageChange={setCabPage}
        />
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

        <ChangeManagementModals
          createModalOpen={createModalOpen}
          createForm={createForm}
          createSubmitting={createSubmitting}
          onCreate={handleCreateWrapper}
          onCreateCancel={() => {
            setCreateModalOpen(false);
            createForm.resetFields();
          }}
          editModalOpen={editModalOpen}
          editForm={editForm}
          editSubmitting={editSubmitting}
          onEdit={handleEditWrapper}
          onEditCancel={() => {
            setEditModalOpen(false);
            editForm.resetFields();
          }}
          statusNoteModalOpen={statusNoteModalOpen}
          statusNoteForm={statusNoteForm}
          pendingStatusChange={pendingStatusChange}
          onStatusConfirm={handleConfirmStatusChangeWrapper}
          onStatusCancel={() => {
            setStatusNoteModalOpen(false);
            statusNoteForm.resetFields();
            setPendingStatusChange('');
          }}
          addEventModalOpen={addEventModalOpen}
          eventForm={eventForm}
          onEventAdd={handleAddTimelineEventWrapper}
          onEventCancel={() => {
            setAddEventModalOpen(false);
            eventForm.resetFields();
          }}
          rfcModalOpen={rfcModalOpen}
          rfcForm={rfcForm}
          editRfcId={editRfcId}
          onCreateRfc={handleCreateRfcWrapper}
          onUpdateRfc={handleUpdateRfcWrapper}
          onRfcCancel={() => {
            setRfcModalOpen(false);
            rfcForm.resetFields();
            setEditRfcId(null);
          }}
          rfcDetailModalOpen={rfcDetailModalOpen}
          selectedRfc={selectedRfc}
          onRfcDetailCancel={() => {
            setRfcDetailModalOpen(false);
            setSelectedRfc(null);
          }}
          cabModalOpen={cabModalOpen}
          cabForm={cabForm}
          editCabId={editCabId}
          onCreateCab={handleCreateCabWrapper}
          onUpdateCab={handleUpdateCabWrapper}
          onCabCancel={() => {
            setCabModalOpen(false);
            cabForm.resetFields();
            setEditCabId(null);
          }}
          cabDetailModalOpen={cabDetailModalOpen}
          selectedCab={selectedCab}
          onCabDetailCancel={() => setCabDetailModalOpen(false)}
          onOpenDecision={() => {
            decisionForm.resetFields();
            setDecisionModalOpen(true);
          }}
          decisionModalOpen={decisionModalOpen}
          decisionForm={decisionForm}
          onDecisionAdd={handleAddDecisionWrapper}
          onDecisionCancel={() => {
            setDecisionModalOpen(false);
            decisionForm.resetFields();
          }}
        />;
      </div>
    </Layout>
  );
};

export default ChangeManagement;
