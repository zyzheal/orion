/**
 * PerformanceFlameGraphPage (P1-09)
 * 性能火焰图可视化 - CPU / Memory / IO
 *
 * 功能：
 * - 顶部 Tab：CPU / Memory / IO
 * - SVG 火焰图：每层代表一个调用栈帧，框宽度 = 时间/内存占比
 * - 鼠标 hover 显示函数详情
 * - 点击节点展开/收起子调用栈
 * - 滚轮缩放 (wheel zoom)
 * - 图例和统计信息
 * - Loading / 空状态
 *
 * 布局：
 * - 左侧火焰图（占满）
 * - 右侧详情面板（360px）
 *
 * Design Tokens：
 * - 火焰图经典配色：#F5C77E → #E07A5F → #C44536 → #9E2A2B → #821F20
 * - Card 阴影：shadows.sm
 * - 圆角：radius.lg / radius.xs
 * - 间距：spacing.sm/md/lg
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tabs, Card, Typography, Tooltip, Button, Empty, Space, Tag, Statistic } from 'antd';
import { spacing, shadows, radius } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  FireOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  type FlameGraphFrame,
  type FlameGraphProfile,
  type FlameGraphType,
  FLAME_GRAPH_LABELS,
  FLAME_GRAPH_UNITS,
  FLAME_GRAPH_DESCRIPTIONS,
  generateCpuFlameGraph,
  generateMemoryFlameGraph,
  generateIOFlameGraph,
  getFlameGraph,
} from '@/api/flamegraph';

const { Title, Text } = Typography;

// ---- 常量 ----

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const FRAME_HEIGHT = 22;       // 每层帧高度
const FRAME_GAP = 1;           // 帧间间隙
const MIN_FRAME_WIDTH = 3;     // 最小帧宽度 (px)
const MIN_LABEL_WIDTH = 30;    // 显示标签的最小宽度
const HEADER_HEIGHT = 56;      // 顶部工具栏高度
const LEGEND_HEIGHT = 44;      // 底部图例高度
const DETAIL_PANEL_WIDTH = 360; // 右侧详情面板宽度

// ---- 火焰图经典配色 (热度由浅到深) ----

const FLAME_COLORS: string[] = [
  '#F5C77E', // 浅 - 低层 (叶子)
  '#E07A5F',
  '#C44536',
  '#9E2A2B',
  '#821F20', // 深 - 高层 (根)
];

// 文字颜色：浅色帧用深色文字，深色帧用白色文字
const FLAME_TEXT_COLORS: string[] = [
  '#1f1f1f',
  '#1f1f1f',
  '#ffffff',
  '#ffffff',
  '#ffffff',
];

// ---- 工具函数 ----

/** 根据深度选择颜色（深度 = 0 为根节点） */
const colorByDepth = (depth: number): string => {
  const i = Math.min(FLAME_COLORS.length - 1, Math.max(0, depth % FLAME_COLORS.length));
  return FLAME_COLORS[i];
};

const textColorByDepth = (depth: number): string => {
  const i = Math.min(FLAME_TEXT_COLORS.length - 1, Math.max(0, depth % FLAME_TEXT_COLORS.length));
  return FLAME_TEXT_COLORS[i];
};

/** 将火焰图节点展平为渲染列表，返回每行的渲染信息 */
interface RenderRow {
  frame: FlameGraphFrame;
  depth: number;
  x: number;       // 在该行中的 x 偏移（相对行宽的比例 0~1）
  w: number;       // 在该行中的宽度比例 0~1
}

/**
 * 将火焰图递归展平为 RenderRow 列表。
 * 算法：DFS 遍历，每层累积 value 占比。
 * 支持 collapsed 节点（展开/收起）。
 */
