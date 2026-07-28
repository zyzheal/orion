// =============================================================================
// usePagination — 统一分页 Hook
//
// 封装分页逻辑，自动处理：
// 1. page/pageSize 参数传递
// 2. 总条数更新
// 3. 页码变化时自动重新请求
// 4. 支持搜索/筛选条件联动
//
// 使用示例：
//   const { data, total, loading, page, pageSize, setPage, setPageSize, refresh } =
//     usePagination((p, ps) => getPipelines({ page: p, pageSize: ps, ...filters }), { pageSize: 20 })
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface PaginationOptions {
  /** 初始页码，默认 1 */
  defaultPage?: number;
  /** 每页条数，默认 20 */
  pageSize?: number;
  /** 是否自动请求，默认 true */
  enabled?: boolean;
  /** 依赖项变化时重置到第一页 */
  deps?: unknown[];
}

interface PaginationResult<T> {
  /** 当前页数据 */
  data: T[];
  /** 总条数 */
  total: number;
  /** 加载中 */
  loading: boolean;
  /** 错误 */
  error: Error | null;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 设置页码 */
  setPage: (page: number) => void;
  /** 设置每页条数 */
  setPageSize: (pageSize: number) => void;
  /** 手动刷新（保持当前页码） */
  refresh: () => void;
  /** 重置到第一页并刷新 */
  reset: () => void;
}

type Fetcher<T> = (
  page: number,
  pageSize: number
) => Promise<{ data: T[]; total: number }>;

/**
 * 统一分页 Hook
 *
 * @param fetcher 接收 (page, pageSize) 返回 Promise<{ data, total }> 的函数
 * @param options 配置项
 */
export function usePagination<T>(
  fetcher: Fetcher<T>,
  options?: PaginationOptions
): PaginationResult<T> {
  const { defaultPage = 1, pageSize: defaultPageSize = 20, enabled = true, deps = [] } = options || {};

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPageState] = useState(defaultPage);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (p: number, ps: number) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current(p, ps);
      // 检查是否被取消
      if (abortRef.current?.signal.aborted) return;
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setData([]);
      setTotal(0);
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // 页码/每页条数变化时重新请求
  useEffect(() => {
    if (!enabled) return;
    execute(page, pageSize);
    return () => {
      abortRef.current?.abort();
    };
  }, [page, pageSize, enabled, ...deps]);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage));
  }, []);

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(Math.max(1, Math.min(100, newPageSize)));
    setPageState(1); // 切换每页条数时重置到第一页
  }, []);

  const refresh = useCallback(() => {
    execute(page, pageSize);
  }, [page, pageSize, execute]);

  const reset = useCallback(() => {
    setPageState(defaultPage);
    setPageSizeState(defaultPageSize);
  }, [defaultPage, defaultPageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data,
    total,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    refresh,
    reset,
  };
}
