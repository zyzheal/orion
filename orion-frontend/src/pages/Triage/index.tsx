/**
 * Triage 页面（盯盘）
 *
 * 三视图切换：Overview / Queue / Timeline
 *
 * 参见: frontend-triage-implementation-spec-2026-10-11.md §3
 */
import React, { useCallback, useState } from 'react';
import { message } from 'antd';
import { ViewSwitcher, type TriageView } from '../../components/triage/ViewSwitcher';
import { useTriageData, useTriageActions, useHotkeys } from '../../hooks/useTriage';
import { OverviewView } from './OverviewView';
import { QueueView } from './QueueView';
import { TimelineView } from './TimelineView';
import type { TriageItem } from '../../api/triage';

export const TriagePage: React.FC = () => {
  const [view, setView] = useState<TriageView>('overview');

  const {
    overview,
    overviewLoading,
    overviewError,
    refreshOverview,
    items,
    loading,
    page,
    pageSize,
    total,
    hasMore,
    fetchPage,
  } = useTriageData({
    includeActivity: true,
    limitActivity: 20,
    refreshInterval: 60_000, // 每 60s 自动刷新
  });

  const onAction = useCallback(
    (item: TriageItem, action: 'acknowledge' | 'assign') => {
      // TODO: 打开模态对话框确认/分配（简化处理）
      if (action === 'acknowledge') {
        message.info(`确认: ${item.title}`);
      } else {
        message.info(`分配: ${item.title}`);
      }
    },
    [],
  );

  const actions = useTriageActions(refreshOverview);

  // 快捷键
  useHotkeys([
    { key: '1', handler: () => setView('overview') },
    { key: '2', handler: () => setView('queue') },
    { key: '3', handler: () => setView('timeline') },
    { key: 'r', handler: () => refreshOverview() },
    { key: 'Escape', handler: () => {/* clear selection */} },
  ]);

  const onBatchAcknowledge = useCallback(
    (selectedItems: TriageItem[]) => {
      // 逐条确认（后端支持批量）
      selectedItems.forEach((it) => actions.acknowledge(it.id, it.type as 'alert' | 'ticket'));
    },
    [actions],
  );

  const onBatchAssign = useCallback(
    (selectedItems: TriageItem[]) => {
      // 简化：只提示
      message.info(`批量分配 ${selectedItems.length} 项`);
    },
    [],
  );

  return (
    <div role="main" aria-label="Triage 页面" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>盯盘 (Triage)</h1>
        <ViewSwitcher
          value={view}
          onChange={setView}
          shortcuts={{ overview: '1', queue: '2', timeline: '3' }}
        />
      </div>

      {view === 'overview' && (
        <OverviewView
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onRefresh={refreshOverview}
        />
      )}

      {view === 'queue' && (
        <QueueView
          items={items}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          hasMore={hasMore}
          onPageChange={fetchPage}
          onAction={onAction}
          onBatchAcknowledge={onBatchAcknowledge}
          onBatchAssign={onBatchAssign}
        />
      )}

      {view === 'timeline' && (
        <TimelineView items={items} loading={loading} onAction={onAction} />
      )}
    </div>
  );
};

export default TriagePage;
