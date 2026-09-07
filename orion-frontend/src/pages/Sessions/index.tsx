/**
 * Session Management Page
 * 用户会话监控与管理 (查看、撤销、过滤)
 *
 * P2-9 Phase 130 重构: 490 → 47行 (-90.4%)
 * 拆分: types.ts + helpers.ts + constants.tsx + useSessionState.tsx
 *       + sessionColumns.tsx + 5 Components
 */
import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSessionState } from './useSessionState';
import { SessionHeader } from './Components/SessionHeader';
import { StatsCards } from './Components/StatsCards';
import { Filters } from './Components/Filters';
import { SessionsTable } from './Components/SessionsTable';
import { DetailDrawer } from './Components/DetailDrawer';

dayjs.extend(relativeTime);

const SessionManagement: React.FC = () => {
  const state = useSessionState();

  return (
    <div style={{ padding: 0 }}>
      <SessionHeader loading={state.loading} loadData={state.loadData} />
      <StatsCards stats={state.stats} />
      <Filters
        searchQuery={state.searchQuery}
        setSearchQuery={state.setSearchQuery}
        statusFilter={state.statusFilter}
        setStatusFilter={state.setStatusFilter}
      />
      <SessionsTable
        filteredSessions={state.filteredSessions}
        loading={state.loading}
        openDetail={state.openDetail}
        handleRevoke={state.handleRevoke}
      />
      <DetailDrawer
        open={state.detailDrawerVisible}
        onClose={() => state.setDetailDrawerVisible(false)}
        selectedSession={state.selectedSession}
        handleRevoke={state.handleRevoke}
      />
    </div>
  );
};

export default SessionManagement;
