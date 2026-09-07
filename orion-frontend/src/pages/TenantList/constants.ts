/**
 * Tenant List 常量
 * 抽取自 index.tsx (P2-9 Phase 109)
 */
import type { QuotaTemplate } from './types';

export const QUOTA_TEMPLATES: QuotaTemplate[] = [
  {
    name: 'startup',
    label: '初创团队',
    quota: {
      maxPipelines: 50,
      maxPipelineRunsPerDay: 500,
      maxConcurrentRuns: 5,
      maxRunners: 2,
      maxCpuCores: 8,
      maxMemoryGb: 16,
      maxStorageGb: 50,
      maxNamespaces: 5,
    },
  },
  {
    name: 'enterprise',
    label: '企业标准',
    quota: {
      maxPipelines: 100,
      maxPipelineRunsPerDay: 1000,
      maxConcurrentRuns: 10,
      maxRunners: 5,
      maxCpuCores: 16,
      maxMemoryGb: 32,
      maxStorageGb: 100,
      maxNamespaces: 10,
    },
  },
  {
    name: 'saas',
    label: 'SaaS 客户',
    quota: {
      maxPipelines: 500,
      maxPipelineRunsPerDay: 5000,
      maxConcurrentRuns: 50,
      maxRunners: 20,
      maxCpuCores: 64,
      maxMemoryGb: 128,
      maxStorageGb: 500,
      maxNamespaces: 50,
    },
  },
];

export const STATUS_COLOR_MAP: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  deleted: 'error',
};

export const STATUS_OPTIONS = [
  { label: 'active', value: 'active' },
  { label: 'inactive', value: 'inactive' },
  { label: 'deleted', value: 'deleted' },
];
