import React from 'react';
import { Segmented } from 'antd';
import type { TimeRange } from '../../api/triage';

interface Props {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}

const OPTIONS: Array<{ label: string; value: TimeRange }> = [
  { label: '1h', value: '1h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

export const TimeRangeSelector: React.FC<Props> = ({ value, onChange }) => (
  <Segmented
    role="tablist"
    value={value}
    options={OPTIONS}
    onChange={(v) => onChange(v as TimeRange)}
    aria-label="时间范围"
  />
);

export default TimeRangeSelector;
