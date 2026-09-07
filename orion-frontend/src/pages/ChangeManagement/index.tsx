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
 * P2-9 Phase 160 重构: 525 → ~140 行 (-73%), 新增:
 *   useChangeFormWrappers.ts  — 7 Forms + 10 wrappers + 5 openers + 7 cancellers
 *   Components/PageHeader.tsx — 标题 + 副标题
 *   Components/StatsBar.tsx   — 统计卡片行
 */
import React from 'react';
import { Card, Tabs } from 'antd';
import {
  EyeOutlined,
  SwapOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import { radius, shadows, spacing } from '@/tokens';
import { useChangeManagementState } from './useChangeManagementState';
import { useChangeFormWrappers } from './useChangeFormWrappers';
import { useChangeColumns, useRFCColumns, useCABColumns } from './columns';
import { buildStatsCards } from './stats';
import { ChangeDetailPanel } from './ChangeDetailPanel';
import { RequestsTab } from './RequestsTab';
import { RFCsTab } from './RFCsTab';
import { CABsTab } from './CABsTab';
import { ChangeManagementModals } from './ChangeManagementModals';
import { PageHeader } from './Components/PageHeader';
import { StatsBar } from './Components/StatsBar';

const ChangeManagement: React.FC = () => {
  const state = useChangeManagementState();
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
    handleCreate, handleEdit,
    handleDelete, handleViewDetail,
    handleStatusChange,
    handleConfirmStatusChange,
    handleRiskAnalysis,
    handleAddTimelineEvent,
    handleCreateRfc, handleUpdateRfc, handleViewRfc,
    handleCreateCab, handleUpdateCab, handleViewCab,
    handleAddDecision,
  } = state;

  const wrappers = useChangeFormWrappers({
    handleCreate, handleEdit,
    handleConfirmStatusChange, handleAddTimelineEvent,
    handleCreateRfc, handleUpdateRfc,
    handleCreateCab, handleUpdateCab, handleAddDecision,
    selectedChange,
    setCreateModalOpen, setEditModalOpen, setAddEventModalOpen,
    setStatusNoteModalOpen, setPendingStatusChange,
    setRfcModalOpen, setRfcDetailModalOpen, setSelectedRfc,
    setEditRfcId, setCabModalOpen, setCabDetailModalOpen,
    setEditCabId, setDecisionModalOpen,
  });

  const changeColumns = useChangeColumns({
    handleDelete,
    handleViewDetail,
    handleOpenEditModal: wrappers.handleOpenEditModalWrapper,
    setSelectedChange,
  });

  const rfcColumns = useRFCColumns({
    handleViewRfc,
    handleEditRfc: wrappers.handleEditRfcWrapper,
  });

  const cabColumns = useCABColumns({
    handleViewCab,
    handleEditCab: wrappers.handleEditCabWrapper,
  });

  const statsCards = buildStatsCards(stats);

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
          onCreate={wrappers.openCreateModal}
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
          onEdit={wrappers.handleOpenEditModalWrapper}
          onStatusChange={handleStatusChange}
          onAddEvent={wrappers.openAddEventModal}
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
          onCreate={wrappers.openRfcModal}
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
          onCreate={wrappers.openCabModal}
          onPageChange={setCabPage}
        />
      ),
    },
  ];

  return (
    <Layout>
      <div style={{ padding: spacing.lg }}>
        <PageHeader />
        <StatsBar statsCards={statsCards} loading={statsLoading} />

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
          createForm={wrappers.createForm}
          createSubmitting={createSubmitting}
          onCreate={wrappers.handleCreateWrapper}
          onCreateCancel={wrappers.cancelCreateModal}
          editModalOpen={editModalOpen}
          editForm={wrappers.editForm}
          editSubmitting={editSubmitting}
          onEdit={wrappers.handleEditWrapper}
          onEditCancel={wrappers.cancelEditModal}
          statusNoteModalOpen={statusNoteModalOpen}
          statusNoteForm={wrappers.statusNoteForm}
          pendingStatusChange={pendingStatusChange}
          onStatusConfirm={wrappers.handleConfirmStatusChangeWrapper}
          onStatusCancel={wrappers.cancelStatusModal}
          addEventModalOpen={addEventModalOpen}
          eventForm={wrappers.eventForm}
          onEventAdd={wrappers.handleAddTimelineEventWrapper}
          onEventCancel={wrappers.cancelEventModal}
          rfcModalOpen={rfcModalOpen}
          rfcForm={wrappers.rfcForm}
          editRfcId={editRfcId}
          onCreateRfc={wrappers.handleCreateRfcWrapper}
          onUpdateRfc={wrappers.handleUpdateRfcWrapper}
          onRfcCancel={wrappers.cancelRfcModal}
          rfcDetailModalOpen={rfcDetailModalOpen}
          selectedRfc={selectedRfc}
          onRfcDetailCancel={() => {
            setRfcDetailModalOpen(false);
            wrappers.cancelRfcDetailModal();
          }}
          cabModalOpen={cabModalOpen}
          cabForm={wrappers.cabForm}
          editCabId={editCabId}
          onCreateCab={wrappers.handleCreateCabWrapper}
          onUpdateCab={wrappers.handleUpdateCabWrapper}
          onCabCancel={wrappers.cancelCabModal}
          cabDetailModalOpen={cabDetailModalOpen}
          selectedCab={selectedCab}
          onCabDetailCancel={() => setCabDetailModalOpen(false)}
          onOpenDecision={wrappers.openDecisionModal}
          decisionModalOpen={decisionModalOpen}
          decisionForm={wrappers.decisionForm}
          onDecisionAdd={wrappers.handleAddDecisionWrapper}
          onDecisionCancel={wrappers.cancelDecisionModal}
        />
      </div>
    </Layout>
  );
};

export default ChangeManagement;
