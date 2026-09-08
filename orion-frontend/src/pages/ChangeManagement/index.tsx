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
 * P2-9 Phase 272 重构: 158 → ~45 行, 新增:
 *   Components/ModalsBundle.tsx — 55 行 ChangeManagementModals props 汇总
 */
import React from 'react';
import { Card, Tabs } from 'antd';
import { Layout } from '@/components/Layout';
import { radius, shadows, spacing } from '@/tokens';
import { useChangeManagementState } from './useChangeManagementState';
import { useChangeFormWrappers } from './useChangeFormWrappers';
import { useChangeColumns, useRFCColumns, useCABColumns } from './columns';
import { buildStatsCards } from './stats';
import { PageHeader } from './Components/PageHeader';
import { StatsBar } from './Components/StatsBar';
import { buildTabItems } from './Components/TabItems';
import { ModalsBundle } from './Components/ModalsBundle';

const ChangeManagement: React.FC = () => {
  const state = useChangeManagementState();

  const wrappers = useChangeFormWrappers({
    handleCreate: state.handleCreate,
    handleEdit: state.handleEdit,
    handleConfirmStatusChange: state.handleConfirmStatusChange,
    handleAddTimelineEvent: state.handleAddTimelineEvent,
    handleCreateRfc: state.handleCreateRfc,
    handleUpdateRfc: state.handleUpdateRfc,
    handleCreateCab: state.handleCreateCab,
    handleUpdateCab: state.handleUpdateCab,
    handleAddDecision: state.handleAddDecision,
    selectedChange: state.selectedChange,
    setCreateModalOpen: state.setCreateModalOpen,
    setEditModalOpen: state.setEditModalOpen,
    setAddEventModalOpen: state.setAddEventModalOpen,
    setStatusNoteModalOpen: state.setStatusNoteModalOpen,
    setPendingStatusChange: state.setPendingStatusChange,
    setRfcModalOpen: state.setRfcModalOpen,
    setRfcDetailModalOpen: state.setRfcDetailModalOpen,
    setSelectedRfc: state.setSelectedRfc,
    setEditRfcId: state.setEditRfcId,
    setCabModalOpen: state.setCabModalOpen,
    setCabDetailModalOpen: state.setCabDetailModalOpen,
    setEditCabId: state.setEditCabId,
    setDecisionModalOpen: state.setDecisionModalOpen,
  });

  const changeColumns = useChangeColumns({
    handleDelete: state.handleDelete,
    handleViewDetail: state.handleViewDetail,
    handleOpenEditModal: wrappers.handleOpenEditModalWrapper,
    setSelectedChange: state.setSelectedChange,
  });

  const rfcColumns = useRFCColumns({
    handleViewRfc: state.handleViewRfc,
    handleEditRfc: wrappers.handleEditRfcWrapper,
  });

  const cabColumns = useCABColumns({
    handleViewCab: state.handleViewCab,
    handleEditCab: wrappers.handleEditCabWrapper,
  });

  const statsCards = buildStatsCards(state.stats);
  const tabItems = buildTabItems({ state, wrappers, changeColumns, rfcColumns, cabColumns });

  return (
    <Layout>
      <div style={{ padding: spacing.lg }}>
        <PageHeader />
        <StatsBar statsCards={statsCards} loading={state.statsLoading} />

        <Card style={{ borderRadius: radius.lg, boxShadow: shadows.card }}>
          <Tabs activeKey={state.activeTab} onChange={state.setActiveTab} items={tabItems} />
        </Card>

        <ModalsBundle state={state} wrappers={wrappers} />
      </div>
    </Layout>
  );
};

export default ChangeManagement;
