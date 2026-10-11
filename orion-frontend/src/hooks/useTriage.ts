/**
 * Triage Hooks
 *
 * 4 Hooks（参见 frontend-triage-implementation-spec §3）：
 *   - useTriageData: 拉取总览 + 分页子集数据
 *   - useTriageActions: 确认 / 分配 / 交接操作
 *   - useTriageFilters: 过滤状态管理
 *   - useHotkeys: 全局快捷键
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type MyOverview,
  type TriageItem,
  type TriageFilter,
  getOverview,
  listAlerts,
  acknowledge,
  assign,
  handoff,
} from '../api/triage';

// ==================== useTriageData ====================

export interface UseTriageDataOptions {
  includeActivity?: boolean;
  limitActivity?: number;
  /** 自动刷新间隔（毫秒），0 表示不自动刷新 */
  refreshInterval?: number;
}

export interface UseTriageDataReturn {
  overview: MyOverview | null;
  overviewLoading: boolean;
  overviewError: string | null;
  refreshOverview: () => Promise<void>;

  items: TriageItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  fetchPage: (p?: number) => Promise<void>;
  loadNext: () => Promise<void>;
}

export function useTriageData(opts: UseTriageDataOptions = {}): UseTriageDataReturn {
  const [overview, setOverview] = useState<MyOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [items, setItems] = useState<TriageItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(opts.limitActivity ?? 20);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await getOverview(opts.includeActivity ?? true, opts.limitActivity ?? 20);
      setOverview(data);
    } catch (e: any) {
      setOverviewError(e?.message || 'Failed to load overview');
    } finally {
      setOverviewLoading(false);
    }
  }, [opts.includeActivity, opts.limitActivity]);

  const fetchPage = useCallback(async (p?: number) => {
    const targetPage = p ?? page;
    setLoading(true);
    setError(null);
    try {
      // 这里默认拉 alerts，可扩展；实际视图切换在调用侧决定
      const res = await listAlerts({}, targetPage, pageSize);
      setItems(res.data);
      setPage(res.page);
      setTotal(res.total);
      setHasMore(res.has_more);
    } catch (e: any) {
      setError(e?.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadNext = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchPage(page + 1);
    }
  }, [hasMore, loading, page, fetchPage]);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  useEffect(() => {
    if (!opts.refreshInterval || opts.refreshInterval <= 0) return;
    const id = setInterval(() => refreshOverview(), opts.refreshInterval);
    return () => clearInterval(id);
  }, [opts.refreshInterval, refreshOverview]);

  return {
    overview,
    overviewLoading,
    overviewError,
    refreshOverview,
    items,
    page,
    pageSize,
    total,
    hasMore,
    loading,
    error,
    fetchPage,
    loadNext,
  };
}

// ==================== useTriageActions ====================

export interface UseTriageActionsReturn {
  acknowledge: (itemId: string, type: 'alert' | 'ticket') => Promise<void>;
  assign: (req: { item_id: string; type: 'alert' | 'ticket'; to_user_id: string; to_role?: string }) => Promise<void>;
  handoff: (req: {
    schedule_id: string;
    rotation_id: string;
    from_user_id: string;
    to_user_id: string;
    reason?: string;
  }) => Promise<void>;
  acting: boolean;
  error: string | null;
}

export function useTriageActions(onSuccess?: () => void): UseTriageActionsReturn {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acknowledgeAction = useCallback(
    async (itemId: string, type: 'alert' | 'ticket') => {
      setActing(true);
      setError(null);
      try {
        await acknowledge({ item_id: itemId, type });
        onSuccess?.();
      } catch (e: any) {
        setError(e?.message || 'Failed to acknowledge');
        throw e;
      } finally {
        setActing(false);
      }
    },
    [onSuccess],
  );

  const assignAction = useCallback(
    async (req: { item_id: string; type: 'alert' | 'ticket'; to_user_id: string; to_role?: string }) => {
      setActing(true);
      setError(null);
      try {
        await assign(req);
        onSuccess?.();
      } catch (e: any) {
        setError(e?.message || 'Failed to assign');
        throw e;
      } finally {
        setActing(false);
      }
    },
    [onSuccess],
  );

  const handoffAction = useCallback(
    async (req: {
      schedule_id: string;
      rotation_id: string;
      from_user_id: string;
      to_user_id: string;
      reason?: string;
    }) => {
      setActing(true);
      setError(null);
      try {
        await handoff(req);
        onSuccess?.();
      } catch (e: any) {
        setError(e?.message || 'Failed to handoff');
        throw e;
      } finally {
        setActing(false);
      }
    },
    [onSuccess],
  );

  return {
    acknowledge: acknowledgeAction,
    assign: assignAction,
    handoff: handoffAction,
    acting,
    error,
  };
}

// ==================== useTriageFilters ====================

export interface UseTriageFiltersReturn {
  filter: TriageFilter;
  setFilter: (f: TriageFilter) => void;
  reset: () => void;
  hasActiveFilter: boolean;
}

export function useTriageFilters(initial: TriageFilter = {}): UseTriageFiltersReturn {
  const [filter, setFilter] = useState<TriageFilter>(initial);
  const hasActiveFilter = useMemo(
    () => Object.keys(filter).some((k) => filter[k as keyof TriageFilter] !== undefined),
    [filter],
  );

  return {
    filter,
    setFilter,
    reset: () => setFilter({}),
    hasActiveFilter,
  };
}

// ==================== useHotkeys ====================

export interface HotkeyBinding {
  /** 组合键，如 'k', 'cmd+k', 'ctrl+/', 'escape' */
  key: string;
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;
}

export function useHotkeys(bindings: HotkeyBinding[]) {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 输入框、文本域、可编辑元素不响应全局快捷键
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        // Escape 仍生效
        if (e.key !== 'Escape') return;
      }

      for (const b of ref.current) {
        if (b.enabled === false) continue;
        if (matchHotkey(b.key, e)) {
          e.preventDefault();
          b.handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function matchHotkey(spec: string, e: KeyboardEvent): boolean {
  const parts = spec.split('+').map((s) => s.trim().toLowerCase());
  const cmd = e.metaKey || e.ctrlKey;

  if (parts.includes('cmd') || parts.includes('ctrl') || parts.includes('⌘')) {
    if (!cmd) return false;
  } else if (cmd) {
    return false; // 未声明修饰键，但实际按了
  }

  const key = parts[parts.length - 1];
  return e.key.toLowerCase() === key;
}
