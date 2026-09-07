/**
 * Tenant List 类型定义
 * 抽取自 index.tsx (P2-9 Phase 109)
 */

export interface QuotaConfig {
  maxPipelines: number;
  maxPipelineRunsPerDay: number;
  maxConcurrentRuns: number;
  maxRunners: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxNamespaces: number;
}

export interface QuotaTemplate {
  name: string;
  label: string;
  quota: QuotaConfig;
}
