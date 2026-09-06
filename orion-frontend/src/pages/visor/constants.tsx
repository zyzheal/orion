/**
 * constants.ts - Visor (运维可视化) 常量
 * 抽取自 VisorPage.tsx (P2-9 Phase 94)
 */
import type { Host, ScriptExecution } from '@/api/visor';
import {
  DashboardOutlined,
  DesktopOutlined,
  HddOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';

export const hostStatusLabelMap: Record<Host['status'], string> = {
  online: '在线',
  offline: '离线',
  error: '异常',
  maintenance: '维护中',
};

export const scriptStatusColorMap: Record<ScriptExecution['status'], string> = {
  pending: 'blue',
  running: 'orange',
  success: 'green',
  failed: 'red',
  timeout: 'magenta',
};

export const scriptStatusLabelMap: Record<ScriptExecution['status'], string> = {
  pending: '等待中',
  running: '执行中',
  success: '成功',
  failed: '失败',
  timeout: '超时',
};

export const resourceTypeIconMap: Record<string, JSX.Element> = {
  cpu: <DashboardOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
  memory: <DesktopOutlined style={{ fontSize: 24, color: colors.purple[500] }} />,
  disk: <HddOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
  network: <GlobalOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
};

export const resourceTypeLabelMap: Record<string, string> = {
  cpu: 'CPU使用率',
  memory: '内存使用率',
  disk: '磁盘使用率',
  network: '网络流量',
};

export const OS_OPTIONS = [
  { label: 'Linux', value: 'linux' },
  { label: 'Windows', value: 'windows' },
  { label: 'macOS', value: 'macos' },
];

export const RESOURCE_TYPE_OPTIONS = [
  { label: '全部类型', value: 'all' },
  { label: 'CPU', value: 'cpu' },
  { label: '内存', value: 'memory' },
  { label: '磁盘', value: 'disk' },
  { label: '网络', value: 'network' },
];
