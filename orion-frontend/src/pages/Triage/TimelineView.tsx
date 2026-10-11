import React from 'react';
import { Card, Space } from 'antd';
import type { TriageItem, TimeRange } from '../../api/triage';
import { TimelineTrack } from '../../components/triage/TimelineTrack';
import { TimeRangeSelector } from '../../components/triage/TimeRangeSelector';

interface Props {
  items: TriageItem[];
  loading: boolean;
  onAction: (item: TriageItem, action: 'acknowledge' | 'assign') => void;
}

export const TimelineView: React.FC<Props> = ({ items, loading, onAction }) => {
  const [range, setRange] = React.useState<TimeRange>('7d');

  return (
    <Card size="small" className="orion-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space>
          <span>按时间轴展示</span>
        </Space>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>
      <TimelineTrack items={items} onItemAction={onAction} />
    </Card>
  );
};

export default TimelineView;
