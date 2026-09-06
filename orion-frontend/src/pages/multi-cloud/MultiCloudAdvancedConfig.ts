/**
 * Multi-Cloud Advanced Page - Configuration Constants
 * 多云进阶管理 - 常量配置集中定义
 *
 * 从 MultiCloudAdvancedPage.tsx 拆分而来，纯配置无副作用。
 * 图标元素通过工厂函数返回，避免在 .ts 文件中出现 JSX。
 */
import React from 'react';
import {
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

/** 云账号 Provider -> Ant Design Tag 颜色映射 */
export const PROVIDER_TAG_COLOR_MAP: Record<string, string> = {
  aws: 'orange',
  azure: 'blue',
  gcp: 'red',
  alicloud: 'green',
  aliyun: 'green',
  tencent: 'cyan',
};

/** 合规检查严重程度 -> Ant Design Tag 颜色映射 */
export const SEVERITY_COLOR_MAP: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'blue',
  low: 'green',
};

/** 合规检查严重程度 -> 图标元素工厂（.ts 中避免 JSX，改为工厂函数） */
export const SEVERITY_ICON_FACTORIES: Record<string, () => React.ReactNode> = {
  critical: () =>
    React.createElement(CloseCircleOutlined, { style: { color: colors.error[500] } }),
  high: () =>
    React.createElement(ExclamationCircleOutlined, { style: { color: colors.warning[500] } }),
  medium: () =>
    React.createElement(WarningOutlined, { style: { color: colors.info[500] } }),
  low: () =>
    React.createElement(CheckCircleOutlined, { style: { color: colors.success[500] } }),
};

/** 合规检查类别 -> 中文标签 */
export const CATEGORY_LABEL_MAP: Record<string, string> = {
  security: '安全',
  cost: '成本',
  governance: '治理',
  availability: '可用性',
  'data-residency': '数据驻留',
};

/** 合规检查类别筛选下拉选项 */
export const COMPLIANCE_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'security', label: '安全' },
  { value: 'cost', label: '成本' },
  { value: 'governance', label: '治理' },
  { value: 'availability', label: '可用性' },
  { value: 'data-residency', label: '数据驻留' },
];

/** 资源调度 - 资源类型下拉选项 */
export const SCHEDULING_RESOURCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'compute', label: '计算资源' },
  { value: 'storage', label: '存储资源' },
  { value: 'database', label: '数据库' },
  { value: 'container', label: '容器服务' },
  { value: 'network', label: '网络资源' },
];

/** 资源调度 - 首选厂商下拉选项 */
export const SCHEDULING_PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
  { value: 'gcp', label: 'GCP' },
  { value: 'alicloud', label: '阿里云' },
];

/** 云账号注册 - Provider 下拉选项 */
export const ACCOUNT_PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
  { value: 'gcp', label: 'GCP' },
  { value: 'alicloud', label: '阿里云' },
  { value: 'tencent', label: '腾讯云' },
];
