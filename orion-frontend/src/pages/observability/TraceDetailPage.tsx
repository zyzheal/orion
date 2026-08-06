/**
 * TraceDetailPage (P1-08)
 * Trace 详情可视化 - Waterfall / Gantt Chart
 *
 * 功能：
 * - 左侧：Span 名称树形列表（可展开/折叠）
 * - 右侧：SVG 时间轴，每个 span 显示为水平条（长度 = duration）
 * - 错误 span 高亮（红色）
 * - 鼠标 hover 显示 span 详情
 * - 支持滚轮缩放查看时间线
 * - Loading / 空状态
 *
 * Design Tokens 使用：
 * - 正常 span: colors.primary[500] (#3370E6)
 * - 错误 span: colors.error[500] (#f5222d)
 * - 背景: colors.light.bg.primary (#ffffff)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Empty,
  Tooltip,
  Popover,
  Input,
} from 'antd';
import { spacing, shadows, radius } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  ClockCircleOutlined,
  EyeOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { traceApi, type Span, type TraceDetail } from '@/api/trace';
import PageSkeleton from '@/components/PageSkeleton';

const { Title, Text } = Typography;
const { Search } = Input;

// ---- 类型定义 ----

/** Span 树节点（含子节点索引） */
interface SpanNode {
  span: Span;
  children: SpanNode[];
  depth: number;
}

/** 缩放级别 (1 = 原始比例) */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const ROW_HEIGHT = 36;        // 每行 span 高度
const BAR_MIN_HEIGHT = 18;    // span 条最小高度
const BAR_MIN_WIDTH = 2;      // span 条最小宽度 (防止太短不可见)
const TREE_COL_WIDTH = 320;   // 左侧树形列宽度
const HEADER_HEIGHT = 40;     // 顶部时间轴标题高度
const AXIS_HEIGHT = 30;       // 底部时间轴坐标轴高度
const ROW_GAP = 2;            // 行间间隙

// ---- 工具函数 ----

/**
 * 将 nanoseconds 转为 ms
 */
const nsToMs = (ns: number): number => ns / 1_000_000;

/**
 * 解析 span 的持续时间 (ms)
 */
const spanDurationMs = (span: Span): number => {
  if (span.durationMs) return span.durationMs;
  if (span.durationNs) return nsToMs(span.durationNs);
  // 从时间戳计算
  const start = Date.parse(span.startTime);
  const end = Date.parse(span.endTime);
  return Math.max(0, end - start);
};

/**
 * 解析 span 的开始时间 (ms from epoch)
 */
const spanStartMs = (span: Span): number => {
  const t = Date.parse(span.startTime);
  return isNaN(t) ? 0 : t;
};

/**
 * 格式化持续时间显示
 */
const formatDuration = (durationNs: number): string => {
  const ms = nsToMs(durationNs);
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
};

/**
 * 格式化时间戳为可读时间
 */
const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
};

/**
 * 判断 span 是否为错误状态
 */
const isSpanError = (span: Span): boolean => span.statusCode === 'ERROR';

/**
 * Span 状态标签颜色
 */
const statusColor = (statusCode: string): string => {
  switch (statusCode) {
    case 'OK': return colors.success[500];
    case 'ERROR': return colors.error[500];
    default: return colors.neutral[500];
  }
};

/**
 * Span 状态标签文本
 */
const statusLabel = (statusCode: string): string => {
  switch (statusCode) {
    case 'OK': return 'OK';
    case 'ERROR': return 'ERROR';
    default: return 'UNSET';
  }
};

/**
 * 根据服务名选择颜色 (用于 span 条)
 */
const serviceBarColors = [
  colors.primary[500],
  colors.info[500],
  colors.purple[500],
  colors.success[500],
  colors.warning[500],
  '#FF8C00',
  '#00BCD4',
  '#E91E63',
];

/**
 * 为 span 选择条形颜色 (优先用服务色，错误状态用红色)
 */
