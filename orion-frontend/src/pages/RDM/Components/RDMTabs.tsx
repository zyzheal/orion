/**
 * RDM tabs bar with count badges
 */
import React from 'react';
import { Badge, Tabs } from 'antd';
import type { TabKey } from '../types';

interface RDMTabsProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  counts: Record<TabKey, number>;
}

export const RDMTabs: React.FC<RDMTabsProps> = ({ activeTab, onChange, counts }) => (
  <Tabs activeKey={activeTab} onChange={(k) => onChange(k as TabKey)}>
    <Tabs.TabPane
      tab={
        <span>
          <Badge count={counts.requirements} size="small">
            需求
          </Badge>
        </span>
      }
      key="requirements"
    />
    <Tabs.TabPane
      tab={
        <span>
          <Badge count={counts.defects} size="small">
            缺陷
          </Badge>
        </span>
      }
      key="defects"
    />
    <Tabs.TabPane
      tab={
        <span>
          <Badge count={counts.sprints} size="small">
            迭代
          </Badge>
        </span>
      }
      key="sprints"
    />
    <Tabs.TabPane
      tab={
        <span>
          <Badge count={counts.tasks} size="small">
            任务
          </Badge>
        </span>
      }
      key="tasks"
    />
  </Tabs>
);
