/**
 * useFlameGraphState - 性能火焰图页面状态容器
 * 抽取自 PerformanceFlameGraphPage.tsx (P2-9 Phase 44)
 *
 * 管理: 3 种 profile (cpu/memory/io) 加载、zoom、hover/select、collapse、chartWidth 测量
 * 提供: flatRows/maxDepth/effectiveMaxDepth/categoryStats/sortedCategories memos + 9 handler
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  type FlameGraphFrame,
  type FlameGraphProfile,
  type FlameGraphType,
  generateCpuFlameGraph,
  generateMemoryFlameGraph,
  generateIOFlameGraph,
  getFlameGraph,
} from '@/api/flamegraph';
import { spacing } from '@/tokens';
import {
  ZOOM_MIN,
  ZOOM_MAX,
  DETAIL_PANEL_WIDTH,
  flattenFlameGraph,
  getMaxDepth,
  getCategoryStats,
  type RenderRow,
} from './PerformanceFlameGraphConfig';

export interface UseFlameGraphStateReturn {
  activeType: FlameGraphType;
  setActiveType: (t: FlameGraphType) => void;
  loading: boolean;
  profiles: Record<FlameGraphType, FlameGraphProfile | null>;
  error: string | null;
  currentProfile: FlameGraphProfile | null;
  zoom: number;
  hoveredFrame: FlameGraphFrame | null;
  selectedFrame: FlameGraphFrame | null;
  selectedDepth: number;
  collapsed: Set<string>;
  svgRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  chartWidth: number;
  flatRows: RenderRow[];
  maxDepth: number;
  effectiveMaxDepth: number;
  categoryStats: Record<string, { value: number; pct: number }>;
  sortedCategories: [string, { value: number; pct: number }][];
  loadProfile: (type: FlameGraphType) => Promise<void>;
  isNodeCollapsed: (frame: FlameGraphFrame) => boolean;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleFrameEnter: (frame: FlameGraphFrame) => void;
  handleFrameLeave: () => void;
  handleFrameClick: (frame: FlameGraphFrame) => void;
  handleTabChange: (key: string) => void;
  setSelectedFrame: (f: FlameGraphFrame | null) => void;
}

export const useFlameGraphState = (): UseFlameGraphStateReturn => {
  const [activeType, setActiveType] = useState<FlameGraphType>('cpu');

  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Record<FlameGraphType, FlameGraphProfile | null>>({
    cpu: null,
    memory: null,
    io: null,
  });
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [hoveredFrame, setHoveredFrame] = useState<FlameGraphFrame | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<FlameGraphFrame | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(0);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(900);

  const currentProfile = profiles[activeType];

  // ---- 加载数据 ----

  const loadProfile = useCallback(async (type: FlameGraphType) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFlameGraph(type);
      setProfiles((prev) => ({ ...prev, [type]: data }));
    } catch {
      // API 不可用时回退到 mock 数据
      let mockData: FlameGraphProfile;
      switch (type) {
        case 'cpu':
          mockData = generateCpuFlameGraph();
          break;
        case 'memory':
          mockData = generateMemoryFlameGraph();
          break;
        case 'io':
          mockData = generateIOFlameGraph();
          break;
      }
      setProfiles((prev) => ({ ...prev, [type]: mockData }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile(activeType);
  }, [activeType, loadProfile]);

  // ---- 展开/收起 ----

  const isNodeCollapsed = useCallback(
    (frame: FlameGraphFrame): boolean => {
      const hasChildren = frame.children != null && frame.children.length > 0;
      return collapsed.has(frame.name) && hasChildren;
    },
    [collapsed]
  );

  // ---- 展平 ----

  const flatRows = useMemo(() => {
    if (!currentProfile) return [];
    return flattenFlameGraph(currentProfile.data, collapsed);
  }, [currentProfile, collapsed]);

  const maxDepth = getMaxDepth(flatRows);

  // 计算可见深度（根据折叠状态动态调整）
  const effectiveMaxDepth = useMemo(() => {
    if (flatRows.length === 0) return 0;
    return Math.max(...flatRows.map((r) => r.depth));
  }, [flatRows]);

  // ---- 布局 ----

  const measureChart = useCallback(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        const w = parent.clientWidth - DETAIL_PANEL_WIDTH - spacing.md;
        if (w > 200) setChartWidth(w);
      }
    }
  }, []);

  useEffect(() => {
    measureChart();
    const resizeObserver = new ResizeObserver(measureChart);
    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }
    window.addEventListener('resize', measureChart);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureChart);
    };
  }, [measureChart, activeType]);

  // ---- 缩放 ----

  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1);
    setCollapsed(new Set());
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));
  }, []);

  // ---- 鼠标交互 ----

  const handleFrameEnter = useCallback((frame: FlameGraphFrame) => {
    setHoveredFrame(frame);
  }, []);

  const handleFrameLeave = useCallback(() => {
    setHoveredFrame(null);
  }, []);

  const handleFrameClick = useCallback(
    (frame: FlameGraphFrame) => {
      if (frame.children && frame.children.length > 0) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(frame.name)) next.delete(frame.name);
          else next.add(frame.name);
          return next;
        });
      }
      const idx = flatRows.findIndex((r) => r.frame === frame);
      const depth = idx >= 0 ? flatRows[idx].depth : 0;
      setSelectedFrame(frame);
      setSelectedDepth(depth);
    },
    [flatRows]
  );

  const handleTabChange = useCallback((key: string) => {
    const t = key as FlameGraphType;
    setActiveType(t);
    setZoom(1);
    setCollapsed(new Set());
    setSelectedFrame(null);
    setHoveredFrame(null);
  }, []);

  // ---- 类别统计 ----

  const categoryStats = useMemo(() => {
    if (!currentProfile) return {};
    return getCategoryStats(currentProfile.data, currentProfile.totalValue);
  }, [currentProfile]);

  const sortedCategories = useMemo(
    () =>
      Object.entries(categoryStats)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 8),
    [categoryStats]
  );

  return {
    activeType,
    setActiveType,
    loading,
    profiles,
    error,
    currentProfile,
    zoom,
    hoveredFrame,
    selectedFrame,
    selectedDepth,
    collapsed,
    svgRef,
    containerRef,
    chartWidth,
    flatRows,
    maxDepth,
    effectiveMaxDepth,
    categoryStats,
    sortedCategories,
    loadProfile,
    isNodeCollapsed,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleWheel,
    handleFrameEnter,
    handleFrameLeave,
    handleFrameClick,
    handleTabChange,
    setSelectedFrame,
  };
};
