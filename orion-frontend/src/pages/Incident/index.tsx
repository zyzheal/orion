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
 * Split into modules (2026-09-06, P2-9):
 * - ./useIncidentState.ts : state, data loading, event handlers (hook)
 * - ./IncidentTabs.tsx    : tab content components (List/Detail/Timeline/Postmortem/StatsBar)
 * - ./columns.tsx         : table column factory + filter definitions
 * - ./config.tsx          : severity/status/priority/event-type display configs
 * - ./IncidentModals.tsx  : create/edit/assign/escalate/timeline/status/postmortem modals
 *
 * API: @/api/incident
 */
import React from 'react';
import {
  Typography,
  Tabs,
} from 'antd';
import {
  BugOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import { colors, spacing } from '@/tokens';
import { useIncidentState } from './useIncidentState';
import {
  IncidentListTab,
  IncidentDetailTab,
  IncidentTimelineTab,
  IncidentPostmortemTab,
} from './IncidentTabs';
import { IncidentModals } from './IncidentModals';

const { Title, Text } = Typography;

const IncidentManagement: React.FC = () => {
  const s = useIncidentState();

  const tabItems = s.selectedIncident
    ? [
        {
          key: 'list',
          label: '事件列表',
          children: (
            <IncidentListTab
              incidents={s.incidents}
              loading={s.loading}
              page={s.page}
              pageSize={s.pageSize}
              total={s.total}
              columns={s.columns}
              searchQuery={s.searchQuery}
              filters={s.filters}
              stats={s.stats}
              statsLoading={s.statsLoading}
              setSearchQuery={s.setSearchQuery}
              setFilters={s.setFilters}
              setPage={s.setPage}
              setPageSize={s.setPageSize}
              loadIncidents={s.loadIncidents}
              loadStats={s.loadStats}
              setCreateModalOpen={s.setCreateModalOpen}
            />
          ),
        },
        {
          key: 'detail',
          label: '事件详情',
          children: (
            <IncidentDetailTab
              selectedIncident={s.selectedIncident}
              detailLoading={s.detailLoading}
              handleBackToList={s.handleBackToList}
              handleOpenEdit={s.handleOpenEdit}
              handleOpenAssign={s.handleOpenAssign}
              handleOpenEscalate={s.handleOpenEscalate}
              handleStatusChange={s.handleStatusChange}
            />
          ),
        },
        {
          key: 'timeline',
          label: '时间线',
          children: (
            <IncidentTimelineTab
              selectedIncident={s.selectedIncident}
              timeline={s.timeline}
              timelineLoading={s.timelineLoading}
              setAddEventModalOpen={s.setAddEventModalOpen}
              loadTimeline={s.loadTimeline}
            />
          ),
        },
        {
          key: 'postmortem',
          label: '复盘',
          children: (
            <IncidentPostmortemTab
              selectedIncident={s.selectedIncident}
              postmortem={s.postmortem}
              postmortemLoading={s.postmortemLoading}
              aiDraft={s.aiDraft}
              aiDraftLoading={s.aiDraftLoading}
              setPostmortemModalOpen={s.setPostmortemModalOpen}
              handleGenerateDraft={s.handleGenerateDraft}
              handlePublishPostmortem={s.handlePublishPostmortem}
              handleFillDraftToForm={s.handleFillDraftToForm}
            />
          ),
        },
      ]
    : [
        {
          key: 'list',
          label: '事件列表',
          children: (
            <IncidentListTab
              incidents={s.incidents}
              loading={s.loading}
              page={s.page}
              pageSize={s.pageSize}
              total={s.total}
              columns={s.columns}
              searchQuery={s.searchQuery}
              filters={s.filters}
              stats={s.stats}
              statsLoading={s.statsLoading}
              setSearchQuery={s.setSearchQuery}
              setFilters={s.setFilters}
              setPage={s.setPage}
              setPageSize={s.setPageSize}
              loadIncidents={s.loadIncidents}
              loadStats={s.loadStats}
              setCreateModalOpen={s.setCreateModalOpen}
            />
          ),
        },
      ];

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

        <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={tabItems} />

        <IncidentModals
          selectedIncident={s.selectedIncident}
          setSelectedIncident={s.setSelectedIncident}
          timeline={s.timeline}
          setTimeline={s.setTimeline}
          postmortem={s.postmortem}
          setPostmortem={s.setPostmortem}
          aiDraft={s.aiDraft}
          setAiDraft={s.setAiDraft}
          createModalOpen={s.createModalOpen}
          setCreateModalOpen={s.setCreateModalOpen}
          editModalOpen={s.editModalOpen}
          setEditModalOpen={s.setEditModalOpen}
          assignModalOpen={s.assignModalOpen}
          setAssignModalOpen={s.setAssignModalOpen}
          escalateModalOpen={s.escalateModalOpen}
          setEscalateModalOpen={s.setEscalateModalOpen}
          postmortemModalOpen={s.postmortemModalOpen}
          setPostmortemModalOpen={s.setPostmortemModalOpen}
          addEventModalOpen={s.addEventModalOpen}
          setAddEventModalOpen={s.setAddEventModalOpen}
          statusNoteModalOpen={s.statusNoteModalOpen}
          setStatusNoteModalOpen={s.setStatusNoteModalOpen}
          pendingStatusChange={s.pendingStatusChange}
          setPendingStatusChange={s.setPendingStatusChange}
          createSubmitting={s.createSubmitting}
          setCreateSubmitting={s.setCreateSubmitting}
          editSubmitting={s.editSubmitting}
          setEditSubmitting={s.setEditSubmitting}
          createForm={s.createForm}
          editForm={s.editForm}
          assignForm={s.assignForm}
          escalateForm={s.escalateForm}
          postmortemForm={s.postmortemForm}
          eventForm={s.eventForm}
          statusNoteForm={s.statusNoteForm}
          handleCreate={s.handleCreate}
          handleEdit={s.handleEdit}
          handleAssign={s.handleAssign}
          handleEscalate={s.handleEscalate}
          handleAddEvent={s.handleAddEvent}
          handleCreatePostmortem={s.handleCreatePostmortem}
          handlePublishPostmortem={s.handlePublishPostmortem}
          handleGenerateDraft={s.handleGenerateDraft}
          handleFillDraftToForm={s.handleFillDraftToForm}
          handleConfirmStatusChange={s.handleConfirmStatusChange}
          handleOpenEdit={s.handleOpenEdit}
          handleOpenAssign={s.handleOpenAssign}
          handleOpenEscalate={s.handleOpenEscalate}
          handleStatusChange={s.handleStatusChange}
          handleBackToList={s.handleBackToList}
          handleDelete={s.handleDelete}
          handleViewDetail={s.handleViewDetail}
        />
      </div>
    </Layout>
  );
};

export default IncidentManagement;
