/**
 * Hooks Index
 */

export { useAuth } from './useAuth';
export { useWebSocket } from './useWebSocket';
export { useBiDashboard } from './useBiDashboard';
export { useChartPerformance } from './useChartPerformance';
export { useLazyLoad } from './useLazyLoad';
export { usePagination } from './usePagination';
export { usePermission } from './usePermission';
export { usePermissionActions, useMultiPermission } from './usePermissionActions';
export { useTheme } from './useTheme';
export { useSubmit } from './useSubmit';
export { useErrorBanner } from './useErrorBanner';
export { AlertBanner } from './ErrorBanner';
export type { ErrorBannerState, ErrorSeverity } from './useErrorBanner';
export type {
  UseWebSocketOptions,
  UseWebSocketReturn,
  WebSocketMessage,
  BackoffConfig,
  HeartbeatConfig,
} from './useWebSocket';
export type { BiDashboardType, BiDashboardData, UseBiDashboardResult } from './useBiDashboard';
export type { ChartPerformanceOptions, useChartPerformanceReturn } from './useChartPerformance';
export type { UseLazyLoadOptions, UseLazyLoadReturn } from './useLazyLoad';
