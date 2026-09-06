/**
 * useTraceState.ts - Trace 详情页面状态 Hook
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 *
 * 管理:
 * - 加载状态 (loading/detail/error) + traceApi.getTrace
 * - 树计算 (spanTree/flatSpans/visibleSpans) + 折叠 (collapsed)
 * - 时间轴参数 (traceStartMs/totalDurationMs/serviceColorMap)
 * - 布局测量 (chartRef/chartWidth) + ResizeObserver
 * - 缩放 (zoom) + 搜索 (searchTerm/matchingSpanIds)
 * - 交互 (hoveredSpanId/selectedSpanId/hoverY)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { traceApi, type TraceDetail } from '@/api/trace';
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ROW_HEIGHT,
  ROW_GAP,
  AXIS_HEIGHT,
  serviceBarColors,
  spanDurationMs,
  spanStartMs,
  buildSpanTree,
  flattenSpanTree,
} from './TraceDetailConfig';
import type { SpanNode } from './TraceDetailConfig';

export interface UseTraceStateReturn {
  loading: boolean;
  detail: TraceDetail | null;
  error: string | null;
  zoom: number;
  hoveredSpanId: string | null;
  selectedSpanId: string | null;
  collapsed: Set<string>;
  hoverY: number | null;
  searchTerm: string;
  matchingSpanIds: Set<string>;
  spanTree: SpanNode[];
  flatSpans: SpanNode[];
  visibleSpans: SpanNode[];
  traceStartMs: number;
  totalDurationMs: number;
  serviceColorMap: Map<string, string>;
  chartRef: React.RefObject<HTMLDivElement>;
  chartWidth: number;
  effectiveDurationMs: number;
  pxPerMs: number;
  svgHeight: number;
  loadTrace: (traceId: string) => Promise<void>;
  setSearchTerm: (v: string) => void;
  handleSpanEnter: (spanId: string, rowIdx: number) => void;
  handleSpanLeave: () => void;
  handleSelect: (spanId: string) => void;
  handleToggle: (spanId: string) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleWheelZoom: (e: React.WheelEvent) => void;
}

export const useTraceState = (): UseTraceStateReturn => {
  const [searchParams] = useSearchParams();
  const traceIdParam = searchParams.get('traceId') || '';

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  // ---- 加载数据 ----
  const loadTrace = useCallback(async (traceId: string) => {
    if (!traceId) return;
    setLoading(true);
    setError(null);
    setSelectedSpanId(null);
    setCollapsed(new Set());
    try {
      const data = await traceApi.getTrace(traceId);
      setDetail(data);
    } catch (err: unknown) {
      setError((err as Error).message || '加载 Trace 失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (traceIdParam) {
      loadTrace(traceIdParam);
    } else {
      loadTrace('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
    }
  }, [traceIdParam, loadTrace]);

  // ---- 计算 span 树 ----
  const spanTree = useMemo(() => {
    if (!detail || detail.spans.length === 0) return [];
    return buildSpanTree(detail.spans);
  }, [detail]);

  const flatSpans = useMemo(() => {
    if (spanTree.length === 0) return [];
    return flattenSpanTree(spanTree);
  }, [spanTree]);

  const visibleSpans = useMemo(() => {
    const hiddenParentIds = new Set<string>();
    for (const span of flatSpans) {
      const node = span;
      let parentSpanId = node.span.parentId;
      while (parentSpanId) {
        if (collapsed.has(parentSpanId)) {
          hiddenParentIds.add(node.span.spanId);
          break;
        }
        const parentNode = flatSpans.find((s) => s.span.spanId === parentSpanId);
        parentSpanId = parentNode?.span.parentId || '';
      }
    }
    return flatSpans.filter((node) => !hiddenParentIds.has(node.span.spanId));
  }, [flatSpans, collapsed]);

  // ---- 计算时间轴参数 ----
  const { traceStartMs, totalDurationMs, serviceColorMap } = useMemo(() => {
    if (!detail) {
      return { traceStartMs: 0, totalDurationMs: 1000, serviceColorMap: new Map<string, string>() };
    }
    let minStart = Infinity;
    let maxEnd = 0;
    for (const node of flatSpans) {
      const s = node.span;
      const start = spanStartMs(s);
      const end = start + spanDurationMs(s);
      if (start < minStart) minStart = start;
      if (end > maxEnd) maxEnd = end;
    }
    const duration = Math.max(1, maxEnd - minStart);

    const services = new Set<string>();
    for (const node of flatSpans) {
      if (node.span.service) services.add(node.span.service);
    }
    const svcArr = Array.from(services);
    const cmap = new Map<string, string>();
    svcArr.forEach((svc, i) => {
      cmap.set(svc, serviceBarColors[i % serviceBarColors.length]);
    });

    return { traceStartMs: minStart, totalDurationMs: duration, serviceColorMap: cmap };
  }, [flatSpans, detail]);

  // ---- 布局计算 ----
  const measureChart = useCallback(() => {
    if (chartRef.current) {
      const w = chartRef.current.clientWidth;
      if (w > 0) setChartWidth(w);
    }
  }, []);

  useEffect(() => {
    measureChart();
    const resizeObserver = new ResizeObserver(measureChart);
    if (chartRef.current) resizeObserver.observe(chartRef.current);
    window.addEventListener('resize', measureChart);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureChart);
    };
  }, [measureChart]);

  const effectiveDurationMs = totalDurationMs * zoom;
  const pxPerMs = chartWidth / Math.max(1, effectiveDurationMs);
  const totalRows = visibleSpans.length;
  const svgHeight = Math.max(400, totalRows * (ROW_HEIGHT + ROW_GAP) + AXIS_HEIGHT);

  // ---- 鼠标交互 ----
  const handleSpanEnter = useCallback((spanId: string, rowIdx: number) => {
    setHoveredSpanId(spanId);
    setHoverY(rowIdx);
  }, []);

  const handleSpanLeave = useCallback(() => {
    setHoveredSpanId(null);
    setHoverY(null);
  }, []);

  const handleSelect = useCallback((spanId: string) => {
    setSelectedSpanId((prev) => (prev === spanId ? null : spanId));
  }, []);

  const handleToggle = useCallback((spanId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  }, []);

  // ---- 缩放 ----
  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)));
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));
  }, []);

  // ---- 搜索匹配 ----
  const matchingSpanIds = useMemo(() => {
    if (!searchTerm.trim()) return new Set<string>();
    const lower = searchTerm.toLowerCase();
    const ids = new Set<string>();
    for (const node of flatSpans) {
      const s = node.span;
      if (
        s.name.toLowerCase().includes(lower) ||
        (s.service && s.service.toLowerCase().includes(lower)) ||
        s.spanId.toLowerCase().includes(lower)
      ) {
        ids.add(s.spanId);
      }
    }
    return ids;
  }, [flatSpans, searchTerm]);

  return {
    loading,
    detail,
    error,
    zoom,
    hoveredSpanId,
    selectedSpanId,
    collapsed,
    hoverY,
    searchTerm,
    matchingSpanIds,
    spanTree,
    flatSpans,
    visibleSpans,
    traceStartMs,
    totalDurationMs,
    serviceColorMap,
    chartRef,
    chartWidth,
    effectiveDurationMs,
    pxPerMs,
    svgHeight,
    loadTrace,
    setSearchTerm,
    handleSpanEnter,
    handleSpanLeave,
    handleSelect,
    handleToggle,
    handleZoomIn,
    handleZoomOut,
    handleWheelZoom,
  };
};
