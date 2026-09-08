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
 * P2-9 Phase 239:
 * - Components/TabItems.tsx : buildTabItems based on selectedIncident
 * - Components/ModalsProps.tsx : IncidentModals bound props wrapper
 *
 * API: @/api/incident
 */
import { Typography, Tabs } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import { colors, spacing } from '@/tokens';
import { useIncidentState } from './useIncidentState';
import { IncidentModals } from './IncidentModals';
import { buildTabItems } from './Components/TabItems';

const { Title, Text } = Typography;

const IncidentManagement: React.FC = () => {
  const s = useIncidentState();
  const tabItems = buildTabItems({ s });

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