const flattenFlameGraph = (
  frame: FlameGraphFrame,
  collapsed: Set<string>,
  depth: number = 0,
  parentValue: number = 0,
): RenderRow[] => {
  const rows: RenderRow[] = [];

  const processLayer = (
    f: FlameGraphFrame,
    d: number,
    layerRows: RenderRow[],
  ) => {
    const total = parentValue > 0 ? parentValue : getTotalValue(f);
    let accum = 0;

    const children = collapsed.has(f.name) ? [] : (f.children || []);

    if (children.length === 0 || total <= 0) {
      layerRows.push({ frame: f, depth: d, x: 0, w: 1 });
    } else {
      for (const child of children) {
        const childTotal = getTotalValue(child);
        const ratio = childTotal / total;
        layerRows.push({ frame: child, depth: d + 1, x: accum, w: ratio });
        accum += ratio;
        processLayer(child, d + 1, layerRows);
      }
    }
  };

  processLayer(frame, depth, rows);
  return rows;
};

/** 计算节点总 value（包含子节点） */
const getTotalValue = (frame: FlameGraphFrame): number => {
  const sum = (f: FlameGraphFrame): number => {
    if (f.children && f.children.length > 0) {
      return f.children.reduce((acc, c) => acc + sum(c), 0);
    }
    return f.value;
  };
  return sum(frame);
};

/** 计算最大深度（用于图例） */
const getMaxDepth = (rows: RenderRow[]): number =>
  rows.length > 0 ? Math.max(...rows.map((r) => r.depth)) : 0;

/** 计算类别统计 */
const getCategoryStats = (frame: FlameGraphFrame, totalValue: number): Record<string, { value: number; pct: number }> => {
  const stats: Record<string, { value: number; pct: number }> = {};
  const collect = (f: FlameGraphFrame) => {
    if (f.children && f.children.length > 0) {
      for (const c of f.children) collect(c);
    } else {
      const cat = f.category || 'uncategorized';
      if (!stats[cat]) stats[cat] = { value: 0, pct: 0 };
      stats[cat].value += f.value;
    }
  };
  collect(frame);
  for (const cat of Object.keys(stats)) {
    stats[cat].pct = totalValue > 0 ? (stats[cat].value / totalValue) * 100 : 0;
  }
  return stats;
};

/** 格式化数值 */
const formatValue = (v: number): string => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  return v.toString();
};

/** 格式化百分比 */
const formatPct = (pct: number): string => `${pct.toFixed(1)}%`;

// ---- SVG 帧渲染 ----

