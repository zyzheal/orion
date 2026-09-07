/**
 * MetricsDashboard helpers
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import { colors } from '@/tokens';
import type { ServiceHealthRow } from './types';

export const getStatusColor = (status: ServiceHealthRow['status']): string => {
  switch (status) {
    case 'healthy':
      return colors.success[500];
    case 'degraded':
      return colors.warning[500];
    case 'unhealthy':
      return colors.error[500];
  }
};

export const getStatusLabel = (status: ServiceHealthRow['status']): string => {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'unhealthy':
      return 'Unhealthy';
  }
};

export const generateSparkline = (
  base: number,
  variance: number,
  points = 12
): number[] =>
  Array.from({ length: points }, (_, i) =>
    Math.round(base * (1 + Math.sin(i * 0.6) * variance + (Math.random() - 0.5) * variance))
  );
