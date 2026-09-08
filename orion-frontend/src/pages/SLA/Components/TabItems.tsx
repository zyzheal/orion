/**
 * TabItems.tsx - SLA Tab 项目构建
 * 抽取自 index.tsx (P2-9 Phase 238)
 */
import type { TabsProps } from 'antd';
import { DefinitionsTab } from '../DefinitionsTab';
import { TrackingTab } from '../TrackingTab';
import { BreachesTab } from '../BreachesTab';
import type { SLAState } from '../useSLAFormHandlers';

interface Props {
  state: SLAState;
  handleOpenCreateTrackingModal: () => void;
}

export function buildTabItems({ state: s, handleOpenCreateTrackingModal }: Props): TabsProps['items'] {
  return [
    {
      key: 'definitions',
      label: `SLA 定义 (${s.defTotal})`,
      children: (
        <DefinitionsTab
          definitions={s.definitions}
          defTotal={s.defTotal}
          loading={s.loading}
          defTypeFilter={s.defTypeFilter}
          setDefTypeFilter={s.setDefTypeFilter}
          defStatusFilter={s.defStatusFilter}
          setDefStatusFilter={s.setDefStatusFilter}
          handleOpenCreateDefModal={s.handleOpenCreateDefModal}
          handleOpenEditDefModal={s.handleOpenEditDefModal}
          handleDeleteDefinition={s.handleDeleteDefinition}
        />
      ),
    },
    {
      key: 'tracking',
      label: `追踪记录 (${s.trackingTotal})`,
      children: (
        <TrackingTab
          trackings={s.trackings}
          trackingTotal={s.trackingTotal}
          loading={s.loading}
          trackingStatusFilter={s.trackingStatusFilter}
          setTrackingStatusFilter={s.setTrackingStatusFilter}
          trackingEntityFilter={s.trackingEntityFilter}
          setTrackingEntityFilter={s.setTrackingEntityFilter}
          handleOpenCreateTrackingModal={handleOpenCreateTrackingModal}
          handleUpdateTrackingStatus={s.handleUpdateTrackingStatus}
          handleMarkBreach={s.handleMarkBreach}
          definitionMap={s.definitionMap}
        />
      ),
    },
    {
      key: 'breaches',
      label: `违约事件 (${s.breachTotal})`,
      children: (
        <BreachesTab
          breaches={s.breaches}
          breachTotal={s.breachTotal}
          loading={s.loading}
          breachTrackingFilter={s.breachTrackingFilter}
          setBreachTrackingFilter={s.setBreachTrackingFilter}
        />
      ),
    },
  ];
}
