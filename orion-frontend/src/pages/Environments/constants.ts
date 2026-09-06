/**
 * constants.ts - 环境管理常量
 * 抽取自 Environments/index.tsx (P2-9 Phase 82)
 */
import type { EnvironmentType, EnvironmentStatus } from '@/api/environments';

export const typeColorMap: Record<EnvironmentType, string> = {
  dev: 'blue',
  development: 'blue',
  staging: 'orange',
  'pre-prod': 'gold',
  prod: 'red',
  production: 'red',
  testing: 'purple',
};

export const typeLabelMap: Record<EnvironmentType, string> = {
  dev: '开发',
  development: '开发',
  staging: '预发',
  'pre-prod': '预生产',
  prod: '生产',
  production: '生产',
  testing: '测试',
};

export const statusColorMap: Record<EnvironmentStatus, string> = {
  active: 'green',
  inactive: 'default',
  maintenance: 'orange',
  deprecated: 'red',
};

export const statusLabelMap: Record<EnvironmentStatus, string> = {
  active: '运行中',
  inactive: '已停用',
  maintenance: '维护中',
  deprecated: '已废弃',
};

export const environmentTypeOptions = [
  { label: '开发 (dev)', value: 'dev' },
  { label: '测试 (testing)', value: 'testing' },
  { label: '预发 (staging)', value: 'staging' },
  { label: '预生产 (pre-prod)', value: 'pre-prod' },
  { label: '生产 (prod)', value: 'prod' },
];
