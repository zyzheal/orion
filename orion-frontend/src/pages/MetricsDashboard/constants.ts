/**
 * MetricsDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 128)
 */
import type { ServiceHealthRow, TimeRange } from './types';

export const SERVICE_OPTIONS = [
  { label: 'All Services', value: 'all' },
  { label: 'API Gateway', value: 'api-gateway' },
  { label: 'Platform Service', value: 'platform-service' },
  { label: 'AI Service', value: 'ai-service' },
  { label: 'Pipeline Engine', value: 'pipeline-engine' },
  { label: 'Auth Service', value: 'auth-service' },
  { label: 'Notification Service', value: 'notification-svc' },
];

export const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Last 5m', value: '5m' },
  { label: 'Last 15m', value: '15m' },
  { label: 'Last 1h', value: '1h' },
  { label: 'Last 6h', value: '6h' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
];

export const HEALTH_SCORE_MAP: Record<ServiceHealthRow['status'], number> = {
  healthy: 95,
  degraded: 60,
  unhealthy: 25,
};
