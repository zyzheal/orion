import React from 'react';
import { Collapse } from 'antd';
import type { TriageItem, AssignedScope } from '../../api/triage';
import { TriageItemRow } from './TriageItemRow';

const SCOPE_LABELS: Record<AssignedScope, string> = {
  mine: '我的',
  team: '团队',
  assigned: '已分配',
  unassigned: '未分配',
};

interface Props {
  items: TriageItem[];
  groupBy?: 'assigned_scope' | 'severity' | 'status';
  onAction?: (item: TriageItem, action: 'acknowledge' | 'assign') => void;
}

export const GroupedListRenderer: React.FC<Props> = ({ items, groupBy = 'assigned_scope', onAction }) => {
  const groups: Record<string, TriageItem[]> = {};
  for (const it of items) {
    const key = (it as any)[groupBy];
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  }

  const itemsForCollapse = Object.entries(groups).map(([key, list]) => ({
    key,
    label: (
      <span aria-label={`${SCOPE_LABELS[key as AssignedScope] ?? key} (${list.length} 项)`}>
        {SCOPE_LABELS[key as AssignedScope] ?? key} ({list.length})
      </span>
    ),
    children: (
      <>
        {list.map((item) => (
          <TriageItemRow key={item.id} item={item} onAction={onAction} />
        ))}
      </>
    ),
  }));

  return <Collapse defaultActiveKey={Object.keys(groups)} items={itemsForCollapse} aria-label="分组列表" />;
};

export default GroupedListRenderer;
