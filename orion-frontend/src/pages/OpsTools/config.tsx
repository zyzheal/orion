/**
 * 运维管理工具 - 配置常量
 *
 * 包含状态色映射、Tab 配置等静态配置项。
 */
import type { TabsProps } from 'antd';
import {
  ClusterOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileSyncOutlined,
  FileTextOutlined,
  ToolOutlined,
  AuditOutlined,
  ConsoleSqlOutlined,
  SettingOutlined,
} from '@ant-design/icons';

// ==================== 状态色映射 ====================

export const STATUS_COLORS: Record<string, string> = {
  online: 'success',
  idle: 'default',
  running: 'processing',
  error: 'error',
  offline: 'default',
  upgrading: 'processing',
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
  active: 'success',
  unused: 'warning',
  redundant: 'error',
  success: 'success',
  pending: 'processing',
  completed: 'success',
  failed: 'error',
  uploaded: 'default',
  distributing: 'processing',
  distributed: 'success',
  normal: 'success',
  busy: 'warning',
  saturated: 'error',
  grace: 'warning',
  expired: 'error',
};

// ==================== Tab 配置 ====================

export const tabConfig: NonNullable<TabsProps['items']> = [
  {
    key: 'cron',
    label: (
      <span>
        <ClockCircleOutlined /> 定时调度
      </span>
    ),
  },
  {
    key: 'db',
    label: (
      <span>
        <DatabaseOutlined /> 数据库工具
      </span>
    ),
  },
  {
    key: 'mq',
    label: (
      <span>
        <ClusterOutlined /> MQ监控
      </span>
    ),
  },
  {
    key: 'tagent',
    label: (
      <span>
        <ToolOutlined /> Tagent管理
      </span>
    ),
  },
  {
    key: 'batch',
    label: (
      <span>
        <ConsoleSqlOutlined /> 批量操作
      </span>
    ),
  },
  {
    key: 'file',
    label: (
      <span>
        <FileTextOutlined /> 文件管理
      </span>
    ),
  },
  {
    key: 'config',
    label: (
      <span>
        <SettingOutlined /> 系统配置
      </span>
    ),
  },
  {
    key: 'audit',
    label: (
      <span>
        <AuditOutlined /> 审计
      </span>
    ),
  },
  {
    key: 'logs',
    label: (
      <span>
        <FileSyncOutlined /> 日志
      </span>
    ),
  },
];

// ==================== 日志级别选项 ====================

export const LOG_LEVEL_OPTIONS = [
  { label: 'ERROR', value: 'ERROR' },
  { label: 'WARN', value: 'WARN' },
  { label: 'INFO', value: 'INFO' },
  { label: 'DEBUG', value: 'DEBUG' },
] as const;

// ==================== 日志服务选项 ====================

export const LOG_SERVICE_OPTIONS = [
  { label: 'orion-platform', value: 'orion-platform' },
  { label: 'orion-deploy', value: 'orion-deploy' },
  { label: 'orion-ai', value: 'orion-ai' },
  { label: 'orion-monitor', value: 'orion-monitor' },
  { label: 'orion-auth', value: 'orion-auth' },
] as const;

// ==================== 主题模式选项 ====================

export const THEME_MODE_OPTIONS = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
] as const;

// ==================== 默认升级版本 ====================

export const DEFAULT_TAGENT_UPGRADE_VERSION = '2.5.2';
