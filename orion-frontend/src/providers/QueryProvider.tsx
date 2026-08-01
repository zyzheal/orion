// =============================================================================
// QueryProvider — @tanstack/react-query v5 统一数据获取层
//
// 已安装 @tanstack/react-query，本文件提供 QueryClient + QueryClientProvider
// 供全局使用。所有页面应通过 useQuery/useMutation 替代 useEffect + fetch 模式。
// =============================================================================

import React from 'react';
import { QueryClient, QueryClientProvider as TanStackProvider } from '@tanstack/react-query';
import type { QueryClientConfig } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// QueryClient 配置
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,             // 30s 内不重新请求（减少重复调用）
      gcTime: 5 * 60 * 1000,         // 5 分钟后缓存回收
      retry: 2,                       // 失败重试 2 次
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 10_000), // 指数退避，上限 10s
      refetchOnWindowFocus: true,    // 窗口获得焦点时刷新
      refetchOnReconnect: true,      // 网络重连时刷新
      throwOnError: false,           // 不抛出异常，由组件自行处理 error
    },
    mutations: {
      retry: 1,                       // 写操作重试 1 次
    },
  },
};

let queryClientSingleton: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = new QueryClient(DEFAULT_CONFIG);
  }
  return queryClientSingleton;
}

// ---------------------------------------------------------------------------
// QueryProvider
// ---------------------------------------------------------------------------

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => getQueryClient(), []);
  return (
    <TanStackProvider client={client}>
      {children}
    </TanStackProvider>
  );
}

// ---------------------------------------------------------------------------
// 导出给业务层使用的 hooks
// ---------------------------------------------------------------------------

export {
  useQuery,
  useQueries,
  useInfiniteQuery,
  useMutation,
  useIsFetching,
  useIsMutating,
  useQueryClient,
  useQueryErrorResetBoundary,
  QueryErrorResetBoundary,
} from '@tanstack/react-query';
