/**
 * Dashboard Core constants
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import {
  RocketOutlined,
  CloudUploadOutlined,
  BellOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { QuickActionItem, SystemHealthItem } from './types';

export const QUICK_ACTIONS: QuickActionItem[] = [
  { name: '创建 Pipeline', icon: 'RocketOutlined', path: '/pipelines', color: colors.primary[500] },
  { name: '部署应用', icon: 'CloudUploadOutlined', path: '/deployments', color: colors.success[500] },
  { name: '查看告警', icon: 'BellOutlined', path: '/alerts', color: colors.warning[500] },
  { name: '查看日志', icon: 'FileTextOutlined', path: '/pipelines', color: colors.purple[500] },
];

export const QUICK_ACTION_ICONS: Record<string, React.ReactNode> = {
  RocketOutlined: <RocketOutlined />,
  CloudUploadOutlined: <CloudUploadOutlined />,
  BellOutlined: <BellOutlined />,
  FileTextOutlined: <FileTextOutlined />,
};

export const DEFAULT_SYSTEM_HEALTH: SystemHealthItem[] = [
  { name: 'API Gateway', status: 'success', latency: '-' },
  { name: 'Platform Service', status: 'success', latency: '-' },
  { name: 'Database', status: 'success', latency: '-' },
  { name: 'Event Bus', status: 'success', latency: '-' },
];

export const DEFAULT_ALERT_STATE_SYSTEM_HEALTH: SystemHealthItem[] = [
  { name: 'API Gateway', status: 'warning', latency: '-' },
  { name: 'Platform Service', status: 'warning', latency: '-' },
  { name: 'Database', status: 'warning', latency: '-' },
  { name: 'Event Bus', status: 'warning', latency: '-' },
];