const getBarColor = (span: Span, serviceColorMap: Map<string, string>): string => {
  if (isSpanError(span)) return colors.error[500];
  if (span.service && serviceColorMap.has(span.service)) {
    return serviceColorMap.get(span.service)!;
  }
  return colors.primary[500];
};

/**
 * 为 span 选择条形悬停颜色 (深色版本)
 */
const getBarHoverColor = (color: string): string => {
  if (color === colors.error[500]) return colors.error[700];
  if (color === colors.success[500]) return colors.success[700];
  if (color === colors.primary[500]) return colors.primary[700];
  if (color === colors.info[500]) return colors.info[700];
  if (color === colors.purple[500]) return colors.purple[700];
  return colors.neutral[700];
};

/**
 * 构建 Span 树 (基于 parentId)
 */
const buildSpanTree = (spans: Span[]): SpanNode[] => {
  const spanMap = new Map<string, Span>();
  for (const s of spans) spanMap.set(s.spanId, s);

  const nodeMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  // 第一遍：创建节点
  for (const s of spans) {
    nodeMap.set(s.spanId, { span: s, children: [], depth: 0 });
  }

  // 第二遍：建立父子关系
  for (const s of spans) {
    const node = nodeMap.get(s.spanId)!;
    if (s.parentId && nodeMap.has(s.parentId)) {
      nodeMap.get(s.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 第三遍：计算深度
  const setDepth = (node: SpanNode, d: number) => {
    node.depth = d;
    for (const child of node.children) {
      setDepth(child, d + 1);
    }
  };
  for (const root of roots) setDepth(root, 0);

  return roots;
};

/**
 * 将树扁平化为行列表 (保持 DFS 顺序)
 */
const flattenSpanTree = (nodes: SpanNode[]): SpanNode[] => {
  const result: SpanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenSpanTree(node.children));
    }
  }
  return result;
};

// ---- Span Detail Popover 内容 ----

