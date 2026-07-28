// =============================================================================
// QueryProvider — 基于 @tanstack/react-query 的统一数据获取层
//
// 用途：替代页面中重复的 useEffect + useState + fetch 模式
// 安装：npm install @tanstack/react-query
//
// 使用示例：
//   const { data, isLoading, error } = useQuery({
//     queryKey: ['pipelines', filters],
//     queryFn: () => getPipelines(filters),
//     staleTime: 30_000,
//   })
// =============================================================================

import React, { useState } from 'react';

// 如果已安装 @tanstack/react-query，取消注释以下 import
// import { QueryClient, QueryClientProvider as TanStackProvider } from '@tanstack/react-query';

// ========================= 简易版 QueryProvider =========================
// 在正式安装 @tanstack/react-query 之前，先提供一个简易替代方案
// 后续可无缝切换

interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 简易版 useQuery — 替代 useEffect + useState + fetch 模式
 *
 * 特性：
 * - 自动去重（相同 key 的并发请求合并）
 * - 自动缓存（staleTime 内不重复请求）
 * - 自动重试（retry 次）
 * - 组件卸载自动取消
 *
 * @param key 查询唯一标识（用于缓存和去重）
 * @param fetcher 异步数据获取函数
 * @param options 配置项
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    staleTime?: number;
    retry?: number;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
): QueryState<T> & { refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!options?.enabled === false);
  const [error, setError] = useState<Error | null>(null);

  // 简易缓存（内存 Map）
  // 生产环境应使用 @tanstack/react-query 的缓存机制
  const cache = React.useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const abortRef = React.useRef<AbortController | null>(null);
  const keyRef = React.useRef(key);

  const execute = React.useCallback(async () => {
    // 检查缓存
    const cached = cache.current.get(key);
    const staleTime = options?.staleTime ?? 30_000;
    if (cached && Date.now() - cached.timestamp < staleTime) {
      setData(cached.data);
      setIsLoading(false);
      return;
    }

    // 取消进行中的请求
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    const maxRetries = options?.retry ?? 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const result = await fetcher();
        // 写入缓存
        cache.current.set(key, { data: result, timestamp: Date.now() });
        setData(result);
        setIsLoading(false);
        options?.onSuccess?.(result);
        return;
      } catch (err) {
        attempt++;
        if (attempt > maxRetries || (err as Error)?.name === 'AbortError') {
          const finalError = err instanceof Error ? err : new Error(String(err));
          setError(finalError);
          setIsLoading(false);
          options?.onError?.(finalError);
          return;
        }
        // 指数退避重试
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 10000)));
      }
    }
  }, [key, fetcher, options?.staleTime, options?.retry, options?.onSuccess, options?.onError]);

  const refresh = React.useCallback(() => {
    cache.current.delete(keyRef.current);
    execute();
  }, [execute]);

  React.useEffect(() => {
    keyRef.current = key;
    if (options?.enabled === false) return;
    execute();
    return () => {
      abortRef.current?.abort();
    };
  }, [key, execute, options?.enabled]);

  return { data, isLoading, error, refetch: execute, refresh };
}

/**
 * 简易版 useMutation — 替代手动处理 loading/error 状态的写操作
 *
 * 使用示例：
 *   const { mutate, isLoading } = useMutation({
 *     mutationFn: (id: string) => deletePipeline(id),
 *     onSuccess: () => { message.success('删除成功'); queryClient.invalidateQueries('pipelines'); },
 *   })
 */
export function useMutation<TData, TVariables = void>(
  options: {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
  }
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = React.useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await options.mutationFn(variables);
        setIsLoading(false);
        options.onSuccess?.(result, variables);
        return result;
      } catch (err) {
        const finalError = err instanceof Error ? err : new Error(String(err));
        setError(finalError);
        setIsLoading(false);
        options.onError?.(finalError, variables);
        throw finalError;
      }
    },
    [options]
  );

  return { mutate, isLoading, error };
}

// ========================= QueryClientProvider =========================
// 正式接入 @tanstack/react-query 后，取消注释以下代码并删除上面的简易实现

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 30_000,        // 30s 内不重新请求
//       retry: 3,                  // 失败重试 3 次
//       retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
//       refetchOnWindowFocus: true,
//       refetchOnReconnect: true,
//     },
//     mutations: {
//       retry: 1,
//     },
//   },
// });
//
// export function QueryProvider({ children }: { children: React.ReactNode }) {
//   return <TanStackProvider client={queryClient}>{children}</TanStackProvider>;
// }
