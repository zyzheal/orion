/**
 * API 路径常量集中管理
 *
 * 所有前端 API 客户端使用的路径统一在此定义，
 * 避免硬编码字符串散落在各个文件中。
 */

export const API_PATHS = {
  CANARY: {
    BASE: '/api/v1/canary-analysis',
    RUNS: '/api/v1/canary-analysis/runs',
    RUN_DETAIL: (id: string) => `/api/v1/canary-analysis/runs/${id}`,
    RUN_METRICS: (runId: string) => `/api/v1/canary-analysis/runs/${runId}/metrics`,
    RUN_ML_RESULTS: (runId: string) => `/api/v1/canary-analysis/runs/${runId}/ml-results`,
    CONFIGS: '/api/v1/canary-analysis/configs',
    CONFIG_DETAIL: (serviceName: string, environment: string) =>
      `/api/v1/canary-analysis/configs/${serviceName}/${environment}`,
    CONFIG_BY_ID: (id: string) => `/api/v1/canary-analysis/configs/${id}`,
    FORCE_PROMOTE: '/api/v1/canary-analysis/force-promote',
    FORCE_ROLLBACK: '/api/v1/canary-analysis/force-rollback',
    METRICS_DISCOVER: '/api/v1/canary-analysis/metrics/discover',
    MODELS_RETRAIN: '/api/v1/canary-analysis/models/retrain',
  },
  COMPLIANCE: {
    BASE: '/api/v1/compliance',
    POLICIES: '/api/v1/compliance/policies',
    EVALUATE: '/api/v1/compliance/evaluate',
    REPORT: (policyId: string) => `/api/v1/compliance/report/${policyId}`,
    SCORE: '/api/v1/compliance/score',
    REMEDIATE: '/api/v1/compliance/remediate',
    AUDIT_PLANS: '/api/v1/compliance/audit/plans',
    AUDIT_EXECUTE: (auditId: string) => `/api/v1/compliance/audit/${auditId}/execute`,
    AUDIT_REPORT: (auditId: string) => `/api/v1/compliance/audit/${auditId}/report`,
    AUDIT_FINDINGS: (auditId: string) => `/api/v1/compliance/audit/${auditId}/findings`,
    FINDING_CLOSE: (findingId: string) =>
      `/api/v1/compliance/audit/findings/${findingId}/close`,
  },
  REPORTS: {
    BASE: '/api/v1/reports',
    LIST: '/api/v1/reports/',
    CREATE: '/api/v1/reports/',
    DETAIL: (id: string) => `/api/v1/reports/${id}`,
    PREVIEW: (id: string) => `/api/v1/reports/${id}/preview`,
    EXECUTE: (id: string) => `/api/v1/reports/${id}/execute`,
    SCHEDULES: (id: string) => `/api/v1/reports/${id}/schedules`,
    DATASOURCES: '/api/v1/reports/datasources',
    DATASOURCE_DETAIL: (id: string) => `/api/v1/reports/datasources/${id}`,
  },
} as const;

export type ApiPaths = typeof API_PATHS;
