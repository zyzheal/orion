/**
 * 多云管理页面 - 配置常量
 *
 * 从 MultiCloudPage.tsx 中提取的纯数据常量：
 * - 云厂商 / 账号状态的颜色与标签映射
 * - 资源类型 / 资源状态的颜色与状态映射
 * - 云厂商下拉选项
 *
 * 注意：本文件不包含 antd 组件与 message 调用；
 * 因含 JSX 图标映射，故使用 .tsx 扩展名。
 */
import type { ReactNode } from 'react';
import {
  CloudServerOutlined,
  HddOutlined,
  DatabaseOutlined,
  ApiOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

// ============================================================================
// 云厂商 / 账号状态映射
// ============================================================================

export const providerTypeColor: Record<string, string> = {
  aws: 'orange',
  azure: 'blue',
  gcp: 'red',
  alicloud: 'green',
  aliyun: 'green',
  tencent: 'cyan',
};

export const providerLabelMap: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'Google Cloud',
  alicloud: '阿里云',
  aliyun: '阿里云',
  tencent: '腾讯云',
  private: '私有云',
};

export const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  error: 'red',
};

export const statusLabelMap: Record<string, string> = {
  active: '已连接',
  inactive: '未激活',
  error: '错误',
};

export const providerIconColors: Record<string, string> = {
  aws: colors.cloud.aws,
  azure: colors.cloud.azure,
  gcp: colors.cloud.gcp,
  alicloud: colors.cloud.alicloud,
  aliyun: colors.cloud.alicloud,
  tencent: colors.cloud.tencent,
};

// ============================================================================
// 云厂商下拉选项 (注册 / 编辑云账号表单共用)
// ============================================================================

export interface ProviderOption {
  value: string;
  label: string;
}

export const providerOptions: ProviderOption[] = [
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
  { value: 'gcp', label: 'Google Cloud' },
  { value: 'alicloud', label: '阿里云' },
  { value: 'tencent', label: '腾讯云' },
];

// ============================================================================
// 资源类型 / 资源状态映射
// ============================================================================

/** 资源类型 → Tag 颜色 */
export const resourceTypeColors: Record<string, string> = {
  compute: 'blue',
  storage: 'green',
  database: 'purple',
  network: 'orange',
  container: 'cyan',
};

/** 资源类型 → 设计 Token 颜色 (资源类型分布卡片) */
export const resourceTypeTokenColors: Record<string, string> = {
  compute: colors.primary[500],
  storage: colors.success[500],
  database: colors.purple[500],
  network: colors.warning[500],
  container: colors.info[500],
};

/** 资源类型 → 图标 (资源类型分布卡片) */
export const resourceTypeIcons: Record<string, ReactNode> = {
  compute: <CloudServerOutlined />,
  storage: <HddOutlined />,
  database: <DatabaseOutlined />,
  network: <ApiOutlined />,
  container: <CloudOutlined />,
};

/** 资源状态 → Badge 状态 */
export const resourceStateBadgeMap: Record<string, 'success' | 'error' | 'warning'> = {
  running: 'success',
  active: 'success',
  stopped: 'error',
  error: 'error',
  pending: 'warning',
};
