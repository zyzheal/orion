/**
 * useErrorBanner — 页面级持久化错误钩子
 *
 * 参考 Google Error Alert Banner / AWS Error Banner 模式：
 * - 错误显示在页面级（不闪现）
 * - 带"重试"和"关闭"操作
 *
 * @example
 *   import { AlertBanner } from '@/hooks/ErrorBanner';
 *   const { error, setError, clearError } = useErrorBanner();
 *   return (
 *     <>
 *       <AlertBanner state={error} onClose={clearError} />
 *       <Spin spinning={loading}>
 *         {error ? null : <Content />}
 *       </Spin>
 *     </>
 *   );
 */
import { useCallback, useState } from 'react';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorBannerState {
  message: string;
  severity?: ErrorSeverity;
  actionLabel?: string;
  onRetry?: () => void;
}

export interface UseErrorBannerReturn {
  error: ErrorBannerState | null;
  setError: (state: ErrorBannerState | null) => void;
  clearError: () => void;
  hasError: boolean;
}

export function useErrorBanner(): UseErrorBannerReturn {
  const [error, setError] = useState<ErrorBannerState | null>(null);

  const clearError = useCallback(() => setError(null), []);

  return {
    error,
    setError,
    clearError,
    hasError: error !== null,
  };
}

export default useErrorBanner;
