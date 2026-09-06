/**
 * Developer Portal — top-level tab item definitions.
 */
import type { ReactNode } from 'react';
import {
  FileTextOutlined,
  ExperimentOutlined,
  CodeOutlined,
  KeyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { TAB_KEYS } from './constants';
import type { TabKey } from './types';

export interface PortalTabItem {
  key: TabKey;
  label: ReactNode;
}

const TAB_LABELS: { key: TabKey; icon: ReactNode; label: string }[] = [
  { key: TAB_KEYS.DOCS, icon: <FileTextOutlined />, label: 'API 文档' },
  { key: TAB_KEYS.MOCK, icon: <ExperimentOutlined />, label: 'Mock 服务' },
  { key: TAB_KEYS.SDK, icon: <CodeOutlined />, label: 'SDK 生成' },
  { key: TAB_KEYS.SUBSCRIPTIONS, icon: <KeyOutlined />, label: '订阅管理' },
  { key: TAB_KEYS.PLAYGROUND, icon: <ThunderboltOutlined />, label: '在线调试' },
];

export const tabItems: PortalTabItem[] = TAB_LABELS.map(({ key, icon, label }) => ({
  key,
  label: (
    <span>
      {icon} {label}
    </span>
  ),
}));
