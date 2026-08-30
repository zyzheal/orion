/**
 * API 路径常量集中管理
 *
 * 所有前端 API 客户端使用的路径统一在此定义，
 * 避免硬编码字符串散落在各个文件中。
 * 路径为相对路径（无 /api/v1 前缀），由 api client 自动拼接 baseURL。
 */

export const API_PATHS = {
  SCHEMA_REGISTRY: {
    BASE: 'schema-registry',
    SCHEMAS: 'schema-registry/schemas',
    SCHEMA_DETAIL: (namespace: string, name: string) =>
      `schema-registry/schemas/${namespace}/${name}`,
    EVOLVE: (namespace: string, name: string) =>
      `schema-registry/schemas/${namespace}/${name}/evolve`,
    VERSIONS: (namespace: string, name: string) =>
      `schema-registry/schemas/${namespace}/${name}/versions`,
    VERSION_DETAIL: (namespace: string, name: string, version: number) =>
      `schema-registry/schemas/${namespace}/${name}/versions/${version}`,
    COMPATIBILITY: (namespace: string, name: string) =>
      `schema-registry/schemas/${namespace}/${name}/compatibility`,
  },
  MIGRATION: {
    PLANS: 'migration/plans',
    PLAN_DETAIL: (id: string) => `migration/plans/${id}`,
    PLAN_EXECUTE: (id: string) => `migration/plans/${id}/execute`,
    PLAN_VALIDATE: (id: string) => `migration/plans/${id}/validate`,
    PLAN_ROLLBACK: (id: string) => `migration/plans/${id}/rollback`,
    PLAN_DIFF: (id: string) => `migration/plans/${id}/diff`,
    PLAN_STEPS: (id: string) => `migration/plans/${id}/steps`,
    STATS: 'migration/stats',
  },
  DATASOURCE: {
    BASE: 'data-sources',
    TYPES: 'data-sources/types',
    HEALTH: 'data-sources/health',
    DETAIL: (id: string) => `data-sources/${id}`,
    HEALTH_BY_ID: (id: string) => `data-sources/${id}/health`,
    TEST: (id: string) => `data-sources/${id}/test`,
    QUERY: (id: string) => `data-sources/${id}/query`,
    EXECUTE: (id: string) => `data-sources/${id}/execute`,
  },
  CANARY: {
    BASE: 'canary-analysis',
    RUNS: 'canary-analysis/runs',
    RUN_DETAIL: (id: string) => `canary-analysis/runs/${id}`,
    RUN_METRICS: (runId: string) => `canary-analysis/runs/${runId}/metrics`,
    RUN_ML_RESULTS: (runId: string) => `canary-analysis/runs/${runId}/ml-results`,
    CONFIGS: 'canary-analysis/configs',
    CONFIG_DETAIL: (serviceName: string, environment: string) =>
      `canary-analysis/configs/${serviceName}/${environment}`,
    CONFIG_BY_ID: (id: string) => `canary-analysis/configs/${id}`,
    FORCE_PROMOTE: 'canary-analysis/force-promote',
    FORCE_ROLLBACK: 'canary-analysis/force-rollback',
    METRICS_DISCOVER: 'canary-analysis/metrics/discover',
    MODELS_RETRAIN: 'canary-analysis/models/retrain',
  },
  COMPLIANCE: {
    BASE: 'compliance',
    POLICIES: 'compliance/policies',
    EVALUATE: 'compliance/evaluate',
    REPORT: (policyId: string) => `compliance/report/${policyId}`,
    SCORE: 'compliance/score',
    REMEDIATE: 'compliance/remediate',
    AUDIT_PLANS: 'compliance/audit/plans',
    AUDIT_EXECUTE: (auditId: string) => `compliance/audit/${auditId}/execute`,
    AUDIT_REPORT: (auditId: string) => `compliance/audit/${auditId}/report`,
    AUDIT_FINDINGS: (auditId: string) => `compliance/audit/${auditId}/findings`,
    FINDING_CLOSE: (findingId: string) => `compliance/audit/findings/${findingId}/close`,
  },
  REPORTS: {
    BASE: 'reports',
    LIST: 'reports/',
    CREATE: 'reports/',
    DETAIL: (id: string) => `reports/${id}`,
    PREVIEW: (id: string) => `reports/${id}/preview`,
    EXECUTE: (id: string) => `reports/${id}/execute`,
    SCHEDULES: (id: string) => `reports/${id}/schedules`,
    DATASOURCES: 'reports/datasources',
    DATASOURCE_DETAIL: (id: string) => `reports/datasources/${id}`,
  },
} as const;

export type ApiPaths = typeof API_PATHS;
