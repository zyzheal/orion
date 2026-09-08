/**
 * AuditComplianceDashboard state hook (Phase 305)
 *
 * Loads the dashboard, risk-map and trend endpoints in parallel via a single
 * useQuery bundle call. Exposes state + setters for days and re-fetch.
 *
 * Note on error handling: the QueryProvider README documents that
 * useQuery's onError is a no-op in this repo's pinned tanstack/react-query
 * build, so we surface errors through useEffect + isError (see
 * QueryProvider.tsx for the full rationale).
 */
import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  loadComplianceDashboardBundle,
  type ComplianceDashboardOverview,
  type ComplianceRiskMatrix,
  type ComplianceScoreTrend,
} from '@/api/audit-compliance';

export interface ComplianceBundle {
  dashboard: ComplianceDashboardOverview;
  riskMap: ComplianceRiskMatrix;
  trend: ComplianceScoreTrend;
}

export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 90;
export const MIN_DAYS = 1;

export const DAYS_OPTIONS = [
  { label: '7 天', value: 7 },
  { label: '14 天', value: 14 },
  { label: '30 天', value: 30 },
  { label: '60 天', value: 60 },
  { label: '90 天', value: 90 },
] as const;

export const useAuditComplianceState = (initialDays = DEFAULT_DAYS) => {
  const [days, setDays] = useState<number>(initialDays);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ComplianceBundle>({
    queryKey: ['audit-compliance-bundle', days],
    queryFn: () => loadComplianceDashboardBundle(days),
    staleTime: 30_000,
  });

  // Surface load failures. QueryProvider README: onError is a no-op in this
  // repo's tanstack/react-query build, so we use isError + useEffect instead.
  useEffect(() => {
    if (isError) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`加载合规数据失败：${msg}`);
    }
  }, [isError, error]);

  const clampDays = (n: number) => {
    if (n < MIN_DAYS) return MIN_DAYS;
    if (n > MAX_DAYS) return MAX_DAYS;
    return n;
  };

  const handleDaysChange = (n: number) => {
    setDays(clampDays(n));
  };

  return {
    days,
    setDays: handleDaysChange,
    dashboard: data?.dashboard,
    riskMap: data?.riskMap,
    trend: data?.trend,
    loading: isLoading,
    error,
    refetch,
  };
};
