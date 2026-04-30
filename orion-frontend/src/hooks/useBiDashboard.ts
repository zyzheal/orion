/**
 * Shared hook for BI dashboard data fetching.
 *
 * All three dashboard types (executive, manager, engineer) call the same
 * backend endpoint `/v1/efficiency/dashboard` with different query parameters.
 * This hook encapsulates the fetch logic and provides a unified interface.
 *
 * Usage:
 *   const { data, loading, error } = useBiDashboard('executive');
 *   const { data, loading, error } = useBiDashboard('manager', { teamId: 't1' });
 *   const { data, loading, error } = useBiDashboard('engineer', { engineerId: 'E001' });
 */
import { useState, useEffect } from 'react';
import {
  getExecutiveDashboard,
  getManagerDashboard,
  getEngineerDashboard,
} from '@/api/bi';
import type {
  ExecutiveDashboardData,
  ManagerDashboardData,
  EngineerDashboardData,
} from '@/types/pages';

export type BiDashboardType = 'executive' | 'manager' | 'engineer';

export type BiDashboardData =
  | ExecutiveDashboardData
  | ManagerDashboardData
  | EngineerDashboardData;

export interface UseBiDashboardResult {
  data: BiDashboardData | null;
  loading: boolean;
  error: Error | null;
}

export function useBiDashboard(
  type: BiDashboardType,
  options?: {
    engineerId?: string;
    teamId?: string;
    days?: number;
  }
): UseBiDashboardResult {
  const [data, setData] = useState<BiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetcher =
      type === 'executive'
        ? () => getExecutiveDashboard({ days: options?.days })
        : type === 'manager'
          ? () => getManagerDashboard({ teamId: options?.teamId, days: options?.days })
          : () =>
              getEngineerDashboard(
                options?.engineerId ?? 'current',
                { days: options?.days }
              );

    fetcher()
      .then((res) => {
        if (!cancelled) {
          setData(res.data.data as BiDashboardData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [type, options?.engineerId, options?.teamId, options?.days]);

  return { data, loading, error };
}