const FlameFrame: React.FC<{
  row: RenderRow;
  rowIndex: number;
  chartWidth: number;
  zoom: number;
  hoveredFrame: FlameGraphFrame | null;
  selectedFrame: FlameGraphFrame | null;
  collapsed: Set<string>;
  isCollapsedAncestor: boolean;
  onEnter: (f: FlameGraphFrame) => void;
  onLeave: () => void;
  onClick: (f: FlameGraphFrame) => void;
}> = ({
  row,
  rowIndex,
  chartWidth,
  zoom,
  hoveredFrame,
  selectedFrame,
  collapsed,
  isCollapsedAncestor,
  onEnter,
  onLeave,
  onClick,
}) => {
  const { frame, depth, x, w } = row;

  const left = x * chartWidth * zoom;
  const width = Math.max(MIN_FRAME_WIDTH, w * chartWidth * zoom);
  const top = rowIndex * (FRAME_HEIGHT + FRAME_GAP);
  const fill = isCollapsedAncestor ? FLAME_COLORS[0] : colorByDepth(depth);
  const textColor = textColorByDepth(depth);

  const isHovered = hoveredFrame === frame;
  const isSelected = selectedFrame === frame;
  const isCollapsed = collapsed.has(frame.name) && frame.children && frame.children.length > 0;

  // 仅当帧足够宽且未被折叠时显示标签
  const showLabel = width >= MIN_LABEL_WIDTH && !isCollapsedAncestor;

  const label = showLabel ? truncateLabel(frame.name, width) : '';

  return (
    <g
      onMouseEnter={() => onEnter(frame)}
      onMouseLeave={onLeave}
      onClick={() => onClick(frame)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <rect
        x={left}
        y={top}
        width={width}
        height={FRAME_HEIGHT}
        fill={fill}
        rx={radius.xs}
        style={{
          stroke: isHovered || isSelected ? '#ffffff' : 'none',
          strokeWidth: isHovered || isSelected ? 2 : 0,
          filter: isHovered ? 'brightness(1.1)' : 'none',
          opacity: isCollapsedAncestor ? 0.5 : 1,
          transition: 'filter 150ms ease, opacity 150ms ease',
        }}
      />
      {label && (
        <text
          x={left + 4}
          y={top + FRAME_HEIGHT / 2 + 3}
          fontSize={10}
          fill={textColor}
          style={{
            userSelect: 'none',
            fontWeight: isSelected ? 600 : 400,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
          clipPath={`url(#clip-${rowIndex})`}
        >
          {label}
        </text>
      )}
      {/* 折叠指示器 */}
      {isCollapsed && width > 10 && (
        <text
          x={left + width - 10}
          y={top + FRAME_HEIGHT / 2 + 3}
          fontSize={9}
          fill={textColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
          textAnchor="end"
        >
          +{frame.children?.length ?? 0}
        </text>
      )}
    </g>
  );
};

/** 截断标签以适应帧宽度 */
const truncateLabel = (name: string, availableWidth: number): string => {
  // 每个字符大约 5.5px (fontSize=10)
  const maxChars = Math.floor((availableWidth - 8) / 5.5);
  if (maxChars <= 0) return '';
  if (name.length <= maxChars) return name;
  // 优先截取最后一个 "." 之前的部分
  const dotIdx = name.lastIndexOf('.', maxChars);
  if (dotIdx > 4) return '…' + name.substring(dotIdx);
  return name.substring(0, maxChars - 1) + '…';
};

// ---- 右侧详情面板 ----

const DetailPanel: React.FC<{
  frame: FlameGraphFrame;
  depth: number;
  totalValue: number;
  allRows: RenderRow[];
  unit: string;
  onClose: () => void;
}> = ({ frame, depth, totalValue, unit, onClose }) => {
  const pct = totalValue > 0 ? (frame.value / totalValue) * 100 : 0;
  const color = colorByDepth(depth);
  const children = frame.children || [];
  const isLeaf = children.length === 0;

  return (
    <Card
      size="small"
      style={{
        boxShadow: shadows.sm,
        borderRadius: radius.lg,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      bodyStyle={{ padding: spacing.md, flex: 1, overflow: 'auto' }}
    >
      {/* 关闭按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Tag
          color={color}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            backgroundColor: color,
            color: textColorByDepth(depth),
            border: 'none',
          }}
        >
          depth {depth}
        </Tag>
        <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={onClose} />
      </div>

      {/* 函数名 */}
      <div style={{ marginTop: spacing.sm }}>
        <Text code style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>
          {frame.name}
        </Text>
      </div>

      {/* 统计 */}
      <div style={{ marginTop: spacing.md }}>
        <Statistic
          title={<Text type="secondary">值 ({unit})</Text>}
          value={formatValue(frame.value)}
          valueStyle={{ fontSize: 22, color: color }}
        />
        <Statistic
          title={<Text type="secondary">占比</Text>}
          value={formatPct(pct)}
          precision={1}
          suffix="%"
          valueStyle={{ fontSize: 22, color: colors.primary[500] }}
        />
      </div>

      {/* 分类 */}
      {frame.category && (
        <div style={{ marginTop: spacing.sm }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            分类
          </Text>
          <Tag style={{ marginLeft: spacing.sm, fontSize: 11 }}>{frame.category}</Tag>
        </div>
      )}

      {/* 是否叶子节点 */}
      <div style={{ marginTop: spacing.sm }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          类型
        </Text>
        <Tag color={isLeaf ? colors.success[500] : colors.info[500]} style={{ marginLeft: spacing.sm, fontSize: 11 }}>
          {isLeaf ? '叶子节点' : '父节点'}
        </Tag>
      </div>

      {/* 子调用栈 */}
      {children.length > 0 && (
        <div style={{ marginTop: spacing.md }}>
          <Text strong style={{ fontSize: 12 }}>
            子调用栈 ({children.length})
          </Text>
          <div style={{ marginTop: spacing.xs, maxHeight: 180, overflow: 'auto' }}>
            {children.map((child, i) => {
              const childPct = frame.value > 0 ? (child.value / frame.value) * 100 : 0;
              const barColor = colorByDepth(depth + 1);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: spacing.xs,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      backgroundColor: barColor,
                      borderRadius: 1,
                      marginRight: spacing.xs,
                      flexShrink: 0,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {child.name}
                  </Text>
                  <Text type="secondary" style={{ marginLeft: spacing.xs }}>
                    {formatValue(child.value)} ({childPct.toFixed(1)}%)
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 调用栈路径 */}
      <div style={{ marginTop: spacing.md }}>
        <Text strong style={{ fontSize: 12 }}>
          调用栈路径
        </Text>
        <div style={{ marginTop: spacing.xs }}>
          <Text
            code
            style={{ fontSize: 10, wordBreak: 'break-all', color: colors.neutral[600] }}
          >
            {frame.name}
          </Text>
        </div>
      </div>
    </Card>
  );
};

// ---- 主组件 ----

const PerformanceFlameGraphPage: React.FC = () => {
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
  const unit = FLAME_GRAPH_UNITS[activeType];
  const description = FLAME_GRAPH_DESCRIPTIONS[activeType];

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
    [collapsed],
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

  const svgWidth = chartWidth * zoom;
  const svgHeight = Math.max(400, effectiveMaxDepth * (FRAME_HEIGHT + FRAME_GAP) + HEADER_HEIGHT + LEGEND_HEIGHT);

  // ---- 缩放 ----

  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1);
    setCollapsed(new Set());
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));
    },
    [],
  );

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
    [flatRows],
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
    [categoryStats],
  );

  // ---- Tab 配置 ----

  const tabItems: { key: FlameGraphType; label: string; count: number }[] = [
    { key: 'cpu', label: 'CPU', count: profiles.cpu?.totalValue ?? 0 },
    { key: 'memory', label: 'Memory', count: profiles.memory?.totalValue ?? 0 },
    { key: 'io', label: 'IO', count: profiles.io?.totalValue ?? 0 },
  ];

  const tabs = tabItems.map((t) => ({
    key: t.key,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
        {t.key === 'cpu' && <FireOutlined />}
        {t.key === 'memory' && <ThunderboltOutlined />}
        {t.key === 'io' && <SwapOutlined />}
        <span>{t.label}</span>
        <Tag style={{ fontSize: 10, padding: '0 4px' }}>
          {formatValue(t.count)}
        </Tag>
      </span>
    ),
  }));

  // ---- 渲染 ----

  if (loading) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FireOutlined style={{ marginRight: spacing.sm, color: FLAME_COLORS[2] }} />
          性能火焰图
        </Title>
        <Text type="secondary">{description}</Text>
        <Card style={{ marginTop: spacing.md, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description={<Text type="secondary">加载火焰图数据中...</Text>} />
        </Card>
      </div>
    );
  }

  if (error && !currentProfile) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FireOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
          性能火焰图
        </Title>
        <Card>
          <Empty description={<Text type="secondary">{error}</Text>}>
            <Button type="primary" onClick={() => loadProfile(activeType)}>重试</Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: spacing.sm }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FireOutlined style={{ marginRight: spacing.sm, color: FLAME_COLORS[2] }} />
          性能火焰图
        </Title>
        <Text type="secondary">{description}</Text>
      </div>

      {/* Tab + 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Tabs
          activeKey={activeType}
          onChange={handleTabChange}
          items={tabs}
          size="small"
          type="card"
          style={{ width: 'auto' }}
        />

        <Space size="small">
          <Tooltip title="缩小">
            <Button size="small" icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          </Tooltip>
          <Text style={{ fontSize: 11, color: colors.neutral[500], width: 48, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Text>
          <Tooltip title="放大">
            <Button size="small" icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Tooltip>
          <Tooltip title="重置缩放 & 展开全部">
            <Button size="small" icon={<ReloadOutlined />} onClick={handleResetZoom} />
          </Tooltip>
        </Space>
      </div>

      {/* 主内容区 */}
      <div style={{ display: 'flex', gap: spacing.md }}>
        {/* 左侧火焰图 */}
        <Card
          style={{
            flex: 1,
            boxShadow: shadows.sm,
            borderRadius: radius.lg,
            overflow: 'hidden',
            minHeight: 500,
          }}
          bodyStyle={{ padding: 0 }}
        >
          {/* 顶部信息栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${spacing.md}`,
              height: HEADER_HEIGHT,
              borderBottom: `1px solid ${colors.light.border.default}`,
              backgroundColor: colors.light.bg.secondary,
              fontSize: 12,
            }}
          >
            <Text strong>
              {FLAME_GRAPH_LABELS[activeType]} Flame Graph
            </Text>
            {currentProfile && (
              <>
                <Text type="secondary" style={{ marginLeft: spacing.md }}>
                  服务: <Text strong>{currentProfile.serviceName}</Text>
                </Text>
                <Text type="secondary" style={{ marginLeft: spacing.md }}>
                  总 {unit}: <Text strong>{formatValue(currentProfile.totalValue)}</Text>
                </Text>
                <Text type="secondary" style={{ marginLeft: spacing.md }}>
                  层数: <Text strong>{effectiveMaxDepth}</Text>
                </Text>
                <Text type="secondary" style={{ marginLeft: spacing.md }}>
                  深度: <Text strong>{maxDepth}</Text>
                </Text>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.neutral[500] }}>
                  滚轮缩放 · 点击展开/收起 · Hover 查看详情
                </span>
              </>
            )}
          </div>

          {/* SVG 火焰图容器 */}
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              overflow: 'auto',
              height: svgHeight - HEADER_HEIGHT - LEGEND_HEIGHT,
              backgroundColor: colors.light.bg.primary,
            }}
            onWheel={handleWheel}
          >
            {currentProfile ? (
              <svg
                ref={svgRef}
                width={svgWidth}
                height={effectiveMaxDepth * (FRAME_HEIGHT + FRAME_GAP)}
                style={{ display: 'block', minWidth: chartWidth }}
              >
                <defs>
                  {/* 每行一个 clipPath，防止标签溢出 */}
                  {flatRows.map((_, i) => (
                    <clipPath key={`clip-${i}`}>
                      <rect x={0} y={0} width={svgWidth} height={FRAME_HEIGHT} />
                    </clipPath>
                  ))}
                </defs>
                {flatRows.map((row, i) => {
                  const underCollapsed = i > 0
                    ? (() => {
                        // 查找上一个深度更小的行作为父节点
                        for (let j = i - 1; j >= 0; j--) {
                          if (flatRows[j].depth < row.depth) {
                            return isNodeCollapsed(flatRows[j].frame);
                          }
                          if (flatRows[j].depth === row.depth) break;
                        }
                        return false;
                      })()
                    : false;

                  return (
                    <FlameFrame
                      key={`frame-${i}`}
                      row={row}
                      rowIndex={i}
                      chartWidth={chartWidth}
                      zoom={zoom}
                      hoveredFrame={hoveredFrame}
                      selectedFrame={selectedFrame}
                      collapsed={collapsed}
                      isCollapsedAncestor={underCollapsed}
                      onEnter={handleFrameEnter}
                      onLeave={handleFrameLeave}
                      onClick={handleFrameClick}
                    />
                  );
                })}
              </svg>
            ) : (
              <div
                style={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Empty description="暂无火焰图数据" />
              </div>
            )}
          </div>

          {/* 底部图例 */}
          {currentProfile && (
            <div
              style={{
                height: LEGEND_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                padding: `0 ${spacing.md}`,
                borderTop: `1px solid ${colors.light.border.default}`,
                backgroundColor: colors.light.bg.secondary,
                fontSize: 11,
                flexWrap: 'wrap',
                gap: spacing.xs,
              }}
            >
              <Text strong style={{ marginRight: spacing.sm }}>图例:</Text>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    backgroundColor: FLAME_COLORS[FLAME_COLORS.length - 1],
                    borderRadius: 1,
                  }}
                />
                <Text type="secondary">高层 (根)</Text>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    backgroundColor: FLAME_COLORS[0],
                    borderRadius: 1,
                  }}
                />
                <Text type="secondary">低层 (叶)</Text>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    backgroundColor: FLAME_COLORS[0],
                    borderRadius: 1,
                    opacity: 0.5,
                    border: '1px dashed #ffffff',
                  }}
                />
                <Text type="secondary">折叠子栈</Text>
              </span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                {sortedCategories.map(([cat, stat]) => (
                  <Tag
                    key={cat}
                    color={cat === 'runtime' ? 'blue' : cat === 'network' ? 'green' : cat === 'database' ? 'orange' : 'default'}
                    style={{ fontSize: 10, padding: '0 6px' }}
                  >
                    {cat} {formatValue(stat.value)} ({stat.pct.toFixed(1)}%)
                  </Tag>
                ))}
              </span>
            </div>
          )}
        </Card>

        {/* 右侧详情面板 */}
        <div style={{ width: DETAIL_PANEL_WIDTH, flexShrink: 0 }}>
          {selectedFrame ? (
            <DetailPanel
              frame={selectedFrame}
              depth={selectedDepth}
              totalValue={currentProfile?.totalValue ?? 0}
              allRows={flatRows}
              unit={unit}
              onClose={() => setSelectedFrame(null)}
            />
          ) : (
            <Card
              size="small"
              style={{
                boxShadow: shadows.sm,
                borderRadius: radius.lg,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              bodyStyle={{
                padding: spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: spacing.sm,
              }}
            >
              <FireOutlined style={{ fontSize: 32, color: FLAME_COLORS[2], opacity: 0.6 }} />
              <Text type="secondary" style={{ fontSize: 13 }}>
                点击火焰图节点查看
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                函数详情 / 调用栈 / 占比分析
              </Text>
              {currentProfile && (
                <div style={{ width: '100%', marginTop: spacing.md, borderTop: `1px solid ${colors.light.border.light}`, paddingTop: spacing.sm }}>
                  <Text strong style={{ fontSize: 12, display: 'block', marginBottom: spacing.xs }}>
                    全局统计
                  </Text>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <Text type="secondary">{unit} 总计</Text>
                    <Text strong>{formatValue(currentProfile.totalValue)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <Text type="secondary">最大深度</Text>
                    <Text strong>{maxDepth}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <Text type="secondary">总层数</Text>
                    <Text strong>{flatRows.length}</Text>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      {currentProfile && (
        <div style={{ marginTop: spacing.md, display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
          {sortedCategories.slice(0, 6).map(([cat, stat]) => {
            const catColor =
              cat === 'runtime'
                ? colors.primary[500]
                : cat === 'network'
                ? colors.info[500]
                : cat === 'database'
                ? colors.warning[500]
                : cat === 'security'
                ? colors.error[500]
                : cat === 'io'
                ? colors.purple[500]
                : colors.neutral[600];
            return (
              <Card
                size="small"
                key={cat}
                style={{ minWidth: 120, boxShadow: shadows.sm, borderLeft: `3px solid ${catColor}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: catColor, fontWeight: 500 }}>{cat}</Text>
                  <Text strong>{formatValue(stat.value)}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {stat.pct.toFixed(1)}% of total
                  </Text>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PerformanceFlameGraphPage;