const SpanDetailPopover: React.FC<{ span: Span }> = ({ span }) => {
  return (
    <div style={{ minWidth: 240, maxWidth: 360 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong>{span.name}</Text>
        <Tag color={statusColor(span.statusCode)} style={{ marginLeft: 8 }}>
          {statusLabel(span.statusCode)}
        </Tag>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 4, columnGap: 8, fontSize: 12 }}>
        <Text type="secondary">Trace ID</Text>
        <Text code style={{ wordBreak: 'break-all' }}>{span.traceId}</Text>

        <Text type="secondary">Span ID</Text>
        <Text code style={{ wordBreak: 'break-all' }}>{span.spanId}</Text>

        <Text type="secondary">Parent ID</Text>
        <Text code style={{ wordBreak: 'break-all' }}>{span.parentId || '-'}</Text>

        {span.service && (
          <>
            <Text type="secondary">Service</Text>
            <Text>{span.service}</Text>
          </>
        )}

        {span.kind && (
          <>
            <Text type="secondary">Kind</Text>
            <Text>{span.kind}</Text>
          </>
        )}

        <Text type="secondary">Duration</Text>
        <Text strong>{formatDuration(span.durationNs)}</Text>

        <Text type="secondary">Start</Text>
        <Text>{formatTime(span.startTime)}</Text>

        <Text type="secondary">End</Text>
        <Text>{formatTime(span.endTime)}</Text>

        {span.statusMessage && (
          <>
            <Text type="secondary" style={{ color: colors.error[500] }}>Message</Text>
            <Text style={{ color: colors.error[500] }}>{span.statusMessage}</Text>
          </>
        )}
      </div>

      {span.attributes && Object.keys(span.attributes).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Attributes
          </Text>
          <div style={{ maxHeight: 120, overflow: 'auto', backgroundColor: colors.light.bg.secondary, borderRadius: radius.xs, padding: 8, fontSize: 11 }}>
            <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(span.attributes, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {span.events && span.events.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Events ({span.events.length})
          </Text>
          <div style={{ maxHeight: 80, overflow: 'auto', fontSize: 11 }}>
            {span.events.map((ev, i) => (
              <div key={i} style={{ padding: '2px 0', borderLeft: `2px solid ${colors.primary[400]}`, paddingLeft: 6, marginBottom: 2 }}>
                <Text code>{ev.name}</Text>
                <Text type="secondary" style={{ marginLeft: 4 }}>{formatTime(ev.timestamp)}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- 树形行组件 ----

const TreeNodeRow: React.FC<{
  node: SpanNode;
  rowIdx: number;
  treeColWidth: number;
  rowHeight: number;
  collapsed: Set<string>;
  onToggle: (spanId: string) => void;
  hoveredSpanId: string | null;
  onMouseEnter: (spanId: string, y: number) => void;
  onMouseLeave: () => void;
  selectedSpanId: string | null;
  onSelect: (spanId: string) => void;
}> = ({
  node,
  rowIdx,
  treeColWidth,
  rowHeight,
  collapsed,
  onToggle,
  hoveredSpanId,
  onMouseEnter,
  onMouseLeave,
  selectedSpanId,
  onSelect,
}) => {
  const { span, depth } = node;
  const isError = isSpanError(span);
  const isHovered = hoveredSpanId === span.spanId;
  const isSelected = selectedSpanId === span.spanId;
  const isCollapsed = collapsed.has(span.spanId);
  const hasChildren = node.children.length > 0;

  const indent = depth * 16 + 8;
  const bgColor = isSelected
    ? colors.primary[50]
    : isHovered
    ? colors.light.bg.secondary
    : 'transparent';

  const toggleIcon = hasChildren
    ? (isCollapsed ? '▸' : '▾')
    : '\u00A0'; // non-breaking space

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: rowIdx * (rowHeight + ROW_GAP),
        width: treeColWidth,
        height: rowHeight,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${spacing.sm}`,
        backgroundColor: bgColor,
        borderBottom: `1px solid ${colors.light.border.light}`,
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: 13,
      }}
      onMouseEnter={() => onMouseEnter(span.spanId, rowIdx)}
      onMouseLeave={onMouseLeave}
      onClick={() => onSelect(span.spanId)}
    >
      <span
        style={{
          width: 16,
          textAlign: 'center',
          color: hasChildren ? colors.neutral[500] : 'transparent',
          fontSize: 10,
          marginRight: 4,
          flexShrink: 0,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          if (hasChildren) {
            e.stopPropagation();
            onToggle(span.spanId);
          }
        }}
      >
        {toggleIcon}
      </span>
      <span style={{ width: indent, flexShrink: 0 }} />
      <span style={{ flexShrink: 0 }}>
        {span.service ? (
          <Tag
            color={statusColor(span.statusCode)}
            style={{
              fontSize: 10,
              padding: '0 4px',
              lineHeight: '16px',
              marginRight: 4,
            }}
          >
            {span.service}
          </Tag>
        ) : null}
        <Text
          style={{
            fontSize: 12,
            color: isError ? colors.error[500] : colors.neutral[900],
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: treeColWidth - indent - 80,
            display: 'inline-block',
            verticalAlign: 'middle',
          }}
        >
          {span.name}
        </Text>
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.neutral[500], flexShrink: 0 }}>
        {formatDuration(span.durationNs)}
      </span>
    </div>
  );
};

// ---- 时间轴刻度组件 ----

const TimeAxis: React.FC<{
  chartWidth: number;
  totalDurationMs: number;
  zoom: number;
}> = ({ chartWidth, totalDurationMs, zoom }) => {
  const effectiveDurationMs = totalDurationMs * zoom;
  const pxPerMs = chartWidth / Math.max(1, effectiveDurationMs);

  const ticks = useMemo(() => {
    // 计算合适的刻度间隔
    const fullMsPerPixel = 1 / pxPerMs;
    let intervalMs: number;
    if (fullMsPerPixel < 50) intervalMs = 50;
    else if (fullMsPerPixel < 100) intervalMs = 100;
    else if (fullMsPerPixel < 200) intervalMs = 200;
    else if (fullMsPerPixel < 500) intervalMs = 500;
    else if (fullMsPerPixel < 1000) intervalMs = 1000;
    else if (fullMsPerPixel < 2000) intervalMs = 2000;
    else if (fullMsPerPixel < 5000) intervalMs = 5000;
    else if (fullMsPerPixel < 10000) intervalMs = 10000;
    else if (fullMsPerPixel < 30000) intervalMs = 30000;
    else if (fullMsPerPixel < 60000) intervalMs = 60000;
    else if (fullMsPerPixel < 120000) intervalMs = 120000;
    else intervalMs = 300000;

    const ticks: { x: number; label: string }[] = [];
    for (let t = 0; t <= effectiveDurationMs; t += intervalMs) {
      const x = t * pxPerMs;
      const elapsedMs = t;
      let label: string;
      if (elapsedMs < 1000) label = `${elapsedMs}ms`;
      else if (elapsedMs < 60000) label = `${(elapsedMs / 1000).toFixed(1)}s`;
      else label = `${(elapsedMs / 60000).toFixed(1)}min`;
      ticks.push({ x, label });
    }
    return ticks;
  }, [chartWidth, effectiveDurationMs, pxPerMs]);

  const y = AXIS_HEIGHT - 4;

  return (
    <g>
      {/* 轴线 */}
      <line x1="0" y1={y} x2={chartWidth} y2={y} stroke={colors.light.border.default} strokeWidth={1} />
      {/* 刻度线 + 标签 */}
      {ticks.map((tick, i) => (
        <g key={i}>
          <line x1={tick.x} y1={y} x2={tick.x} y2={y + 4} stroke={colors.neutral[400]} strokeWidth={1} />
          <text
            x={tick.x}
            y={y + 16}
            fontSize={10}
            fill={colors.neutral[500]}
            textAnchor="start"
            style={{ userSelect: 'none' }}
          >
            +{tick.label}
          </text>
        </g>
      ))}
    </g>
  );
};

// ---- 主组件 ----

const TraceDetailPage: React.FC = () => {
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
      // 默认加载第一个模拟 trace
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

  // 过滤掉被折叠节点的子节点
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
        // 找父节点的 parentId
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

    // 为服务分配颜色
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
  }, [flatSpans]);

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
  const handleWheelZoom = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));
    },
    [],
  );

  // ---- 查找 span ----

  const [searchTerm, setSearchTerm] = useState('');
  const matchingSpanIds = useMemo(() => {
    if (!searchTerm.trim()) return new Set<string>();
    const lower = searchTerm.toLowerCase();
    const ids = new Set<string>();
    for (const node of flatSpans) {
      const s = node.span;
      if (s.name.toLowerCase().includes(lower) ||
          (s.service && s.service.toLowerCase().includes(lower)) ||
          s.spanId.toLowerCase().includes(lower)) {
        ids.add(s.spanId);
      }
    }
    return ids;
  }, [flatSpans, searchTerm]);

  // ---- 渲染：Loading ----

  if (loading) {
    return <PageSkeleton rows={8} />;
  }

  // ---- 渲染：错误 ----

  if (error && !detail) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClockCircleOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
          Trace 详情
        </Title>
        <Card>
          <Empty
            description={<Text type="secondary">{error}</Text>}
          >
            <Button type="primary" onClick={() => loadTrace(traceIdParam || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6')}>
              重试
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  // ---- 渲染：无数据 ----

  if (!detail) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClockCircleOutlined style={{ marginRight: spacing.sm }} />
          Trace 详情
        </Title>
        <Empty description="请选择或输入 Trace ID">
          <Button type="primary">加载 Trace</Button>
        </Empty>
      </div>
    );
  }

  // ---- 渲染：详情 ----

  const rootSpan = flatSpans.find((n) => !n.span.parentId) || flatSpans[0];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <EyeOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
              Trace 详情
            </Title>
            <Text type="secondary">分布式追踪 Waterfall 视图</Text>
          </div>

          {/* 基本信息卡片 */}
          <Space>
            <Card size="small" style={{ minWidth: 140, boxShadow: shadows.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>总时长</Text>
                <Text strong>{formatDuration(detail.totalDurationNs)}</Text>
              </div>
            </Card>
            <Card size="small" style={{ minWidth: 100, boxShadow: shadows.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Span 数</Text>
                <Text strong>{detail.spanCount}</Text>
              </div>
            </Card>
            <Card size="small" style={{ minWidth: 140, boxShadow: shadows.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
                <Tag color={statusColor(rootSpan?.span.statusCode || 'OK')}>
                  {statusLabel(rootSpan?.span.statusCode || 'OK')}
                </Tag>
              </div>
            </Card>
          </Space>
        </div>

        {/* Trace ID */}
        <div style={{ marginTop: spacing.sm }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Trace ID: </Text>
          <Text code>{detail.traceId}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: spacing.md }}>Root: </Text>
          <Text strong>{detail.rootSpanName}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: spacing.md }}>Service: </Text>
          <Text>{detail.rootService}</Text>
        </div>
      </div>

      {/* Waterfall Chart */}
      <Card
        style={{
          boxShadow: shadows.sm,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${spacing.md}`,
            height: HEADER_HEIGHT,
            borderBottom: `1px solid ${colors.light.border.default}`,
            backgroundColor: colors.light.bg.secondary,
          }}
        >
          <Text style={{ fontSize: 13, marginRight: spacing.md, flexShrink: 0 }}>
            <EyeOutlined style={{ marginRight: 4 }} />
            Waterfall
          </Text>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <Search
              placeholder="搜索 span 名称 / 服务 / ID"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
          </div>

          <Space size="small">
            <Tooltip title="缩小">
              <Button size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
            </Tooltip>
            <Text style={{ fontSize: 11, color: colors.neutral[500], width: 60, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Text>
            <Tooltip title="放大">
              <Button size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
            </Tooltip>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => loadTrace(detail.traceId)} />
          </Space>
        </div>

        {/* Main Chart Area */}
        <div
          ref={chartRef}
          style={{
            position: 'relative',
            height: svgHeight,
            overflow: 'hidden',
          }}
          onWheel={handleWheelZoom}
        >
          {/* Column headers */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: TREE_COL_WIDTH,
              height: HEADER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${spacing.md}`,
              borderBottom: `1px solid ${colors.light.border.default}`,
              borderRight: `1px solid ${colors.light.border.default}`,
              backgroundColor: colors.light.bg.tertiary,
              fontSize: 12,
              fontWeight: 500,
              zIndex: 2,
            }}
          >
            <span style={{ width: 16, marginRight: 4, textAlign: 'center' }}>&#160;</span>
            <span>Span</span>
            <span style={{ marginLeft: 'auto' }}>Duration</span>
          </div>

          <div
            style={{
              position: 'absolute',
              left: TREE_COL_WIDTH,
              top: 0,
              width: chartWidth,
              height: HEADER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: colors.neutral[500],
              zIndex: 2,
            }}
          >
            Time elapsed (scale: {zoom.toFixed(2)}x, {formatDuration(totalDurationMs * 1_000_000)} total)
          </div>

          {/* Time axis header line */}
          <div
            style={{
              position: 'absolute',
              left: TREE_COL_WIDTH,
              top: HEADER_HEIGHT,
              width: chartWidth,
              height: 1,
              backgroundColor: colors.light.border.default,
              zIndex: 1,
            }}
          />

          {/* Tree column */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: HEADER_HEIGHT,
              width: TREE_COL_WIDTH,
              height: Math.max(400, totalRows * (ROW_HEIGHT + ROW_GAP)),
              borderRight: `1px solid ${colors.light.border.default}`,
              backgroundColor: colors.light.bg.primary,
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            {visibleSpans.map((node, rowIdx) => (
              <TreeNodeRow
                key={node.span.spanId}
                node={node}
                rowIdx={rowIdx}
                treeColWidth={TREE_COL_WIDTH}
                rowHeight={ROW_HEIGHT}
                collapsed={collapsed}
                onToggle={handleToggle}
                hoveredSpanId={hoveredSpanId}
                onMouseEnter={handleSpanEnter}
                onMouseLeave={handleSpanLeave}
                selectedSpanId={selectedSpanId}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* SVG Waterfall */}
          <div
            style={{
              position: 'absolute',
              left: TREE_COL_WIDTH,
              top: HEADER_HEIGHT,
              width: chartWidth,
              height: svgHeight - HEADER_HEIGHT,
              backgroundColor: colors.light.bg.primary,
              cursor: 'col-resize',
              overflow: 'hidden',
            }}
          >
            <svg
              width={chartWidth}
              height={svgHeight - HEADER_HEIGHT}
              style={{ display: 'block' }}
              onWheel={handleWheelZoom}
            >
              {/* Grid lines (vertical) */}
              {(() => {
                const gridLines: React.ReactNode[] = [];
                const fullMsPerPixel = 1 / pxPerMs;
                let intervalMs: number;
                if (fullMsPerPixel < 50) intervalMs = 50;
                else if (fullMsPerPixel < 100) intervalMs = 100;
                else if (fullMsPerPixel < 500) intervalMs = 500;
                else if (fullMsPerPixel < 1000) intervalMs = 1000;
                else intervalMs = 2000;

                for (let t = 0; t <= effectiveDurationMs; t += intervalMs) {
                  const x = t * pxPerMs;
                  gridLines.push(
                    <line
                      key={`grid-${t}`}
                      x1={x} y1={0}
                      x2={x} y2={svgHeight - HEADER_HEIGHT - AXIS_HEIGHT}
                      stroke={colors.light.border.light}
                      strokeWidth={1}
                      strokeDasharray="2,4"
                    />,
                  );
                }
                return gridLines;
              })()}

              {/* Span bars */}
              {visibleSpans.map((node, rowIdx) => {
                const s = node.span;
                const startOffset = spanStartMs(s) - traceStartMs;
                const dur = spanDurationMs(s);
                const x = Math.max(0, startOffset * pxPerMs);
                const w = Math.max(BAR_MIN_WIDTH, dur * pxPerMs);
                const y = rowIdx * (ROW_HEIGHT + ROW_GAP);
                const barH = Math.min(ROW_HEIGHT - ROW_GAP - 4, BAR_MIN_HEIGHT);
                const barY = y + 2;
                const barColor = getBarColor(s, serviceColorMap);
                const isHovered = hoveredSpanId === s.spanId;
                const isSelected = selectedSpanId === s.spanId;
                const isMatch = searchTerm.trim() && matchingSpanIds.has(s.spanId);

                return (
                  <g key={`span-${s.spanId}`}>
                    {/* Highlight background for search matches */}
                    {isMatch && (
                      <rect
                        x={0} y={y}
                        width={chartWidth} height={ROW_HEIGHT + ROW_GAP}
                        fill={colors.warning[50]}
                        opacity={0.7}
                      />
                    )}
                    {/* Bar shadow */}
                    <rect
                      x={x + 1} y={barY + 2}
                      width={w} height={barH}
                      fill="rgba(0,0,0,0.08)"
                      rx={radius.xs}
                    />
                    {/* Bar */}
                    <Popover
                      content={<SpanDetailPopover span={s} />}
                      trigger="hover"
                      placement="bottomLeft"
                      overlayStyle={{ boxShadow: shadows.dropdown }}
                    >
                      <rect
                        x={x} y={barY}
                        width={w} height={barH}
                        fill={isHovered ? getBarHoverColor(barColor) : barColor}
                        rx={radius.xs}
                        style={{
                          cursor: 'pointer',
                          filter: isHovered ? 'brightness(1.1)' : 'none',
                          stroke: isSelected ? colors.neutral[900] : 'none',
                          strokeWidth: isSelected ? 2 : 0,
                          transition: 'fill 150ms ease',
                        }}
                        onMouseEnter={() => handleSpanEnter(s.spanId, rowIdx)}
                        onMouseLeave={handleSpanLeave}
                      />
                    </Popover>
                    {/* Duration label on bar (only if wide enough) */}
                    {w > 60 && (
                      <text
                        x={x + 4}
                        y={barY + barH / 2 + 3}
                        fontSize={10}
                        fill="#ffffff"
                        style={{ userSelect: 'none', fontWeight: 500 }}
                      >
                        {formatDuration(s.durationNs)}
                      </text>
                    )}
                    {/* Error indicator dot */}
                    {isSpanError(s) && (
                      <circle
                        cx={x + w - 4}
                        cy={barY + barH / 2}
                        r={3}
                        fill={colors.error[700]}
                      />
                    )}
                  </g>
                );
              })}

              {/* Hovered span horizontal highlight line */}
              {hoveredSpanId && hoverY !== null && (() => {
                const y = hoverY * (ROW_HEIGHT + ROW_GAP);
                return (
                  <rect
                    x={0} y={y}
                    width={chartWidth} height={ROW_HEIGHT + ROW_GAP}
                    fill={colors.primary[50]}
                    opacity={0.5}
                    pointerEvents="none"
                  />
                );
              })()}

              {/* Current time indicator (if trace is recent) */}

              {/* Time axis */}
              <g transform={`translate(0, ${svgHeight - HEADER_HEIGHT - AXIS_HEIGHT})`}>
                <TimeAxis
                  chartWidth={chartWidth}
                  totalDurationMs={totalDurationMs}
                  zoom={zoom}
                />
              </g>
            </svg>
          </div>

          {/* Axis label column (bottom-left) */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: svgHeight - AXIS_HEIGHT,
              width: TREE_COL_WIDTH,
              height: AXIS_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${spacing.md}`,
              borderRight: `1px solid ${colors.light.border.default}`,
              backgroundColor: colors.light.bg.tertiary,
              fontSize: 11,
              color: colors.neutral[500],
              zIndex: 2,
            }}
          >
            {totalRows} spans &middot; {flatSpans.length} total
          </div>

          {/* X-axis line under tree column */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: svgHeight - AXIS_HEIGHT,
              width: TREE_COL_WIDTH,
              height: 1,
              backgroundColor: colors.light.border.default,
              zIndex: 1,
            }}
          />
        </div>
      </Card>

      {/* Legend */}
      <Card size="small" style={{ marginTop: spacing.md, boxShadow: shadows.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }}>
          <Text strong style={{ fontSize: 12 }}>Legend:</Text>
          {serviceColorMap.size > 0 && Array.from(serviceColorMap.entries()).map(([svc, color]) => (
            <span key={svc} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 10,
                  backgroundColor: color,
                  borderRadius: radius.xs,
                  marginRight: 4,
                }}
              />
              <Text>{svc}</Text>
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 10,
                backgroundColor: colors.error[500],
                borderRadius: radius.xs,
                marginRight: 4,
              }}
            />
            <Text style={{ color: colors.error[500] }}>Error</Text>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 10,
                backgroundColor: colors.warning[50],
                borderRadius: radius.xs,
                marginRight: 4,
              }}
            />
            <Text type="secondary">Search match</Text>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, marginLeft: 'auto' }}>
            <Text type="secondary">滚轮缩放 &middot; Hover 查看详情 &middot; 点击选中</Text>
          </span>
        </div>
      </Card>

      {/* Span count by service */}
      <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
        {Object.entries(detail.spanCountByService).map(([svc, count]) => {
          const svcColor = serviceColorMap.get(svc) || colors.primary[500];
          const errorCount = flatSpans
            .filter((n) => n.span.service === svc && isSpanError(n.span))
            .length;
          return (
            <Card size="small" key={svc} style={{ minWidth: 130, boxShadow: shadows.sm, borderLeft: `3px solid ${svcColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: svcColor, fontWeight: 500 }}>{svc}</Text>
                <Text strong>{count}</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                {errorCount > 0 ? (
                  <Tag color={colors.error[500]} style={{ fontSize: 10 }}>{errorCount} error</Tag>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>{count} spans</Text>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TraceDetailPage;
