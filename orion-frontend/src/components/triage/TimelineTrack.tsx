import React from 'react';
import { Timeline, Tag } from 'antd';
import type { TriageItem, Severity } from '../../api/triage';

const SEVERITY_COLOR: Record<Severity, 'red' | 'orange' | 'blue'> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

interface Props {
  items: TriageItem[];
  onItemAction?: (item: TriageItem, action: 'acknowledge' | 'assign') => void;
}

export const TimelineTrack: React.FC<Props> = ({ items, onItemAction }) => {
  const sorted = [...items].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (sorted.length === 0) {
    return <div style={{ padding: 24, color: '#999' }}>暂无时间线数据</div>;
  }

  return (
    <Timeline
      aria-label="时间线"
      items={sorted.map((item) => ({
        color: SEVERITY_COLOR[item.severity] ?? 'blue',
        children: (
          <div role="button" tabIndex={0} aria-label={`${item.title} (${item.severity})`}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{item.title}</strong>
              <Tag color={SEVERITY_COLOR[item.severity]}>{item.severity}</Tag>
            </div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
              {new Date(item.created_at).toLocaleString()} · {item.type} · {item.status}
            </div>
            {item.assigned_to && (
              <div style={{ color: '#999', fontSize: 12 }}>→ {item.assigned_to}</div>
            )}
          </div>
        ),
      }))}
    />
  );
};

export default TimelineTrack;
