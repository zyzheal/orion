/**
 * Task Timeouts Management Page
 *
 * 拆分自 index.tsx (P2-9 Phase 200)
 * - useTaskTimeoutsState.ts: state + queries + handlers
 * - columns.tsx: 表格列定义
 * - constants.tsx: 动作标签 + 说明
 * - Components/PageHeader.tsx: 页面标题
 * - Components/StatsRow.tsx: 4 张统计卡片
 * - Components/InfoBanner.tsx: 动作说明
 * - Components/TaskTable.tsx: 超时任务列表
 */
import { useMemo } from 'react';
import { useTaskTimeoutsState } from './useTaskTimeoutsState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { InfoBanner } from './Components/InfoBanner';
import { TaskTable } from './Components/TaskTable';

const TaskTimeoutsPage = () => {
  const {
    timedOutTasks,
    loading,
    status,
    checking,
    handleCheckNow,
    handleRefresh,
  } = useTaskTimeoutsState();

  const columns = useMemo(() => buildColumns(), []);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader />

      <StatsRow
        timedOutCount={timedOutTasks.length}
        status={status}
        checking={checking}
        onCheckNow={handleCheckNow}
      />

      <InfoBanner />

      <TaskTable
        timedOutTasks={timedOutTasks}
        loading={loading}
        columns={columns}
        onRefresh={handleRefresh}
      />
    </div>
  );
};

export default TaskTimeoutsPage;
