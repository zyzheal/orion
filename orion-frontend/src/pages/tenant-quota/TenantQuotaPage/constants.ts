/**
 * TenantQuotaPage constants
 * 抽取自 index.tsx (P2-9 Phase 136)
 */

export const PLAN_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  inactive: { color: 'default', label: '停用' },
};

export const QUOTA_METRICS: { value: string; label: string; planField: string }[] = [
  { value: 'api_calls_per_min', label: 'API 每分钟调用', planField: 'apiRateLimitPerMin' },
  { value: 'api_calls_per_hour', label: 'API 每小时调用', planField: 'apiRateLimitPerHour' },
  { value: 'ci_count', label: 'CI 任务数', planField: 'maxCIs' },
  { value: 'user_count', label: '用户数', planField: 'maxUsers' },
  { value: 'storage_mb', label: '存储空间(MB)', planField: 'maxStorageMB' },
  { value: 'pipeline_count', label: '流水线数', planField: 'maxPipelines' },
  { value: 'concurrent_jobs', label: '并发任务数', planField: 'maxConcurrentJobs' },
  { value: 'alerts_per_day', label: '每日告警数', planField: 'maxAlertsPerDay' },
];
