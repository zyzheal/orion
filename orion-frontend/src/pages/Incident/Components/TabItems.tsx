/**
 * TabItems.tsx - Incident 事件 Tab 项目构建
 * 抽取自 index.tsx (P2-9 Phase 239)
 */
import type { TabsProps } from 'antd';
import type { useIncidentState } from '../useIncidentState';
import {
  IncidentListTab,
  IncidentDetailTab,
  IncidentTimelineTab,
  IncidentPostmortemTab,
} from '../IncidentTabs';

type IncidentState = ReturnType<typeof useIncidentState>;

interface Props {
  s: IncidentState;
}

const listTab = (s: IncidentState) => ({
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
});

export function buildTabItems({ s }: Props): TabsProps['items'] {
  if (!s.selectedIncident) {
    return [listTab(s)];
  }
  return [
    listTab(s),
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
  ];
}
