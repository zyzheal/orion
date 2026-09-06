/**
 * Queue Management Page
 * Queue job monitoring, enqueue/dequeue operations, and statistics
 *
 * 主入口 (P2-9 Phase 105 refactor: 已抽取 Header / StatsPanel / FilterBar / JobTable
 * EnqueueModal / DequeueModal / DetailDrawer / useQueueState)
 */
import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useQueueState } from './useQueueState';
import { Header } from './Components/Header';
import { StatsPanel } from './Components/StatsPanel';
import { FilterBar } from './Components/FilterBar';
import { JobTable } from './Components/JobTable';
import { EnqueueModal } from './Components/EnqueueModal';
import { DequeueModal } from './Components/DequeueModal';
import { DetailDrawer } from './Components/DetailDrawer';

dayjs.extend(relativeTime);

const QueueManagement: React.FC = () => {
  const state = useQueueState();

  return (
    <div style={{ padding: 0 }}>
      <Header state={state} />
      <StatsPanel stats={state.stats} />
      <FilterBar state={state} />
      <JobTable state={state} />
      <EnqueueModal state={state} />
      <DequeueModal state={state} />
      <DetailDrawer state={state} />
    </div>
  );
};

export default QueueManagement;
