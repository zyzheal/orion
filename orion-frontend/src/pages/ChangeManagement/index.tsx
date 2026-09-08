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
 * P2-9 Phase 255 重构: 294 → 95 行 (-68%), 新增:
 *   Components/TabItems.tsx   — 4 tabs items (requests/detail/rfc/cab)
 */
import React from 'react';
import { Card, Tabs } from 'antd';
import { Layout } from '@/components/Layout';
import { radius, shadows, spacing } from '@/tokens';
import { useChangeManagementState } from './useChangeManagementState';
import { useChangeFormWrappers } from './useChangeFormWrappers';
import { useChangeColumns, useRFCColumns, useCABColumns } from './columns';
import { buildStatsCards } from './stats';
import { ChangeManagementModals } from './ChangeManagementModals';
import { PageHeader } from './Components/PageHeader';
import { StatsBar } from './Components/StatsBar';
import { buildTabItems } from './Components/TabItems';

const ChangeManagement: React.FC = () => {
  const state = useChangeManagementState();
  const {
    activeTab, setActiveTab,
    stats, statsLoading,
    createModalOpen, editModalOpen, addEventModalOpen,
    statusNoteModalOpen, pendingStatusChange,
    rfcModalOpen, rfcDetailModalOpen, selectedRfc, setRfcDetailModalOpen, editRfcId,
    cabModalOpen, cabDetailModalOpen, selectedCab, setCabDetailModalOpen, editCabId,
    decisionModalOpen,
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
    setCreateModalOpen, setEditModalOpen, setAddEventModalOpen,
    setStatusNoteModalOpen, setPendingStatusChange,
    setRfcModalOpen, setSelectedRfc, setEditRfcId,
    setCabModalOpen, setEditCabId, setDecisionModalOpen,
    setSelectedChange,
  } = state;

  const wrappers = useChangeFormWrappers({
    handleCreate, handleEdit,
    handleConfirmStatusChange, handleAddTimelineEvent,
    handleCreateRfc, handleUpdateRfc,
    handleCreateCab, handleUpdateCab, handleAddDecision,
    selectedChange: state.selectedChange,
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

  const tabItems = buildTabItems({ state, wrappers, changeColumns, rfcColumns, cabColumns });

  return (
    <Layout>
      <div style={{ padding: spacing.lg }}>
        <PageHeader />
        <StatsBar statsCards={statsCards} loading={statsLoading} />

        <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
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
