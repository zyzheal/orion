/**
 * EnvironmentPage Constants
 * 环境类型/状态颜色标签映射 + 环境模板预设（抽取自 EnvironmentPage.tsx）
 */

export const typeColorMap: Record<string, string> = {
  dev: 'blue',
  development: 'blue',
  staging: 'orange',
  'pre-prod': 'gold',
  prod: 'red',
  production: 'red',
  testing: 'purple',
};

export const typeLabelMap: Record<string, string> = {
  dev: '开发',
  development: '开发',
  staging: '预发',
  'pre-prod': '预生产',
  prod: '生产',
  production: '生产',
  testing: '测试',
};

export const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  maintenance: 'orange',
  deprecated: 'red',
};

export const statusLabelMap: Record<string, string> = {
  active: '运行中',
  inactive: '已停用',
  maintenance: '维护中',
  deprecated: '已废弃',
};

export const envTypeOptions = [
  { label: '开发 (dev)', value: 'dev' },
  { label: '测试 (testing)', value: 'testing' },
  { label: '预发 (staging)', value: 'staging' },
  { label: '预生产 (pre-prod)', value: 'pre-prod' },
  { label: '生产 (prod)', value: 'prod' },
];

export interface EnvTemplate {
  name: string;
  description: string;
  config: Record<string, unknown>;
}

export const envTemplates: EnvTemplate[] = [
  {
    name: '开发环境标准',
    description: '1 副本、低资源配置、自动休眠',
    config: {
      replicas: 1,
      resources: { cpu: '100m', memory: '256Mi' },
      autoSleep: true,
      sleepAfterHours: 2,
    },
  },
  {
    name: '测试环境标准',
    description: '2 副本、中等资源配置',
    config: { replicas: 2, resources: { cpu: '200m', memory: '512Mi' }, autoSleep: false },
  },
  {
    name: '预发环境标准',
    description: '3 副本、接近生产配置',
    config: { replicas: 3, resources: { cpu: '500m', memory: '1Gi' }, autoSleep: false },
  },
  {
    name: '生产环境标准',
    description: '3+ 副本、高可用配置',
    config: {
      replicas: 3,
      resources: { cpu: '1000m', memory: '2Gi' },
      autoSleep: false,
      hpa: true,
    },
  },
];
