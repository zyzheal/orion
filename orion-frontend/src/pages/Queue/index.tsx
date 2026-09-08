/**
 * Queue Management Page
 * Queue job monitoring, enqueue/dequeue operations, and statistics
 *
 * 重构自 P2-9 Phase 87 (654 → ~180 lines):
 *  - constants.tsx - 状态色/标签/图标映射
 *  - useQueueState.ts - 状态与业务逻辑 Hook
 *  - columns.tsx - 任务表格列定义
 *  - Modals/EnqueueModal.tsx - 入队弹窗
 *  - Modals/DequeueModal.tsx - 出队弹窗
 *  - Components/DetailDrawer.tsx - 详情抽屉
 *  - Components/QueueStatsPanel.tsx - 队列统计卡
 *  - Components/QueueFilterBar.tsx - 队列筛选栏
 *  - index.tsx: 组合层
 *
 * P2-9 Phase 273 拆分:
 *  - Components/PageHeader.tsx — 标题栏 + 刷新/入队/出队按钮
 *  - Components/ModalsAndDrawer.tsx — 2 Modals + 1 Drawer 汇总
 */
import React from 'react';
import { Card, Table } from 'antd';
import { spacing } from '@/tokens';
import { useQueueState } from './useQueueState';
import { makeQueueJobColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { QueueStatsPanel } from './Components/QueueStatsPanel';
import { QueueFilterBar } from './Components/QueueFilterBar';
import { ModalsAndDrawer } from './Components/ModalsAndDrawer';

const QueueManagement: React.FC = () => {
  const state = useQueueState();

  const columns = makeQueueJobColumns(state.openDetail, state.handleComplete, state.handleFail);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={state.loading}
        onRefresh={() => {
          state.loadData();
          state.loadStats();
        }}
        onEnqueue={state.openEnqueue}
        onDequeue={state.openDequeue}
      />

      <QueueStatsPanel stats={state.stats} />

      <QueueFilterBar
        statusFilter={state.statusFilter}
        setStatusFilter={state.setStatusFilter}
        queueFilter={state.queueFilter}
        setQueueFilter={state.setQueueFilter}
        queueNames={state.queueNames}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={state.jobs}
          loading={state.loading}
          rowKey="id"
          size="middle"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个任务`,
          }}
        />
      </Card>

      <ModalsAndDrawer state={state} />
    </div>
  );
};

export default QueueManagement;
