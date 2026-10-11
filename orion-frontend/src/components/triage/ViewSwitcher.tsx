import React from 'react';
import { Segmented } from 'antd';

export type TriageView = 'overview' | 'queue' | 'timeline';

interface Props {
  value: TriageView;
  onChange: (v: TriageView) => void;
  shortcuts?: Partial<Record<TriageView, string>>;
}

export const ViewSwitcher: React.FC<Props> = ({ value, onChange, shortcuts }) => {
  const options: Array<{ label: React.ReactNode; value: TriageView }> = [
    {
      label: (
        <span aria-keyshortcuts={shortcuts?.overview}>
          总览{shortcuts?.overview ? ` (${shortcuts.overview})` : ''}
        </span>
      ),
      value: 'overview',
    },
    {
      label: (
        <span aria-keyshortcuts={shortcuts?.queue}>
          队列{shortcuts?.queue ? ` (${shortcuts.queue})` : ''}
        </span>
      ),
      value: 'queue',
    },
    {
      label: (
        <span aria-keyshortcuts={shortcuts?.timeline}>
          时间线{shortcuts?.timeline ? ` (${shortcuts.timeline})` : ''}
        </span>
      ),
      value: 'timeline',
    },
  ];

  return (
    <Segmented
      role="tablist"
      value={value}
      options={options}
      onChange={(v) => onChange(v as TriageView)}
      aria-label="Triage 视图切换"
    />
  );
};

export default ViewSwitcher;
