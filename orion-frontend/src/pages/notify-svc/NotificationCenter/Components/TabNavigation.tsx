/**
 * NotificationCenter tab navigation
 * 抽取自 index.tsx (P2-9 Phase 159)
 */
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import { tabDefinitions } from '../constants';

interface TabNavigationProps {
  activeKey: string;
  onChange: (key: string) => void;
}

export const TabNavigation = ({ activeKey, onChange }: TabNavigationProps) => (
  <Tabs
    activeKey={activeKey}
    onChange={onChange}
    items={tabDefinitions.map((tab) => ({ key: tab.key, label: tab.label }))}
    style={{ marginBottom: spacing.md }}
  />
);
